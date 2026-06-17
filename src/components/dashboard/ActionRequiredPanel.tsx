import React, { useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { useToastStore } from '../../store/toastStore';
import { restockInventoryAndPostFinancials } from '../../services/financeService';
import { AlertTriangle, UserPlus, ShieldCheck } from 'lucide-react';
import styles from './ActionRequiredPanel.module.css';
import { useI18n } from '../../i18n/I18nProvider';

export const ActionRequiredPanel: React.FC = () => {
  const { t } = useI18n();
  const { inventory, orders, updateOrderStatus, updateOrderDetails } = useAdminStore();
  const addToast = useToastStore(s => s.addToast);

  const [restockAmounts, setRestockAmounts] = useState<Record<string, number>>({});
  const [isRestockingSku, setIsRestockingSku] = useState<string | null>(null);

  // 1. Filter Low Stock Items
  const lowStockItems = inventory.filter(item => item.quantity <= item.reorderPoint);

  // 2. Filter Unassigned Delivery Orders
  const unassignedOrders = orders.filter(o => 
    (o.status === 'in_design' || o.status === 'ready') && !o.driver
  );

  // 3. Filter Urgent Drafts/Unconfirmed
  const unconfirmedOrders = orders.filter(o => 
    o.status === 'draft' && o.priority === 'high'
  );

  const handleRestock = async (sku: string, unitCost: number, name: string) => {
    const amount = restockAmounts[sku] || 50;
    if (amount <= 0) {
      addToast('Restock quantity must be greater than zero.', 'error');
      return;
    }

    setIsRestockingSku(sku);
    try {
      // Safe, protected transaction flow
      await restockInventoryAndPostFinancials(sku, amount, unitCost);
      addToast(`Restocked ${amount}x ${name}. GL posted & ledger refreshed.`, 'success');
      
      // Clear amount input
      setRestockAmounts(prev => {
        const next = { ...prev };
        delete next[sku];
        return next;
      });
    } catch (error: unknown) {
      console.error(error);
      const errMsg = (error as { message?: string })?.message || `Failed to complete restocking transaction for ${name}.`;
      addToast(errMsg, 'error');
    } finally {
      setIsRestockingSku(null);
    }
  };

  const handleAssignDriver = (orderId: string, driver: string) => {
    updateOrderDetails(orderId, { driver });
    addToast(`Assigned courier ${driver} to order.`, 'success');
  };

  const handleConfirmOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'confirmed');
    addToast(`High priority order verified and confirmed.`, 'success');
  };

  const hasAlerts = lowStockItems.length > 0 || unassignedOrders.length > 0 || unconfirmedOrders.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <AlertTriangle className={styles.alertHeaderIcon} size={18} />
          <div>
            <h3 className={styles.title}>{t('dashboard.actionRequired')}</h3>
            <p className={styles.subtitle}>{t('dashboard.criticalIssuesRequiringImmediateOperationsApproval')}</p>
          </div>
        </div>
        <span className={styles.alertCountBadge}>
          {lowStockItems.length + unassignedOrders.length + unconfirmedOrders.length} Issues
        </span>
      </div>

      <div className={styles.alertList}>
        {!hasAlerts ? (
          <div className={styles.allClear}>
            <ShieldCheck size={32} className={styles.allClearIcon} />
            <p className={styles.allClearText}>{t('dashboard.allOperationsClearNoUrgentTasksPendingApproval')}</p>
          </div>
        ) : (
          <>
            {/* Category: Low Stock Inventory (Protected Restocking Flow) */}
            {lowStockItems.map(item => (
              <div key={item.id} className={`${styles.alertItem} ${styles.alertStock}`}>
                <div className={styles.alertLeft}>
                  <div className={styles.alertBadgeStock}>{t('dashboard.lowInventory')}</div>
                  <div>
                    <h4 className={styles.alertTitle}>{item.name}</h4>
                    <p className={styles.alertMeta}>
                      SKU: {item.sku} • Cost: ${item.unitCost.toFixed(2)}/stem •{' '}
                      <strong className={styles.criticalText}>{item.quantity} remaining</strong> (Reorder: {item.reorderPoint})
                    </p>
                  </div>
                </div>

                <div className={styles.restockForm}>
                  <input
                    type="number"
                    min="1"
                    placeholder="50"
                    value={restockAmounts[item.sku] ?? ''}
                    className={styles.restockInput}
                    disabled={isRestockingSku === item.sku}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setRestockAmounts(prev => ({ ...prev, [item.sku]: isNaN(val) ? 0 : val }));
                    }}
                  />
                  <button
                    className={styles.btnRestock}
                    disabled={isRestockingSku === item.sku}
                    onClick={() => handleRestock(item.sku, item.unitCost, item.name)}
                  >
                    {isRestockingSku === item.sku ? 'Securing...' : 'Restock GL'}
                  </button>
                </div>
              </div>
            ))}

            {/* Category: Unassigned Delivery Courier */}
            {unassignedOrders.map(order => (
              <div key={order.id} className={`${styles.alertItem} ${styles.alertCourier}`}>
                <div className={styles.alertLeft}>
                  <div className={styles.alertBadgeCourier}>{t('dashboard.needsCourier')}</div>
                  <div>
                    <h4 className={styles.alertTitle}>Delivery for {order.customerName}</h4>
                    <p className={styles.alertMeta}>
                      Order #{order.id.substring(0, 8).toUpperCase()} • Due: {order.deliveryDate} • Status: preparing
                    </p>
                  </div>
                </div>

                <div className={styles.assignActions}>
                  <button 
                    className={styles.btnAssign}
                    onClick={() => handleAssignDriver(order.id, 'Julian V.')}
                  >
                    <UserPlus size={12} /> Julian
                  </button>
                  <button 
                    className={styles.btnAssign}
                    onClick={() => handleAssignDriver(order.id, 'Clara M.')}
                  >
                    <UserPlus size={12} /> Clara
                  </button>
                </div>
              </div>
            ))}

            {/* Category: Urgent Unconfirmed Draft */}
            {unconfirmedOrders.map(order => (
              <div key={order.id} className={`${styles.alertItem} ${styles.alertConfirm}`}>
                <div className={styles.alertLeft}>
                  <div className={styles.alertBadgeConfirm}>{t('dashboard.urgentDraft')}</div>
                  <div>
                    <h4 className={styles.alertTitle}>Arrangement Draft: {order.customerName}</h4>
                    <p className={styles.alertMeta}>
                      Total: ${order.total.toFixed(2)} • Created: {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button 
                  className={styles.btnVerify}
                  onClick={() => handleConfirmOrder(order.id)}
                >
                  Confirm Order
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
