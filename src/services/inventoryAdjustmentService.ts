import { 
  collection, doc, runTransaction, getDocs, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore } from '../store/adminStore';
import { CHART_OF_ACCOUNTS } from './chartOfAccounts';
import { verifyPeriodNotClosed, type JournalLine, type JournalEntry } from './financeService';
import { writeAuditLog } from './auditService';

export interface InventoryAdjustmentInput {
  sku: string;
  qtyChange: number; // Negative for loss, positive for found stock
  type: 'spoilage' | 'shrinkage' | 'damage' | 'write_off' | 'correction';
  reason: string;
  actor: string;
}

export async function postInventoryAdjustment({
  sku,
  qtyChange,
  type,
  reason,
  actor
}: InventoryAdjustmentInput): Promise<string> {
  if (qtyChange === 0) {
    throw new Error("Quantity change cannot be zero.");
  }

  const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';

  // 1. Fetch the inventory item first to get its reference and current WAC
  const q = query(collection(db, 'inventory'), where('companyId', '==', companyId), where('sku', '==', sku));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error(`Inventory item with SKU ${sku} not found.`);
  }

  const itemDoc = snap.docs[0];
  const itemData = itemDoc.data();
  const itemId = itemDoc.id;
  const currentQty = itemData.quantity || 0;
  const unitCost = itemData.unitCost || 0;
  const totalCost = Math.round(Math.abs(qtyChange) * unitCost * 100) / 100;

  // 2. Closed period check
  await verifyPeriodNotClosed(new Date(), companyId);

  const newQty = currentQty + qtyChange;
  if (newQty < 0) {
    throw new Error(`Adjustment of ${qtyChange} would result in negative stock (${newQty}) for SKU ${sku}.`);
  }

  const jeId = await runTransaction(db, async (transaction) => {
    // Re-verify quantity within transaction to avoid race conditions
    const itemRef = doc(db, 'inventory', itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) {
      throw new Error(`Inventory item ${itemId} not found inside transaction.`);
    }
    const freshData = itemSnap.data();
    const freshQty = freshData.quantity || 0;
    const freshNewQty = freshQty + qtyChange;
    if (freshNewQty < 0) {
      throw new Error(`Adjustment would result in negative stock inside transaction.`);
    }

    // A. Update inventory quantity
    transaction.update(itemRef, {
      quantity: freshNewQty,
      updatedAt: new Date().toISOString(),
      updatedBy: actor
    });

    // B. Write Inventory Transaction log
    const txRef = doc(collection(db, 'inventoryTransactions'));
    const newTx = {
      type: 'manual_adjustment',
      companyId,
      itemId,
      sku,
      quantityIn: qtyChange > 0 ? qtyChange : 0,
      quantityOut: qtyChange < 0 ? Math.abs(qtyChange) : 0,
      unitCost,
      location: 'Main Warehouse',
      sourceReference: `ADJ-${Date.now().toString(36).toUpperCase()}`,
      notes: `Adjustment type: ${type}. Reason: ${reason}`,
      createdAt: new Date().toISOString(),
      createdBy: actor
    };
    transaction.set(txRef, newTx);

    // C. Post Journal Entry (if cost is > 0)
    if (totalCost > 0) {
      const journalRef = doc(collection(db, 'journalEntries'));
      
      let lines: JournalLine[];
      if (qtyChange < 0) {
        // Negative Adjustment: Debit Spoilage & Shrinkage Expense (5500), Credit Inventory (1300)
        lines = [
          { account: 'Spoilage & Shrinkage Expense', debit: totalCost, credit: 0, accountId: '5500', accountName: 'Spoilage & Shrinkage Expense' },
          { account: 'Inventory', debit: 0, credit: totalCost, accountId: '1300', accountName: 'Inventory' }
        ];
      } else {
        // Positive Adjustment: Debit Inventory (1300), Credit Spoilage & Shrinkage Expense (5500)
        lines = [
          { account: 'Inventory', debit: totalCost, credit: 0, accountId: '1300', accountName: 'Inventory' },
          { account: 'Spoilage & Shrinkage Expense', debit: 0, credit: totalCost, accountId: '5500', accountName: 'Spoilage & Shrinkage Expense' }
        ];
      }

      // Enrich account lines with correct code from CHART_OF_ACCOUNTS fallback
      const enrichedLines = lines.map(line => {
        const coaItem = CHART_OF_ACCOUNTS.find(a => a.name === line.account || a.code === line.accountId);
        return {
          ...line,
          accountId: coaItem?.code || line.accountId || '',
          accountName: coaItem?.name || line.account
        };
      });

      const je: JournalEntry = {
        orderId: `ADJ-${itemId}-${Date.now().toString(36)}`,
        companyId,
        createdBy: actor,
        description: `Inventory manual adjustment (${type}) for SKU ${sku}. Reason: ${reason}`,
        lines: enrichedLines,
        sourceType: 'inventory_adjustment',
        sourceId: itemId,
        sourceLabel: `Adj SKU ${sku}`,
        status: 'posted',
        postedAt: serverTimestamp(),
        postedBy: actor,
        createdAt: serverTimestamp()
      };

      transaction.set(journalRef, je);
      return journalRef.id;
    }

    return '';
  });

  // 3. Write Audit Log
  await writeAuditLog({
    companyId,
    actor,
    action: 'RESTOCK_INVENTORY', // matching inventory changes
    entityType: 'inventory',
    entityId: sku,
    before: { quantity: currentQty },
    after: { quantity: newQty },
    journalEntryId: jeId || undefined
  });

  // 4. Update local admin store state
  const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', companyId)));
  const updatedInv = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() }));
  useAdminStore.setState({ inventory: updatedInv as any });

  return jeId;
}
