import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { restockInventoryAndPostFinancials } from '../services/financeService';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import { 
  DollarSign, ShoppingBag, Hammer, Truck, AlertTriangle, 
  ShieldCheck, Landmark as BalanceIcon 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { CommandSummary } from '../components/dashboard/CommandSummary';
import { MetricCard } from '../components/dashboard/MetricCard';
import { TodayOperationsPanel } from '../components/dashboard/TodayOperationsPanel';
import { ActionRequiredPanel } from '../components/dashboard/ActionRequiredPanel';
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline';
import { AiInsightsPanel } from '../components/dashboard/AiInsightsPanel';
import { QuickActionsMenu } from '../components/dashboard/QuickActionsMenu';
import { ReconciliationDrawer } from '../components/dashboard/ReconciliationDrawer';
import styles from './Dashboard.module.css';

// Safe date handling helper
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { orders, inventory, setActiveModal, fetchOrders } = useAdminStore();
  const { journalEntries, fetchJournalEntries } = useFinanceStore();
  const addToast = useToastStore(s => s.addToast);
  
  const { selectedCompanyId, companySettings } = useCompany();
  const { t, formatCurrency } = useI18n();

  // Protected loading state for restocking actions
  const [isRestockingSku, setIsRestockingSku] = useState<string | null>(null);

  const [isReconDrawerOpen, setIsReconDrawerOpen] = useState(false);
  const [reconActiveTab, setReconActiveTab] = useState<'cash' | 'revenue' | 'ar' | 'tax'>('cash');

  // Fetch ledger entries and orders on mount
  useEffect(() => {
    fetchJournalEntries();
    fetchOrders();
  }, [fetchJournalEntries, fetchOrders]);

  // Today timezone-safe date matcher
  const today = new Date();
  const isToday = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const todaysPaidOrders = orders.filter(o => {
    const orderDate = toDate(o.createdAt);
    return isToday(orderDate) && !['draft', 'cancelled', 'refunded'].includes(o.status);
  });
  const todaysRevenue = todaysPaidOrders.reduce((sum, o) => sum + o.total, 0);
  const inProduction = orders.filter(o => o.status === 'in_design').length;
  const lowStockItems = inventory.filter(i => i.quantity <= i.reorderPoint);

  // Chart data and sparkline metrics over last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const revenueChartData = last7Days.map(dateStr => {
    const targetDate = new Date(dateStr);
    const dayOrders = orders.filter(o => {
      const orderDate = toDate(o.createdAt);
      if (!orderDate) return false;
      return (
        orderDate.getFullYear() === targetDate.getFullYear() &&
        orderDate.getMonth() === targetDate.getMonth() &&
        orderDate.getDate() === targetDate.getDate() &&
        !['draft', 'cancelled', 'refunded'].includes(o.status)
      );
    });
    return {
      name: new Date(dateStr).toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'short' }),
      revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
      orders: dayOrders.length
    };
  });

  const statusData = [
    { name: t('status.draft'), value: orders.filter(o => o.status === 'draft').length, color: '#94A3B8' },
    { name: t('status.confirmed'), value: orders.filter(o => o.status === 'confirmed').length, color: '#3B82F6' },
    { name: t('status.scheduled'), value: orders.filter(o => o.status === 'scheduled').length, color: '#60A5FA' },
    { name: t('status.in_design'), value: orders.filter(o => o.status === 'in_design').length, color: '#F59E0B' },
    { name: t('status.ready'), value: orders.filter(o => o.status === 'ready').length, color: '#FBBF24' },
    { name: t('status.out_for_delivery'), value: orders.filter(o => o.status === 'out_for_delivery').length, color: '#8B5CF6' },
    { name: t('status.delivered'), value: orders.filter(o => o.status === 'delivered').length, color: '#10B981' },
    { name: t('status.cancelled'), value: orders.filter(o => o.status === 'cancelled').length, color: '#EF4444' },
    { name: t('status.refunded'), value: orders.filter(o => o.status === 'refunded').length, color: '#EC4899' },
  ].filter(d => d.value > 0);

  // Unified financial derivations to prevent double-counting
  const totalLifetimeRevenue = orders
    .filter(o => !['draft', 'cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  const arAsset = orders
    .filter(o => ['confirmed', 'scheduled', 'in_design', 'ready', 'out_for_delivery'].includes(o.status) && (o.balanceDue !== undefined ? o.balanceDue > 0 : o.total > 0))
    .reduce((sum, o) => sum + (o.balanceDue !== undefined ? o.balanceDue : o.total), 0);

  const taxLiabilities = orders
    .filter(o => !['draft', 'cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + (o.taxes !== undefined ? o.taxes : o.total * 0.08875), 0);

  const paidOrCompletedOrderTotals = orders
    .filter(o => !['draft', 'cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + (o.amountPaid !== undefined ? o.amountPaid : 0), 0);

  const cashAcct = useFinanceStore(s => s.chartOfAccounts.find(a => a.code === '1010'));
  const cashAcctId = cashAcct?.id;

  const standaloneCash = journalEntries.reduce((total, entry) => {
    // If it's a primary order sale, we already count it via orders, so skip to avoid double counting.
    if ((entry.sourceType === 'order' || entry.sourceType === 'demo_order') && orders.some(o => o.id === entry.orderId)) {
      return total;
    }
    
    // Exclude inventory restock and expense source types from cash collected calculations to align with "Cash Collected" definition
    if (entry.sourceType === 'inventory_restock') {
      return total;
    }

    const cashLines = entry.lines.filter(l => 
      (cashAcctId && (l as any).accountId === cashAcctId) || 
      l.account === 'Cash'
    );
    const entryCashChange = cashLines.reduce((sum, l) => sum + l.debit - l.credit, 0);
    return total + entryCashChange;
  }, 0);

  const cashAsset = paidOrCompletedOrderTotals + standaloneCash;

  // Dynamic sparklines data lists
  const revenueSparkline = revenueChartData.map(d => d.revenue);

  // Dynamic Today's Priority Queue generation
  const priorityQueue: {
    id: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    type: 'Inventory' | 'Orders' | 'Delivery' | 'Finance';
    item: string;
    reason: string;
    owner: string;
    actionLabel: string;
    action: () => void;
  }[] = [];

  // 1. Critical inventory alerts
  lowStockItems.forEach(item => {
    priorityQueue.push({
      id: `stock-${item.sku}`,
      priority: 'Critical',
      type: 'Inventory',
      item: `${item.sku} ${item.name}`,
      reason: `${t('dashboard.lowStockAlerts')} (${item.quantity} stems left)`,
      owner: 'Inventory',
      actionLabel: t('dashboard.restock'),
      action: async () => {
        setIsRestockingSku(item.sku);
        try {
          await restockInventoryAndPostFinancials(item.sku, 50, item.unitCost, selectedCompanyId || 'DEFAULT_COMPANY', 'Priority Queue Restock');
          await fetchJournalEntries();
          addToast(`Restocked 50 stems of ${item.name}. GL entry verified.`, 'success');
        } catch (err: unknown) {
          const errMsg = (err as { message?: string })?.message || 'Restocking transaction failed.';
          addToast(errMsg, 'error');
        } finally {
          setIsRestockingSku(null);
        }
      }
    });
  });

  // 2. High priority unconfirmed drafts
  const draftOrders = orders.filter(o => o.status === 'draft');
  if (draftOrders.length > 0) {
    priorityQueue.push({
      id: 'order-drafts',
      priority: 'High',
      type: 'Orders',
      item: `${draftOrders.length} Draft Orders`,
      reason: 'Not confirmed',
      owner: 'Sales',
      actionLabel: t('dashboard.review'),
      action: () => navigate('/admin/orders?status=draft')
    });
  }

  // 3. Medium active deliveries / in transit workload
  const transitDeliveries = orders.filter(o => o.status === 'out_for_delivery');
  if (transitDeliveries.length > 0) {
    priorityQueue.push({
      id: 'delivery-transit',
      priority: 'Medium',
      type: 'Delivery',
      item: `${transitDeliveries.length} In Transit`,
      reason: 'Active workload',
      owner: 'Delivery',
      actionLabel: t('dashboard.track'),
      action: () => navigate('/admin/deliveries?status=transit')
    });
  }

  // 4. Medium Finance Ledger Audit
  priorityQueue.push({
    id: 'finance-ledger-audit',
    priority: 'Medium',
    type: 'Finance',
    item: 'Ledger Audit',
    reason: 'Balanced',
    owner: 'Finance',
    actionLabel: t('dashboard.view'),
    action: () => navigate('/admin/finance?tab=ledger&date=today')
  });

  const draftOrdersCount = orders.filter(o => o.status === 'draft').length;
  const transitCount = orders.filter(o => o.status === 'out_for_delivery').length;

  return (
    <div className={styles.container}>
      {/* Premium Dashboard Command Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.625rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0 }}>
          {t('dashboard.operationsCommandCenter')}
        </h1>
        <QuickActionsMenu onOpenModal={setActiveModal} />
      </div>

      {/* Dynamic Command Briefing Section */}
      <CommandSummary onOpenModal={setActiveModal} />
      
      <div style={{ marginBottom: '1.5rem' }}></div>

      {/* Refactored KPI Grid */}
      <div className={styles.kpiGrid}>
        <MetricCard
          title={t('dashboard.revenueToday')}
          value={formatCurrency(todaysRevenue, companySettings?.baseCurrencyCode)}
          subtitle={`${t('dashboard.lifetime')}: ${formatCurrency(totalLifetimeRevenue, companySettings?.baseCurrencyCode)}`}
          trend="+12.5%"
          trendDirection="up"
          icon={DollarSign}
          accentClass="accent-sage"
          progress={(todaysRevenue / 4800) * 100}
          badgeText="Today's Sales"
          sparklineData={revenueSparkline}
          onClick={() => {
            setReconActiveTab('revenue');
            setIsReconDrawerOpen(true);
          }}
        />
        <MetricCard
          title={t('dashboard.cashAndLedger')}
          value={formatCurrency(cashAsset, companySettings?.baseCurrencyCode)}
          subtitle={`${t('dashboard.arPending')}: ${formatCurrency(arAsset, companySettings?.baseCurrencyCode)} • ${t('dashboard.tax')}: ${formatCurrency(taxLiabilities, companySettings?.baseCurrencyCode)}`}
          trend="Balanced"
          trendDirection="neutral"
          icon={BalanceIcon}
          accentClass="accent-champagne"
          badgeText="Treasury Audit"
          onClick={() => {
            setReconActiveTab('cash');
            setIsReconDrawerOpen(true);
          }}
        />
        <MetricCard
          title={t('dashboard.draftOrders')}
          value={draftOrdersCount.toString()}
          subtitle={t('dashboard.totalOrders', { count: orders.length })}
          trend={draftOrdersCount > 10 ? 'Action Needed' : 'Healthy'}
          trendDirection={draftOrdersCount > 10 ? 'neutral' : 'up'}
          icon={ShoppingBag}
          accentClass="accent-blush"
          badgeText="Drafts"
          onClick={() => navigate('/admin/orders?status=draft')}
        />
        <MetricCard
          title={t('dashboard.productionQueue')}
          value={inProduction.toString()}
          subtitle={t('dashboard.stemsCrafting')}
          trend={inProduction > 5 ? 'High Volume' : 'Normal'}
          trendDirection={inProduction > 5 ? 'neutral' : 'up'}
          icon={Hammer}
          accentClass="accent-success"
          progress={Math.min(100, (inProduction / 12) * 100)}
          badgeText="Workload"
          onClick={() => navigate('/admin/orders?stage=crafting')}
        />
        <MetricCard
          title={t('dashboard.transitWorkload')}
          value={transitCount.toString()}
          subtitle={t('dashboard.courierDispatch')}
          trend="Ongoing"
          trendDirection="neutral"
          icon={Truck}
          accentClass="accent-info"
          badgeText="Fulfillment"
          onClick={() => navigate('/admin/deliveries?status=transit')}
        />
        <MetricCard
          title={t('dashboard.lowStockAlerts')}
          value={lowStockItems.length.toString()}
          subtitle={lowStockItems.length > 0 ? `${lowStockItems[0].name} ${t('dashboard.criticalStock', { count: lowStockItems.length })}` : t('dashboard.allStockHealthy')}
          icon={AlertTriangle}
          accentClass="accent-warning"
          isWarning={lowStockItems.length > 0}
          badgeText={lowStockItems.length > 0 ? "Critical Risk" : "Stable"}
          onClick={() => navigate('/admin/inventory?filter=low-stock')}
        />
      </div>

      {/* Today's Priority Queue Table */}
      <div className={styles.priorityCard}>
        <div className={styles.priorityHeader}>
          <h3 className={styles.priorityTitle}>{t('dashboard.priorityQueue')}</h3>
          <span className={styles.prioritySubtitle}>{t('dashboard.actionRequired')}</span>
        </div>

        {priorityQueue.length === 0 ? (
          <div className={styles.queueEmptyState}>
            <ShieldCheck className={styles.queueEmptyIcon} size={28} />
            <p className={styles.queueEmptyText}>{t('dashboard.noUrgentIssues')}</p>
          </div>
        ) : (
          <div className={styles.priorityTableWrapper}>
            <table className={styles.priorityTable}>
              <thead>
                <tr>
                  <th>{t('dashboard.priority')}</th>
                  <th>{t('dashboard.type')}</th>
                  <th>{t('dashboard.item')}</th>
                  <th>{t('dashboard.reason')}</th>
                  <th>{t('dashboard.owner')}</th>
                  <th>{t('dashboard.action')}</th>
                </tr>
              </thead>
              <tbody>
                {priorityQueue.map(row => (
                  <tr key={row.id}>
                    <td>
                      <span className={`${styles.badgePriority} ${
                        row.priority === 'Critical' ? styles.badgeCritical : 
                        row.priority === 'High' ? styles.badgeHigh : 
                        row.priority === 'Medium' ? styles.badgeMedium : styles.badgeLow
                      }`}>
                        {t(`common.${row.priority.toLowerCase()}`)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.badgeType}>{t(`common.${row.type.toLowerCase()}`)}</span>
                    </td>
                    <td className={styles.itemName}>{row.item}</td>
                    <td className={styles.statusText}>{row.reason}</td>
                    <td>
                      <span className={styles.ownerText} style={{ fontSize: '0.8125rem', color: '#726E64', fontWeight: 500 }}>
                        {t(`common.${row.owner.toLowerCase()}`)}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={styles.btnPriorityResolve}
                        disabled={isRestockingSku !== null}
                        onClick={row.action}
                      >
                        {isRestockingSku && row.id.includes(isRestockingSku) ? t('dashboard.processing') : row.actionLabel}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>{t('dashboard.revenueTrend')}</h3>
            <span className={styles.chartLabel}>{t('dashboard.last7Days')}</span>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C8271" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6C8271" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAE6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E8EAE6', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '0.8125rem' }}
                  formatter={(value: unknown) => [formatCurrency(Number(value), companySettings?.baseCurrencyCode), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6C8271" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>{t('dashboard.ordersByStatus')}</h3>
            <span className={styles.chartLabel}>{t('dashboard.allOrders')}</span>
          </div>
          <div className={styles.chartBody} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #E8EAE6', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '0.8125rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legendGrid}>
            {statusData.map((d) => (
              <div key={d.name} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: d.color }}></span>
                <span className={styles.legendLabel}>{d.name}</span>
                <span className={styles.legendValue}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today Operations + Action Required + Work Activity + AI */}
      <div className={styles.bottomGrid}>
        <div className={styles.bottomMain}>
          <TodayOperationsPanel />
          <div style={{ marginBottom: '1.5rem' }}></div>
          <ActionRequiredPanel />
        </div>
        <div className={styles.bottomSide}>
          <ActivityTimeline />
          <AiInsightsPanel onOpenModal={setActiveModal} />
        </div>
      </div>

      <ReconciliationDrawer
        isOpen={isReconDrawerOpen}
        onClose={() => setIsReconDrawerOpen(false)}
        activeTab={reconActiveTab}
        setActiveTab={setReconActiveTab}
        orders={orders}
        journalEntries={journalEntries}
      />
    </div>
  );
};
