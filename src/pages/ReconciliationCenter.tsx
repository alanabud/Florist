import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useCompany, isValidCompanyId } from '../context/CompanyContext';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  orderBy, addDoc, getDoc, runTransaction 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { 
  ReconciliationRun, ReconciliationException, ReconciliationAdjustment, 
  ReconciliationRunType 
} from '../services/reconciliation/reconciliationTypes';
import { 
  createReconciliationRun, approveReconciliationRun 
} from '../services/reconciliation/reconciliationService';
import { 
  exportReconciliationPDF, exportReconciliationExcel 
} from '../services/reconciliation/reconciliationReportService';
import { closePeriod, getClosedPeriods, type ClosedPeriod } from '../services/reconciliation/periodCloseService';
import { generateAuditEvidencePacket } from '../services/reconciliation/auditEvidenceService';
import { ReconciliationRunList } from '../components/reconciliation/ReconciliationRunList';
import { ReconciliationExceptionTable } from '../components/reconciliation/ReconciliationExceptionTable';
import { ReconciliationExceptionDrawer } from '../components/reconciliation/ReconciliationExceptionDrawer';
import { ReconciliationAiSummaryPanel } from '../components/reconciliation/ReconciliationAiSummaryPanel';
import { CloseReadinessChecklist } from '../components/reconciliation/CloseReadinessChecklist';
import { TaxReadinessPanel } from '../components/reconciliation/TaxReadinessPanel';
import { AlertCircle, Scale, Lock, FileArchive, Check, X, Clock, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export const ReconciliationCenter: React.FC = () => {
  const { t, formatCurrency } = useI18n();
  const { selectedCompanyId, selectedCompany, memberships } = useCompany();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  // Role gating
  const currentMember = memberships.find(m => m.companyId === selectedCompanyId);
  const userRole = currentMember?.role || 'viewer';
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole);
  const canSubmitAdjustments = ['owner', 'admin', 'accountant'].includes(userRole);

  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [exceptions, setExceptions] = useState<ReconciliationException[]>([]);
  const [adjustments, setAdjustments] = useState<ReconciliationAdjustment[]>([]);
  const [closedPeriodsList, setClosedPeriodsList] = useState<ClosedPeriod[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'exceptions' | 'approvals' | 'checklist' | 'close' | 'tax'>('overview');
  
  const [loading, setLoading] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [selectedCloseRunId, setSelectedCloseRunId] = useState<string | null>(null);
  const [selectedException, setSelectedException] = useState<ReconciliationException | null>(null);

  // New run form state
  const [newRunType, setNewRunType] = useState<ReconciliationRunType>('month_end');
  const [newStart, setNewStart] = useState('2026-06-01');
  const [newEnd, setNewEnd] = useState('2026-06-30');

  const selectedRun = runs.find(r => r.id === selectedRunId) || null;
  const todayStr = new Date().toISOString().split('T')[0];
  const isDatesValid = Boolean(newStart && newEnd && newStart <= newEnd && newEnd <= todayStr);
  const isStartScanEnabled = Boolean(isValidCompanyId(selectedCompanyId) && newRunType && isDatesValid);

  const fetchRuns = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reconciliationRuns'),
        where('companyId', '==', selectedCompanyId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const runList: ReconciliationRun[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReconciliationRun));
      setRuns(runList);

      if (runList.length > 0 && !selectedRunId) {
        setSelectedRunId(runList[0].id || null);
      }
    } catch (e) {
      console.error(e);
      addToast(t('reconciliation.toast.fetchFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchExceptions = async () => {
    if (!selectedRunId) {
      setExceptions([]);
      return;
    }
    try {
      const q = query(
        collection(db, 'reconciliationExceptions'),
        where('reconciliationRunId', '==', selectedRunId)
      );
      const snap = await getDocs(q);
      const excList: ReconciliationException[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReconciliationException));
      setExceptions(excList);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAdjustments = async () => {
    if (!selectedRunId) {
      setAdjustments([]);
      return;
    }
    try {
      const q = query(
        collection(db, 'reconciliationAdjustments'),
        where('reconciliationRunId', '==', selectedRunId)
      );
      const snap = await getDocs(q);
      const adjList: ReconciliationAdjustment[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReconciliationAdjustment));
      setAdjustments(adjList);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClosedPeriods = async () => {
    if (!selectedCompanyId) return;
    try {
      const periods = await getClosedPeriods(selectedCompanyId);
      setClosedPeriodsList(periods);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchClosedPeriods();
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchExceptions();
    fetchAdjustments();
  }, [selectedRunId]);

  const handleTriggerRun = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[ReconciliationCenter Dev Diagnostic] Start Scan Triggered", {
      authUid: user?.uid,
      userRole: userRole,
      memberships,
      selectedCompany,
      selectedCompanyId,
      newRunType,
      newStart,
      newEnd
    });

    if (!selectedCompanyId) {
      console.error('Missing company context for reconciliation run', {
        user,
        selectedCompany,
        selectedCompanyId,
        memberships
      });
      addToast('No company context selected.', 'error');
      return;
    }

    // Date range validation
    if (!newStart || !newEnd) {
      addToast('Start date and End date are required.', 'error');
      return;
    }
    if (newStart > newEnd) {
      addToast('Start date must be on or before End date.', 'error');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (newEnd > todayStr) {
      addToast('Audit end date cannot be in the future.', 'error');
      return;
    }

    setLoading(true);
    let runId: string | null = null;
    try {
      addToast(t('reconciliation.toast.triggering') || 'Triggering new audit run...', 'info');
      const actorName = user?.displayName || user?.email || 'System';
      runId = await createReconciliationRun(
        selectedCompanyId,
        newRunType,
        newStart,
        newEnd,
        actorName
      );
      addToast(t('reconciliation.toast.completed') || 'Audit run completed successfully.', 'success');
      setShowRunModal(false);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || t('reconciliation.toast.failed') || 'Failed to trigger audit run.', 'error');
      if (err.runId) {
        runId = err.runId;
      }
    } finally {
      await fetchRuns();
      if (runId) {
        setSelectedRunId(runId);
      }
      setLoading(false);
    }
  };

  const handleApproveRun = async (runId: string) => {
    try {
      const actorName = user?.displayName || user?.email || 'System';
      await approveReconciliationRun(runId, actorName);
      addToast(t('reconciliation.toast.approved'), 'success');
      await fetchRuns();
    } catch (err: any) {
      addToast(err.message || t('reconciliation.toast.approveFailed'), 'error');
    }
  };

  const handleUpdateExceptionStatus = async (
    id: string,
    status: 'resolved' | 'ignored',
    note: string
  ) => {
    try {
      const docRef = doc(db, 'reconciliationExceptions', id);
      const actorName = user?.displayName || user?.email || 'System';
      await updateDoc(docRef, {
        status,
        resolutionNote: note,
        resolvedBy: actorName,
        resolvedAt: new Date().toISOString()
      });
      addToast(status === 'resolved' ? t('reconciliation.status.resolved') : t('reconciliation.status.ignored'), 'success');
      await fetchExceptions();
    } catch (e) {
      console.error(e);
      addToast(t('reconciliation.toast.updateFailed'), 'error');
    }
  };

  // ─── APPROVAL CHAIN HANDLERS ───

  /**
   * Step 1: Submit adjustment for approval.
   * Creates the adjustment doc as 'pending_approval' with full audit trail.
   * Available to: owner, admin, accountant.
   */
  const handleSubmitForApproval = async (adj: ReconciliationAdjustment) => {
    if (!selectedCompanyId || !canSubmitAdjustments) return;
    try {
      const actorName = user?.displayName || user?.email || 'System';
      const now = new Date().toISOString();

      await addDoc(collection(db, 'reconciliationAdjustments'), {
        ...adj,
        companyId: selectedCompanyId,
        status: 'pending_approval',
        sourceRunId: adj.reconciliationRunId,
        submittedBy: actorName,
        submittedAt: now,
        createdBy: actorName,
        createdAt: now
      });

      addToast(t('reconciliation.toast.submittedForApproval') || 'Adjustment submitted for approval.', 'success');
      await fetchAdjustments();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || t('reconciliation.toast.submitFailed') || 'Failed to submit adjustment.', 'error');
    }
  };

  /**
   * Approve and Post an adjustment atomically to the General Ledger.
   * Available to: owner, admin, accountant roles.
   */
  const handleApproveAndPostAdjustment = async (adjId: string, notes: string) => {
    if (!selectedCompanyId || !isOwnerOrAdmin) {
      addToast('Not authorized to approve adjustments.', 'error');
      return;
    }
    try {
      const actorName = user?.displayName || user?.email || 'System';
      const now = new Date().toISOString();

      await runTransaction(db, async (transaction: any) => {
        const adjRef = doc(db, 'reconciliationAdjustments', adjId);
        const adjSnap = await transaction.get(adjRef);
        if (!adjSnap.exists()) {
          throw new Error('Adjustment record not found.');
        }
        const adjData = adjSnap.data() as ReconciliationAdjustment;

        // 1. Confirm adjustment is still pending_approval
        if (adjData.status !== 'pending_approval') {
          throw new Error('Adjustment is no longer pending approval.');
        }

        // 2. Confirm journal lines are balanced
        const lines = adjData.proposedJournalLines || [];
        const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
          throw new Error('Proposed journal lines are not balanced.');
        }

        // 3. Confirm target period is not closed
        const companyRef = doc(db, 'companies', selectedCompanyId, 'settings', 'profile');
        const companySnap = await transaction.get(companyRef);
        if (companySnap.exists() && companySnap.data().closedPeriodDate) {
          const runRef = doc(db, 'reconciliationRuns', adjData.reconciliationRunId);
          const runSnap = await transaction.get(runRef);
          if (runSnap.exists()) {
            const runData = runSnap.data() as ReconciliationRun;
            if (runData.periodEnd <= companySnap.data().closedPeriodDate) {
              throw new Error(`Target period is closed (closed through ${companySnap.data().closedPeriodDate}).`);
            }
          }
        }

        // 4. Confirm exception still exists
        const excRef = doc(db, 'reconciliationExceptions', adjData.exceptionId);
        const excSnap = await transaction.get(excRef);
        if (!excSnap.exists()) {
          throw new Error('Source exception record no longer exists.');
        }

        // 5. Confirm reconciliation run is not archived (superseded)
        const runRef = doc(db, 'reconciliationRuns', adjData.reconciliationRunId);
        const runSnap = await transaction.get(runRef);
        if (!runSnap.exists()) {
          throw new Error('Reconciliation run not found.');
        }
        const runData = runSnap.data() as ReconciliationRun;
        if (runData.status === 'superseded') {
          throw new Error('Reconciliation run has been superseded.');
        }

        // Generate a new document reference for the journal entry
        const journalRef = doc(collection(db, 'journalEntries'));
        const journalLines = lines.map(l => ({
          account: l.accountName,
          debit: l.debit,
          credit: l.credit,
          accountId: l.accountId || '',
          accountName: l.accountName
        }));

        const journalEntry = {
          orderId: `adj-${adjData.exceptionId}`,
          companyId: selectedCompanyId,
          createdBy: actorName,
          description: adjData.reason,
          lines: journalLines,
          sourceType: 'manual_journal',
          sourceId: adjData.exceptionId,
          sourceLabel: 'AI Recon Correction',
          status: 'posted',
          postedAt: now,
          postedBy: actorName,
          createdAt: now
        };

        // 6. Post GL journal entry
        transaction.set(journalRef, journalEntry);

        // 7. Update adjustment to posted
        transaction.update(adjRef, {
          status: 'posted',
          postedJournalId: journalRef.id,
          postedBy: actorName,
          postedAt: now,
          approvedBy: actorName,
          approvedAt: now,
          approvalDecision: 'approved',
          approvalNotes: notes || 'Approved and posted'
        });

        // 8. Update exception to approved_adjustment
        transaction.update(excRef, {
          status: 'approved_adjustment',
          resolutionNote: `AI Offset posted in GL Entry #${journalRef.id.substring(0, 8).toUpperCase()}`,
          resolvedBy: actorName,
          resolvedAt: now
        });
      });

      addToast(t('reconciliation.toast.postSuccess') || 'Adjustment approved and posted to General Ledger.', 'success');
      await fetchExceptions();
      await fetchAdjustments();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to approve and post adjustment.', 'error');
    }
  };

  /**
   * Reject an adjustment and reset the source exception to open.
   * Available to: owner, admin, accountant roles.
   */
  const handleRejectAdjustment = async (adjId: string, reason: string) => {
    if (!isOwnerOrAdmin) {
      addToast('Not authorized to reject adjustments.', 'error');
      return;
    }
    try {
      const actorName = user?.displayName || user?.email || 'System';
      const now = new Date().toISOString();
      const adjRef = doc(db, 'reconciliationAdjustments', adjId);
      const adjSnap = await getDoc(adjRef);
      if (!adjSnap.exists()) {
        addToast('Adjustment record not found.', 'error');
        return;
      }
      const adjData = adjSnap.data() as ReconciliationAdjustment;

      // Update adjustment to rejected
      await updateDoc(adjRef, {
        status: 'rejected',
        rejectedBy: actorName,
        rejectedAt: now,
        approvalDecision: 'rejected',
        rejectionReason: reason || 'Rejected'
      });

      // Reset the source exception to open
      const excRef = doc(db, 'reconciliationExceptions', adjData.exceptionId);
      await updateDoc(excRef, {
        status: 'open',
        resolutionNote: `Adjustment rejected by ${actorName}. Reason: ${reason || 'None provided'}`,
        updatedAt: now
      });

      addToast(t('reconciliation.toast.adjustmentRejected') || 'Adjustment rejected and exception reopened.', 'success');
      await fetchExceptions();
      await fetchAdjustments();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to reject adjustment.', 'error');
    }
  };

  // ─── PERIOD CLOSE HANDLER ───

  const handleClosePeriod = async () => {
    if (!selectedCompanyId || !selectedCloseRunId || !isOwnerOrAdmin) return;
    const runToClose = runs.find(r => r.id === selectedCloseRunId);
    if (!runToClose || !runToClose.id) return;

    // Graceful duplicate close check
    const alreadyClosed = closedPeriodsList.some(p => runToClose.periodEnd <= p.periodEndDate);
    if (alreadyClosed) {
      addToast('This period (or a later period) is already closed.', 'info');
      return;
    }

    try {
      const actorName = user?.displayName || user?.email || 'System';
      await closePeriod(
        selectedCompanyId,
        runToClose.periodEnd,
        runToClose.id,
        actorName,
        closeNotes
      );
      addToast(t('reconciliation.toast.periodClosed') || `Period closed through ${runToClose.periodEnd}.`, 'success');
      setShowCloseModal(false);
      setCloseNotes('');
      setSelectedCloseRunId(null);
      await fetchClosedPeriods();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to close period.', 'error');
    }
  };

  // ─── AUDIT EVIDENCE HANDLER ───

  const handleGenerateEvidencePacket = async () => {
    if (!selectedRunId) return;
    try {
      const actorName = user?.displayName || user?.email || 'System';
      await generateAuditEvidencePacket(selectedRunId, actorName);
      addToast(t('reconciliation.toast.evidenceGenerated') || 'Audit evidence packet generated.', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to generate evidence packet.', 'error');
    }
  };

  // ─── EXPORT HANDLERS ───

  const triggerPDF = (run: ReconciliationRun) => {
    const runExcs = exceptions.filter(e => e.reconciliationRunId === run.id);
    exportReconciliationPDF(run, runExcs, {
      companyName: selectedCompanyId === 'DEFAULT_COMPANY' ? 'BloomPro Studio Demo' : 'Rose & Sage S.A.',
      currencyCode: 'USD',
      locale: 'en-US',
      reportFooterText: 'BloomPro Internal Compliance Copy'
    });
  };

  const triggerExcel = (run: ReconciliationRun) => {
    const runExcs = exceptions.filter(e => e.reconciliationRunId === run.id);
    exportReconciliationExcel(run, runExcs, {
      companyName: selectedCompanyId === 'DEFAULT_COMPANY' ? 'BloomPro Studio Demo' : 'Rose & Sage S.A.',
      currencyCode: 'USD',
      locale: 'en-US',
      reportFooterText: 'BloomPro Internal Compliance Copy'
    });
  };

  // ─── DERIVED STATE ───
  const isPeriodClosed = selectedRun ? closedPeriodsList.some(p => selectedRun.periodEnd <= p.periodEndDate) : false;
  const canClosePeriod = selectedRun?.status === 'locked' && !isPeriodClosed && isOwnerOrAdmin;
  const pendingApprovals = adjustments.filter(a => a.status === 'pending_approval');
  const runToClose = (selectedCloseRunId ? runs.find(r => r.id === selectedCloseRunId) : selectedRun) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#2C302E' }}>
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200,
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <RefreshCw size={48} style={{ color: '#6C8271', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ fontWeight: 600, color: '#2C302E' }}>Executing Reconciliation Audit Scan...</div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Verifying sub-ledger alignments and checking compliance metrics.</div>
        </div>
      )}
      
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#2C302E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Scale size={28} style={{ color: '#6C8271' }} />
            {t('navigation.reconciliation') || 'AI Reconciliation Center'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
            {t('reconciliation.desc')}
          </p>
        </div>

        {/* Period Close & Audit Evidence Actions */}
        {selectedRun && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Generate Evidence Packet */}
            {selectedRun.status === 'locked' && (
              <button
                onClick={handleGenerateEvidencePacket}
                type="button"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: '#FFFFFF', color: '#374151', border: '1px solid #D1D5DB',
                  borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                  fontWeight: 500, cursor: 'pointer'
                }}
              >
                <FileArchive size={14} />
                {t('reconciliation.actions.generateEvidence') || 'Generate Evidence Packet'}
              </button>
            )}

            {/* Close Period */}
            {canClosePeriod && (
              <button
                onClick={() => setShowCloseModal(true)}
                type="button"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: '#B91C1C', color: '#FFFFFF', border: 'none',
                  borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Lock size={14} />
                {t('reconciliation.actions.closePeriod') || 'Close Period'}
              </button>
            )}

            {/* Period Closed Badge */}
            {isPeriodClosed && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: '#ECFDF5', color: '#065F46', borderRadius: '8px',
                padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600,
                border: '1px solid #A7F3D0'
              }}>
                <CheckCircle2 size={14} />
                {t('reconciliation.status.periodClosed') || 'Period Closed'}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 3fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left side audit logs runs */}
        <ReconciliationRunList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onNewRun={() => {
            if (!isValidCompanyId(selectedCompanyId)) {
              addToast('Company context is not ready. Please refresh or select a company before starting an audit.', 'error');
              return;
            }
            setShowRunModal(true);
          }}
          onApprove={handleApproveRun}
          onExportPDF={triggerPDF}
          onExportExcel={triggerExcel}
          loading={loading}
          disabled={!isValidCompanyId(selectedCompanyId)}
        />

        {/* Right side check tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {selectedRun ? (
            selectedRun.status === 'running' ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: '#8a8f8c', background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px' }}>
                <RefreshCw size={36} style={{ marginBottom: '0.5rem', color: '#D97706', animation: 'spin 2s linear infinite' }} />
                <h3>Reconciliation Scan Running</h3>
                <p style={{ fontSize: '0.875rem' }}>We are verifying the General Ledger, AR, AP, Inventory, Cash, and Tax compliance details. This may take a few moments.</p>
              </div>
            ) : selectedRun.status === 'failed' ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: '#8a8f8c', background: '#FFFFFF', border: '1px solid #FCA5A5', borderRadius: '16px' }}>
                <ShieldAlert size={36} style={{ marginBottom: '0.5rem', color: '#EF4444' }} />
                <h3 style={{ color: '#B91C1C' }}>Reconciliation Audit Scan Failed</h3>
                <p style={{ fontSize: '0.875rem', color: '#991B1B' }}>An error occurred while executing the reconciliation audit checks.</p>
                {selectedRun.failureReason && (
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.25rem' }}>Failure Reason:</p>
                    <p style={{ fontSize: '0.825rem', color: '#B91C1C', fontFamily: 'monospace', padding: '0.75rem', background: '#FEF2F2', display: 'inline-block', borderRadius: '8px', border: '1px solid #FEE2E2', maxWidth: '90%', wordBreak: 'break-all' }}>
                      {selectedRun.failureReason}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
              {/* Tab Navigation */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #E8EAE6',
                gap: '1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                {(['overview', 'exceptions', 'approvals', 'checklist', 'close'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '0.75rem 0',
                      borderBottom: activeTab === tab ? '2px solid #6C8271' : 'none',
                      color: activeTab === tab ? '#6C8271' : '#6b7280',
                      background: 'none',
                      border: 'none',
                      borderBottomWidth: activeTab === tab ? '2px' : '0',
                      borderBottomStyle: 'solid',
                      borderBottomColor: activeTab === tab ? '#6C8271' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      position: 'relative'
                    }}
                  >
                    {tab === 'overview' && (t('reconciliation.tabs.overview') || 'Overview')}
                    {tab === 'exceptions' && (t('reconciliation.tabs.mismatches')?.replace('{count}', String(exceptions.length)) || `Mismatches (${exceptions.length})`)}
                    {tab === 'approvals' && (
                      <>
                        {t('reconciliation.tabs.approvals') || 'Approvals'}
                        {pendingApprovals.length > 0 && (
                          <span style={{
                            background: '#FEF2F2', color: '#991B1B', borderRadius: '9999px',
                            padding: '0 0.4rem', fontSize: '0.6875rem', fontWeight: 700,
                            minWidth: '1.125rem', textAlign: 'center', lineHeight: '1.25rem'
                          }}>
                            {pendingApprovals.length}
                          </span>
                        )}
                      </>
                    )}
                    {tab === 'checklist' && (t('reconciliation.tabs.checklist') || 'Close Readiness')}
                    {tab === 'close' && (t('reconciliation.tabs.closePeriod') || 'Period Close')}
                  </button>
                ))}
                {selectedRun.runType === 'tax_readiness' && (
                  <button
                    onClick={() => setActiveTab('tax')}
                    style={{
                      padding: '0.75rem 0',
                      borderBottom: activeTab === 'tax' ? '2px solid #6C8271' : 'none',
                      color: activeTab === 'tax' ? '#6C8271' : '#6b7280',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {t('reconciliation.tabs.tax') || 'Tax Readiness'}
                  </button>
                )}
              </div>

              {/* Tab Contents */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <ReconciliationAiSummaryPanel
                    aiSummary={selectedRun.aiSummary}
                    riskScore={selectedRun.aiRiskScore}
                  />

                  {/* Summary Metric Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('reconciliation.summary.glDebits')}</span>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {formatCurrency(selectedRun.summary.glDebits)}
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('reconciliation.summary.arSubledger')}</span>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {formatCurrency(selectedRun.summary.arSubledgerTotal)}
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('reconciliation.summary.apSubledger')}</span>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {formatCurrency(selectedRun.summary.apSubledgerTotal)}
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', padding: '1rem', borderRadius: '12px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t('reconciliation.summary.inventory')}</span>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                        {formatCurrency(selectedRun.summary.inventoryValuation)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'exceptions' && (
                <ReconciliationExceptionTable
                  exceptions={exceptions}
                  onSelectException={setSelectedException}
                />
              )}

              {activeTab === 'approvals' && (
                <ApprovalQueuePanel
                  adjustments={adjustments}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  onApproveAndPost={handleApproveAndPostAdjustment}
                  onReject={handleRejectAdjustment}
                  formatCurrency={formatCurrency}
                  t={t}
                />
              )}
              
              {activeTab === 'close' && (
                <PeriodCloseTabPanel
                  runs={runs}
                  closedPeriods={closedPeriodsList}
                  selectedCloseRunId={selectedCloseRunId}
                  setSelectedCloseRunId={setSelectedCloseRunId}
                  closeNotes={closeNotes}
                  setCloseNotes={setCloseNotes}
                  onClosePeriod={() => setShowCloseModal(true)}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  t={t}
                />
              )}

              {activeTab === 'checklist' && (
                <CloseReadinessChecklist run={selectedRun} />
              )}

              {activeTab === 'tax' && selectedRun.runType === 'tax_readiness' && (
                <TaxReadinessPanel runId={selectedRun.id || null} />
              )}
            </>
          )) : (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#8a8f8c', background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px' }}>
              <AlertCircle size={36} style={{ marginBottom: '0.5rem', color: '#6C8271' }} />
              <p>{t('reconciliation.noActiveRun')}</p>
            </div>
          )}

        </div>

      </div>

      {/* Exception Detail Drawer */}
      <ReconciliationExceptionDrawer
        exception={selectedException}
        onClose={() => setSelectedException(null)}
        onUpdateStatus={handleUpdateExceptionStatus}
        onSubmitForApproval={handleSubmitForApproval}
      />

      {/* Trigger audit setup run modal */}
      {showRunModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(44,48,46,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '420px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1px solid #E8EAE6',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#2C302E' }}>
              {t('reconciliation.modal.title') || 'Configure Audit Parameters'}
            </h3>

            <form onSubmit={handleTriggerRun} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '0.65rem 0.75rem',
                fontSize: '0.8125rem',
                color: '#166534'
              }}>
                <div style={{ fontWeight: 600 }}>Active Company Context:</div>
                <div style={{ marginTop: '0.15rem' }}>
                  {selectedCompany ? selectedCompany.displayName : 'BloomPro Studio'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#166534', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                  ID: {selectedCompanyId}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{t('reconciliation.modal.runType')}</label>
                <select
                  value={newRunType}
                  onChange={(e) => setNewRunType(e.target.value as ReconciliationRunType)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="month_end">{t('reconciliation.runTypes.month_end')}</option>
                  <option value="weekly">{t('reconciliation.runTypes.weekly')}</option>
                  <option value="daily">{t('reconciliation.runTypes.daily')}</option>
                  <option value="tax_readiness">{t('reconciliation.runTypes.tax_readiness')}</option>
                  <option value="historical_baseline">{t('reconciliation.runTypes.historical_baseline')}</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{t('reconciliation.modal.start')}</label>
                  <input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>{t('reconciliation.modal.end')}</label>
                  <input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '8px',
                    border: '1px solid #D1D5DB', background: '#FFFFFF',
                    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {t('reconciliation.modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!isStartScanEnabled || loading}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '8px',
                    background: isStartScanEnabled ? '#6C8271' : '#D1D5DB',
                    color: '#FFFFFF', border: 'none',
                    fontSize: '0.875rem', fontWeight: 600,
                    cursor: isStartScanEnabled ? 'pointer' : 'not-allowed'
                  }}
                >
                  {t('reconciliation.modal.startScan') || 'Start Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Period Confirmation Modal */}
      {showCloseModal && runToClose && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(44,48,46,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '460px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1px solid #E8EAE6',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={22} style={{ color: '#B91C1C' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#2C302E' }}>
                {t('reconciliation.closePeriod.title') || 'Close Accounting Period'}
              </h3>
            </div>

            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '1rem',
              fontSize: '0.8125rem',
              color: '#991B1B',
              lineHeight: '1.6'
            }}>
              {t('reconciliation.closePeriod.warning') || `Closing this period will prevent new financial postings dated on or before ${runToClose.periodEnd}. This action should only be completed after reconciliation, adjustments, and management review are finalized.`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                {t('reconciliation.closePeriod.notes') || 'Notes (optional)'}
              </label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder={t('reconciliation.closePeriod.notesPlaceholder') || 'E.g., June 2026 month-end close completed.'}
                rows={2}
                style={{
                  width: '100%', padding: '0.5rem', borderRadius: '8px',
                  border: '1px solid #D1D5DB', fontSize: '0.8125rem', fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setShowCloseModal(false); setCloseNotes(''); }}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px',
                  border: '1px solid #D1D5DB', background: '#FFFFFF',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                {t('reconciliation.modal.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleClosePeriod}
                style={{
                  flex: 1, padding: '0.5rem', borderRadius: '8px',
                  background: '#B91C1C', color: '#FFFFFF', border: 'none',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Lock size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                {t('reconciliation.closePeriod.confirm') || 'Close Period'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


// ─── INLINE APPROVAL QUEUE PANEL ───
 
interface ApprovalQueuePanelProps {
  adjustments: ReconciliationAdjustment[];
  isOwnerOrAdmin: boolean;
  onApproveAndPost: (id: string, notes: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  formatCurrency: (amount: number) => string;
  t: (key: string) => string;
}
 
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: '#F3F4F6', text: '#4B5563', label: 'Draft' },
  pending_approval: { bg: '#FEF3C7', text: '#92400E', label: 'Pending Approval' },
  approved: { bg: '#D1FAE5', text: '#065F46', label: 'Approved' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', label: 'Rejected' },
  posted: { bg: '#DBEAFE', text: '#1E40AF', label: 'Posted' },
  voided: { bg: '#F3F4F6', text: '#6B7280', label: 'Voided' }
};
 
const ApprovalQueuePanel: React.FC<ApprovalQueuePanelProps> = ({
  adjustments, isOwnerOrAdmin, onApproveAndPost, onReject, formatCurrency, t
}) => {
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
 
  if (adjustments.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '3rem 0', color: '#8a8f8c',
        background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px'
      }}>
        <Clock size={32} style={{ marginBottom: '0.5rem', color: '#6C8271' }} />
        <p style={{ fontSize: '0.875rem' }}>
          {t('reconciliation.approvals.empty') || 'No adjustments have been submitted yet.'}
        </p>
      </div>
    );
  }
 
  // Sort: pending_approval first, then rest
  const sorted = [...adjustments].sort((a, b) => {
    const order: Record<string, number> = { pending_approval: 0, posted: 1, rejected: 2, draft: 3, approved: 4, voided: 5 };
    return (order[a.status] ?? 6) - (order[b.status] ?? 6);
  });
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {sorted.map(adj => {
        const colors = STATUS_COLORS[adj.status] || STATUS_COLORS.draft;
        const isExpanded = expandedId === adj.id;
        const totalAmount = (adj.proposedJournalLines || []).reduce((s, l) => s + (l.debit || 0), 0);
 
        return (
          <div
            key={adj.id}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8EAE6',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Header row */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedId(isExpanded ? null : (adj.id || null))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  background: colors.bg, color: colors.text, borderRadius: '6px',
                  padding: '0.2rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.04em'
                }}>
                  {colors.label}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2C302E' }}>
                  {adj.reason.substring(0, 80)}{adj.reason.length > 80 ? '…' : ''}
                </span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2C302E' }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
 
            {/* Audit trail row */}
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.6875rem', color: '#6b7280', flexWrap: 'wrap' }}>
              {adj.submittedBy && <span>Submitted: {adj.submittedBy}</span>}
              {adj.approvedBy && <span>Approved: {adj.approvedBy}</span>}
              {adj.rejectedBy && <span>Rejected: {adj.rejectedBy}</span>}
              {adj.postedBy && <span>Posted: {adj.postedBy}</span>}
              {adj.aiGenerated && <span style={{ color: '#D97706' }}>🤖 AI Generated</span>}
            </div>
 
            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #F3F4F6', paddingTop: '0.75rem' }}>
                {/* Journal lines */}
                {adj.proposedJournalLines && adj.proposedJournalLines.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E8EAE6', color: '#8a8f8c', fontWeight: 600 }}>
                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Account</th>
                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Debit</th>
                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adj.proposedJournalLines.map((l, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '0.4rem', fontWeight: 500 }}>{l.accountCode} - {l.accountName}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'right' }}>{l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'right' }}>{l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
 
                {/* Rejection reason */}
                {adj.status === 'rejected' && adj.rejectionReason && (
                  <div style={{
                    background: '#FEF2F2', borderRadius: '8px', padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem', color: '#991B1B'
                  }}>
                    <strong>Rejection reason:</strong> {adj.rejectionReason}
                  </div>
                )}
 
                {/* Action buttons for pending_approval */}
                {adj.status === 'pending_approval' && isOwnerOrAdmin && adj.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder={t('reconciliation.approvals.notesPlaceholder') || 'Approval/rejection notes…'}
                      value={actionNotes[adj.id] || ''}
                      onChange={(e) => setActionNotes(prev => ({ ...prev, [adj.id!]: e.target.value }))}
                      style={{
                        padding: '0.4rem 0.5rem', borderRadius: '8px', border: '1px solid #D1D5DB',
                        fontSize: '0.8125rem', fontFamily: 'inherit'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => onReject(adj.id!, actionNotes[adj.id!] || '')}
                        type="button"
                        style={{
                          flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          gap: '0.35rem', padding: '0.5rem', borderRadius: '8px',
                          border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B',
                          fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        <X size={14} /> {t('reconciliation.approvals.reject') || 'Reject'}
                      </button>
                      <button
                        onClick={() => onApproveAndPost(adj.id!, actionNotes[adj.id!] || '')}
                        type="button"
                        style={{
                          flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          gap: '0.35rem', padding: '0.5rem', borderRadius: '8px',
                          background: '#6C8271', color: '#FFFFFF', border: 'none',
                          fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        <Check size={14} /> {t('reconciliation.approvals.approveAndPost') || 'Approve & Post'}
                      </button>
                    </div>
                  </div>
                )}
 
                {/* Posted confirmation */}
                {adj.status === 'posted' && adj.postedJournalId && (
                  <div style={{
                    background: '#DBEAFE', borderRadius: '8px', padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.35rem'
                  }}>
                    <CheckCircle2 size={14} />
                    <span>Posted to GL as Journal Entry #{adj.postedJournalId.substring(0, 8).toUpperCase()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
 
 
// ─── PERIOD CLOSE TAB PANEL ───
 
interface PeriodCloseTabPanelProps {
  runs: ReconciliationRun[];
  closedPeriods: ClosedPeriod[];
  selectedCloseRunId: string | null;
  setSelectedCloseRunId: (id: string | null) => void;
  closeNotes: string;
  setCloseNotes: (notes: string) => void;
  onClosePeriod: () => void;
  isOwnerOrAdmin: boolean;
  t: (key: string) => string;
}
 
const PeriodCloseTabPanel: React.FC<PeriodCloseTabPanelProps> = ({
  runs,
  closedPeriods,
  selectedCloseRunId,
  setSelectedCloseRunId,
  closeNotes,
  setCloseNotes,
  onClosePeriod,
  isOwnerOrAdmin,
  t
}) => {
  // Get all approved runs (status === 'locked') that are not already closed
  const closeableRuns = runs.filter(r => 
    r.status === 'locked' && 
    !closedPeriods.some(p => r.periodEnd <= p.periodEndDate)
  );
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Closed Period Action Card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8EAE6',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} style={{ color: '#B91C1C' }} />
          {t('reconciliation.closePeriod.tabTitle') || 'Close a Financial Period'}
        </h3>
        
        {!isOwnerOrAdmin ? (
          <div style={{ fontSize: '0.875rem', color: '#B91C1C', padding: '0.5rem', background: '#FEF2F2', borderRadius: '8px' }}>
            {t('reconciliation.closePeriod.notAuthorized') || 'Only Owners and Admins have permission to lock accounting periods.'}
          </div>
        ) : closeableRuns.length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: '#6b7280', padding: '0.5rem', background: '#FAFAF8', borderRadius: '8px' }}>
            {t('reconciliation.closePeriod.noApprovedRuns') || 'No approved (locked) reconciliation runs are available to close. Please review and approve an audit run first.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                {t('reconciliation.closePeriod.selectRun') || 'Select Approved Reconciliation Period:'}
              </label>
              <select
                value={selectedCloseRunId || ''}
                onChange={(e) => setSelectedCloseRunId(e.target.value || null)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  fontSize: '0.875rem',
                  width: '100%',
                  maxWidth: '400px',
                  background: '#FFFFFF'
                }}
              >
                <option value="">-- Select an approved period --</option>
                {closeableRuns.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.runNumber} ({r.periodStart} to {r.periodEnd})
                  </option>
                ))}
              </select>
            </div>
 
            {selectedCloseRunId && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                    {t('reconciliation.closePeriod.notesLabel') || 'Close Notes:'}
                  </label>
                  <textarea
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder={t('reconciliation.closePeriod.notesPlaceholder') || 'Enter compliance/close notes here...'}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      fontSize: '0.8125rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
 
                <button
                  type="button"
                  onClick={onClosePeriod}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#B91C1C',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Lock size={14} />
                  {t('reconciliation.closePeriod.buttonText') || 'Close Accounting Period'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
 
      {/* Closed Period History List */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8EAE6',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
          {t('reconciliation.closePeriod.historyTitle') || 'Closed Period History'}
        </h3>
        
        {closedPeriods.length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: '#6b7280', padding: '1rem 0', textAlign: 'center' }}>
            {t('reconciliation.closePeriod.noClosedPeriods') || 'No periods have been closed yet.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E8EAE6', color: '#8a8f8c', fontWeight: 600 }}>
                  <th style={{ padding: '0.5rem' }}>Period End Date</th>
                  <th style={{ padding: '0.5rem' }}>Closed By</th>
                  <th style={{ padding: '0.5rem' }}>Closed At</th>
                  <th style={{ padding: '0.5rem' }}>Notes</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {closedPeriods.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 600, color: '#2C302E' }}>{p.periodEndDate}</td>
                    <td style={{ padding: '0.5rem', color: '#4b5563' }}>{p.closedBy}</td>
                    <td style={{ padding: '0.5rem', color: '#4b5563' }}>{new Date(p.closedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>{p.notes || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{
                        background: '#ECFDF5',
                        color: '#065F46',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
