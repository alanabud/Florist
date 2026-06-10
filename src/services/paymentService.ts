import { db } from '../firebase/config';
import { 
  collection, doc, addDoc, getDocs, query, where, 
  runTransaction
} from 'firebase/firestore';
import { validatePayment } from './validators';
import { CHART_OF_ACCOUNTS } from './chartOfAccounts';
import type { PaymentRecord, PaymentAllocation, Order, Customer } from '../store/adminStore';

/**
 * Returns an array of allocations mapping the payment amount to the oldest unpaid orders first.
 */
export async function autoAllocatePaymentOldestFirst(
  customerId: string,
  amount: number
): Promise<PaymentAllocation[]> {
  // 1. Fetch all orders for this customer
  const q = query(
    collection(db, 'orders'),
    where('customerId', '==', customerId)
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // Filter out orders that have balanceDue <= 0 or status in draft/cancelled/refunded,
  // and require that the order has been posted to GL.
  const unpaidOrders = orders
    .filter((o: any) => {
      const balanceDue = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
      return (
        balanceDue > 0 && 
        o.status !== 'draft' && 
        o.status !== 'cancelled' && 
        o.status !== 'refunded' &&
        o.glPostingStatus === 'posted'
      );
    })
    .sort((a, b) => new Date(a.createdAt || a.deliveryDate).getTime() - new Date(b.createdAt || b.deliveryDate).getTime());

  let remainingPayment = amount;
  const allocations: PaymentAllocation[] = [];

  for (const order of unpaidOrders) {
    if (remainingPayment <= 0) break;

    const balanceDue = order.balanceDue !== undefined ? order.balanceDue : (order.total - (order.amountPaid || 0));
    const amountApplied = Math.min(remainingPayment, balanceDue);
    const roundedApplied = Math.round(amountApplied * 100) / 100;

    if (roundedApplied > 0) {
      allocations.push({
        orderId: order.id,
        orderNumber: order.orderNumber || order.id.substring(0, 8).toUpperCase(),
        originalBalance: balanceDue,
        amountApplied: roundedApplied,
        remainingBalance: Math.max(0, Math.round((balanceDue - roundedApplied) * 100) / 100)
      });
      remainingPayment = Math.round((remainingPayment - roundedApplied) * 100) / 100;
    }
  }

  return allocations;
}

/**
 * Create a new Payment record in Draft state.
 */
export async function createPaymentDraft(
  paymentData: Omit<PaymentRecord, 'id' | 'paymentNumber' | 'status' | 'glPostingStatus' | 'createdAt' | 'updatedAt' | 'unappliedAmount'> & { id?: string }
): Promise<string> {
  const paymentRef = collection(db, 'payments');
  
  // Generate a random payment number
  const rand = Math.floor(100000 + Math.random() * 900000);
  const paymentNumber = `PMT-${rand}`;

  // Calculate allocation total
  const allocationTotal = (paymentData.allocations || []).reduce((sum, a) => sum + a.amountApplied, 0);
  const unappliedAmount = Math.max(0, Math.round((paymentData.amount - allocationTotal) * 100) / 100);

  const docData = {
    ...paymentData,
    paymentNumber,
    status: 'draft',
    glPostingStatus: 'unposted',
    unappliedAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const docRef = await addDoc(paymentRef, docData);
  return docRef.id;
}

/**
 * Post a payment to the general ledger, updating order and customer balances atomically.
 */
export async function postPaymentToLedger(
  paymentId: string,
  actor: string = 'Admin'
): Promise<string> {
  // Load COA first
  let coa: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'chartOfAccounts'));
    coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not load COA for payment posting enrichment:", e);
  }
  if (!coa || coa.length === 0) {
    coa = CHART_OF_ACCOUNTS;
  }

  return await runTransaction(db, async (transaction) => {
    // 1. Fetch payment
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error(`Payment ${paymentId} not found`);
    }
    const payment = paymentSnap.data() as PaymentRecord;

    // Idempotency check
    if (payment.glPostingStatus === 'posted') {
      throw new Error('Payment is already posted');
    }

    // 2. Fetch customer
    const customerRef = doc(db, 'customers', payment.customerId);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Customer ${payment.customerId} not found`);
    }
    const customer = customerSnap.data() as Customer;

    // 3. Fetch all orders referenced in allocations to perform full validation
    const orders: any[] = [];
    for (const alloc of payment.allocations) {
      const orderRef = doc(db, 'orders', alloc.orderId);
      const orderSnap = await transaction.get(orderRef);
      if (orderSnap.exists()) {
        orders.push({ id: orderSnap.id, ...orderSnap.data() });
      }
    }

    // 4. Validate payment
    const validation = validatePayment(payment, orders);
    if (Object.keys(validation.errors).length > 0) {
      throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
    }

    // 5. Update orders
    const allocationTotal = payment.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
    const unappliedAmount = Math.max(0, Math.round((payment.amount - allocationTotal) * 100) / 100);

    for (const alloc of payment.allocations) {
      const orderRef = doc(db, 'orders', alloc.orderId);
      const matchedOrder = orders.find(o => o.id === alloc.orderId);
      
      const currentPaid = matchedOrder.amountPaid || 0;
      const newPaid = Math.round((currentPaid + alloc.amountApplied) * 100) / 100;
      const originalBalance = matchedOrder.balanceDue !== undefined ? matchedOrder.balanceDue : (matchedOrder.total - currentPaid);
      const newBalance = Math.max(0, Math.round((originalBalance - alloc.amountApplied) * 100) / 100);
      
      const paymentStatus = newBalance === 0 ? 'paid' : 'partial';

      transaction.update(orderRef, {
        amountPaid: newPaid,
        balanceDue: newBalance,
        paymentStatus,
        updatedAt: new Date().toISOString()
      });
    }

    // 6. Update customer AR and credit balances
    const currentAr = customer.arBalance || 0;
    const currentCredit = customer.creditBalance || 0;

    const newAr = Math.max(0, Math.round((currentAr - allocationTotal) * 100) / 100);
    const newCredit = Math.round((currentCredit + unappliedAmount) * 100) / 100;

    transaction.update(customerRef, {
      arBalance: newAr,
      creditBalance: newCredit,
      lastPaymentDate: payment.paymentDate,
      lastUpdated: new Date().toISOString()
    });

    // 7. Create GL Journal Entry doc
    const journalRef = doc(collection(db, 'journalEntries'));
    const jeId = journalRef.id;

    // Build journal lines
    const lines: any[] = [];
    
    // Debit Cash (1010)
    lines.push({
      account: 'Cash',
      debit: payment.amount,
      credit: 0,
      accountId: coa.find(a => a.code === '1010')?.id || '',
      accountName: 'Cash'
    });

    // Credit Accounts Receivable (1200)
    if (allocationTotal > 0) {
      lines.push({
        account: 'Accounts Receivable',
        debit: 0,
        credit: allocationTotal,
        accountId: coa.find(a => a.code === '1200')?.id || '',
        accountName: 'Accounts Receivable'
      });
    }

    // Credit Customer Credits/Deposits (2200)
    if (unappliedAmount > 0) {
      lines.push({
        account: 'Customer Credits / Customer Deposits',
        debit: 0,
        credit: unappliedAmount,
        accountId: coa.find(a => a.code === '2200')?.id || '',
        accountName: 'Customer Credits / Customer Deposits'
      });
    }

    const shortId = payment.paymentNumber || paymentId.substring(0, 8).toUpperCase();
    
    const journalEntry = {
      orderId: paymentId,
      companyId: 'DEFAULT_COMPANY',
      createdBy: actor,
      description: `Payment Receipt #${shortId} for Customer ${customer.name}`,
      lines,
      sourceType: 'payment',
      sourceId: paymentId,
      sourceLabel: `Payment #${shortId}`,
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedBy: actor,
      createdAt: new Date().toISOString()
    };

    transaction.set(journalRef, journalEntry);

    // 8. Update payment status to posted
    transaction.update(paymentRef, {
      status: 'posted',
      glPostingStatus: 'posted',
      journalEntryId: jeId,
      unappliedAmount,
      updatedAt: new Date().toISOString()
    });

    // 9. Write audit log
    const auditRef = doc(collection(db, 'auditLogs'));
    transaction.set(auditRef, {
      actor,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: jeId,
      before: { glPostingStatus: 'unposted' },
      after: { glPostingStatus: 'posted', paymentId, journalEntryId: jeId },
      journalEntryId: jeId,
      timestamp: new Date().toISOString()
    });

    return jeId;
  });
}

/**
 * Void a posted payment, generating reversing journal entries and restoring balances.
 */
export async function voidPostedPayment(
  paymentId: string,
  actor: string = 'Admin'
): Promise<string> {
  // Load COA first
  let coa: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'chartOfAccounts'));
    coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not load COA for payment voiding enrichment:", e);
  }
  if (!coa || coa.length === 0) {
    coa = CHART_OF_ACCOUNTS;
  }

  return await runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error(`Payment ${paymentId} not found`);
    }
    const payment = paymentSnap.data() as PaymentRecord;

    // Idempotency check
    if (payment.glPostingStatus === 'reversed') {
      throw new Error('Payment has already been reversed');
    }
    if (payment.glPostingStatus !== 'posted') {
      throw new Error('Only posted payments can be voided');
    }

    const customerRef = doc(db, 'customers', payment.customerId);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Customer ${payment.customerId} not found`);
    }
    const customer = customerSnap.data() as Customer;

    // 1. Restore order balances
    const allocationTotal = payment.allocations.reduce((sum, a) => sum + a.amountApplied, 0);
    const unappliedAmount = payment.unappliedAmount || 0;

    for (const alloc of payment.allocations) {
      const orderRef = doc(db, 'orders', alloc.orderId);
      const orderSnap = await transaction.get(orderRef);
      if (orderSnap.exists()) {
        const order = orderSnap.data() as Order;
        const currentPaid = order.amountPaid || 0;
        const newPaid = Math.max(0, Math.round((currentPaid - alloc.amountApplied) * 100) / 100);
        const originalBalance = order.balanceDue !== undefined ? order.balanceDue : (order.total - currentPaid);
        const newBalance = Math.round((originalBalance + alloc.amountApplied) * 100) / 100;
        
        const paymentStatus = newPaid <= 0 ? 'unpaid' : 'partial';

        transaction.update(orderRef, {
          amountPaid: newPaid,
          balanceDue: newBalance,
          paymentStatus,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 2. Update customer AR and credit balances
    const currentAr = customer.arBalance || 0;
    const currentCredit = customer.creditBalance || 0;

    const newAr = Math.round((currentAr + allocationTotal) * 100) / 100;
    const newCredit = Math.max(0, Math.round((currentCredit - unappliedAmount) * 100) / 100);

    transaction.update(customerRef, {
      arBalance: newAr,
      creditBalance: newCredit,
      lastUpdated: new Date().toISOString()
    });

    // 3. Create reversing Journal Entry
    const revJournalRef = doc(collection(db, 'journalEntries'));
    const revJeId = revJournalRef.id;

    const reversedLines: any[] = [];
    
    // Credit Cash (1010)
    reversedLines.push({
      account: 'Cash',
      debit: 0,
      credit: payment.amount,
      accountId: coa.find(a => a.code === '1010')?.id || '',
      accountName: 'Cash'
    });

    // Debit Accounts Receivable (1200)
    if (allocationTotal > 0) {
      reversedLines.push({
        account: 'Accounts Receivable',
        debit: allocationTotal,
        credit: 0,
        accountId: coa.find(a => a.code === '1200')?.id || '',
        accountName: 'Accounts Receivable'
      });
    }

    // Debit Customer Deposits (2200)
    if (unappliedAmount > 0) {
      reversedLines.push({
        account: 'Customer Credits / Customer Deposits',
        debit: unappliedAmount,
        credit: 0,
        accountId: coa.find(a => a.code === '2200')?.id || '',
        accountName: 'Customer Credits / Customer Deposits'
      });
    }

    const shortId = payment.paymentNumber || paymentId.substring(0, 8).toUpperCase();

    const reversingEntry = {
      orderId: paymentId,
      companyId: 'DEFAULT_COMPANY',
      createdBy: actor,
      description: `Void/Reversal of Payment Receipt #${shortId}`,
      lines: reversedLines,
      sourceType: 'payment_reversal',
      sourceId: paymentId,
      sourceLabel: `Reversal #${shortId}`,
      status: 'posted',
      reversalOf: payment.journalEntryId || '',
      postedAt: new Date().toISOString(),
      postedBy: actor,
      createdAt: new Date().toISOString()
    };

    transaction.set(revJournalRef, reversingEntry);

    // Mark the original journal entry as reversed
    if (payment.journalEntryId) {
      const origJeRef = doc(db, 'journalEntries', payment.journalEntryId);
      transaction.update(origJeRef, {
        status: 'reversed',
        reversedBy: actor,
        reversedAt: new Date().toISOString()
      });
    }

    // 4. Update payment status to voided/reversed
    transaction.update(paymentRef, {
      status: 'voided',
      glPostingStatus: 'reversed',
      reversalJournalEntryId: revJeId,
      updatedAt: new Date().toISOString()
    });

    // 5. Write audit log
    const auditRef = doc(collection(db, 'auditLogs'));
    transaction.set(auditRef, {
      actor,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: revJeId,
      before: { status: 'posted', glPostingStatus: 'posted' },
      after: { status: 'reversed', glPostingStatus: 'reversed', paymentId, reversalJournalEntryId: revJeId },
      journalEntryId: revJeId,
      timestamp: new Date().toISOString()
    });

    return revJeId;
  });
}

/**
 * Refund a posted payment's unapplied customer credits back to Cash/Bank.
 */
export async function refundPayment(
  paymentId: string,
  refundAmount: number,
  actor: string = 'Admin'
): Promise<string> {
  // Load COA first
  let coa: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'chartOfAccounts'));
    coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not load COA for payment refund enrichment:", e);
  }
  if (!coa || coa.length === 0) {
    coa = CHART_OF_ACCOUNTS;
  }

  return await runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error(`Payment ${paymentId} not found`);
    }
    const payment = paymentSnap.data() as PaymentRecord;

    if (payment.glPostingStatus !== 'posted') {
      throw new Error('Only posted payments can be refunded');
    }

    if (payment.status === 'voided') {
      throw new Error('Voided payments cannot be refunded');
    }

    const customerRef = doc(db, 'customers', payment.customerId);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists()) {
      throw new Error(`Customer ${payment.customerId} not found`);
    }
    const customer = customerSnap.data() as Customer;

    const unapplied = payment.unappliedAmount || 0;
    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }
    if (refundAmount > unapplied + 0.01) {
      throw new Error(`Refund amount ($${refundAmount.toFixed(2)}) cannot exceed payment unapplied amount ($${unapplied.toFixed(2)})`);
    }

    const currentCredit = customer.creditBalance || 0;
    if (refundAmount > currentCredit + 0.01) {
      throw new Error(`Refund amount ($${refundAmount.toFixed(2)}) cannot exceed customer credit balance ($${currentCredit.toFixed(2)})`);
    }

    // 1. Reduce customer creditBalance
    const newCredit = Math.max(0, Math.round((currentCredit - refundAmount) * 100) / 100);
    transaction.update(customerRef, {
      creditBalance: newCredit,
      lastUpdated: new Date().toISOString()
    });

    // 2. Reduce payment unappliedAmount
    const newUnapplied = Math.max(0, Math.round((unapplied - refundAmount) * 100) / 100);
    
    // Mark payment status as 'refunded' if all unapplied credit is returned
    const status = newUnapplied === 0 ? 'refunded' : payment.status;

    // Generate refund journal ID first to include in the sub-record
    const refundJournalRef = doc(collection(db, 'journalEntries'));
    const refundJeId = refundJournalRef.id;

    const refunds = (payment as any).refunds || [];
    const updatedRefunds = [
      ...refunds,
      {
        refundAmount,
        refundDate: new Date().toISOString(),
        journalEntryId: refundJeId,
        actor
      }
    ];

    transaction.update(paymentRef, {
      unappliedAmount: newUnapplied,
      status,
      refunds: updatedRefunds,
      updatedAt: new Date().toISOString()
    });

    // 3. Create Refund Journal Entry: Debit 2200 (Liability), Credit 1010 (Cash Asset)
    const lines: any[] = [];
    
    // Debit Customer Deposits (2200)
    lines.push({
      account: 'Customer Credits / Customer Deposits',
      debit: refundAmount,
      credit: 0,
      accountId: coa.find(a => a.code === '2200')?.id || '',
      accountName: 'Customer Credits / Customer Deposits'
    });

    // Credit Cash (1010)
    lines.push({
      account: 'Cash',
      debit: 0,
      credit: refundAmount,
      accountId: coa.find(a => a.code === '1010')?.id || '',
      accountName: 'Cash'
    });

    const shortId = payment.paymentNumber || paymentId.substring(0, 8).toUpperCase();

    const refundEntry = {
      orderId: paymentId,
      companyId: 'DEFAULT_COMPANY',
      createdBy: actor,
      description: `Refund of Unapplied Credit from Payment #${shortId}`,
      lines,
      sourceType: 'refund',
      sourceId: paymentId,
      sourceLabel: `Refund #${shortId}`,
      status: 'posted',
      postedAt: new Date().toISOString(),
      postedBy: actor,
      createdAt: new Date().toISOString()
    };

    transaction.set(refundJournalRef, refundEntry);

    // 4. Write audit log
    const auditRef = doc(collection(db, 'auditLogs'));
    transaction.set(auditRef, {
      actor,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: refundJeId,
      before: { creditBalance: currentCredit },
      after: { creditBalance: newCredit, paymentId, refundJournalEntryId: refundJeId, refundAmount },
      journalEntryId: refundJeId,
      timestamp: new Date().toISOString()
    });

    return refundJeId;
  });
}
