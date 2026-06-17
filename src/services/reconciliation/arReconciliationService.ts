import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { Customer, Order } from '../../store/adminStore';
import type { ReconciliationException } from './reconciliationTypes';

export interface ARReconcileResult {
  arReconciled: boolean;
  glArBalance: number;
  subledgerArTotal: number;
  variance: number;
  exceptions: ReconciliationException[];
}

export async function reconcileAR(
  companyId: string,
  periodEnd: string,
  runId: string
): Promise<ARReconcileResult> {
  const exceptions: ReconciliationException[] = [];

  // 1. Fetch Customers
  const customerQuery = query(collection(db, 'customers'), where('companyId', '==', companyId));
  const customerSnap = await getDocs(customerQuery);
  const customers: Customer[] = customerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));

  // 2. Fetch Orders (Invoices)
  const orderQuery = query(collection(db, 'orders'), where('companyId', '==', companyId));
  const orderSnap = await getDocs(orderQuery);
  const allOrders: Order[] = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));



  // 4. Fetch Journal Entries for GL AR Control (all-time up to periodEnd)
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

  const ordersUpToPeriodEnd = allOrders.filter(o => {
    return new Date(o.createdAt) <= endThresholdDate;
  });

  // Calculate GL Accounts Receivable Balance (debits - credits)
  let glArBalance = 0;
  for (const j of journalsUpToPeriodEnd) {
    for (const line of j.lines) {
      if (line.accountId === '1200' || line.account === 'Accounts Receivable') {
        glArBalance += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  // Calculate Subledger AR Total from customer fields
  const subledgerArTotal = customers.reduce((sum, c) => {
    const bal = c.openBalance !== undefined ? c.openBalance : (c.arBalance || 0);
    return sum + bal;
  }, 0);

  // Checks:
  // A. Subledger total matches GL AR control
  const variance = Math.abs(glArBalance - subledgerArTotal);
  if (variance > 0.01) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'ar',
      severity: 'critical',
      title: 'AR Subledger to GL Control Discrepancy',
      description: `The Accounts Receivable subledger total ($${subledgerArTotal.toFixed(2)}) does not match the GL AR Control Account balance ($${glArBalance.toFixed(2)}). Variance: $${variance.toFixed(2)}.`,
      expectedAmount: glArBalance,
      actualAmount: subledgerArTotal,
      varianceAmount: variance,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  // B. Match customer balances with open orders
  for (const c of customers) {
    const customerBal = c.openBalance !== undefined ? c.openBalance : (c.arBalance || 0);
    
    // Sum open orders for this customer
    const cOrders = ordersUpToPeriodEnd.filter(o => o.customerId === c.id && o.status !== 'cancelled' && o.status !== 'refunded');
    const computedOrdersBal = cOrders.reduce((sum, o) => {
      const balDue = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
      return sum + Math.max(0, balDue);
    }, 0);

    const cVariance = Math.abs(customerBal - computedOrdersBal);
    if (cVariance > 0.05) {
      exceptions.push({
        companyId,
        reconciliationRunId: runId,
        module: 'ar',
        severity: 'warning',
        title: `Customer Statement Balance Mismatch: ${c.name}`,
        description: `Customer "${c.name}" (ID: ${c.id}) has a subledger balance of $${customerBal.toFixed(2)}, but their outstanding orders sum to $${computedOrdersBal.toFixed(2)}. Variance: $${cVariance.toFixed(2)}.`,
        expectedAmount: computedOrdersBal,
        actualAmount: customerBal,
        varianceAmount: cVariance,
        sourceCollection: 'customers',
        sourceDocumentId: c.id,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  }

  // C. Paid orders check (balanceDue must be zero)
  for (const o of ordersUpToPeriodEnd) {
    const balDue = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
    if (o.status === 'delivered' && o.paymentStatus === 'paid' && balDue > 0.01) {
      exceptions.push({
        companyId,
        reconciliationRunId: runId,
        module: 'ar',
        severity: 'warning',
        title: `Paid Order with Outstanding Balance`,
        description: `Order #${o.id.substring(0, 8).toUpperCase()} is marked as "delivered" and "paid", but has a remaining balance due of $${balDue.toFixed(2)}.`,
        expectedAmount: 0,
        actualAmount: balDue,
        varianceAmount: balDue,
        sourceCollection: 'orders',
        sourceDocumentId: o.id,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
  }

  const arReconciled = exceptions.filter(e => e.module === 'ar' && e.severity === 'critical').length === 0;

  return {
    arReconciled,
    glArBalance: Math.round(glArBalance * 100) / 100,
    subledgerArTotal: Math.round(subledgerArTotal * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    exceptions
  };
}
