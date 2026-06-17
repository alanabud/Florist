import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { 
  generateCustomerStatement, 
  exportStatementPdf, 
  exportStatementExcel 
} from '../../../services/customerStatementService';
import type { StatementData } from '../../../services/customerStatementService';
import { doc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import styles from '../../ui/FormModal.module.css';
import { useI18n } from '../../../i18n/I18nProvider';

interface CustomerStatementFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerStatementForm: React.FC<CustomerStatementFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const addToast = useToastStore((s) => s.addToast);
  const { customers, modalPayload, fetchCustomerStatements } = useAdminStore();

  const [customerId, setCustomerId] = useState('');
  // Default date ranges: start of this month to today
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statementPreview, setStatementPreview] = useState<StatementData | null>(null);

  useEffect(() => {
    if (isOpen) {
      const payloadCustomerId = modalPayload?.customerId || '';
      // Intended: sync form state when an existing customer statement payload is loaded for edit/creation mode.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerId(payloadCustomerId);
      
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // format as YYYY-MM-DD local
      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(now));
      setStatementPreview(null);
    }
  }, [isOpen, modalPayload]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      addToast('Please select a customer first.', 'error');
      return;
    }
    if (!startDate || !endDate) {
      addToast('Please enter both start and end dates.', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      addToast('Start date cannot be after end date.', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      const statementData = await generateCustomerStatement(customerId, startDate, endDate);
      setStatementPreview(statementData);
      addToast('Customer statement calculated.', 'success');
    } catch (err: any) {
      console.error(err);
      addToast('Failed to generate statement: ' + err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAndPrintPDF = async () => {
    if (!statementPreview) return;
    try {
      // Create a statement record in Firestore for statement history tracking
      const statementRef = collection(db, 'customerStatements');
      await addDoc(statementRef, {
        customerId: statementPreview.customer.id,
        customerName: statementPreview.customer.name,
        startDate: statementPreview.startDate,
        endDate: statementPreview.endDate,
        endingArBalance: statementPreview.endingArBalance,
        endingCreditBalance: statementPreview.endingCreditBalance,
        endingNetBalance: statementPreview.endingNetBalance,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin'
      });

      // Update customer lastStatementDate
      const custRef = doc(db, 'customers', statementPreview.customer.id);
      await updateDoc(custRef, {
        lastStatementDate: new Date().toISOString()
      } as any);

      // Refresh store statements log
      await fetchCustomerStatements();

      // Trigger pdf printing
      exportStatementPdf(statementPreview);
      addToast('Statement history recorded. Printing PDF statement.', 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast('Failed to record statement: ' + e.message, 'error');
    }
  };

  const handleDownloadExcel = () => {
    if (!statementPreview) return;
    exportStatementExcel(statementPreview);
    addToast('Statement downloaded as Excel sheet.', 'success');
  };

  return (
    <FormModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={t('maintenance.generateCustomerStatement')}
    >
      <div style={{ width: '500px', maxWidth: '100%' }}>
        <form onSubmit={handleGenerate}>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Customer Name *</label>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setStatementPreview(null);
                }}
                className={styles.formInput}
                required
              >
                <option value="">{t('maintenance.selectCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (AR Bal: $${(c.arBalance || 0).toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Statement Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setStatementPreview(null);
                }}
                className={styles.formInput}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Statement End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setStatementPreview(null);
                }}
                className={styles.formInput}
                required
              />
            </div>
          </div>

          <div className={styles.formActions} style={{ marginBottom: statementPreview ? '1rem' : 0 }}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={isGenerating}>Cancel</button>
            <button type="submit" className={styles.btnSubmit} disabled={isGenerating || !customerId}>
              {isGenerating ? 'Calculating...' : 'Calculate Statement'}
            </button>
          </div>
        </form>

        {statementPreview && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid #E8EAE6', paddingTop: '1.25rem' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-sage-dark)' }}>
              Statement Summary Preview
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center', background: '#FAFAF8', padding: '12px', borderRadius: '8px', border: '1px solid #E8EAE6', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block' }}>{t('maintenance.endingAr')}</span>
                <strong style={{ fontSize: '1rem', color: '#2C302E' }}>
                  ${statementPreview.endingArBalance.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block' }}>{t('maintenance.availableCredit')}</span>
                <strong style={{ fontSize: '1rem', color: '#2C302E' }}>
                  ${statementPreview.endingCreditBalance.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.6875rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block' }}>{t('maintenance.netDue')}</span>
                <strong style={{ fontSize: '1rem', color: '#4A6B50' }}>
                  ${statementPreview.endingNetBalance.toFixed(2)}
                </strong>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Activities count: <strong>{statementPreview.activities.length}</strong></span>
              <span>Aging: <strong>${(statementPreview.aging.current + statementPreview.aging.thirtyToSixty + statementPreview.aging.sixtyToNinety + statementPreview.aging.overNinety).toFixed(2)}</strong> aged AR</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={handleDownloadExcel}
                style={{ padding: '0.5rem 1rem', background: '#FFFFFF', border: '1px solid #E8EAE6', color: '#2C302E', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Download Excel Sheet
              </button>
              <button 
                type="button" 
                onClick={handleSaveAndPrintPDF}
                style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', color: '#FFFFFF', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Print / Save PDF Statement
              </button>
            </div>
          </div>
        )}
      </div>
    </FormModal>
  );
};

// Simple inline document updater fallback helper to avoid import complexities
async function updateDoc(docRef: any, data: any) {
  const { updateDoc: fbUpdateDoc } = await import('firebase/firestore');
  await fbUpdateDoc(docRef, data);
}
