import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { InventoryItem, Order } from '../../store/adminStore';
import type { ReconciliationException } from './reconciliationTypes';

export interface InventoryReconcileResult {
  inventoryReconciled: boolean;
  glInventoryBalance: number;
  subledgerInventoryValuation: number;
  variance: number;
  exceptions: ReconciliationException[];
}

export async function reconcileInventory(
  companyId: string,
  periodEnd: string,
  runId: string
): Promise<InventoryReconcileResult> {
  const exceptions: ReconciliationException[] = [];

  // 1. Fetch Inventory Items
  const invQuery = query(collection(db, 'inventory'), where('companyId', '==', companyId));
  const invSnap = await getDocs(invQuery);
  const inventory: InventoryItem[] = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));

  // 2. Fetch Orders (to check COGS on delivered orders)
  const orderQuery = query(collection(db, 'orders'), where('companyId', '==', companyId));
  const orderSnap = await getDocs(orderQuery);
  const orders: Order[] = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));

  // 3. Fetch GL Journal entries up to periodEnd
  const journalQuery = query(collection(db, 'journalEntries'), where('companyId', '==', companyId));
  const journalSnap = await getDocs(journalQuery);
  const allJournals: JournalEntry[] = journalSnap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));

  const endThresholdDate = new Date(periodEnd + 'T23:59:59');

  const journalsUpToPeriodEnd = allJournals.filter(j => {
    let dateVal: Date;
    if (j.createdAt) {
      if (typeof j.createdAt === 'string') {
        dateVal = new Date(j.createdAt);
      } else if (j.createdAt && typeof j.createdAt === 'object' && 'toDate' in j.createdAt) {
        dateVal = (j.createdAt as any).toDate();
      } else if ((j.createdAt as any).seconds) {
        dateVal = new Date((j.createdAt as any).seconds * 1000);
      } else {
        dateVal = new Date(j.createdAt as any);
      }
    } else {
      dateVal = new Date();
    }
    return dateVal <= endThresholdDate;
  });

  const ordersUpToPeriodEnd = orders.filter(o => {
    return new Date(o.createdAt) <= endThresholdDate;
  });

  // Calculate GL Inventory Asset Balance (debits - credits)
  let glInventoryBalance = 0;
  for (const j of journalsUpToPeriodEnd) {
    for (const line of j.lines) {
      if (line.accountId === '1300' || line.account === 'Inventory') {
        glInventoryBalance += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  // Calculate subledger inventory valuation
  const subledgerInventoryValuation = inventory.reduce((sum, item) => {
    const qty = item.quantity || 0;
    const cost = item.unitCost || 0;
    return sum + (qty * cost);
  }, 0);

  // A. Check subledger matches GL inventory control
  const variance = Math.abs(glInventoryBalance - subledgerInventoryValuation);
  if (variance > 0.01) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'inventory',
      severity: 'critical',
      title: 'Inventory Subledger to GL Asset Discrepancy',
      description: `The inventory stock valuation ($${subledgerInventoryValuation.toFixed(2)}) does not match the GL Inventory Asset Account balance ($${glInventoryBalance.toFixed(2)}). Variance: $${variance.toFixed(2)}.`,
      expectedAmount: glInventoryBalance,
      actualAmount: subledgerInventoryValuation,
      varianceAmount: variance,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  // B. Check for negative inventory
  for (const item of inventory) {
    if (item.quantity < 0) {
      exceptions.push({
        companyId,
        reconciliationRunId: runId,
        module: 'inventory',
        severity: 'blocking',
        title: 'Negative Stock Quantity',
        description: `Product "${item.name}" (SKU: ${item.sku}) has a negative quantity of ${item.quantity} on hand. This distorts WAC valuations and must be corrected.`,
        sourceCollection: 'inventory',
        sourceDocumentId: item.id,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  }

  // C. Delivered orders check (must have COGS posting)
  for (const o of ordersUpToPeriodEnd) {
    if (o.status === 'delivered') {
      const hasCogsPosted = o.cogsPosted === true || journalsUpToPeriodEnd.some(j => 
        j.orderId === o.id && (j.sourceType === 'cogs' || j.description.toLowerCase().includes('cogs'))
      );

      if (!hasCogsPosted) {
        exceptions.push({
          companyId,
          reconciliationRunId: runId,
          module: 'cogs',
          severity: 'critical',
          title: 'Delivered Order Missing COGS Posting',
          description: `Order #${o.id.substring(0, 8).toUpperCase()} was delivered, but has no corresponding Cost of Goods Sold (COGS) journal entry recorded in the general ledger.`,
          sourceCollection: 'orders',
          sourceDocumentId: o.id,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  const inventoryReconciled = exceptions.filter(e => e.module === 'inventory' && e.severity === 'critical').length === 0;

  return {
    inventoryReconciled,
    glInventoryBalance: Math.round(glInventoryBalance * 100) / 100,
    subledgerInventoryValuation: Math.round(subledgerInventoryValuation * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    exceptions
  };
}
