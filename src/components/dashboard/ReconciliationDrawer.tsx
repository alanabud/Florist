import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Order } from '../../store/adminStore';
import type { JournalEntry } from '../../services/financeService';
import { useFinanceStore } from '../../store/financeStore';
import { useAdminStore } from '../../store/adminStore';
import styles from './ReconciliationDrawer.module.css';
import { useI18n } from '../../i18n/I18nProvider';

interface ReconciliationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'cash' | 'revenue' | 'ar' | 'tax';
  setActiveTab: (tab: 'cash' | 'revenue' | 'ar' | 'tax') => void;
  orders: Order[];
  journalEntries: JournalEntry[];
}

function toDateString(value: unknown): string {
  if (!value) return 'N/A';
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    return 'N/A';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isTodayDate(value: unknown): boolean {
  if (!value) return false;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    return false;
  }
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export const ReconciliationDrawer: React.FC<ReconciliationDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  orders,
  journalEntries,
}) => {
  const { t } = useI18n();
  // Listen for Escape key to close the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent scroll propagation on body when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Derivations matching Dashboard.tsx logic
  const paidOrCompletedOrders = orders.filter((o) =>
    !['draft', 'cancelled', 'refunded'].includes(o.status) && o.amountPaid !== undefined && o.amountPaid > 0
  );
  
  const paidOrCompletedOrderTotals = paidOrCompletedOrders.reduce(
    (sum, o) => sum + (o.amountPaid !== undefined ? o.amountPaid : 0),
    0
  );

  const cashAcct = useFinanceStore((s) => s.chartOfAccounts.find((a) => a.code === '1010'));
  const cashAcctId = cashAcct?.id;

  const standaloneCashEntries = journalEntries.filter((entry) => {
    // If it's a primary order sale, we already count it via orders, so skip to avoid double counting.
    if (
      (entry.sourceType === 'order' || entry.sourceType === 'demo_order') &&
      orders.some((o) => o.id === entry.orderId)
    ) {
      return false;
    }
    // Exclude inventory restock and expense source types from cash collected calculations to align with "Cash Collected" definition
    if (entry.sourceType === 'inventory_restock') {
      return false;
    }
    const cashLines = (entry.lines || []).filter((l) => 
      (cashAcctId && (l as any).accountId === cashAcctId) || 
      l.account === 'Cash'
    );
    const entryCashChange = cashLines.reduce(
      (sum, l) => sum + l.debit - l.credit,
      0
    );
    return Math.abs(entryCashChange) > 0.001;
  });

  const standaloneCashTotal = standaloneCashEntries.reduce((total, entry) => {
    const cashLines = (entry.lines || []).filter((l) => 
      (cashAcctId && (l as any).accountId === cashAcctId) || 
      l.account === 'Cash'
    );
    const entryCashChange = cashLines.reduce(
      (sum, l) => sum + l.debit - l.credit,
      0
    );
    return total + entryCashChange;
  }, 0);

  const cashAssetTotal = paidOrCompletedOrderTotals + standaloneCashTotal;

  // Revenue
  const todayPaidOrders = orders.filter((o) => {
    return isTodayDate(o.createdAt) && !['draft', 'cancelled', 'refunded'].includes(o.status);
  });
  const todayRevenueTotal = todayPaidOrders.reduce((sum, o) => sum + o.total, 0);

  const lifetimePaidOrders = orders.filter((o) =>
    !['draft', 'cancelled', 'refunded'].includes(o.status)
  );
  const lifetimeRevenueTotal = lifetimePaidOrders.reduce((sum, o) => sum + o.total, 0);

  // Accounts Receivable
  const arOrders = orders.filter((o) =>
    ['confirmed', 'scheduled', 'in_design', 'ready', 'out_for_delivery'].includes(o.status) && (o.balanceDue !== undefined ? o.balanceDue > 0 : o.total > 0)
  );
  const arAssetTotal = arOrders.reduce((sum, o) => sum + (o.balanceDue !== undefined ? o.balanceDue : o.total), 0);

  const customers = useAdminStore((s) => s.customers);
  const customerCreditsTotal = customers.reduce((sum, c) => sum + (c.creditBalance || 0), 0);
  const netReceivables = arAssetTotal - customerCreditsTotal;

  // Tax Liabilities
  const taxOrders = orders.filter((o) => !['draft', 'cancelled', 'refunded'].includes(o.status));
  const taxLiabilitiesTotal = taxOrders.reduce(
    (sum, o) => sum + (o.taxes !== undefined ? o.taxes : o.total * 0.08875),
    0
  );

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
      onClick={onClose}
    >
      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{t('dashboard.reconciliationDetail')}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label={t('dashboard.closeDrawer')}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Controls */}
        <div className={styles.tabList}>
          <button
            className={`${styles.tabButton} ${activeTab === 'cash' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('cash')}
          >
            Cash & Ledger
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'revenue' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            Revenue Today
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'ar' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('ar')}
          >
            AR Pending
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'tax' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('tax')}
          >
            Tax Liabilities
          </button>
        </div>

        {/* Content Area */}
        <div className={styles.content}>
          {activeTab === 'cash' && (
            <>
              {/* Formula */}
              <div className={styles.formulaCard}>
                <div className={styles.formulaTitle}>{t('dashboard.formulaDerivation')}</div>
                <div className={styles.formulaMath}>
                  Paid Orders (${paidOrCompletedOrderTotals.toFixed(2)}) + Standalone GL Cash (${standaloneCashTotal.toFixed(2)})
                </div>
                <div className={styles.formulaSummary}>
                  <span className={styles.summaryLabel}>{t('dashboard.totalCashCollected')}</span>
                  <span className={styles.summaryValue}>${cashAssetTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Paid Orders Table */}
              <div>
                <h3 className={styles.sectionTitle}>Paid / Completed Orders ({paidOrCompletedOrders.length})</h3>
                <div className={styles.tableWrapper}>
                  {paidOrCompletedOrders.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noPaidOrdersRecorded')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.orderId')}</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidOrCompletedOrders.map((order) => (
                          <tr key={order.id}>
                            <td>#{order.id.substring(0, 8).toUpperCase()}</td>
                            <td>{order.customerName}</td>
                            <td>
                              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{toDateString(order.createdAt)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${order.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Standalone GL Entries Table */}
              <div>
                <h3 className={styles.sectionTitle}>Standalone Cash GL Transactions ({standaloneCashEntries.length})</h3>
                <div className={styles.tableWrapper}>
                  {standaloneCashEntries.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noStandaloneCashGlEntries')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.entryId')}</th>
                          <th>Source</th>
                          <th>Description</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>{t('dashboard.cashEffect')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standaloneCashEntries.map((entry) => {
                          const cashLines = (entry.lines || []).filter((l) => 
                            (cashAcctId && (l as any).accountId === cashAcctId) || 
                            l.account === 'Cash'
                          );
                          const cashChange = cashLines.reduce(
                            (sum, l) => sum + l.debit - l.credit,
                            0
                          );
                          return (
                            <tr key={entry.id}>
                              <td>#{entry.id?.substring(0, 8).toUpperCase() || 'N/A'}</td>
                              <td>
                                <span className={`${styles.badge} ${styles.badgeInfo}`}>
                                  {entry.sourceType}
                                </span>
                              </td>
                              <td>{entry.description}</td>
                              <td>{toDateString(entry.createdAt || entry.postedAt)}</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: cashChange >= 0 ? '#047857' : '#C81E1E',
                                }}
                              >
                                {cashChange >= 0 ? '+' : ''}${cashChange.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'revenue' && (
            <>
              {/* Formula */}
              <div className={styles.formulaCard}>
                <div className={styles.formulaTitle}>{t('dashboard.formulaDerivation')}</div>
                <div className={styles.formulaMath}>
                  Sum of Totals for Today's Paid & Completed Orders
                </div>
                <div className={styles.formulaSummary}>
                  <span className={styles.summaryLabel}>Today's Revenue / Lifetime</span>
                  <span className={styles.summaryValue}>
                    ${todayRevenueTotal.toFixed(2)} / ${lifetimeRevenueTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Today's Orders */}
              <div>
                <h3 className={styles.sectionTitle}>Today's Paid / Completed Orders ({todayPaidOrders.length})</h3>
                <div className={styles.tableWrapper}>
                  {todayPaidOrders.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noPaidOrdersToday')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.orderId')}</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayPaidOrders.map((order) => (
                          <tr key={order.id}>
                            <td>#{order.id.substring(0, 8).toUpperCase()}</td>
                            <td>{order.customerName}</td>
                            <td>
                              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{toDateString(order.createdAt)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${order.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Lifetime Orders */}
              <div>
                <h3 className={styles.sectionTitle}>Lifetime Paid / Completed Orders ({lifetimePaidOrders.length})</h3>
                <div className={styles.tableWrapper}>
                  {lifetimePaidOrders.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noLifetimePaidOrders')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.orderId')}</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lifetimePaidOrders.map((order) => (
                          <tr key={order.id}>
                            <td>#{order.id.substring(0, 8).toUpperCase()}</td>
                            <td>{order.customerName}</td>
                            <td>
                              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{toDateString(order.createdAt)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${order.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'ar' && (
            <>
              {/* Formula */}
              <div className={styles.formulaCard}>
                <div className={styles.formulaTitle}>{t('dashboard.formulaDerivation')}</div>
                <div className={styles.formulaMath}>
                  AR Invoices (${arAssetTotal.toFixed(2)}) - Customer Credits (${customerCreditsTotal.toFixed(2)})
                </div>
                <div className={styles.formulaSummary} style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: '#8a8f8c' }}>Total Accounts Receivable:</span>
                    <span style={{ fontWeight: 600 }}>${arAssetTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: '#8a8f8c' }}>Available Customer Credits:</span>
                    <span style={{ fontWeight: 600 }}>${customerCreditsTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E8EAE6', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '1.125rem', fontWeight: 700 }}>
                    <span className={styles.summaryLabel} style={{ padding: 0 }}>Net Receivables Due:</span>
                    <span className={styles.summaryValue} style={{ fontSize: '1.125rem' }}>${netReceivables.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* AR Orders Table */}
              <div>
                <h3 className={styles.sectionTitle}>Outstanding Unpaid Orders ({arOrders.length})</h3>
                <div className={styles.tableWrapper}>
                  {arOrders.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noOutstandingAccountsReceivable')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.orderId')}</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>{t('finance.balanceDue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {arOrders.map((order) => (
                          <tr key={order.id}>
                            <td>#{order.id.substring(0, 8).toUpperCase()}</td>
                            <td>{order.customerName}</td>
                            <td>
                              <span
                                className={`${styles.badge} ${
                                  order.status === 'draft'
                                    ? styles.badgeNeutral
                                    : order.status === 'confirmed'
                                    ? styles.badgeInfo
                                    : styles.badgeWarning
                                }`}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td>{toDateString(order.createdAt)}</td>
                            <td style={{ textAlign: 'right' }}>
                              ${order.total.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${(order.balanceDue !== undefined ? order.balanceDue : order.total).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'tax' && (
            <>
              {/* Formula */}
              <div className={styles.formulaCard}>
                <div className={styles.formulaTitle}>{t('dashboard.formulaDerivation')}</div>
                <div className={styles.formulaMath}>
                  Estimated Tax from Active Orders (Excluding Draft, Cancelled, and Refunded)
                </div>
                <div className={styles.formulaSummary}>
                  <span className={styles.summaryLabel}>{t('dashboard.totalTaxLiabilities')}</span>
                  <span className={styles.summaryValue}>${taxLiabilitiesTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Tax Orders Table */}
              <div>
                <h3 className={styles.sectionTitle}>Taxes by Order ({taxOrders.length})</h3>
                <div className={styles.tableWrapper}>
                  {taxOrders.length === 0 ? (
                    <div className={styles.emptyState}>{t('dashboard.noTaxOrdersRecorded')}</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('dashboard.orderId')}</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>{t('dashboard.orderTotal')}</th>
                          <th style={{ textAlign: 'right' }}>{t('dashboard.taxAmount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taxOrders.map((order) => {
                          const computedTax =
                            order.taxes !== undefined ? order.taxes : order.total * 0.08875;
                          return (
                            <tr key={order.id}>
                              <td>#{order.id.substring(0, 8).toUpperCase()}</td>
                              <td>{order.customerName}</td>
                              <td>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>${order.total.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                ${computedTax.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
