import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReconciliationRun } from '../../services/reconciliation/reconciliationTypes';
import { Play, Lock, FileSpreadsheet, FileDown } from 'lucide-react';

interface RunListProps {
  runs: ReconciliationRun[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onNewRun: () => void;
  onApprove: (id: string) => void;
  onExportPDF: (run: ReconciliationRun) => void;
  onExportExcel: (run: ReconciliationRun) => void;
  loading: boolean;
}

export const ReconciliationRunList: React.FC<RunListProps> = ({
  runs,
  selectedRunId,
  onSelectRun,
  onNewRun,
  onApprove,
  onExportPDF,
  onExportExcel,
  loading
}) => {
  const { t } = useI18n();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked': return { bg: '#EBF5FF', text: '#2563EB', label: t('common.approved') };
      case 'superseded': return { bg: '#F3F4F6', text: '#6B7280', label: t('reconciliation.runs.status.superseded') };
      case 'running': return { bg: '#FEF3C7', text: '#D97706', label: t('common.loading') };
      case 'completed': return { bg: '#ECFDF5', text: '#10B981', label: t('common.success') };
      case 'failed': return { bg: '#FEE2E2', text: '#EF4444', label: t('reconciliation.runs.status.failed') };
      default: return { bg: '#F3F4F6', text: '#374151', label: t('reconciliation.runs.status.draft') };
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 70) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E8EAE6',
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
          {t('reconciliation.runs.title') || 'Audit Run Logs'}
        </h3>
        <button
          onClick={onNewRun}
          disabled={loading}
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#6C8271',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s',
            opacity: loading ? 0.6 : 1
          }}
        >
          <Play size={14} />
          {t('reconciliation.runs.new') || 'Trigger New Audit'}
        </button>
      </div>

      {runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
          {t('reconciliation.runs.empty')}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {runs.map((run) => {
            const sc = getStatusColor(run.status);
            const isSelected = selectedRunId === run.id;
            return (
              <div
                key={run.id}
                onClick={() => run.id && onSelectRun(run.id)}
                style={{
                  border: isSelected ? '1px solid #6C8271' : '1px solid #E8EAE6',
                  borderRadius: '12px',
                  padding: '1rem',
                  cursor: 'pointer',
                  background: isSelected ? '#FDFDFC' : '#FFFFFF',
                  transition: 'border 0.2s, background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#2C302E', fontSize: '0.9375rem' }}>
                      {run.runNumber}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: sc.bg,
                      color: sc.text,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '6px',
                      marginLeft: '0.5rem',
                      display: 'inline-block',
                      verticalAlign: 'middle'
                    }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: getHealthColor(run.summary?.healthScore || 100),
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.15rem'
                  }}>
                    {run.summary?.healthScore || 100}
                    <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#9ca3af' }}>/100</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
                  <div>
                    {t('reconciliation.runs.type')} <span style={{ fontWeight: 500, color: '#374151' }}>{run.runType.toUpperCase()}</span>
                  </div>
                  <div>
                    {t('reconciliation.runs.period')} <span style={{ fontWeight: 500, color: '#374151' }}>{run.periodStart} {t('reconciliation.runs.to')} {run.periodEnd}</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.25rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed #E8EAE6'
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {t('reconciliation.runs.checks')} {run.passedChecks}/{run.totalChecks}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onExportPDF(run)}
                      title={t('reconciliation.runs.pdf')}
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6c8271',
                        padding: '0.2rem'
                      }}
                    >
                      <FileDown size={15} />
                    </button>
                    <button
                      onClick={() => onExportExcel(run)}
                      title={t('reconciliation.runs.excel')}
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6c8271',
                        padding: '0.2rem'
                      }}
                    >
                      <FileSpreadsheet size={15} />
                    </button>

                    {run.status === 'completed' && run.blockingCount === 0 && (
                      <button
                        onClick={() => run.id && onApprove(run.id)}
                        title={t('reconciliation.runs.approve')}
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#2563eb',
                          padding: '0.2rem'
                        }}
                      >
                        <Lock size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
