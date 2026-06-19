import { collection, addDoc, updateDoc, doc, getDocs, query, where, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { reconcileGL } from './glReconciliationService';
import { reconcileAR } from './arReconciliationService';
import { reconcileAP } from './apReconciliationService';
import { reconcileInventory } from './inventoryReconciliationService';
import { reconcileCash } from './cashReconciliationService';
import { runTaxReadinessReview } from './taxReadinessService';
import { generateAiRunInsights } from './reconciliationAiService';
import type { ReconciliationRun, ReconciliationRunType } from './reconciliationTypes';

export async function createReconciliationRun(
  companyId: string,
  runType: ReconciliationRunType,
  periodStart: string,
  periodEnd: string,
  createdBy: string
): Promise<string> {
  // Input Validation
  if (!companyId || companyId.trim() === '') {
    throw new Error('Validation failed: Missing company context.');
  }
  if (!periodStart || !periodEnd) {
    throw new Error('Validation failed: Start date and End date are required.');
  }
  if (periodStart > periodEnd) {
    throw new Error('Validation failed: Start date must be on or before End date.');
  }
  const todayStr = new Date().toISOString().split('T')[0];
  if (periodEnd > todayStr) {
    throw new Error('Validation failed: Audit end date cannot be in the future.');
  }

  // 1. Create run document in running state
  const runNumber = `REC-${Date.now().toString().substring(6)}`;
  
  const runData: Omit<ReconciliationRun, 'id'> = {
    companyId,
    runNumber,
    runType,
    periodStart,
    periodEnd,
    status: 'running',
    totalChecks: 0,
    passedChecks: 0,
    warningCount: 0,
    criticalCount: 0,
    blockingCount: 0,
    glBalanced: true,
    arReconciled: true,
    apReconciled: true,
    inventoryReconciled: true,
    cashReconciled: true,
    taxReady: true,
    summary: {
      glDebits: 0,
      glCredits: 0,
      arSubledgerTotal: 0,
      apSubledgerTotal: 0,
      inventoryValuation: 0,
      cashReceiptsTotal: 0,
      salesTaxCollected: 0,
      exceptionCount: 0,
      blockingExceptionCount: 0,
      healthScore: 100
    },
    createdBy,
    createdAt: new Date().toISOString()
  };

  const runRef = await addDoc(collection(db, 'reconciliationRuns'), runData);
  const runId = runRef.id;

  try {
    // 2. Run deterministic sub-ledger checks
    const glRes = await reconcileGL(companyId, periodStart, periodEnd, runId);
    const arRes = await reconcileAR(companyId, periodEnd, runId);
    const apRes = await reconcileAP(companyId, periodEnd, runId);
    const invRes = await reconcileInventory(companyId, periodEnd, runId);
    const cashRes = await reconcileCash(companyId, periodEnd, runId);
    
    // Tax year is derived from periodEnd
    const taxYear = new Date(periodEnd).getFullYear();
    const taxRes = await runTaxReadinessReview(companyId, taxYear, runId);

    // 3. Accumulate all exceptions
    const allExceptions = [
      ...glRes.exceptions,
      ...arRes.exceptions,
      ...apRes.exceptions,
      ...invRes.exceptions,
      ...cashRes.exceptions,
      ...taxRes.exceptions
    ];

    // Write all exceptions to Firestore using Batch (up to 500 records)
    const batch = writeBatch(db);
    allExceptions.forEach(e => {
      const docRef = doc(collection(db, 'reconciliationExceptions'));
      batch.set(docRef, e);
    });
    await batch.commit();

    // 4. Calculate stats and health score
    const warningCount = allExceptions.filter(e => e.severity === 'warning').length;
    const criticalCount = allExceptions.filter(e => e.severity === 'critical').length;
    const blockingCount = allExceptions.filter(e => e.severity === 'blocking').length;
    const infoCount = allExceptions.filter(e => e.severity === 'info').length;

    let healthScore = 100;
    healthScore -= (blockingCount * 15);
    healthScore -= (criticalCount * 10);
    healthScore -= (warningCount * 5);
    healthScore -= (infoCount * 2);
    healthScore = Math.max(0, healthScore);

    const totalChecks = 6; // Six core modules
    let passedChecks = 6;
    if (!glRes.glBalanced) passedChecks--;
    if (!arRes.arReconciled) passedChecks--;
    if (!apRes.apReconciled) passedChecks--;
    if (!invRes.inventoryReconciled) passedChecks--;
    if (!cashRes.cashReconciled) passedChecks--;
    if (!taxRes.taxReady) passedChecks--;

    // 5. Update old runs for same period to superseded
    const qOldRuns = query(
      collection(db, 'reconciliationRuns'),
      where('companyId', '==', companyId),
      where('periodStart', '==', periodStart),
      where('periodEnd', '==', periodEnd),
      where('runType', '==', runType)
    );
    const oldRunsSnap = await getDocs(qOldRuns);
    for (const oldDoc of oldRunsSnap.docs) {
      if (oldDoc.id !== runId && oldDoc.data().status !== 'superseded') {
        await updateDoc(doc(db, 'reconciliationRuns', oldDoc.id), {
          status: 'superseded',
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 6. Generate AI insights summary
    const aiInsight = generateAiRunInsights(allExceptions, healthScore);

    // 7. Save finalized run data
    const finalRunData: Partial<ReconciliationRun> = {
      status: 'completed',
      totalChecks,
      passedChecks,
      warningCount,
      criticalCount,
      blockingCount,
      glBalanced: glRes.glBalanced,
      arReconciled: arRes.arReconciled,
      apReconciled: apRes.apReconciled,
      inventoryReconciled: invRes.inventoryReconciled,
      cashReconciled: cashRes.cashReconciled,
      taxReady: taxRes.taxReady,
      summary: {
        glDebits: glRes.totalDebits,
        glCredits: glRes.totalCredits,
        arSubledgerTotal: arRes.subledgerArTotal,
        apSubledgerTotal: apRes.subledgerApTotal,
        inventoryValuation: invRes.subledgerInventoryValuation,
        cashReceiptsTotal: cashRes.subledgerCashTotal,
        salesTaxCollected: taxRes.review?.salesTaxCollected || 0,
        exceptionCount: allExceptions.length,
        blockingExceptionCount: blockingCount,
        healthScore
      },
      aiSummary: aiInsight.summary,
      aiRiskScore: aiInsight.aiRiskScore,
      completedAt: new Date().toISOString()
    };

    // Save tax readiness document if running tax review
    if (runType === 'tax_readiness' && taxRes.review) {
      await addDoc(collection(db, 'taxReadinessReviews'), {
        ...taxRes.review,
        reconciliationRunId: runId
      });
    }

    await updateDoc(doc(db, 'reconciliationRuns', runId), finalRunData);

  } catch (error: any) {
    console.error("Failed executing reconciliation run:", error);
    const msg = error instanceof Error ? error.message : 'Unknown reconciliation failure';
    const failureReason = msg.slice(0, 1000);
    await updateDoc(doc(db, 'reconciliationRuns', runId), {
      status: 'failed',
      failureReason,
      completedAt: new Date().toISOString()
    });
    try {
      error.runId = runId;
    } catch {
      // In case error is read-only
    }
    throw error;
  }

  return runId;
}

export async function approveReconciliationRun(
  runId: string,
  approvedBy: string
): Promise<void> {
  const runRef = doc(db, 'reconciliationRuns', runId);
  const runSnap = await getDoc(runRef);
  if (!runSnap.exists()) {
    throw new Error('Reconciliation run not found.');
  }

  const run = runSnap.data() as ReconciliationRun;
  if (run.blockingCount > 0) {
    throw new Error('Approval blocked: Reconciliation run contains blocking exceptions that must be resolved first.');
  }

  await updateDoc(runRef, {
    status: 'locked',
    approvedBy,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}


