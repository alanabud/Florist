import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Download, Plus, Repeat, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { exportSubscriptionsPDF } from '../services/pdfExportService';
import { exportSubscriptionsExcel } from '../services/excelExportService';
import { EmptyState } from '../components/ui/EmptyState';
import styles from '../components/layout/AdminList.module.css';

export const Subscriptions: React.FC = () => {
  const { subscriptions, setActiveModal, toggleSubscriptionStatus } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);

  // Filter local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [billingFilter, setBillingFilter] = useState<string>('all');

  const searchTerm = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalSubscribers = subscriptions.length;
  const activeSubscribers = subscriptions.filter(s => s.status === 'active').length;
  const mrrSum = subscriptions.reduce((sum, s) => sum + (s.value || 0), 0);

  const nextSevenDays = new Date();
  nextSevenDays.setDate(nextSevenDays.getDate() + 7);
  const nextSevenCount = subscriptions.filter(s => {
    const deliveryDate = new Date(s.nextDelivery);
    return deliveryDate >= new Date() && deliveryDate <= nextSevenDays && s.status === 'active';
  }).length;

  // Status Tab Counts
  const allCount = totalSubscribers;
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const pausedCount = subscriptions.filter(s => s.status === 'paused').length;
  const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length;

  const uniqueFrequencies = Array.from(new Set(subscriptions.map(s => s.frequency))).filter(Boolean);

  const filteredSubs = subscriptions.filter(s => {
    // Search filter
    const matchesSearch = 
      s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.product.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Status Tab Filter
    if (selectedStatusFilter !== 'all' && s.status !== selectedStatusFilter) {
      return false;
    }

    // Frequency filter
    if (frequencyFilter !== 'all' && s.frequency !== frequencyFilter) {
      return false;
    }

    // Billing Status filter
    if (billingFilter !== 'all') {
      const currentBilling = s.billingStatus || 'paid';
      if (currentBilling !== billingFilter) return false;
    }

    return true;
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

  const handleToggleStatus = (id: string, name: string) => {
    toggleSubscriptionStatus(id);
    const sub = subscriptions.find(s => s.id === id);
    const isNowActive = sub ? sub.status !== 'active' : true;
    addToast(`Subscription for ${name} has been ${isNowActive ? 'resumed' : 'paused'}.`, 'success');
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-subscriptions-${selectedStatusFilter}-${dateStr}.pdf`;
    exportSubscriptionsPDF(filteredSubs, filename);
    addToast(`Exported ${filteredSubs.length} subscriptions to PDF.`, 'success');
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-subscriptions-${selectedStatusFilter}-${dateStr}.xlsx`;
    exportSubscriptionsExcel(filteredSubs, filename);
    addToast(`Exported ${filteredSubs.length} subscriptions as Excel.`, 'success');
  };

  const handleEditSubscription = (sub: typeof subscriptions[0]) => {
    setActiveModal('newSubscription', sub as unknown as Record<string, unknown>);
    addToast(`Opening subscription workspace for ${sub.customerName}.`, 'info');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Recurring Subscriptions
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Monitor recurring customer subscriptions, automate delivery schedules, and track monthly recurring revenue (MRR).
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newSubscription')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} /> New Subscription
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Repeat size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Total Accounts</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalSubscribers} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280' }}>Active/Paused</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Total subscription profiles</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Active Subscriptions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {activeSubscribers} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#047857' }}>Live</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Currently billing cycles</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Monthly MRR Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${mrrSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Recurring business baseline</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Dispatching In 7 Days</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {nextSevenCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#b45309' }}>Stops</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Due for courier generation</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counter Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Accounts', count: allCount },
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'paused', label: 'Paused', count: pausedCount },
            { key: 'cancelled', label: 'Cancelled', count: cancelledCount },
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

        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
          <input 
            type="text" 
            placeholder="Search by Customer or Product..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frequency</span>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Frequencies</option>
              {uniqueFrequencies.map(freq => (
                <option key={freq} value={freq}>{freq.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billing Status</span>
            <select
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Billings</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed / Overdue</option>
            </select>
          </div>

          {(frequencyFilter !== 'all' || billingFilter !== 'all' || selectedStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setFrequencyFilter('all');
                setBillingFilter('all');
                setSelectedStatusFilter('all');
                searchParams.delete('search');
                setSearchParams(searchParams);
              }}
              style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Subscription Table */}
        {filteredSubs.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching subscriptions found." : "No subscriptions under this filter."}
            description={searchTerm ? `No subscription matches "${searchTerm}".` : "Adjust your filters or configure a new client subscription."}
            actionLabel={searchTerm ? "Clear Search" : undefined}
            onAction={searchTerm ? () => {
              searchParams.delete('search');
              setSearchParams(searchParams);
            } : undefined}
          />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#FDFCFA' }}>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Subscriber Name</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Plan Arrangement</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Delivery Frequency</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Next Scheduled Date</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Price Per Cycle</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Billing Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map(sub => {
                  const currentBilling = sub.billingStatus || 'paid';
                  
                  return (
                    <tr 
                      key={sub.id}
                      onDoubleClick={() => handleEditSubscription(sub)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      title="Double-click to open subscription workspace"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>
                        {sub.customerName}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        {sub.product}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.8125rem' }}>
                        <span className={styles.statusBadge} style={{ background: '#EAF0EB', color: '#4A6B50', fontSize: '0.7rem' }}>
                          {sub.frequency.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        {new Date(sub.nextDelivery).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>
                        ${sub.value.toFixed(2)}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={styles.statusBadge} style={{
                          background: currentBilling === 'paid' ? '#DEF7EC' : (currentBilling === 'failed' ? '#FDE8E8' : '#FEF3C7'),
                          color: currentBilling === 'paid' ? '#03543F' : (currentBilling === 'failed' ? '#9B1C1C' : '#92400E'),
                          fontSize: '0.7rem'
                        }}>
                          {currentBilling.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={`${styles.statusBadge} ${sub.status === 'active' ? styles.statusActive : styles.statusPaused}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          {sub.status === 'active' ? (
                             <button className={styles.actionBtn} onClick={() => handleToggleStatus(sub.id, sub.customerName)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFBEB', color: '#D97706', fontWeight: 600, cursor: 'pointer' }}>
                               Pause
                             </button>
                          ) : (
                             <button className={styles.actionBtn} onClick={() => handleToggleStatus(sub.id, sub.customerName)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#ECFDF5', color: '#059669', fontWeight: 600, cursor: 'pointer' }}>
                               Resume
                             </button>
                          )}
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handleEditSubscription(sub)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Edit
                          </button>
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
    </div>
  );
};
