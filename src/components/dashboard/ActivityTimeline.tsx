import React, { useEffect, useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { getRecentAuditLogs, type AuditRecord } from '../../services/auditService';
import { useCompany } from '../../context/CompanyContext';
import styles from './ActivityTimeline.module.css';
import { ShoppingBag, CreditCard, Flower2, Truck, Package, CalendarHeart, FileText } from 'lucide-react';

const activityTemplates = [
  { icon: ShoppingBag, color: '#6C8271', label: 'New order placed' },
  { icon: CreditCard, color: '#D49A9A', label: 'Payment received' },
  { icon: Flower2, color: '#8FA891', label: 'Arrangement completed' },
  { icon: Truck, color: '#3B82F6', label: 'Delivery dispatched' },
  { icon: Package, color: '#F59E0B', label: 'Inventory adjusted' },
  { icon: CalendarHeart, color: '#A78BFA', label: 'Event consultation scheduled' },
];

export const ActivityTimeline: React.FC = () => {
  const { orders } = useAdminStore();
  const { selectedCompanyId } = useCompany();
  const [logs, setLogs] = useState<AuditRecord[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const recentLogs = await getRecentAuditLogs(selectedCompanyId || 'DEFAULT_COMPANY', 8);
        setLogs(recentLogs);
      } catch (error) {
        console.error("Failed to load activity logs:", error);
      }
    };
    fetchLogs();
  }, [orders, selectedCompanyId]); // Refresh logs when orders list or selected company changes

  const getLogTime = (log: AuditRecord) => {
    const date = log.createdAt 
      ? (log.createdAt as any).toDate?.() || new Date(log.createdAt as any) 
      : new Date();
    return {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    };
  };

  const getLogDetails = (log: AuditRecord) => {
    switch (log.action) {
      case 'RESTOCK_INVENTORY':
        return {
          icon: Package,
          color: '#F59E0B',
          label: 'Inventory Restocked',
          detail: `SKU ${log.entityId} quantity adjusted.`
        };
      case 'PRICE_CHANGE':
        return {
          icon: Flower2,
          color: '#8FA891',
          label: 'Catalog Prices Adjusted',
          detail: 'Mother\'s day rose pricing margins optimized.'
        };
      case 'ORDER_STATUS_CHANGE':
        return {
          icon: ShoppingBag,
          color: '#6C8271',
          label: 'Order Status Changed',
          detail: `Order #${log.entityId.substring(0, 8).toUpperCase()} updated.`
        };
      case 'DELIVERY_STATUS_CHANGE':
        return {
          icon: Truck,
          color: '#3B82F6',
          label: 'Delivery Queue Update',
          detail: `Fulfillment status for #${log.entityId.substring(0, 8).toUpperCase()} updated.`
        };
      case 'LOG_JOURNAL_ENTRY':
        return {
          icon: FileText,
          color: '#D49A9A',
          label: 'GL Journal Logged',
          detail: `${log.actor} posted balanced entry.`
        };
      case 'TAX_ADJUSTMENT':
        return {
          icon: CreditCard,
          color: '#E11D48',
          label: 'Tax Liability Adjusted',
          detail: 'Sales tax liability adjustments recorded.'
        };
      default:
        return {
          icon: ShoppingBag,
          color: '#726E64',
          label: 'System Log',
          detail: `Action: ${log.action}`
        };
    }
  };

  // If we have audit logs in Firestore, use them; otherwise, fall back to orders mock data
  const activities = logs.length > 0 
    ? logs.map((log, idx) => {
        const details = getLogDetails(log);
        const { time, date } = getLogTime(log);
        return {
          id: log.id || `log-${idx}`,
          icon: details.icon,
          color: details.color,
          label: details.label,
          detail: `${details.detail} (${log.actor})`,
          time,
          date
        };
      })
    : orders.slice(0, 8).map((order, index) => {
        const template = activityTemplates[index % activityTemplates.length];
        return {
          id: order.id,
          icon: template.icon,
          color: template.color,
          label: template.label,
          detail: `${order.customerName} — ${order.id.substring(0, 8)}`,
          time: new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        };
      });

  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>Recent Activity</h3>
      <div className={styles.timeline}>
        {activities.map((activity, index) => (
          <div key={activity.id + index} className={styles.timelineItem}>
            <div className={styles.lineContainer}>
              <div className={styles.dot} style={{ backgroundColor: activity.color }}></div>
              {index < activities.length - 1 && <div className={styles.line}></div>}
            </div>
            <div className={styles.content}>
              <p className={styles.label}>{activity.label}</p>
              <p className={styles.detail}>{activity.detail}</p>
            </div>
            <div className={styles.timeCol}>
              <span className={styles.time}>{activity.time}</span>
              <span className={styles.date}>{activity.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
