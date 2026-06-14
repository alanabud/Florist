import { collection, doc, setDoc, updateDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type Vendor, type VendorBill, type VendorPayment } from '../store/adminStore';
import { getNextSequenceNumber } from './sequenceService';
import { writeAuditLog } from './auditService';

const VENDORS_COLLECTION = 'vendors';
const BILLS_COLLECTION = 'vendorBills';
const PAYMENTS_COLLECTION = 'vendorPayments';

export const DEFAULT_PAYMENT_TERMS = [
  { label: 'Due on Receipt', days: 0 },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
  { label: 'Net 45', days: 45 },
  { label: 'Net 60', days: 60 },
];

/**
 * Creates a new Vendor with sequential VND-xxxxx ID.
 */
export async function createVendor(
  vendorData: Omit<Vendor, 'id' | 'balance' | 'openBillsCount' | 'createdAt' | 'updatedAt' | 'agingBuckets'>,
  actor: string = 'Admin'
): Promise<Vendor> {
  const sequenceId = await getNextSequenceNumber('vendors');
  const now = new Date().toISOString();
  const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';

  const newVendor: Vendor & { companyId: string } = {
    ...vendorData,
    companyId,
    id: sequenceId,
    balance: 0,
    openBillsCount: 0,
    agingBuckets: {
      current: 0,
      thirtyToSixty: 0,
      sixtyToNinety: 0,
      overNinety: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  const docRef = doc(db, VENDORS_COLLECTION, sequenceId);
  await setDoc(docRef, newVendor);

  await writeAuditLog({
    companyId,
    actor,
    action: 'CREATE_VENDOR',
    entityType: 'vendor',
    entityId: sequenceId,
    before: null,
    after: { name: vendorData.name, email: vendorData.email },
  });

  // Sync to local Zustand store
  useAdminStore.getState().addVendor(newVendor);

  return newVendor;
}

/**
 * Updates an existing vendor's profile.
 */
export async function updateVendor(
  id: string,
  updates: Partial<Omit<Vendor, 'id' | 'balance' | 'openBillsCount' | 'createdAt' | 'updatedAt' | 'agingBuckets'>>,
  actor: string = 'Admin'
): Promise<void> {
  const vendorRef = doc(db, VENDORS_COLLECTION, id);
  const now = new Date().toISOString();

  const cleanUpdates = {
    ...updates,
    updatedAt: now,
  };

  const beforeSnap = await getDoc(vendorRef);
  const beforeData = beforeSnap.exists() ? beforeSnap.data() : null;
  const companyId = beforeData?.companyId || localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';

  await updateDoc(vendorRef, cleanUpdates);

  await writeAuditLog({
    companyId,
    actor,
    action: 'UPDATE_VENDOR',
    entityType: 'vendor',
    entityId: id,
    before: beforeData,
    after: cleanUpdates,
  });

  // Sync to local Zustand store
  useAdminStore.getState().updateVendorDetails(id, cleanUpdates);
}

/**
 * Recalculates vendor balances and aging buckets based on open bills.
 */
export async function recalculateVendorBalances(vendorId: string): Promise<void> {
  const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
  
  const billsQuery = query(
    collection(db, BILLS_COLLECTION),
    where('companyId', '==', companyId),
    where('vendorId', '==', vendorId)
  );
  
  const billsSnap = await getDocs(billsQuery);
  const bills = billsSnap.docs.map(doc => doc.data() as VendorBill);

  let totalBalance = 0;
  let openBillsCount = 0;
  const agingBuckets = {
    current: 0,
    thirtyToSixty: 0,
    sixtyToNinety: 0,
    overNinety: 0,
  };

  const now = new Date();

  // Find all unpaid or partially paid posted bills (voided are excluded)
  const activeBills = bills.filter(b => b.status === 'posted' || b.status === 'partially_paid');

  for (const bill of activeBills) {
    const balance = bill.balanceDue || 0;
    if (balance <= 0) continue;

    totalBalance += balance;
    openBillsCount++;

    const billDate = new Date(bill.billDate);
    const diffTime = Math.abs(now.getTime() - billDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      agingBuckets.current += balance;
    } else if (diffDays <= 60) {
      agingBuckets.thirtyToSixty += balance;
    } else if (diffDays <= 90) {
      agingBuckets.sixtyToNinety += balance;
    } else {
      agingBuckets.overNinety += balance;
    }
  }

  // Get last payment date
  const paymentsQuery = query(
    collection(db, PAYMENTS_COLLECTION),
    where('companyId', '==', companyId),
    where('vendorId', '==', vendorId),
    where('status', '==', 'posted')
  );
  const paymentsSnap = await getDocs(paymentsQuery);
  const payments = paymentsSnap.docs.map(doc => doc.data() as VendorPayment);
  
  let lastPaymentDate = '';
  if (payments.length > 0) {
    // Sort descending by paymentDate
    payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    lastPaymentDate = payments[0].paymentDate;
  }

  // Update Vendor in Firestore
  const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
  const updates: Partial<Vendor> = {
    balance: Math.round(totalBalance * 100) / 100,
    openBillsCount,
    agingBuckets,
    updatedAt: now.toISOString(),
  };
  if (lastPaymentDate) {
    updates.lastPaymentDate = lastPaymentDate;
  }

  await updateDoc(vendorRef, updates);

  // Sync to local Zustand store
  useAdminStore.getState().updateVendorDetails(vendorId, updates);
}
