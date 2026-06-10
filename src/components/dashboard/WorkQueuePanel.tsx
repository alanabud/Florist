import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore, type Order } from '../../store/adminStore';
import { useToastStore } from '../../store/toastStore';
import { ArrowRight } from 'lucide-react';
import styles from './WorkQueuePanel.module.css';

const tabs = ['Needs Attention', 'In Production', 'Deliveries', 'Low Stock'];

export const WorkQueuePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();
  const { orders, inventory, updateOrderStatus } = useAdminStore();
  const addToast = useToastStore((s) => s.addToast);

  const needsAttention = orders.filter(o => o.status === 'draft' || o.status === 'confirmed' || o.status === 'scheduled').slice(0, 5);
  const inProduction = orders.filter(o => o.status === 'in_design').slice(0, 5);
  const deliveries = orders.filter(o => o.status === 'out_for_delivery').slice(0, 5);
  const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint);

  const handleAction = (orderId: string, action: string) => {
    if (action === 'confirm') {
      updateOrderStatus(orderId, 'confirmed');
      addToast(`Order ${orderId.substring(0,8)} confirmed.`, 'success');
    } else if (action === 'start') {
      updateOrderStatus(orderId, 'in_design');
      addToast(`Order ${orderId.substring(0,8)} moved to design.`, 'success');
    } else if (action === 'complete') {
      updateOrderStatus(orderId, 'ready');
      addToast(`Order ${orderId.substring(0,8)} marked ready for courier.`, 'success');
    } else if (action === 'delivered') {
      updateOrderStatus(orderId, 'delivered');
      addToast(`Delivery ${orderId.substring(0,8)} completed.`, 'success');
    }
  };

  const renderItems = () => {
    let items: Order[] = [];
    switch (activeTab) {
      case 0: items = needsAttention; break;
      case 1: items = inProduction; break;
      case 2: items = deliveries; break;
      case 3: return lowStock.map(item => (
        <div key={item.id} className={styles.queueItem}>
          <div className={styles.itemLeft}>
            <div className={`${styles.priority} ${styles.priorityHigh}`}></div>
            <div>
              <p className={styles.itemTitle}>{item.name}</p>
              <p className={styles.itemMeta}>{item.quantity} remaining · Reorder at {item.reorderPoint}</p>
            </div>
          </div>
          <button className={styles.actionBtn} onClick={() => navigate('/admin/inventory')}>
            Restock <ArrowRight size={14} />
          </button>
        </div>
      ));
    }

    if (items.length === 0) {
      return <div className={styles.emptyQueue}><p>All clear — nothing pending here.</p></div>;
    }

    return items.map(order => (
      <div key={order.id} className={styles.queueItem}>
        <div className={styles.itemLeft}>
          <div className={`${styles.priority} ${activeTab === 0 ? styles.priorityHigh : styles.priorityMed}`}></div>
          <div>
            <p className={styles.itemTitle}>{order.customerName}</p>
            <p className={styles.itemMeta}>
              {order.id.substring(0,8)} · ${order.total.toFixed(2)} · {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>
        </div>
        <button className={styles.actionBtn} onClick={() => {
          if (activeTab === 0) handleAction(order.id, 'confirm');
          else if (activeTab === 1) handleAction(order.id, 'complete');
          else handleAction(order.id, 'delivered');
        }}>
          {activeTab === 0 ? 'Review' : activeTab === 1 ? 'Mark Ready' : 'Mark Delivered'}
          <ArrowRight size={14} />
        </button>
      </div>
    ));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>Work Queue</h3>
        <button className={styles.viewAll} onClick={() => {
          if (activeTab === 2) navigate('/admin/deliveries');
          else if (activeTab === 3) navigate('/admin/inventory');
          else navigate('/admin/orders');
        }}>
          {activeTab === 2 ? 'Manage' : 'View All'}
        </button>
      </div>
      <div className={styles.tabs}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
            {i === 0 && needsAttention.length > 0 && <span className={styles.tabBadge}>{needsAttention.length}</span>}
            {i === 3 && lowStock.length > 0 && <span className={styles.tabBadge}>{lowStock.length}</span>}
          </button>
        ))}
      </div>
      <div className={styles.queueList}>
        {renderItems()}
      </div>
    </div>
  );
};
