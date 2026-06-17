import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReconciliationException, ReconciliationSeverity } from '../../services/reconciliation/reconciliationTypes';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface ExceptionTableProps {
  exceptions: ReconciliationException[];
  onSelectException: (e: ReconciliationException) => void;
}

export const ReconciliationExceptionTable: React.FC<ExceptionTableProps> = ({
  exceptions,
  onSelectException
}) => {
  const { t, formatCurrency } = useI18n();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const filtered = exceptions.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
    return true;
  });

  const getSeverityBadge = (sev: ReconciliationSeverity) => {
    switch (sev) {
      case 'blocking':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#B91C1C', background: '#FEE2E2', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            <ShieldAlert size={12} /> {t('reconciliation.severity.blocking')}
          </span>
        );
      case 'critical':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#D97706', background: '#FEF3C7', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            <AlertTriangle size={12} /> {t('reconciliation.severity.critical')}
          </span>
        );
      case 'warning':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2563EB', background: '#EBF5FF', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            <AlertTriangle size={12} /> {t('reconciliation.severity.warning')}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#4B5563', background: '#F3F4F6', padding: '0.15rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
            <Info size={12} /> {t('reconciliation.severity.info')}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 500 }}><CheckCircle2 size={12} /> {t('reconciliation.status.resolved')}</span>;
      case 'ignored':
        return <span style={{ color: '#6B7280', fontSize: '0.75rem', fontWeight: 500 }}>{t('reconciliation.status.ignored')}</span>;
      case 'approved_adjustment':
        return <span style={{ color: '#2563EB', fontSize: '0.75rem', fontWeight: 500 }}>{t('reconciliation.status.adjusted')}</span>;
      default:
        return <span style={{ color: '#EF4444', fontSize: '0.75rem', fontWeight: 500 }}>{t('reconciliation.status.open')}</span>;
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
          {t('reconciliation.exceptions.title') || 'Discrepancy Log'}
        </h3>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E8EAE6',
              fontSize: '0.75rem',
              color: '#374151',
              background: '#FFFFFF'
            }}
          >
            <option value="all">{t('reconciliation.filter.allSeverities')}</option>
            <option value="blocking">{t('reconciliation.filter.blocking')}</option>
            <option value="critical">{t('reconciliation.filter.critical')}</option>
            <option value="warning">{t('reconciliation.filter.warning')}</option>
            <option value="info">{t('reconciliation.filter.info')}</option>
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #E8EAE6',
              fontSize: '0.75rem',
              color: '#374151',
              background: '#FFFFFF'
            }}
          >
            <option value="all">{t('reconciliation.filter.allModules')}</option>
            <option value="gl">{t('reconciliation.filter.gl')}</option>
            <option value="ar">{t('reconciliation.filter.ar')}</option>
            <option value="ap">{t('reconciliation.filter.ap')}</option>
            <option value="inventory">{t('reconciliation.filter.inventory')}</option>
            <option value="cogs">{t('reconciliation.filter.cogs')}</option>
            <option value="payments">{t('reconciliation.filter.payments')}</option>
            <option value="sales_tax">{t('reconciliation.filter.salesTax')}</option>
            <option value="irs_tax_readiness">{t('reconciliation.filter.taxReady')}</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: '#8a8f8c', fontSize: '0.875rem' }}>
          {t('reconciliation.exceptions.clean') || 'No discrepancies found matching the filter criteria.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8EAE6' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#8a8f8c', fontWeight: 600 }}>{t('reconciliation.exceptions.module') || 'Module'}</th>
                <th style={{ padding: '0.75rem 1rem', color: '#8a8f8c', fontWeight: 600 }}>{t('reconciliation.exceptions.severity') || 'Severity'}</th>
                <th style={{ padding: '0.75rem 1rem', color: '#8a8f8c', fontWeight: 600 }}>{t('reconciliation.exceptions.titleCol') || 'Title'}</th>
                <th style={{ padding: '0.75rem 1rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'right' }}>{t('reconciliation.exceptions.variance') || 'Variance'}</th>
                <th style={{ padding: '0.75rem 1rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'center' }}>{t('reconciliation.exceptions.status') || 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, index) => (
                <tr
                  key={e.id || index}
                  onClick={() => onSelectException(e)}
                  style={{
                    borderBottom: '1px solid #E8EAE6',
                    cursor: 'pointer',
                    background: '#FFFFFF',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = '#F9FAF9')}
                  onMouseLeave={(el) => (el.currentTarget.style.background = '#FFFFFF')}
                >
                  <td style={{ padding: '1rem', fontWeight: 500, color: '#374151' }}>{e.module.toUpperCase()}</td>
                  <td style={{ padding: '1rem' }}>{getSeverityBadge(e.severity)}</td>
                  <td style={{ padding: '1rem', color: '#2C302E' }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.description}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#B91C1C' }}>
                    {e.varianceAmount !== undefined && e.varianceAmount > 0 ? formatCurrency(e.varianceAmount) : '—'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{getStatusBadge(e.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
