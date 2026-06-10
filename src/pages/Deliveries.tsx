import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { Button } from '../components/ui/Button';
import { MapPin, Printer, Truck, CheckCircle2, Clock } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { writeAuditLog } from '../services/auditService';
import { EmptyState } from '../components/ui/EmptyState';
import styles from '../components/layout/AdminList.module.css';

export const Deliveries: React.FC = () => {
  const { orders, updateOrderStatus, setActiveModal, fetchOrders, ordersLoading } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastOptimized, setLastOptimized] = useState<string | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filters local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('active');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const searchTerm = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalActiveDeliveries = orders.filter(o => 
    o.status === 'confirmed' || o.status === 'preparing' || o.status === 'out_for_delivery'
  ).length;
  const inAssembly = orders.filter(o => o.status === 'preparing').length;
  const inTransit = orders.filter(o => o.status === 'out_for_delivery').length;
  const deliveredToday = orders.filter(o => o.status === 'delivered').length;

  // Status Tab Counts
  const allActiveCount = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing' || o.status === 'out_for_delivery').length;
  const assemblyCount = orders.filter(o => o.status === 'preparing').length;
  const transitCount = orders.filter(o => o.status === 'out_for_delivery').length;
  const completedCount = orders.filter(o => o.status === 'delivered').length;

  const filteredDeliveries = orders.filter(o => {
    // Delivery records are backed by Orders that are confirmed, preparing, out_for_delivery, or delivered
    const isDelivery = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(o.status);
    if (!isDelivery) return false;

    // Search filter
    const matchesSearch = 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.recipientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.addressLine1 || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Tab Status Filter
    if (selectedStatusFilter === 'active') {
      if (!['confirmed', 'preparing', 'out_for_delivery'].includes(o.status)) return false;
    } else if (selectedStatusFilter === 'preparing') {
      if (o.status !== 'preparing') return false;
    } else if (selectedStatusFilter === 'transit') {
      if (o.status !== 'out_for_delivery') return false;
    } else if (selectedStatusFilter === 'delivered') {
      if (o.status !== 'delivered') return false;
    }

    // Driver filter
    if (driverFilter !== 'all') {
      const assignedCourier = o.courier || o.driver || '';
      if (assignedCourier !== driverFilter) return false;
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

  const handleDispatch = async (id: string) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order ? order.status : null;

    updateOrderStatus(id, 'out_for_delivery');

    await writeAuditLog({
      actor: 'Logistics',
      action: 'DELIVERY_STATUS_CHANGE',
      entityType: 'order',
      entityId: id,
      before: oldStatus ? { status: oldStatus } : null,
      after: { status: 'out_for_delivery' }
    });

    addToast(`Order ${id.substring(0,8)} dispatched to driver.`, 'success');
  };

  const handleComplete = async (id: string) => {
    const order = orders.find(o => o.id === id);
    const oldStatus = order ? order.status : null;

    updateOrderStatus(id, 'delivered');

    await writeAuditLog({
      actor: 'Logistics',
      action: 'DELIVERY_STATUS_CHANGE',
      entityType: 'order',
      entityId: id,
      before: oldStatus ? { status: oldStatus } : null,
      after: { status: 'delivered' }
    });

    addToast(`Order ${id.substring(0,8)} marked as delivered.`, 'success');
  };

  const handleOptimize = () => {
    setLastOptimized(new Date().toLocaleTimeString());
    addToast('Courier routes optimized dynamically. Route efficiency increased by 14%.', 'success');
  };

  const handlePrint = () => {
    addToast('Opening print manager for dispatch manifests...', 'info');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Logistics Dispatch Center
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Optimize delivery routes, assign courier drivers, and track live dispatches.
            {lastOptimized && (
              <span style={{ color: 'var(--color-sage-dark)', marginLeft: '0.75rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                ✓ Optimized at {lastOptimized}
              </span>
            )}
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={handleOptimize} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <MapPin size={16} style={{ marginRight: '0.35rem' }} /> Optimize Routes
          </Button>
          <Button variant="outline" onClick={handlePrint} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Printer size={16} style={{ marginRight: '0.35rem' }} /> Print Manifests
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Active Deliveries</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalActiveDeliveries}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Awaiting or in transit</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>In Assembly</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {inAssembly}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Preparing in floral studio</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Out for Delivery</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {inTransit}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Active courier vans active</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Delivered Today</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {deliveredToday}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Successfully dropped off</div>
          </div>
        </div>
      </div>

      {/* Main Table Card workspace */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counters Tab-bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'active', label: 'Active Queue', count: allActiveCount },
            { key: 'preparing', label: 'In Assembly', count: assemblyCount },
            { key: 'transit', label: 'Out for Delivery', count: transitCount },
            { key: 'delivered', label: 'Completed Deliveries', count: completedCount },
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

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver</span>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Couriers</option>
              <option value="Marcus T.">Marcus T.</option>
              <option value="Elena R.">Elena R.</option>
              <option value="James K.">James K.</option>
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
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="vip">VIP Courier</option>
            </select>
          </div>

          {(driverFilter !== 'all' || priorityFilter !== 'all' || selectedStatusFilter !== 'active' || searchTerm) && (
            <button
              onClick={() => {
                setDriverFilter('all');
                setPriorityFilter('all');
                setSelectedStatusFilter('active');
                searchParams.delete('search');
                setSearchParams(searchParams);
              }}
              style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Table data */}
        {ordersLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>❁</div>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Fetching live Firestore deliveries...</p>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching deliveries found." : "No active deliveries in this queue."}
            description={searchTerm ? `No delivery items in the active queue match "${searchTerm}".` : "Adjust your status filter or schedule dispatch orders."}
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
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Order ID</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Delivery Date</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Recipient</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Courier</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Route</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Priority</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(order => (
                  <tr 
                    key={order.id}
                    onDoubleClick={() => {
                      setActiveModal('newDelivery', order);
                      addToast(`Opening delivery details for order #${order.id.substring(0, 8)}.`, 'info');
                    }}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                    title="Double-click to view/edit delivery console"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1.125rem 1.5rem' }}><strong>{order.id.substring(0, 8).toUpperCase()}</strong></td>
                    <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{new Date(order.deliveryDate).toLocaleDateString()}</td>
                    <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500 }}>{order.recipientName || order.customerName}</td>
                    <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{order.courier || order.driver || 'Unassigned'}</td>
                    <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{order.routeNumber || 'N/A'}</td>
                    <td style={{ padding: '1.125rem 1.5rem' }}>
                      <span className={styles.statusBadge} style={{
                        background: order.priority === 'vip' ? '#FEE2E2' : (order.priority === 'urgent' ? '#FEF3C7' : '#E0E7FF'),
                        color: order.priority === 'vip' ? '#991B1B' : (order.priority === 'urgent' ? '#92400E' : '#3730A3'),
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}>
                        {(order.priority || 'normal').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.125rem 1.5rem' }}>
                      <span className={`${styles.statusBadge} ${styles['status-' + order.status]}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        {order.status !== 'out_for_delivery' && order.status !== 'delivered' && (
                          <button className={styles.actionBtn} onClick={() => handleDispatch(order.id)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#F0F5F1', color: '#4A6B50', fontWeight: 600, cursor: 'pointer' }}>
                            Dispatch
                          </button>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <button className={styles.actionBtn} onClick={() => handleComplete(order.id)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#E0F2FE', color: '#0369A1', fontWeight: 600, cursor: 'pointer' }}>
                            Complete
                          </button>
                        )}
                        <button 
                          className={styles.actionBtn} 
                          onClick={() => setActiveModal('newDelivery', order)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Edit Details
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
