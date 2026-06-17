import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { AccountDefinition } from '../chartOfAccounts';
import type { ReconciliationException } from './reconciliationTypes';

export interface GLReconcileResult {
  glBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  exceptions: ReconciliationException[];
}

export async function reconcileGL(
  companyId: string,
  periodStart: string,
  periodEnd: string,
  runId: string
): Promise<GLReconcileResult> {
  const exceptions: ReconciliationException[] = [];
  
  // 1. Fetch Chart of Accounts
  const coaQuery = query(collection(db, 'chartOfAccounts'), where('companyId', '==', companyId));
  const coaSnap = await getDocs(coaQuery);
  const coaList: AccountDefinition[] = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountDefinition));
  
  // 2. Fetch Journal Entries
  const journalQuery = query(collection(db, 'journalEntries'), where('companyId', '==', companyId));
  const journalSnap = await getDocs(journalQuery);
  const allJournals: JournalEntry[] = journalSnap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));

  // Parse strings to Dates
  const startDate = new Date(periodStart + 'T00:00:00');
  const endDate = new Date(periodEnd + 'T23:59:59');

  const periodJournals = allJournals.filter(j => {
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
    return dateVal >= startDate && dateVal <= endDate;
  });

  // 3. Fetch Company Closed Period Date
  let closedPeriodDateStr: string | null = null;
  try {
    const settingsSnap = await getDoc(doc(db, 'companies', companyId, 'settings', 'profile'));
    if (settingsSnap.exists()) {
      closedPeriodDateStr = settingsSnap.data().closedPeriodDate || null;
    }
  } catch (e) {
    console.warn("Failed to retrieve closed period settings", e);
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const j of periodJournals) {
    const shortJeId = j.id ? j.id.substring(0, 8).toUpperCase() : 'UNKNOWN';
    let jeDebits = 0;
    let jeCredits = 0;

    // A. Verify debits and credits on lines
    for (const line of j.lines) {
      jeDebits += line.debit || 0;
      jeCredits += line.credit || 0;
      totalDebits += line.debit || 0;
      totalCredits += line.credit || 0;

      // Verify Chart of Account mapping
      if (coaList.length > 0) {
        const matchingAcct = coaList.find(a => a.id === line.accountId || a.name === line.account || a.code === line.account);
        if (!matchingAcct) {
          exceptions.push({
            companyId,
            reconciliationRunId: runId,
            module: 'gl',
            severity: 'critical',
            title: 'Orphan Journal Line',
            description: `Journal Entry #${shortJeId} contains a line referencing an unrecognized account: "${line.account}" (ID: ${line.accountId || 'none'}).`,
            sourceCollection: 'journalEntries',
            sourceDocumentId: j.id,
            status: 'open',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // B. Check balance matching
    if (Math.abs(jeDebits - jeCredits) > 0.001) {
      exceptions.push({
        companyId,
        reconciliationRunId: runId,
        module: 'gl',
        severity: 'blocking',
        title: 'Unbalanced Journal Entry',
        description: `Journal Entry #${shortJeId} is unbalanced. Debits equal $${jeDebits.toFixed(2)} and Credits equal $${jeCredits.toFixed(2)} (Variance of $${Math.abs(jeDebits - jeCredits).toFixed(2)}).`,
        expectedAmount: jeDebits,
        actualAmount: jeCredits,
        varianceAmount: Math.abs(jeDebits - jeCredits),
        sourceCollection: 'journalEntries',
        sourceDocumentId: j.id,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }

    // C. Check postings in closed periods
    if (closedPeriodDateStr) {
      const closedThreshold = new Date(closedPeriodDateStr + 'T23:59:59');
      let jDate: Date;
      if (typeof j.createdAt === 'string') {
        jDate = new Date(j.createdAt);
      } else if (j.createdAt && typeof j.createdAt === 'object' && 'toDate' in j.createdAt) {
        jDate = (j.createdAt as any).toDate();
      } else if (j.createdAt && (j.createdAt as any).seconds) {
        jDate = new Date((j.createdAt as any).seconds * 1000);
      } else {
        jDate = new Date();
      }

      if (jDate <= closedThreshold) {
        exceptions.push({
          companyId,
          reconciliationRunId: runId,
          module: 'gl',
          severity: 'blocking',
          title: 'Closed Period Posting',
          description: `Journal Entry #${shortJeId} was posted on ${jDate.toISOString().split('T')[0]}, which falls in a closed accounting period (closed through ${closedPeriodDateStr}).`,
          sourceCollection: 'journalEntries',
          sourceDocumentId: j.id,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // D. Trial Balance Balance Check
  const tbVariance = Math.abs(totalDebits - totalCredits);
  if (tbVariance > 0.01) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'gl',
      severity: 'blocking',
      title: 'Trial Balance Out of Balance',
      description: `The overall Trial Balance for the period is out of balance. Total debits are $${totalDebits.toFixed(2)} and total credits are $${totalCredits.toFixed(2)} (Variance of $${tbVariance.toFixed(2)}).`,
      expectedAmount: totalDebits,
      actualAmount: totalCredits,
      varianceAmount: tbVariance,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  const glBalanced = exceptions.filter(e => e.module === 'gl' && e.severity === 'blocking').length === 0;

  return {
    glBalanced,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    exceptions
  };
}
