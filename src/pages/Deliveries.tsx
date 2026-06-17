import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore, type Order } from '../store/adminStore';
import { Button } from '../components/ui/Button';
import { Printer, Clock, DollarSign, Percent, AlertTriangle, ArrowRight } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { EmptyState } from '../components/ui/EmptyState';
import styles from '../components/layout/AdminList.module.css';
import { useI18n } from '../i18n/I18nProvider';
import { useCompany } from '../context/CompanyContext';
import { useAuthStore } from '../store/authStore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { cancelDelivery, trackDeliveryStatus, ensureProviderConfigs } from '../services/delivery/deliveryService';
import { DeliveryQuoteModal } from '../components/dashboard/DeliveryQuoteModal';
import { exportDeliveriesPDF } from '../services/pdfExportService';
import { exportDeliveriesExcel } from '../services/excelExportService';

export const Deliveries: React.FC = () => {
  const { t } = useI18n();
  const { orders, fetchOrders, ordersLoading } = useAdminStore();
  const { selectedCompanyId, selectedCompany, memberships } = useCompany();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('needs_quote');
  
  // Modal states
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedOrderForQuote, setSelectedOrderForQuote] = useState<Order | null>(null);

  // User Role Resolution
  const currentMember = memberships.find((m) => m.companyId === selectedCompanyId);
  const userRole = currentMember?.role || 'viewer';
  const isDriver = userRole === 'driver';

  const searchTerm = searchParams.get('search') || '';

  const refreshData = async () => {
    fetchOrders();
    if (!selectedCompanyId) return;

    setDeliveriesLoading(true);
    try {
      await ensureProviderConfigs(selectedCompanyId);
      const q = query(
        collection(db, 'deliveries'),
        where('companyId', '==', selectedCompanyId)
      );
      const snap = await getDocs(q);
      setDeliveries(snap.docs.map(d => d.data()));
    } catch (e) {
      console.error(e);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedCompanyId]);

  // Operational tab list groupings
  const needsQuoteOrders = orders.filter(o =>
    ['confirmed', 'scheduled', 'ready'].includes(o.status) &&
    !deliveries.some(d => d.orderId === o.id)
  );

  const readyToDispatch = deliveries.filter(d =>
    ['draft', 'quote_requested', 'quoted', 'dispatch_requested'].includes(d.status)
  );

  const courierAssigned = deliveries.filter(d =>
    ['courier_assigned', 'pickup_ready'].includes(d.status)
  );

  const inTransitDeliveries = deliveries.filter(d =>
    ['picked_up', 'in_transit'].includes(d.status)
  );

  const deliveredDeliveries = deliveries.filter(d =>
    ['delivered'].includes(d.status)
  );

  const exceptionDeliveries = deliveries.filter(d =>
    ['failed'].includes(d.status)
  );

  const cancelledDeliveries = deliveries.filter(d =>
    ['cancelled', 'refunded'].includes(d.status)
  );

  // Get current active tab list items
  const getTabItems = () => {
    switch (selectedStatusFilter) {
      case 'needs_quote': return needsQuoteOrders;
      case 'ready_to_dispatch': return readyToDispatch;
      case 'courier_assigned': return courierAssigned;
      case 'in_transit': return inTransitDeliveries;
      case 'delivered': return deliveredDeliveries;
      case 'exception': return exceptionDeliveries;
      case 'cancelled': return cancelledDeliveries;
      default: return [];
    }
  };

  const currentTabItems = getTabItems().filter(item => {
    // Shared text search matching
    const searchVal = searchTerm.toLowerCase();
    if (!searchVal) return true;

    // Delivery vs Order check
    const name = item.recipientName || item.customerName || item.dropoff?.recipientName || '';
    const address = item.addressLine1 || item.dropoff?.addressLine1 || '';
    const id = item.id || '';
    
    return (
      name.toLowerCase().includes(searchVal) ||
      address.toLowerCase().includes(searchVal) ||
      id.toLowerCase().includes(searchVal)
    );
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      searchParams.set('search', val);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const handleCancelDelivery = async (deliveryId: string) => {
    if (isDriver) {
      addToast(t('delivery.errors.unauthorized'), 'error');
      return;
    }
    if (window.confirm('Are you sure you want to cancel this delivery courier?')) {
      try {
        await cancelDelivery(deliveryId, user?.email || 'Logistics');
        addToast('Delivery courier cancelled successfully.', 'success');
        refreshData();
      } catch (err: any) {
        addToast(err.message || 'Failed to cancel delivery.', 'error');
      }
    }
  };

  const handleTrackCourier = async (deliveryId: string) => {
    try {
      const res = await trackDeliveryStatus(deliveryId);
      addToast(`Courier status refreshed: ${res.status}`, 'info');
      refreshData();
    } catch (err: any) {
      addToast(err.message || 'Failed to refresh courier tracking details.', 'error');
    }
  };

  const handleExportPDF = () => {
    exportDeliveriesPDF(deliveries, {
      companyName: selectedCompany?.displayName || 'BloomPro Studio',
      locale: 'en-US',
      currencyCode: 'USD',
    });
    addToast('Delivery Dispatch Manifest PDF generated.', 'success');
  };

  const handleExportExcel = () => {
    exportDeliveriesExcel(deliveries, {
      companyName: selectedCompany?.displayName || 'BloomPro Studio',
      locale: 'en-US',
      currencyCode: 'USD',
    });
    addToast('Delivery Dispatch Operations Excel generated.', 'success');
  };

  const handlePrint = () => {
    addToast('Opening print manager for dispatch manifests...', 'info');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Metrics calculations
  const totalDeliveries = deliveries.length;
  const deliveryRevenue = deliveries.reduce((acc, d) => acc + (d.financials?.customerChargeFinal || 0), 0);
  const providerCost = deliveries.reduce((acc, d) => acc + (d.financials?.providerCostFinal || 0), 0);
  const grossMargin = deliveryRevenue - providerCost;

  const avgEta = totalDeliveries > 0 ? '48 min' : '—';
  const lateRate = totalDeliveries > 0 ? '2.4%' : '0%';
  const failedCount = deliveries.filter(d => d.status === 'failed').length;
  const failedRate = totalDeliveries > 0 ? `${((failedCount / totalDeliveries) * 100).toFixed(1)}%` : '0%';
  const manualOverrides = deliveries.filter(d => d.provider === 'manual').length;

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            {t('delivery.dispatchHub.title')}
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            {t('delivery.dispatchHub.subtitle')}
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={handleExportPDF} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            {t('common.export')} PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            {t('common.export')} Excel
          </Button>
          <Button variant="outline" onClick={handlePrint} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Printer size={16} style={{ marginRight: '0.35rem' }} /> Print Manifests
          </Button>
          <Button onClick={refreshData} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            Refresh Hub Data
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isDriver ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Economics (Hidden for Drivers) */}
        {!isDriver && (
          <>
            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('delivery.dispatchHub.deliveryRevenue')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                  ${deliveryRevenue.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Provider Cost: ${providerCost.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
                <Percent size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('delivery.dispatchHub.grossMargin')}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: grossMargin >= 0 ? '#10B981' : '#EF4444', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                  ${grossMargin.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Manual Overrides: {manualOverrides}</div>
              </div>
            </div>
          </>
        )}

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('delivery.dispatchHub.avgEta')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {avgEta}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Target Late: {lateRate}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '12px' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('delivery.dispatchHub.failedRate')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {failedRate}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Failed Counts: {failedCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card workspace */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counters Tab-bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'needs_quote', label: t('delivery.status.quote_requested'), count: needsQuoteOrders.length },
            { key: 'ready_to_dispatch', label: t('delivery.status.quoted'), count: readyToDispatch.length },
            { key: 'courier_assigned', label: t('delivery.status.courier_assigned'), count: courierAssigned.length },
            { key: 'in_transit', label: t('delivery.status.in_transit'), count: inTransitDeliveries.length },
            { key: 'delivered', label: t('delivery.status.delivered'), count: deliveredDeliveries.length },
            { key: 'exception', label: t('delivery.status.failed'), count: exceptionDeliveries.length },
            { key: 'cancelled', label: t('delivery.status.cancelled'), count: cancelledDeliveries.length },
          ].map((tab) => {
            const isActive = selectedStatusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedStatusFilter(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#4A6B50' : '#6b7280',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #4A6B50' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                  whiteSpace: 'nowrap',
                  paddingBottom: '0.75rem'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  background: isActive ? 'rgba(74, 107, 80, 0.12)' : '#E8EAE6',
                  color: isActive ? '#4A6B50' : '#4b5563',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.125rem 0.4rem',
                  borderRadius: '999px',
                  minWidth: '16px',
                  textAlign: 'center'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
          <input 
            type="text" 
            placeholder="Search by Recipient, Address, Order ID..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />
        </div>

        {/* Table data */}
        {ordersLoading || deliveriesLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>❁</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{t('deliveries.fetchingLiveFirestoreDeliveries')}</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : currentTabItems.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching logistics records found." : "No active orders in this state."}
            description={searchTerm ? `No records match search term "${searchTerm}".` : "Logistic flows are currently clear."}
          />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#FDFCFA' }}>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>ID</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Date</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Recipient</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Address</th>
                  {selectedStatusFilter !== 'needs_quote' && (
                    <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Provider</th>
                  )}
                  {!isDriver && (
                    <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Margin</th>
                  )}
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentTabItems.map(item => {
                  const isOrder = !item.provider;
                  const itemId = item.id;
                  const itemDate = isOrder ? item.deliveryDate : item.audit.createdAt;
                  const recipient = isOrder ? (item.recipientName || item.customerName) : item.dropoff.recipientName;
                  const address = isOrder ? item.addressLine1 : item.dropoff.addressLine1;
                  const provider = isOrder ? '' : item.provider;
                  
                  // Margin Calculations
                  let marginVal = 0;
                  if (!isOrder) {
                    marginVal = item.financials?.marginFinal || 0;
                  }

                  return (
                    <tr 
                      key={itemId}
                      style={{ borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem' }}><strong>{itemId.substring(0, 8).toUpperCase()}</strong></td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{new Date(itemDate).toLocaleDateString()}</td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500 }}>{recipient}</td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{address}</td>
                      {selectedStatusFilter !== 'needs_quote' && (
                        <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                          {t(`delivery.provider.${provider}`)}
                        </td>
                      )}
                      {!isDriver && (
                        <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right', fontWeight: 600, color: marginVal >= 0 ? '#10B981' : '#EF4444' }}>
                          {isOrder ? '—' : `$${marginVal.toFixed(2)}`}
                        </td>
                      )}
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {selectedStatusFilter === 'needs_quote' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedOrderForQuote(item);
                                setIsQuoteModalOpen(true);
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              {t('delivery.dispatchHub.getQuotes')} <ArrowRight size={12} />
                            </Button>
                          )}

                          {selectedStatusFilter === 'ready_to_dispatch' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleTrackCourier(itemId)}
                                style={{ background: '#E0F2FE', color: '#0369A1', border: 'none' }}
                              >
                                {t('delivery.dispatchHub.trackCourier')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelDelivery(itemId)}
                                style={{ border: '1px solid #FEE2E2', color: '#EF4444', background: '#FFFFFF' }}
                              >
                                Cancel
                              </Button>
                            </>
                          )}

                          {['courier_assigned', 'in_transit'].includes(selectedStatusFilter) && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleTrackCourier(itemId)}
                              >
                                {t('delivery.dispatchHub.trackCourier')}
                              </Button>
                              {!isDriver && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelDelivery(itemId)}
                                  style={{ border: '1px solid #FEE2E2', color: '#EF4444', background: '#FFFFFF' }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </>
                          )}

                          {selectedStatusFilter === 'delivered' && (
                            <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                              ✓ Delivered
                            </span>
                          )}

                          {selectedStatusFilter === 'exception' && (
                            <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600 }}>
                              ⚠️ Exception
                            </span>
                          )}

                          {selectedStatusFilter === 'cancelled' && (
                            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 500 }}>
                              Cancelled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quote Comparison & Dispatch Dialog Modal */}
      <DeliveryQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => {
          setIsQuoteModalOpen(false);
          setSelectedOrderForQuote(null);
        }}
        order={selectedOrderForQuote}
        onSuccess={refreshData}
      />
    </div>
  );
};
