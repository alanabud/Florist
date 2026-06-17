import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useCompany } from '../context/CompanyContext';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  addDoc, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { postJournalEntry } from '../services/financeService';
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
import { ReconciliationRunList } from '../components/reconciliation/ReconciliationRunList';
import { ReconciliationExceptionTable } from '../components/reconciliation/ReconciliationExceptionTable';
import { ReconciliationExceptionDrawer } from '../components/reconciliation/ReconciliationExceptionDrawer';
import { ReconciliationAiSummaryPanel } from '../components/reconciliation/ReconciliationAiSummaryPanel';
import { CloseReadinessChecklist } from '../components/reconciliation/CloseReadinessChecklist';
import { TaxReadinessPanel } from '../components/reconciliation/TaxReadinessPanel';
import { AlertCircle, Scale } from 'lucide-react';

export const ReconciliationCenter: React.FC = () => {
  const { t, formatCurrency } = useI18n();
  const { selectedCompanyId } = useCompany();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);



  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [exceptions, setExceptions] = useState<ReconciliationException[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'exceptions' | 'checklist' | 'tax'>('overview');
  
  const [loading, setLoading] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedException, setSelectedException] = useState<ReconciliationException | null>(null);

  // New run form state
  const [newRunType, setNewRunType] = useState<ReconciliationRunType>('month_end');
  const [newStart, setNewStart] = useState('2026-06-01');
  const [newEnd, setNewEnd] = useState('2026-06-30');

  const selectedRun = runs.find(r => r.id === selectedRunId) || null;

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

  useEffect(() => {
    fetchRuns();
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchExceptions();
  }, [selectedRunId]);

  const handleTriggerRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    setLoading(true);
    setShowRunModal(false);
    try {
      addToast(t('reconciliation.toast.triggering'), 'info');
      const actorName = user?.displayName || user?.email || 'System';
      const runId = await createReconciliationRun(
        selectedCompanyId,
        newRunType,
        newStart,
        newEnd,
        actorName
      );
      addToast(t('reconciliation.toast.completed'), 'success');
      setSelectedRunId(runId);
      await fetchRuns();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || t('reconciliation.toast.failed'), 'error');
    } finally {
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

  const handlePostAdjustment = async (adj: ReconciliationAdjustment) => {
    if (!selectedCompanyId) return;
    try {
      const actorName = user?.displayName || user?.email || 'System';
      
      // 1. Post Journal Entry to GL
      const lines = (adj.proposedJournalLines || []).map(l => ({
        account: l.accountName,
        debit: l.debit,
        credit: l.credit,
        accountId: l.accountId,
        accountName: l.accountName
      }));

      const journalId = await postJournalEntry({
        orderId: `adj-${adj.exceptionId}`,
        companyId: selectedCompanyId,
        createdBy: actorName,
        description: adj.reason,
        lines,
        sourceType: 'manual_journal',
        sourceId: adj.exceptionId,
        sourceLabel: 'AI Recon Correction'
      });

      // 2. Add Adjustment doc
      await addDoc(collection(db, 'reconciliationAdjustments'), {
        ...adj,
        status: 'posted',
        postedJournalId: journalId,
        postedAt: new Date().toISOString()
      });

      // 3. Update exception status
      const excRef = doc(db, 'reconciliationExceptions', adj.exceptionId);
      await updateDoc(excRef, {
        status: 'approved_adjustment',
        resolutionNote: `AI Offset posted successfully in GL Entry #${journalId.substring(0, 8).toUpperCase()}`,
        resolvedBy: actorName,
        resolvedAt: new Date().toISOString()
      });

      addToast(t('reconciliation.toast.postSuccess'), 'success');
      await fetchExceptions();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || t('reconciliation.toast.postFailed'), 'error');
    }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#2C302E' }}>
      
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 3fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left side audit logs runs */}
        <ReconciliationRunList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onNewRun={() => setShowRunModal(true)}
          onApprove={handleApproveRun}
          onExportPDF={triggerPDF}
          onExportExcel={triggerExcel}
          loading={loading}
        />

        {/* Right side check tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {selectedRun ? (
            <>
              {/* Tab Navigation */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #E8EAE6',
                gap: '1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                <button
                  onClick={() => setActiveTab('overview')}
                  style={{
                    padding: '0.75rem 0',
                    borderBottom: activeTab === 'overview' ? '2px solid #6C8271' : 'none',
                    color: activeTab === 'overview' ? '#6C8271' : '#6b7280',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('reconciliation.tabs.overview')}
                </button>
                <button
                  onClick={() => setActiveTab('exceptions')}
                  style={{
                    padding: '0.75rem 0',
                    borderBottom: activeTab === 'exceptions' ? '2px solid #6C8271' : 'none',
                    color: activeTab === 'exceptions' ? '#6C8271' : '#6b7280',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('reconciliation.tabs.mismatches').replace('{count}', String(exceptions.length))}
                </button>
                <button
                  onClick={() => setActiveTab('checklist')}
                  style={{
                    padding: '0.75rem 0',
                    borderBottom: activeTab === 'checklist' ? '2px solid #6C8271' : 'none',
                    color: activeTab === 'checklist' ? '#6C8271' : '#6b7280',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('reconciliation.tabs.checklist')}
                </button>
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
                    {t('reconciliation.tabs.tax')}
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

              {activeTab === 'checklist' && (
                <CloseReadinessChecklist run={selectedRun} />
              )}

              {activeTab === 'tax' && selectedRun.runType === 'tax_readiness' && (
                <TaxReadinessPanel runId={selectedRun.id || null} />
              )}
            </>
          ) : (
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
        onPostAdjustment={handlePostAdjustment}
      />

      {/* Trigger audit setup run modal */}
      {showRunModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
              {t('reconciliation.modal.title')}
            </h3>

            <form onSubmit={handleTriggerRun} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #D1D5DB',
                    background: '#FFFFFF',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('reconciliation.modal.cancel')}
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '8px',
                    background: '#6C8271',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('reconciliation.modal.startScan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
