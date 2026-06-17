import React, { useState, useEffect } from 'react';
import { FormModal } from '../ui/FormModal';
import { useI18n } from '../../i18n/I18nProvider';
import { useToastStore } from '../../store/toastStore';
import { useCompany } from '../../context/CompanyContext';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { requestDeliveryQuotes, dispatchDelivery } from '../../services/delivery/deliveryService';
import type { DeliveryQuoteResult } from '../../services/delivery/deliveryTypes';
import { ShieldAlert, Clock, AlertTriangle, Truck } from 'lucide-react';

interface DeliveryQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: () => void;
}

export const DeliveryQuoteModal: React.FC<DeliveryQuoteModalProps> = ({ isOpen, onClose, order, onSuccess }) => {
  const { t } = useI18n();
  const { selectedCompanyId, memberships } = useCompany();
  const { user } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<DeliveryQuoteResult[]>([]);
  const [dispatchingProvider, setDispatchingProvider] = useState<string | null>(null);

  const currentMember = memberships.find((m) => m.companyId === selectedCompanyId);
  const userRole = currentMember?.role || 'viewer';
  const actorEmail = user?.email || 'Logistics';

  const fetchQuotes = async () => {
    if (!order || !isOpen) return;
    setLoading(true);
    try {
      const input = {
        companyId: selectedCompanyId || 'DEFAULT_COMPANY',
        orderId: order.id,
        pickupAddress: order.storeLocationAddress || '123 Flower Lane',
        pickupCity: 'New York',
        pickupState: 'NY',
        pickupZip: '10001',
        pickupCountry: 'US',
        dropoffAddress: order.addressLine1 || '',
        dropoffCity: order.city || '',
        dropoffState: order.state || '',
        dropoffZip: order.zipCode || '',
        dropoffCountry: 'US',
        recipientName: order.recipientName || order.customerName,
        recipientPhone: order.recipientPhone || '',
        customerDeliveryFeeCollected: order.deliveryFee || 0,
      };

      const res = await requestDeliveryQuotes(input);
      setQuotes(res);
    } catch (err: any) {
      console.error(err);
      addToast(t('delivery.errors.quoteFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuotes();
    } else {
      setQuotes([]);
    }
  }, [isOpen, order]);

  const handleDispatch = async (quote: DeliveryQuoteResult) => {
    if (!order) return;
    const providerCost = quote.rawResponse?.base_cost || quote.estimatedCost - 5;
    const collectedFee = order.deliveryFee || 0;

    const isNegativeMargin = collectedFee < providerCost;
    const isManager = ['owner', 'admin', 'manager'].includes(userRole);

    if (isNegativeMargin && !isManager) {
      addToast(t('delivery.errors.existingLower'), 'error');
      return;
    }

    setDispatchingProvider(quote.provider);
    try {
      const deliveryId = `del_${order.id}`;
      await dispatchDelivery(
        deliveryId,
        quote.provider,
        quote.rawResponse?.quoteId || '',
        userRole,
        actorEmail
      );
      addToast(
        t('common.success') + ': Dispatched order via ' + t(`delivery.provider.${quote.provider}`),
        'success'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to dispatch courier.', 'error');
    } finally {
      setDispatchingProvider(null);
    }
  };

  const isManager = ['owner', 'admin', 'manager'].includes(userRole);
  const collectedFee = order?.deliveryFee || 0;

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title={t('delivery.dispatchHub.getQuotes')}>
      <div style={{ padding: '0.5rem' }}>
        {order && (
          <div
            style={{
              background: '#FDFCFA',
              border: '1px solid #E8EAE6',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: '#2C302E',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
              <div>
                <strong>{t('common.orders')}: </strong>#{order.id.substring(0, 8).toUpperCase()} -{' '}
                {order.customerName}
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  📍 {order.addressLine1}, {order.city}, {order.state} {order.zipCode}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  {t('delivery.quote.fee')}: <strong>${collectedFee.toFixed(2)}</strong>
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {t('common.status')}: {order.status}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#6b7280' }}>
            <div
              style={{
                fontSize: '2.5rem',
                marginBottom: '1rem',
                animation: 'spin 2s linear infinite',
                display: 'inline-block',
              }}
            >
              ❁
            </div>
            <p style={{ fontWeight: 500 }}>{t('common.loading')}</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : quotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#8a8f8c' }}>
            <AlertTriangle size={32} style={{ marginBottom: '0.5rem', color: '#d97706' }} />
            <p>{t('delivery.errors.quoteFailed')}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #E8EAE6', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8EAE6' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600 }}>
                    {t('delivery.quote.provider')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600 }}>
                    {t('delivery.quote.eta')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'right' }}>
                    {t('delivery.quote.cost')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'right' }}>
                    {t('delivery.quote.fee')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'right' }}>
                    {t('delivery.quote.margin')}
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600, textAlign: 'right' }}>
                    {t('delivery.quote.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const finalCharge = q.rawResponse?.final_charge || q.estimatedCost;
                  const providerCost = q.rawResponse?.base_cost || q.estimatedCost - 5;
                  const margin = collectedFee - providerCost;
                  const isNegative = margin < 0;

                  return (
                    <tr
                      key={q.provider}
                      style={{
                        borderBottom: '1px solid #E8EAE6',
                        background: q.serviceable ? '#FFFFFF' : '#FAF9F5',
                        opacity: q.serviceable ? 1 : 0.7,
                      }}
                    >
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                        {t(`delivery.provider.${q.provider}`)}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        {q.serviceable ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} /> {q.provider === 'mock' ? '45 min' : '55 min'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', textAlign: 'right', fontWeight: 500 }}>
                        {q.serviceable ? `$${providerCost.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', textAlign: 'right', fontWeight: 500 }}>
                        {q.serviceable ? `$${finalCharge.toFixed(2)}` : '—'}
                      </td>
                      <td
                        style={{
                          padding: '1rem',
                          fontSize: '0.8125rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: isNegative ? '#EF4444' : '#10B981',
                        }}
                      >
                        {q.serviceable ? `$${margin.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {q.serviceable ? (
                          isNegative && !isManager ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: '#EF4444',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                              }}
                              title={t('delivery.quote.overrideApproval')}
                            >
                              <ShieldAlert size={14} /> {t('common.critical')}
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleDispatch(q)}
                              disabled={dispatchingProvider !== null}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                background: isNegative ? '#d97706' : undefined,
                              }}
                            >
                              {dispatchingProvider === q.provider ? (
                                '...'
                              ) : (
                                <>
                                  <Truck size={12} /> {t('delivery.quote.dispatch')}
                                </>
                              )}
                            </Button>
                          )
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#8a8f8c' }}>
                            {q.reasonUnavailable || t('delivery.quote.unavailable')}
                          </span>
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
    </FormModal>
  );
};
