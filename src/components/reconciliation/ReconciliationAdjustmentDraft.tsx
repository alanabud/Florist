import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReconciliationAdjustment } from '../../services/reconciliation/reconciliationTypes';
import { useCompany } from '../../context/CompanyContext';
import { Play, AlertCircle } from 'lucide-react';

interface AdjustmentDraftProps {
  adjustment: ReconciliationAdjustment;
  onPost: (adj: ReconciliationAdjustment) => Promise<void>;
  disabled?: boolean;
}

export const ReconciliationAdjustmentDraft: React.FC<AdjustmentDraftProps> = ({
  adjustment,
  onPost,
  disabled = false
}) => {
  const { t, formatCurrency } = useI18n();
  const { memberships, selectedCompanyId } = useCompany();
  const [posting, setPosting] = useState(false);

  const currentMember = memberships.find(m => m.companyId === selectedCompanyId);
  const userRole = currentMember?.role || 'viewer';
  const isAuthorized = ['owner', 'admin', 'accountant'].includes(userRole);

  const lines = adjustment.proposedJournalLines || [];
  const totalDebits = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  const handlePost = async () => {
    if (!isAuthorized) return;
    setPosting(true);
    try {
      await onPost(adjustment);
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{
      background: '#FAFAF8',
      border: '1px solid #E8EAE6',
      borderRadius: '12px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      {/* Account Lines Grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E8EAE6', color: '#8a8f8c', fontWeight: 600 }}>
              <th style={{ padding: '0.5rem' }}>{t('reconciliation.adjustment.account')}</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('reconciliation.adjustment.debit')}</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('reconciliation.adjustment.credit')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '0.5rem', fontWeight: 500, color: '#374151' }}>
                  {l.accountCode} - {l.accountName}
                  <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontStyle: 'italic', marginTop: '0.1rem' }}>
                    {l.memo}
                  </div>
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                  {l.debit > 0 ? formatCurrency(l.debit) : '—'}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                  {l.credit > 0 ? formatCurrency(l.credit) : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, borderTop: '1px solid #E8EAE6', background: '#FAFAF8' }}>
              <td style={{ padding: '0.5rem', color: '#374151' }}>{t('reconciliation.adjustment.totalOffset')}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#111827' }}>
                {formatCurrency(totalDebits)}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#111827' }}>
                {formatCurrency(totalCredits)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Permissions Guard Warning */}
      {!isAuthorized && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#FEF2F2',
          color: '#991B1B',
          borderRadius: '8px',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 500
        }}>
          <AlertCircle size={14} />
          <span>{t('reconciliation.adjustment.notAuthorized')}</span>
        </div>
      )}

      {/* Posting CTA button */}
      <button
        onClick={handlePost}
        disabled={disabled || posting || !isAuthorized || Math.abs(totalDebits - totalCredits) > 0.01}
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          background: '#6C8271',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.2s',
          width: '100%',
          opacity: (disabled || posting || !isAuthorized || Math.abs(totalDebits - totalCredits) > 0.01) ? 0.6 : 1
        }}
      >
        <Play size={14} />
        {posting ? t('reconciliation.adjustment.posting') : t('reconciliation.adjustment.post')}
      </button>
    </div>
  );
};
