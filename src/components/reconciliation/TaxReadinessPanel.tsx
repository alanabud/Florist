import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useCompany } from '../../context/CompanyContext';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { TaxReadinessReview } from '../../services/reconciliation/reconciliationTypes';
import type { Vendor, VendorPayment } from '../../store/adminStore';
import { TAX_REPORTING_THRESHOLDS } from '../../services/reconciliation/taxReadinessService';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TaxReadinessPanelProps {
  runId: string | null;
}

export const TaxReadinessPanel: React.FC<TaxReadinessPanelProps> = ({ runId }) => {
  const { t, formatCurrency } = useI18n();
  const { selectedCompanyId } = useCompany();
  const [review, setReview] = useState<TaxReadinessReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [taxYear, setTaxYear] = useState<number>(2026);
  const [eligibleVendors, setEligibleVendors] = useState<Array<{ vendor: Vendor, totalPaid: number }>>([]);

  useEffect(() => {
    const fetchTaxData = async () => {
      if (!selectedCompanyId) return;
      setLoading(true);
      try {
        // Find Tax Readiness Review for the run
        let q = query(
          collection(db, 'taxReadinessReviews'),
          where('companyId', '==', selectedCompanyId)
        );
        if (runId) {
          q = query(q, where('reconciliationRunId', '==', runId));
        } else {
          q = query(q, where('taxYear', '==', taxYear));
        }

        const snap = await getDocs(q);
        if (!snap.empty) {
          const revData = snap.docs[0].data() as TaxReadinessReview;
          setReview(revData);
        } else {
          setReview(null);
        }

        // Fetch active 1099 vendors manually for displays
        const vendorSnap = await getDocs(query(collection(db, 'vendors'), where('companyId', '==', selectedCompanyId)));
        const vendors = vendorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor));

        const paymentSnap = await getDocs(query(collection(db, 'vendorPayments'), where('companyId', '==', selectedCompanyId), where('status', '==', 'posted')));
        const payments = paymentSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPayment));

        const yearStart = new Date(`${taxYear}-01-01T00:00:00`);
        const yearEnd = new Date(`${taxYear}-12-31T23:59:59`);

        const thresholdConfig = TAX_REPORTING_THRESHOLDS.US[taxYear] || TAX_REPORTING_THRESHOLDS.US[2026];
        const necThreshold = thresholdConfig.form1099NEC;

        const list: Array<{ vendor: Vendor, totalPaid: number }> = [];
        for (const v of vendors) {
          const vPayments = payments.filter(p => {
            const pDate = new Date(p.paymentDate || p.createdAt);
            return p.vendorId === v.id && pDate >= yearStart && pDate <= yearEnd;
          });
          const totalPaid = vPayments.reduce((sum, p) => sum + p.amount, 0);

          if (totalPaid >= necThreshold) {
            list.push({ vendor: v, totalPaid });
          }
        }
        setEligibleVendors(list);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxData();
  }, [selectedCompanyId, runId, taxYear]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Configure banner */}
      <div style={{
        background: '#FFFBEB',
        border: '1px solid #FEF3C7',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        fontSize: '0.8125rem',
        color: '#D97706'
      }}>
        <AlertTriangle size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.15rem' }}>{t('reconciliation.tax.warningTitle')}</strong>
          {t('reconciliation.tax.warningDesc')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' }}>
        
        {/* W-9 check table */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E8EAE6',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
            {t('reconciliation.tax.title').replace('{year}', String(taxYear))}
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
            {t('reconciliation.tax.desc')}
          </p>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>{t('reconciliation.tax.loading')}</div>
          ) : eligibleVendors.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              {t('reconciliation.tax.noCandidates')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E8EAE6', color: '#8a8f8c', fontWeight: 600 }}>
                    <th style={{ padding: '0.5rem' }}>{t('reconciliation.tax.vendorName')}</th>
                    <th style={{ padding: '0.5rem' }}>{t('reconciliation.tax.taxId')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t('reconciliation.tax.totalPaid')}</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>{t('reconciliation.tax.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleVendors.map(({ vendor, totalPaid }) => {
                    const hasTaxId = vendor.taxId && vendor.taxId.trim() !== '';
                    return (
                      <tr key={vendor.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#2C302E' }}>
                          {vendor.name}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#4b5563' }}>
                          {hasTaxId && vendor.taxId ? `***-**-${vendor.taxId.slice(-4)}` : 'MISSING'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(totalPaid)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          {hasTaxId ? (
                            <span style={{ color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}><CheckCircle2 size={12} /> {t('reconciliation.tax.registered')}</span>
                          ) : (
                            <span style={{ color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}><ShieldAlert size={12} /> {t('reconciliation.tax.missing')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tax reconciliation summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E8EAE6',
            borderRadius: '16px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
              {t('reconciliation.tax.salesTaxRecon')}
            </h3>
            {review ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>{t('reconciliation.tax.collected')}</span>
                  <span style={{ fontWeight: 600, color: '#2C302E' }}>{formatCurrency(review.salesTaxCollected)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>{t('reconciliation.tax.posted')}</span>
                  <span style={{ fontWeight: 600, color: '#2C302E' }}>{formatCurrency(review.salesTaxPayableBalance)}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px dashed #E8EAE6',
                  paddingTop: '0.5rem',
                  color: review.salesTaxVariance > 0.05 ? '#EF4444' : '#10B981',
                  fontWeight: 600
                }}>
                  <span>{t('reconciliation.tax.variance')}</span>
                  <span>{formatCurrency(review.salesTaxVariance)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                {t('reconciliation.tax.runRecon')}
              </div>
            )}
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E8EAE6',
            borderRadius: '16px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
              {t('reconciliation.tax.yearParams')}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setTaxYear(2025)}
                type="button"
                style={{
                  flex: 1,
                  background: taxYear === 2025 ? '#6C8271' : '#FFFFFF',
                  color: taxYear === 2025 ? '#FFFFFF' : '#4B5563',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '0.35rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {t('reconciliation.tax.yearBtn').replace('{year}', '2025')}
              </button>
              <button
                onClick={() => setTaxYear(2026)}
                type="button"
                style={{
                  flex: 1,
                  background: taxYear === 2026 ? '#6C8271' : '#FFFFFF',
                  color: taxYear === 2026 ? '#FFFFFF' : '#4B5563',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '0.35rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {t('reconciliation.tax.yearBtn').replace('{year}', '2026')}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
