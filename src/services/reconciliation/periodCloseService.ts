import { collection, addDoc, getDocs, query, where, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export interface ClosedPeriod {
  id?: string;
  companyId: string;
  periodEndDate: string; // ISO YYYY-MM-DD
  approvedRunId: string;
  closedBy: string;
  closedAt: string;
  status: 'closed';
  source: 'reconciliation';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Closes a financial period. Idempotent — will not create duplicate locks
 * for the same companyId + periodEndDate combination.
 * 
 * Prerequisites:
 * - The reconciliation run must be in 'locked' (approved) status
 * - No existing closed period for the same date
 */
export async function closePeriod(
  companyId: string,
  periodEndDate: string,
  approvedRunId: string,
  closedBy: string,
  notes: string = ''
): Promise<string> {
  // 1. Verify the reconciliation run is approved (locked)
  const runRef = doc(db, 'reconciliationRuns', approvedRunId);
  const runSnap = await getDoc(runRef);
  if (!runSnap.exists()) {
    throw new Error('Reconciliation run not found.');
  }
  const runData = runSnap.data();
  if (runData.status !== 'locked') {
    throw new Error(`Cannot close period: Reconciliation run must be approved (locked) first. Current status: "${runData.status}".`);
  }
  if (runData.blockingCount > 0) {
    throw new Error('Cannot close period: Reconciliation run has unresolved blocking exceptions.');
  }

  // 2. Idempotency check — don't create duplicate period locks
  const existingQuery = query(
    collection(db, 'closedPeriods'),
    where('companyId', '==', companyId),
    where('periodEndDate', '==', periodEndDate),
    where('status', '==', 'closed')
  );
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    // Already closed — return existing document ID (idempotent)
    return existingSnap.docs[0].id;
  }

  // 3. Create the closedPeriods document
  const now = new Date().toISOString();
  const closedPeriod: Omit<ClosedPeriod, 'id'> = {
    companyId,
    periodEndDate,
    approvedRunId,
    closedBy,
    closedAt: now,
    status: 'closed',
    source: 'reconciliation',
    notes,
    createdAt: now,
    updatedAt: now
  };

  const docRef = await addDoc(collection(db, 'closedPeriods'), closedPeriod);

  // 4. Update company settings closedPeriodDate
  try {
    const settingsRef = doc(db, 'companies', companyId, 'settings', 'profile');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const currentClosedDate = settingsSnap.data().closedPeriodDate;
      // Only update if the new date is later than the current closed date
      if (!currentClosedDate || periodEndDate > currentClosedDate) {
        await updateDoc(settingsRef, {
          closedPeriodDate: periodEndDate,
          updatedAt: now
        });
      }
    }
  } catch (err) {
    console.warn('Failed to update company closedPeriodDate setting (non-blocking):', err);
  }

  return docRef.id;
}

/**
 * Fetches all closed periods for a company, ordered by periodEndDate descending.
 */
export async function getClosedPeriods(companyId: string): Promise<ClosedPeriod[]> {
  try {
    const q = query(
      collection(db, 'closedPeriods'),
      where('companyId', '==', companyId),
      orderBy('periodEndDate', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClosedPeriod));
  } catch (err) {
    console.error('Failed to fetch closed periods:', err);
    return [];
  }
}

/**
 * Checks if a given date falls within a closed period for a company.
 */
export async function isDateInClosedPeriod(
  companyId: string,
  dateToCheck: string
): Promise<boolean> {
  const periods = await getClosedPeriods(companyId);
  return periods.some(p => dateToCheck <= p.periodEndDate);
}
