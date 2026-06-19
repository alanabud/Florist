import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { ReconciliationRun, ReconciliationException, ReconciliationAdjustment, TaxReadinessReview } from './reconciliationTypes';
import type { ClosedPeriod } from './periodCloseService';

export interface AuditEvidencePacket {
  id?: string;
  companyId: string;
  runId: string;
  periodEndDate: string;
  generatedBy: string;
  generatedAt: string;
  runSnapshot: ReconciliationRun;
  exceptionsSnapshot: ReconciliationException[];
  adjustmentsSnapshot: ReconciliationAdjustment[];
  journalEntriesSnapshot: Array<{ id: string; description: string; lines: any[]; sourceType: string; createdAt: any }>;
  taxReadinessSnapshot: TaxReadinessReview | null;
  aiSummarySnapshot: string;
  closeStatusSnapshot: ClosedPeriod | null;
  exportVersion: string;
  immutable: true;
}

/**
 * Generates an immutable audit evidence packet capturing the complete state
 * of a reconciliation run, its exceptions, adjustments, related journal entries,
 * tax readiness review, and period close status.
 * 
 * This packet serves as the authoritative compliance record for month-end,
 * tax readiness, and accountant review workflows.
 */
export async function generateAuditEvidencePacket(
  runId: string,
  generatedBy: string
): Promise<string> {
  // 1. Fetch the reconciliation run
  const runRef = doc(db, 'reconciliationRuns', runId);
  const runSnap = await getDoc(runRef);
  if (!runSnap.exists()) {
    throw new Error('Reconciliation run not found.');
  }
  const run = { id: runSnap.id, ...runSnap.data() } as ReconciliationRun;

  // 2. Fetch exceptions for this run
  const excQuery = query(
    collection(db, 'reconciliationExceptions'),
    where('reconciliationRunId', '==', runId)
  );
  const excSnap = await getDocs(excQuery);
  const exceptions: ReconciliationException[] = excSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReconciliationException));

  // 3. Fetch adjustments for this run
  const adjQuery = query(
    collection(db, 'reconciliationAdjustments'),
    where('reconciliationRunId', '==', runId)
  );
  const adjSnap = await getDocs(adjQuery);
  const adjustments: ReconciliationAdjustment[] = adjSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReconciliationAdjustment));

  // 4. Fetch related journal entries (from adjustments that were posted)
  const postedJournalIds = adjustments
    .filter(a => a.postedJournalId)
    .map(a => a.postedJournalId!);
  
  const journalEntries: Array<{ id: string; description: string; lines: any[]; sourceType: string; createdAt: any }> = [];
  for (const jeId of postedJournalIds) {
    try {
      const jeRef = doc(db, 'journalEntries', jeId);
      const jeSnap = await getDoc(jeRef);
      if (jeSnap.exists()) {
        const data = jeSnap.data();
        journalEntries.push({
          id: jeSnap.id,
          description: data.description || '',
          lines: data.lines || [],
          sourceType: data.sourceType || '',
          createdAt: data.createdAt
        });
      }
    } catch (err) {
      console.warn(`Failed to fetch journal entry ${jeId}:`, err);
    }
  }

  // 5. Fetch tax readiness review if exists
  let taxReadiness: TaxReadinessReview | null = null;
  try {
    const taxQuery = query(
      collection(db, 'taxReadinessReviews'),
      where('reconciliationRunId', '==', runId)
    );
    const taxSnap = await getDocs(taxQuery);
    if (!taxSnap.empty) {
      taxReadiness = { id: taxSnap.docs[0].id, ...taxSnap.docs[0].data() } as TaxReadinessReview;
    }
  } catch (err) {
    console.warn('Failed to fetch tax readiness review:', err);
  }

  // 6. Fetch period close status
  let closeStatus: ClosedPeriod | null = null;
  try {
    const closeQuery = query(
      collection(db, 'closedPeriods'),
      where('companyId', '==', run.companyId),
      where('approvedRunId', '==', runId)
    );
    const closeSnap = await getDocs(closeQuery);
    if (!closeSnap.empty) {
      closeStatus = { id: closeSnap.docs[0].id, ...closeSnap.docs[0].data() } as ClosedPeriod;
    }
  } catch (err) {
    console.warn('Failed to fetch closed period status:', err);
  }

  // 7. Build and persist the immutable packet
  const now = new Date().toISOString();
  const packet: Omit<AuditEvidencePacket, 'id'> = {
    companyId: run.companyId,
    runId,
    periodEndDate: run.periodEnd,
    generatedBy,
    generatedAt: now,
    runSnapshot: run,
    exceptionsSnapshot: exceptions,
    adjustmentsSnapshot: adjustments,
    journalEntriesSnapshot: journalEntries,
    taxReadinessSnapshot: taxReadiness,
    aiSummarySnapshot: run.aiSummary || '',
    closeStatusSnapshot: closeStatus,
    exportVersion: 'v2.1.0',
    immutable: true
  };

  const docRef = await addDoc(collection(db, 'auditEvidencePackets'), packet);
  return docRef.id;
}

/**
 * Fetches all audit evidence packets for a company.
 */
export async function getAuditEvidencePackets(
  companyId: string
): Promise<AuditEvidencePacket[]> {
  try {
    const q = query(
      collection(db, 'auditEvidencePackets'),
      where('companyId', '==', companyId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEvidencePacket));
  } catch (err) {
    console.error('Failed to fetch audit evidence packets:', err);
    return [];
  }
}
