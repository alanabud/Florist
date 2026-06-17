import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReconciliationException, ReconciliationAdjustment } from '../../services/reconciliation/reconciliationTypes';
import { X, Sparkles, HelpCircle, FileText } from 'lucide-react';
import { generateExceptionSuggestedFix, draftExceptionAdjustment } from '../../services/reconciliation/reconciliationAiService';
import { ReconciliationAdjustmentDraft } from './ReconciliationAdjustmentDraft';

interface ExceptionDrawerProps {
  exception: ReconciliationException | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'resolved' | 'ignored', note: string) => Promise<void>;
  onPostAdjustment: (adjustment: ReconciliationAdjustment) => Promise<void>;
}

export const ReconciliationExceptionDrawer: React.FC<ExceptionDrawerProps> = ({
  exception,
  onClose,
  onUpdateStatus,
  onPostAdjustment
}) => {
  const { t, formatCurrency } = useI18n();
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState<'resolved' | 'ignored' | null>(null);
  
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [draftAdjustment, setDraftAdjustment] = useState<ReconciliationAdjustment | null>(null);

  useEffect(() => {
    if (exception) {
      const insight = generateExceptionSuggestedFix(exception);
      setAiInsight(insight);
      
      const compId = exception.companyId || 'DEFAULT_COMPANY';
      const runId = exception.reconciliationRunId || '';
      draftExceptionAdjustment(compId, runId, exception, 'AI Auditor')
        .then(adj => setDraftAdjustment(adj));

      setResolutionNote('');
      setShowResolveForm(null);
    } else {
      setAiInsight(null);
      setDraftAdjustment(null);
    }
  }, [exception]);

  if (!exception) return null;

  const handleResolveOrIgnore = async (type: 'resolved' | 'ignored') => {
    if (!exception.id) return;
    setIsSubmitting(true);
    try {
      await onUpdateStatus(exception.id, type, resolutionNote);
      setShowResolveForm(null);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasVariance = exception.varianceAmount !== undefined && exception.varianceAmount > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '460px',
      background: '#FFFFFF',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #E8EAE6',
      animation: 'slideIn 0.3s ease'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '1.25rem',
        borderBottom: '1px solid #E8EAE6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#FAFAF8'
      }}>
        <div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#6C8271',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {exception.module.toUpperCase()} {t('reconciliation.exceptions.audit') || 'Discrepancy'}
          </span>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: '0.25rem 0 0 0' }}>
            {exception.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: '#8a8f8c',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '50%'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Exception Stats Card */}
        <div style={{
          background: '#FAFAF8',
          border: '1px solid #E8EAE6',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: '#6b7280' }}>{t('reconciliation.drawer.expected')}</span>
              <div style={{ fontWeight: 600, color: '#2C302E', marginTop: '0.15rem' }}>
                {exception.expectedAmount !== undefined ? formatCurrency(exception.expectedAmount) : '—'}
              </div>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>{t('reconciliation.drawer.actual')}</span>
              <div style={{ fontWeight: 600, color: '#2C302E', marginTop: '0.15rem' }}>
                {exception.actualAmount !== undefined ? formatCurrency(exception.actualAmount) : '—'}
              </div>
            </div>
          </div>

          {hasVariance && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px dashed #E8EAE6',
              paddingTop: '0.75rem'
            }}>
              <span style={{ fontSize: '0.8125rem', color: '#B91C1C', fontWeight: 600 }}>{t('reconciliation.drawer.variance')}</span>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#B91C1C' }}>
                {formatCurrency(exception.varianceAmount || 0)}
              </span>
            </div>
          )}

          {exception.sourceDocumentId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: '#6b7280',
              borderTop: '1px dashed #E8EAE6',
              paddingTop: '0.75rem'
            }}>
              <FileText size={13} />
              <span>{t('reconciliation.drawer.sourceDoc')}</span>
              <span style={{ fontWeight: 600, color: '#374151' }}>
                {exception.sourceCollection}/{exception.sourceDocumentId.substring(0, 12)}
              </span>
            </div>
          )}
        </div>

        {/* Likely Cause & Recommended Action */}
        {aiInsight && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ color: '#6C8271', marginTop: '0.15rem' }}><HelpCircle size={18} /></div>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#2C302E' }}>
                  {t('reconciliation.exceptions.likelyCause') || 'Likely Root Cause'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563', lineHeight: '1.5' }}>
                  {aiInsight.likelyCause}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ color: '#6C8271', marginTop: '0.15rem' }}><Sparkles size={18} /></div>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#2C302E' }}>
                  {t('reconciliation.exceptions.aiExplanation') || 'AI Auditor Explanation'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#4b5563', lineHeight: '1.5', fontStyle: 'italic' }}>
                  "{aiInsight.aiExplanation}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Proposed Correction / Draft Adjustments */}
        {exception.status === 'open' && draftAdjustment && (
          <div style={{
            borderTop: '1px solid #E8EAE6',
            paddingTop: '1.5rem'
          }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: 600, color: '#2C302E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: '#d97706' }} />
              {t('reconciliation.adjustment.draft') || 'Suggested Balanced Offset'}
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 1rem 0' }}>
              {t('reconciliation.drawer.reviewAi')}
            </p>
            <ReconciliationAdjustmentDraft
              adjustment={draftAdjustment}
              onPost={async (adj) => {
                await onPostAdjustment(adj);
                onClose();
              }}
            />
          </div>
        )}

        {/* Resolution Actions */}
        {exception.status === 'open' && !showResolveForm && (
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: 'auto',
            borderTop: '1px solid #E8EAE6',
            paddingTop: '1.25rem'
          }}>
            <button
              onClick={() => setShowResolveForm('ignored')}
              type="button"
              style={{
                flex: 1,
                background: '#FFFFFF',
                color: '#4B5563',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                padding: '0.625rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {t('reconciliation.drawer.ignore')}
            </button>
            <button
              onClick={() => setShowResolveForm('resolved')}
              type="button"
              style={{
                flex: 1,
                background: '#6C8271',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '0.625rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {t('reconciliation.drawer.resolve')}
            </button>
          </div>
        )}

        {/* Action input form */}
        {showResolveForm && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            borderTop: '1px solid #E8EAE6',
            paddingTop: '1.25rem',
            marginTop: 'auto'
          }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
              {t('reconciliation.drawer.provideReason')}
            </label>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder={t('reconciliation.drawer.reasonPlaceholder')}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #D1D5DB',
                fontSize: '0.8125rem',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowResolveForm(null)}
                type="button"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {t('reconciliation.drawer.cancel')}
              </button>
              <button
                onClick={() => handleResolveOrIgnore(showResolveForm)}
                disabled={isSubmitting || resolutionNote.trim() === ''}
                type="button"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: '#6C8271',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: (isSubmitting || resolutionNote.trim() === '') ? 0.6 : 1
                }}
              >
                {isSubmitting ? t('reconciliation.drawer.submitting') : t('reconciliation.drawer.confirm')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
