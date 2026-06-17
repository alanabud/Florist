import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { Vendor, VendorBill, InventoryReceipt } from '../../store/adminStore';
import type { ReconciliationException } from './reconciliationTypes';

export interface APReconcileResult {
  apReconciled: boolean;
  glApBalance: number;
  subledgerApTotal: number;
  variance: number;
  exceptions: ReconciliationException[];
}

export async function reconcileAP(
  companyId: string,
  periodEnd: string,
  runId: string
): Promise<APReconcileResult> {
  const exceptions: ReconciliationException[] = [];

  // 1. Fetch Vendors
  const vendorQuery = query(collection(db, 'vendors'), where('companyId', '==', companyId));
  const vendorSnap = await getDocs(vendorQuery);
  const vendors: Vendor[] = vendorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor));

  // 2. Fetch Vendor Bills
  const billQuery = query(collection(db, 'vendorBills'), where('companyId', '==', companyId));
  const billSnap = await getDocs(billQuery);
  const bills: VendorBill[] = billSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorBill));



  // 4. Fetch Receipts
  const receiptQuery = query(collection(db, 'inventoryReceipts'), where('companyId', '==', companyId));
  const receiptSnap = await getDocs(receiptQuery);
  const receipts: InventoryReceipt[] = receiptSnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryReceipt));

  // 5. Fetch GL Journal entries up to periodEnd
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

  const billsUpToPeriodEnd = bills.filter(b => {
    return new Date(b.billDate || b.createdAt) <= endThresholdDate;
  });

  const receiptsUpToPeriodEnd = receipts.filter(r => {
    return new Date(r.receiptDate || r.createdAt) <= endThresholdDate;
  });

  // Calculate GL Accounts Payable balance (AP is credit normal: credits - debits)
  let glApBalance = 0;
  for (const j of journalsUpToPeriodEnd) {
    for (const line of j.lines) {
      if (line.accountId === '2000' || line.account === 'Accounts Payable') {
        glApBalance += (line.credit || 0) - (line.debit || 0);
      }
    }
  }

  // Calculate subledger AP total
  const subledgerApTotal = vendors.reduce((sum, v) => sum + (v.balance || 0), 0);

  // A. Check subledger matches GL AP control
  const variance = Math.abs(glApBalance - subledgerApTotal);
  if (variance > 0.01) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'ap',
      severity: 'critical',
      title: 'AP Subledger to GL Control Discrepancy',
      description: `The Accounts Payable subledger total ($${subledgerApTotal.toFixed(2)}) does not match the GL AP Control Account balance ($${glApBalance.toFixed(2)}). Variance: $${variance.toFixed(2)}.`,
      expectedAmount: glApBalance,
      actualAmount: subledgerApTotal,
      varianceAmount: variance,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  // B. Check vendor balances match their open bills
  for (const v of vendors) {
    const vBills = billsUpToPeriodEnd.filter(b => b.vendorId === v.id && b.status !== 'voided');
    const computedUnpaidBills = vBills.reduce((sum, b) => sum + (b.balanceDue !== undefined ? b.balanceDue : (b.totalAmount - (b.subtotal || 0))), 0);
    const vVariance = Math.abs(v.balance - computedUnpaidBills);

    if (vVariance > 0.05) {
      exceptions.push({
        companyId,
        reconciliationRunId: runId,
        module: 'ap',
        severity: 'warning',
        title: `Vendor Balance Discrepancy: ${v.name}`,
        description: `Vendor "${v.name}" (ID: ${v.id}) has a subledger balance of $${v.balance.toFixed(2)}, but their outstanding bills sum to $${computedUnpaidBills.toFixed(2)}. Variance: $${vVariance.toFixed(2)}.`,
        expectedAmount: computedUnpaidBills,
        actualAmount: v.balance,
        varianceAmount: vVariance,
        sourceCollection: 'vendors',
        sourceDocumentId: v.id,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  }

  // C. Received inventory without matched vendor bills (Accrued Liabilities / GRNI verification)
  // Check if any receipt doesn't have an associated posted vendor bill, and check if it's accrued.
  for (const rec of receiptsUpToPeriodEnd) {
    const matchedBill = billsUpToPeriodEnd.find(b => b.receiptId === rec.id || b.poId === rec.poId);
    if (!matchedBill) {
      // Inventory received but not yet billed. This should create an accrued purchases liability (GRNI).
      // We check if there is an Accrued Purchases (2050) entry in journals.
      const hasAccrual = journalsUpToPeriodEnd.some(j => 
        j.sourceId === rec.id && 
        j.lines.some(l => l.accountId === '2050' || l.account === 'Accrued Purchases / GRNI')
      );

      if (!hasAccrual) {
        exceptions.push({
          companyId,
          reconciliationRunId: runId,
          module: 'ap',
          severity: 'warning',
          title: 'Unbilled Receipt without GRNI Accrual',
          description: `Inventory Receipt #${rec.id.substring(0, 8).toUpperCase()} from Vendor "${rec.vendorName}" has no matching vendor bill and is missing a corresponding GRNI Accrual posting in the general ledger.`,
          sourceCollection: 'inventoryReceipts',
          sourceDocumentId: rec.id,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  const apReconciled = exceptions.filter(e => e.module === 'ap' && e.severity === 'critical').length === 0;

  return {
    apReconciled,
    glApBalance: Math.round(glApBalance * 100) / 100,
    subledgerApTotal: Math.round(subledgerApTotal * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    exceptions
  };
}
