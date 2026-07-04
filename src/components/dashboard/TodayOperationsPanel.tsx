import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore, getOrderItemCount } from '../../store/adminStore';
import { useToastStore } from '../../store/toastStore';
import { Truck, Sparkles, Clock, CheckCircle2, ChevronRight, AlertCircle, Play } from 'lucide-react';
import styles from './TodayOperationsPanel.module.css';
import { useI18n } from '../../i18n/I18nProvider';
import { localizeError } from '../../i18n/localizedError';

export const TodayOperationsPanel: React.FC = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'deliveries' | 'production' | 'alerts'>('production');
  const navigate = useNavigate();
  const { orders, updateOrderStatus, updateOrderDetails } = useAdminStore();
  const addToast = useToastStore(s => s.addToast);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filtering data dynamically from store
  const todaysDeliveries = orders.filter(o => 
    (o.deliveryDate === todayStr || o.status === 'out_for_delivery') && o.status !== 'cancelled'
  );
  
  const productionQueue = orders.filter(o => 
    o.status === 'confirmed' || o.status === 'scheduled' || o.status === 'in_design'
  );

  const urgentAlerts = orders.filter(o => 
    (o.priority === 'high' || o.deliveryDate === todayStr) && 
    o.status !== 'delivered' && 
    o.status !== 'cancelled' &&
    o.status !== 'refunded'
  );

  const handleStartProduction = async (id: string) => {
    try {
      await updateOrderStatus(id, 'in_design');
      addToast(t('dashboard.movedToDesign', { order: id.substring(0, 8).toUpperCase() }), 'success');
    } catch (e) {
      addToast(localizeError(e, t, 'dashboard.moveToDesignFailed'), 'error');
    }
  };

  const handleCompleteProduction = async (id: string) => {
    try {
      await updateOrderStatus(id, 'ready');
      addToast(t('dashboard.readyForCourier', { order: id.substring(0, 8).toUpperCase() }), 'success');
    } catch (e) {
      addToast(localizeError(e, t, 'dashboard.readyForCourierFailed'), 'error');
    }
  };

  const handleMarkDelivered = async (id: string) => {
    try {
      await updateOrderStatus(id, 'delivered');
      addToast(t('dashboard.orderDelivered', { order: id.substring(0, 8).toUpperCase() }), 'success');
    } catch (e) {
      addToast(localizeError(e, t, 'dashboard.markDeliveredFailed'), 'error');
    }
  };

  const handleAssignDriver = async (id: string, driverName: string) => {
    try {
      await updateOrderDetails(id, { driver: driverName });
      addToast(t('dashboard.driverAssigned', { driver: driverName, order: id.substring(0, 8).toUpperCase() }), 'success');
    } catch (e) {
      addToast(localizeError(e, t, 'dashboard.assignDriverFailed'), 'error');
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Today's Operations</h3>
          <p className={styles.subtitle}>Manage real-time logistics and studio assembly pipelines.</p>
        </div>
        <button className={styles.actionLink} onClick={() => navigate('/admin/orders')}>
          Manage All Orders <ChevronRight size={14} />
        </button>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'production' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('production')}
        >
          <Sparkles size={14} />
          <span>Production Queue ({productionQueue.length})</span>
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'deliveries' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          <Truck size={14} />
          <span>Fulfillment ({todaysDeliveries.length})</span>
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'alerts' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <Clock size={14} />
          <span>Urgent Shifts ({urgentAlerts.length})</span>
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'production' && (
          <div className={styles.list}>
            {productionQueue.length === 0 ? (
              <p className={styles.emptyState}>{t('dashboard.noArrangementsCurrentlyInTheProductionLine')}</p>
            ) : (
              productionQueue.map(order => (
                <div key={order.id} className={styles.card}>
                  <div className={styles.cardLeft}>
                    <span className={`${styles.dot} ${order.status === 'in_design' ? styles.dotPreparing : styles.dotConfirmed}`} />
                    <div>
                      <h4 className={styles.cardTitle}>{order.customerName}</h4>
                      <p className={styles.cardMeta}>
                        Order #{order.id.substring(0, 8).toUpperCase()} • {getOrderItemCount(order.items)} Items • ${(order.total ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    {['confirmed', 'scheduled'].includes(order.status) ? (
                      <button 
                        className={styles.btnAction} 
                        onClick={() => handleStartProduction(order.id)}
                      >
                        <Play size={12} /> Start Crafting
                      </button>
                    ) : (
                      <button 
                        className={styles.btnActionSuccess} 
                        onClick={() => handleCompleteProduction(order.id)}
                      >
                        <CheckCircle2 size={12} /> Ready for Courier
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'deliveries' && (
          <div className={styles.list}>
            {todaysDeliveries.length === 0 ? (
              <p className={styles.emptyState}>{t('dashboard.noDeliveriesScheduledOrInTransitToday')}</p>
            ) : (
              todaysDeliveries.map(order => (
                <div key={order.id} className={styles.card}>
                  <div className={styles.cardLeft}>
                    <span className={`${styles.dot} ${order.status === 'delivered' ? styles.dotDelivered : styles.dotTransit}`} />
                    <div>
                      <h4 className={styles.cardTitle}>{order.customerName}</h4>
                      <p className={styles.cardMeta}>
                        Status: <strong className={styles.statusText}>{order.status.replace(/_/g, ' ')}</strong> • Courier: {order.driver || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    {!order.driver && order.status !== 'delivered' && (
                      <div className={styles.driverPicker}>
                        <select 
                          className={styles.selectDriver}
                          defaultValue=""
                          onChange={(e) => handleAssignDriver(order.id, e.target.value)}
                        >
                          <option value="" disabled>{t('dashboard.assignCourier')}</option>
                          <option value="Julian V.">Julian V.</option>
                          <option value="Clara M.">Clara M.</option>
                          <option value="Marcus K.">Marcus K.</option>
                        </select>
                      </div>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <button 
                        className={styles.btnActionSuccess} 
                        onClick={() => handleMarkDelivered(order.id)}
                      >
                        <CheckCircle2 size={12} /> Complete Delivery
                      </button>
                    )}
                    {order.status === 'delivered' && (
                      <span className={styles.completedBadge}>
                        <CheckCircle2 size={12} /> Delivered
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className={styles.list}>
            {urgentAlerts.length === 0 ? (
              <p className={styles.emptyState}>No high-priority or delayed items requiring instant resolution.</p>
            ) : (
              urgentAlerts.map(order => (
                <div key={order.id} className={`${styles.card} ${styles.cardUrgent}`}>
                  <div className={styles.cardLeft}>
                    <AlertCircle size={16} className={styles.iconAlert} />
                    <div>
                      <h4 className={styles.cardTitle}>{order.customerName}</h4>
                      <p className={styles.cardMeta}>
                        Needs immediate attention • Delivery Due: {order.deliveryDate} • Status: {order.status}
                      </p>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <button 
                      className={styles.btnUrgentSolve}
                      onClick={async () => {
                        if (order.status === 'draft' || order.status === 'confirmed' || order.status === 'scheduled') {
                          handleStartProduction(order.id);
                        } else if (order.status === 'in_design') {
                          handleCompleteProduction(order.id);
                        } else if (order.status === 'ready') {
                          try {
                            await updateOrderStatus(order.id, 'out_for_delivery');
                            addToast(t('dashboard.dispatchedToCourier', { order: order.id.substring(0, 8).toUpperCase() }), 'success');
                          } catch (e) {
                            addToast(localizeError(e, t, 'dashboard.dispatchFailed'), 'error');
                          }
                        } else {
                          handleMarkDelivered(order.id);
                        }
                      }}
                    >
                      Resolve Status
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
