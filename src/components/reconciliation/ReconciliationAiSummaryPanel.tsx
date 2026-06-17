import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Sparkles, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AiSummaryProps {
  aiSummary?: string;
  riskScore?: number;
}

export const ReconciliationAiSummaryPanel: React.FC<AiSummaryProps> = ({
  aiSummary,
  riskScore = 0
}) => {
  const { t } = useI18n();

  const getRiskClassification = (score: number) => {
    if (score >= 70) return { label: t('reconciliation.ai.critical'), color: '#EF4444', bg: '#FEE2E2', icon: ShieldAlert };
    if (score >= 40) return { label: t('reconciliation.ai.high'), color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle };
    if (score >= 15) return { label: t('reconciliation.ai.moderate'), color: '#2563EB', bg: '#EBF5FF', icon: AlertTriangle };
    return { label: t('reconciliation.ai.low'), color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 };
  };

  const risk = getRiskClassification(riskScore);
  const RiskIcon = risk.icon;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E8EAE6',
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} style={{ color: '#6C8271' }} />
          {t('reconciliation.ai.title') || 'AI Auditor Review'}
        </h3>
        
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: risk.bg,
          color: risk.color,
          padding: '0.25rem 0.5rem',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 700
        }}>
          <RiskIcon size={13} />
          {risk.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.25rem', alignItems: 'center' }}>
        
        {/* Risk meter widget */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid #E8EAE6',
          paddingRight: '1.25rem'
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: risk.color
          }}>
            {riskScore}%
          </div>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af', textAlign: 'center', textTransform: 'uppercase', marginTop: '0.25rem' }}>
            {t('reconciliation.ai.riskScore')}
          </span>
        </div>

        {/* AI summary text */}
        <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.6', fontStyle: 'italic' }}>
          {aiSummary ? `"${aiSummary}"` : `"${t('reconciliation.ai.noSummary')}"`}
        </div>

      </div>
    </div>
  );
};
