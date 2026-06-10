import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore, type OrderStatus } from '../store/adminStore';
import { Button } from '../components/ui/Button';
import { Download, Plus, ShoppingBag, TrendingUp, Sparkles, DollarSign } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { exportOrdersPDF } from '../services/pdfExportService';
import { exportOrdersExcel } from '../services/excelExportService';
import { writeAuditLog } from '../services/auditService';
import { EmptyState } from '../components/ui/EmptyState';
import styles from '../components/layout/AdminList.module.css';

export const Orders: React.FC = () => {
  const { orders, updateOrderStatus, setActiveModal, fetchOrders, ordersLoading, postOrderFinancialsAction } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const searchParam = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics for the ribbon
  const grossRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const activePreparing = orders.filter(o => o.status === 'in_design').length;
  const inTransitCount = orders.filter(o => o.status === 'out_for_delivery').length;
  const unpaidBalance = orders
    .filter(o => o.status !== 'cancelled' && o.paymentStatus !== 'paid')
    .reduce((sum, o) => sum + (o.balanceDue || 0), 0);

  // 2. Count for status tabs
  const allCount = orders.length;
  const draftCount = orders.filter(o => o.status === 'draft').length;
  const confirmedCount = orders.filter(o => o.status === 'confirmed').length;
  const preparingCount = orders.filter(o => o.status === 'in_design').length;
  const transitCount = orders.filter(o => o.status === 'out_for_delivery').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

  const filteredOrders = orders.filter(o => {
    // Search filter
    const matchesSearch = 
      o.id.toLowerCase().includes(searchParam.toLowerCase()) || 
      o.customerName.toLowerCase().includes(searchParam.toLowerCase()) ||
      (o.recipientName || '').toLowerCase().includes(searchParam.toLowerCase());
    if (!matchesSearch) return false;

    // Status filter
    if (selectedStatusFilter !== 'all' && o.status !== selectedStatusFilter) {
      return false;
    }

    // Payment filter
    if (paymentFilter !== 'all') {
      const isPaid = o.paymentStatus === 'paid';
      if (paymentFilter === 'paid' && !isPaid) return false;
      if (paymentFilter === 'unpaid' && isPaid) return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && o.priority !== priorityFilter) {
      return false;
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

  const handleStatusChange = async (id: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order ? order.status : null;

    updateOrderStatus(id, newStatus);

    await writeAuditLog({
      actor: 'Admin',
      action: 'ORDER_STATUS_CHANGE',
      entityType: 'order',
      entityId: id,
      before: oldStatus ? { status: oldStatus } : null,
      after: { status: newStatus }
    });

    addToast(`Order ${id.substring(0, 8)} status updated to ${newStatus.replace('_', ' ')}`, 'success');
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-orders-${selectedStatusFilter}-${dateStr}.pdf`;
    exportOrdersPDF(filteredOrders, filename);
    addToast(`Exported ${filteredOrders.length} orders to PDF.`, 'success');
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-orders-${selectedStatusFilter}-${dateStr}.xlsx`;
    exportOrdersExcel(filteredOrders, filename);
    addToast(`Exported ${filteredOrders.length} orders as Excel.`, 'success');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* 1. Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Orders Command Console
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Monitor floristry dispatches, process client accounts, and route logistics workflows.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newOrder')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} /> Create Order
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Gross Revenue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Active sales summary</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Design Pipeline</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {activePreparing} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#d97706' }}>In Assembly</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Awaiting stem makeup</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Transit Status</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {inTransitCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6366f1' }}>On Route</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Active driver dispatches</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', padding: '0.75rem', borderRadius: '12px' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Outstanding balance (AR)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${unpaidBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Awaiting settlement</div>
          </div>
        </div>
      </div>

      {/* 3. Main Data Card Workspace */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counters Tab-bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Orders', count: allCount },
            { key: 'draft', label: 'Drafts', count: draftCount },
            { key: 'confirmed', label: 'Confirmed', count: confirmedCount },
            { key: 'in_design', label: 'In Design', count: preparingCount },
            { key: 'out_for_delivery', label: 'Transit', count: transitCount },
            { key: 'delivered', label: 'Delivered', count: deliveredCount },
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

        {/* Toolbar & filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
          <input 
            type="text" 
            placeholder="Search by Order ID, Client, Recipient..." 
            className={styles.searchInput}
            value={searchParam}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Billings</option>
              <option value="paid">Settled (Paid)</option>
              <option value="unpaid">Awaiting Payment</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {(paymentFilter !== 'all' || priorityFilter !== 'all' || selectedStatusFilter !== 'all' || searchParam) && (
            <button
              onClick={() => {
                setPaymentFilter('all');
                setPriorityFilter('all');
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

        {/* Data Table */}
        {ordersLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>❁</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Fetching live Firestore orders...</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title={searchParam ? "No matching orders found." : "No orders found for this filter."}
            description={searchParam ? `No order records in database match "${searchParam}".` : "Adjust your filters or create a new order."}
            actionLabel={searchParam ? "Clear Search" : undefined}
            onAction={searchParam ? () => {
              searchParams.delete('search');
              setSearchParams(searchParams);
            } : undefined}
          />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#FDFCFA' }}>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Order ID</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Date</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Customer</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Total</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Payment</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Assigned Staff</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr 
                    key={order.id} 
                    onDoubleClick={() => {
                      setActiveModal('newOrder', order);
                      addToast(`Opening order #${order.id.substring(0, 8)} details.`, 'info');
                    }}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                    title="Double-click to open order console"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1.125rem 1.5rem' }}><strong>{order.id.substring(0, 8).toUpperCase()}</strong></td>
                    <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500 }}>{order.customerName}</td>
                    <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>${order.total.toFixed(2)}</td>
                    <td style={{ padding: '1.125rem 1.5rem' }}>
                      <span className={styles.statusBadge} style={{ background: order.paymentStatus === 'paid' ? '#DEF7EC' : '#FDE8E8', color: order.paymentStatus === 'paid' ? '#03543F' : '#9B1C1C', fontSize: '0.7rem', fontWeight: 600 }}>
                        {(order.paymentStatus || 'unpaid').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.8125rem', color: '#4b5563' }}>{order.assignedStaffId || 'Unassigned'}</td>
                    <td style={{ padding: '1.125rem 1.5rem' }}>
                      <span className={`${styles.statusBadge} ${styles['status-' + order.status]}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        {order.glPostingStatus === 'unposted' && (
                          <button
                            className={styles.actionBtn}
                            onClick={async () => {
                              try {
                                await postOrderFinancialsAction(order.id);
                                addToast(`Order #${order.orderNumber || order.id.substring(0, 8).toUpperCase()} posted to General Ledger.`, 'success');
                              } catch (e: any) {
                                addToast(e.message || 'GL Posting failed', 'error');
                              }
                            }}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #4A6B50', borderRadius: '6px', background: '#F0F5F1', color: '#4A6B50', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Post to Ledger
                          </button>
                        )}
                        <select 
                          className={styles.actionBtn} 
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          style={{ padding: '0.35rem 0.5rem', border: '1px solid #E8EAE6', borderRadius: '6px', fontSize: '0.8125rem', outline: 'none' }}
                        >
                          <option value="draft">Draft</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="preparing">Preparing</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => setActiveModal('newOrder', order)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
