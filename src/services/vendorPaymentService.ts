import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type VendorPayment, type VendorBill } from '../store/adminStore';
import { getNextSequenceNumber } from './sequenceService';
import { writeAuditLog } from './auditService';
import { postJournalEntry, type JournalLine, type JournalEntry, reverseJournalEntry } from './financeService';
import { recalculateVendorBalances } from './vendorService';

const PAYMENTS_COLLECTION = 'vendorPayments';
const BILLS_COLLECTION = 'vendorBills';

/**
 * Creates and posts a Vendor Payment.
 * Updates bill balances, posts GL entries (with prepayment support), and recalculates vendor balances.
 */
export async function createVendorPayment(
  paymentData: Omit<VendorPayment, 'id' | 'paymentNumber' | 'status' | 'glPostingStatus' | 'createdAt'>,
  options?: { drawFromPrepayments?: boolean },
  actor: string = 'Admin'
): Promise<VendorPayment> {
  const sequenceId = await getNextSequenceNumber('vendorPayments');
  const now = new Date().toISOString();

  const isPrepaymentApplication = !!options?.drawFromPrepayments;

  const newPayment: VendorPayment = {
    ...paymentData,
    id: sequenceId,
    paymentNumber: sequenceId,
    status: 'posted',
    glPostingStatus: 'posted',
    createdAt: now,
  };

  // 1. Update each allocated bill's balanceDue and status in Firestore
  for (const alloc of paymentData.allocations) {
    const billRef = doc(db, BILLS_COLLECTION, alloc.billId);
    const billSnap = await getDoc(billRef);
    if (billSnap.exists()) {
      const bill = billSnap.data() as VendorBill;
      const newBalance = Math.max(0, Math.round((bill.balanceDue - alloc.amountApplied) * 100) / 100);
      const newStatus: VendorBill['status'] = newBalance === 0 ? 'paid' : 'partially_paid';

      const billUpdates = {
        balanceDue: newBalance,
        status: newStatus,
        updatedAt: now,
      };

      await updateDoc(billRef, billUpdates);
      
      // Update local store
      useAdminStore.getState().updateVendorBillDetails(alloc.billId, billUpdates);
    }
  }

  // 2. Post Double-Entry Journal to GL
  const glLines: JournalLine[] = [];
  const totalApplied = paymentData.allocations.reduce((sum, a) => sum + a.amountApplied, 0);

  if (isPrepaymentApplication) {
    // Flow 2: Apply prepayment to vendor bill
    // Debit 2000 Accounts Payable (reducing AP)
    // Credit 1400 Vendor Prepayments / Deposits (reducing prepayments asset)
    if (totalApplied > 0) {
      glLines.push({
        account: 'Accounts Payable',
        accountId: '',
        accountName: 'Accounts Payable',
        debit: Math.round(totalApplied * 100) / 100,
        credit: 0,
      });

      glLines.push({
        account: 'Vendor Prepayments / Deposits',
        accountId: '',
        accountName: 'Vendor Prepayments / Deposits',
        debit: 0,
        credit: Math.round(totalApplied * 100) / 100,
      });
    }
  } else {
    // Normal payment (can include overpayments generating new prepayments)
    // Debit 2000 Accounts Payable (for amount applied to bills)
    if (totalApplied > 0) {
      glLines.push({
        account: 'Accounts Payable',
        accountId: '',
        accountName: 'Accounts Payable',
        debit: Math.round(totalApplied * 100) / 100,
        credit: 0,
      });
    }

    // Debit 1400 Vendor Prepayments / Deposits (for overpayment / unapplied amount)
    if (paymentData.unappliedAmount > 0) {
      glLines.push({
        account: 'Vendor Prepayments / Deposits',
        accountId: '',
        accountName: 'Vendor Prepayments / Deposits',
        debit: Math.round(paymentData.unappliedAmount * 100) / 100,
        credit: 0,
      });
    }

    // Credit 1010 Cash / Bank (for the payment amount)
    if (paymentData.amount > 0) {
      glLines.push({
        account: 'Cash',
        accountId: '',
        accountName: 'Cash',
        debit: 0,
        credit: Math.round(paymentData.amount * 100) / 100,
      });
    }
  }

  let jeId = '';
  if (glLines.length > 0) {
    const journalEntry: JournalEntry = {
      orderId: 'VENDOR_AP_PAYMENT',
      companyId: 'DEFAULT_COMPANY',
      createdBy: actor,
      description: isPrepaymentApplication
        ? `Applied prepayment of $${totalApplied.toFixed(2)} to bills for ${paymentData.vendorName}`
        : `Payment ${sequenceId} to ${paymentData.vendorName}`,
      lines: glLines,
      sourceType: 'vendor_payment',
      sourceId: sequenceId,
      sourceLabel: `Payment #${sequenceId}`,
    };
    jeId = await postJournalEntry(journalEntry);
  }

  newPayment.journalEntryId = jeId || undefined;

  // Save the Payment document
  const paymentRef = doc(db, PAYMENTS_COLLECTION, sequenceId);
  await setDoc(paymentRef, newPayment);

  // 3. Recalculate Vendor Balance and Aging
  await recalculateVendorBalances(paymentData.vendorId);

  await writeAuditLog({
    actor,
    action: 'CREATE_VENDOR_PAYMENT',
    entityType: 'vendor_payment',
    entityId: sequenceId,
    before: null,
    after: { amount: paymentData.amount, vendorName: paymentData.vendorName, journalEntryId: jeId },
  });

  // Sync to local store
  useAdminStore.getState().addVendorPayment(newPayment);

  return newPayment;
}

/**
 * Voids a posted Vendor Payment.
 * Restores bill balances, reverses GL entry, and updates vendor balances.
 */
export async function voidVendorPayment(id: string, actor: string = 'Admin'): Promise<void> {
  const paymentRef = doc(db, PAYMENTS_COLLECTION, id);
  const paymentSnap = await getDoc(paymentRef);
  if (!paymentSnap.exists()) {
    throw new Error(`Vendor Payment ${id} not found.`);
  }

  const payment = paymentSnap.data() as VendorPayment;
  if (payment.status !== 'posted') {
    throw new Error(`Only posted payments can be voided.`);
  }

  const now = new Date().toISOString();

  // 1. Reverse GL entry
  let revJeId = '';
  if (payment.journalEntryId) {
    revJeId = await reverseJournalEntry(payment.journalEntryId, actor);
  }

  // 2. Restore allocated bill balances
  for (const alloc of payment.allocations) {
    const billRef = doc(db, BILLS_COLLECTION, alloc.billId);
    const billSnap = await getDoc(billRef);
    if (billSnap.exists()) {
      const bill = billSnap.data() as VendorBill;
      const restoredBalance = Math.round((bill.balanceDue + alloc.amountApplied) * 100) / 100;
      const restoredStatus: VendorBill['status'] = restoredBalance === bill.totalAmount ? 'posted' : 'partially_paid';

      const billUpdates = {
        balanceDue: restoredBalance,
        status: restoredStatus,
        updatedAt: now,
      };

      await updateDoc(billRef, billUpdates);

      // Sync local store
      useAdminStore.getState().updateVendorBillDetails(alloc.billId, billUpdates);
    }
  }

  // 3. Mark payment as voided
  const paymentUpdates: Partial<VendorPayment> = {
    status: 'voided',
    glPostingStatus: 'reversed',
    reversalJournalEntryId: revJeId,
    updatedAt: now,
  };

  await updateDoc(paymentRef, paymentUpdates);
  
  // Sync local store
  useAdminStore.getState().updateVendorPaymentDetails(id, paymentUpdates);

  // 4. Recalculate Vendor Balance and Aging
  await recalculateVendorBalances(payment.vendorId);

  await writeAuditLog({
    actor,
    action: 'VOID_VENDOR_PAYMENT',
    entityType: 'vendor_payment',
    entityId: id,
    before: { status: payment.status },
    after: { status: 'voided', reversalJournalEntryId: revJeId },
  });
}
