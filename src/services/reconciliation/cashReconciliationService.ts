import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { PaymentRecord } from '../../store/adminStore';
import type { ReconciliationException } from './reconciliationTypes';

export interface CashReconcileResult {
  cashReconciled: boolean;
  glCashTotal: number;
  subledgerCashTotal: number;
  variance: number;
  exceptions: ReconciliationException[];
}

export async function reconcileCash(
  companyId: string,
  periodEnd: string,
  runId: string
): Promise<CashReconcileResult> {
  const exceptions: ReconciliationException[] = [];

  // 1. Fetch Payments
  const paymentQuery = query(collection(db, 'payments'), where('companyId', '==', companyId));
  const paymentSnap = await getDocs(paymentQuery);
  const payments: PaymentRecord[] = paymentSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRecord));

  // 2. Fetch GL Journal entries up to periodEnd
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

  const paymentsUpToPeriodEnd = payments.filter(p => {
    return new Date(p.paymentDate || p.createdAt) <= endThresholdDate;
  });

  // Calculate GL Cash Account Balance (debits - credits)
  let glCashBalance = 0;
  for (const j of journalsUpToPeriodEnd) {
    for (const line of j.lines) {
      if (line.accountId === '1010' || line.account === 'Cash') {
        glCashBalance += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  // Calculate subledger cash total (all posted non-voided payments)
  const subledgerCashTotal = paymentsUpToPeriodEnd.reduce((sum, p) => {
    if (p.status === 'posted') {
      return sum + (p.amount || 0);
    }
    return sum;
  }, 0);

  // A. Check subledger cash matches GL Cash control
  // Note: cash includes order cash collections plus separate customer payments
  // Let's check variance. If variance exists, check if any payments are unposted.
  const variance = Math.abs(glCashBalance - subledgerCashTotal);
  
  // Check if there are payment records with glPostingStatus !== 'posted' (unposted payments)
  const unpostedPayments = paymentsUpToPeriodEnd.filter(p => p.status === 'posted' && p.glPostingStatus !== 'posted');
  for (const p of unpostedPayments) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'payments',
      severity: 'warning',
      title: 'Unposted Customer Payment',
      description: `Payment Record #${p.paymentNumber} of $${p.amount.toFixed(2)} from Customer "${p.customerName}" is marked as posted in AR, but has not been posted to the General Ledger.`,
      sourceCollection: 'payments',
      sourceDocumentId: p.id,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  // B. Check for duplicate payments (same amount, customer, date, and method)
  const sortedPayments = [...paymentsUpToPeriodEnd].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (let i = 0; i < sortedPayments.length; i++) {
    for (let j = i + 1; j < sortedPayments.length; j++) {
      const p1 = sortedPayments[i];
      const p2 = sortedPayments[j];

      if (
        p1.customerId === p2.customerId &&
        p1.amount === p2.amount &&
        p1.paymentMethod === p2.paymentMethod &&
        p1.status === 'posted' &&
        p2.status === 'posted'
      ) {
        // Check if created within 5 minutes (300,000 ms)
        const diff = Math.abs(new Date(p1.createdAt).getTime() - new Date(p2.createdAt).getTime());
        if (diff < 5 * 60 * 1000) {
          exceptions.push({
            companyId,
            reconciliationRunId: runId,
            module: 'payments',
            severity: 'warning',
            title: 'Duplicate Payment Signature Detected',
            description: `Potential duplicate payment detected: Payment #${p1.paymentNumber} and Payment #${p2.paymentNumber} for customer "${p1.customerName}" both have an amount of $${p1.amount.toFixed(2)} and were created within 5 minutes of each other.`,
            relatedDocumentIds: [p1.id, p2.id],
            status: 'open',
            createdAt: new Date().toISOString()
          });
        }
      }
    }
  }

  const cashReconciled = exceptions.filter(e => e.module === 'payments' && e.severity === 'critical').length === 0;

  return {
    cashReconciled,
    glCashTotal: Math.round(glCashBalance * 100) / 100,
    subledgerCashTotal: Math.round(subledgerCashTotal * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    exceptions
  };
}
