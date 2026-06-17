import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { ReconciliationRun } from '../../services/reconciliation/reconciliationTypes';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ChecklistProps {
  run: ReconciliationRun | null;
}

export const CloseReadinessChecklist: React.FC<ChecklistProps> = ({ run }) => {
  const { t } = useI18n();

  const checkpoints = [
    {
      id: 'gl_balance',
      label: t('reconciliation.checklist.gl') || 'Trial Balance balances to zero',
      passed: run ? run.glBalanced : false,
      desc: t('reconciliation.checklist.desc.gl')
    },
    {
      id: 'ar_reconciled',
      label: t('reconciliation.checklist.ar') || 'AR Subledger matches GL Accounts Receivable',
      passed: run ? run.arReconciled : false,
      desc: t('reconciliation.checklist.desc.ar')
    },
    {
      id: 'ap_reconciled',
      label: t('reconciliation.checklist.ap') || 'AP Subledger matches GL Accounts Payable',
      passed: run ? run.apReconciled : false,
      desc: t('reconciliation.checklist.desc.ap')
    },
    {
      id: 'inventory_reconciled',
      label: t('reconciliation.checklist.inventory') || 'Inventory Valuation matches GL Inventory Asset',
      passed: run ? run.inventoryReconciled : false,
      desc: t('reconciliation.checklist.desc.inventory')
    },
    {
      id: 'cogs_posted',
      label: t('reconciliation.checklist.cogs') || 'COGS posted for all delivered orders',
      passed: run ? run.summary.exceptionCount === 0 || !run.inventoryReconciled : false, // Derived from run checks
      desc: t('reconciliation.checklist.desc.cogs')
    },
    {
      id: 'cash_reconciled',
      label: t('reconciliation.checklist.cash') || 'Cash & bank receipts match payment subledger',
      passed: run ? run.cashReconciled : false,
      desc: t('reconciliation.checklist.desc.cash')
    },
    {
      id: 'no_blocking',
      label: t('reconciliation.checklist.blocking') || 'No blocking or unbalanced journal entries',
      passed: run ? run.summary.blockingExceptionCount === 0 : false,
      desc: t('reconciliation.checklist.desc.blocking')
    }
  ];

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
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
        {t('reconciliation.checklist.title') || 'Month-End Close Checklist'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {checkpoints.map((cp) => (
          <div
            key={cp.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '8px',
              background: '#FAFAF8',
              border: '1px solid #E8EAE6'
            }}
          >
            <div style={{ color: cp.passed ? '#10B981' : '#EF4444', marginTop: '0.15rem' }}>
              {cp.passed ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2C302E' }}>
                {cp.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                {cp.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
