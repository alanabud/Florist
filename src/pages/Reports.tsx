import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { exportExecutivePDF } from '../services/pdfExportService';
import { exportDetailedExcel } from '../services/excelExportService';
import { BarChart3, TrendingUp, Receipt, Download, FileText, DollarSign } from 'lucide-react';
import styles from '../components/layout/AdminList.module.css';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { orders, inventory, products, customers, fetchOrders } = useAdminStore();
  const { 
    getTotalTaxPayable, 
    getTotalCash, 
    getTotalAR,
    fetchJournalEntries
  } = useFinanceStore();

  const addToast = useToastStore(s => s.addToast);

  useEffect(() => {
    fetchJournalEntries();
    fetchOrders();
  }, [fetchJournalEntries, fetchOrders]);

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

  const handleExportPDF = () => {
    try {
      const revenue = totalRevenue;
      const ordersCount = orders.length;
      const aov = ordersCount > 0 ? revenue / ordersCount : 0;
      const taxCollected = getTotalTaxPayable();
      const cashBalance = getTotalCash() + revenue; // Include current order cash simulation
      const accountsReceivable = getTotalAR();
      const inventoryValue = inventory.reduce((s, i) => s + i.quantity * i.unitCost, 0);

      const ledger = [
        { account: 'Cash', balance: cashBalance, type: 'Asset' },
        { account: 'Accounts Receivable', balance: accountsReceivable, type: 'Asset' },
        { account: 'Inventory Valuation', balance: inventoryValue, type: 'Asset' },
        { account: 'Sales Tax Payable', balance: taxCollected, type: 'Liability' },
        { account: 'Sales Revenue', balance: revenue, type: 'Revenue' }
      ];

      exportExecutivePDF({
        revenue,
        ordersCount,
        aov,
        taxCollected,
        cashBalance,
        accountsReceivable,
        inventoryValue,
        ledger,
        orders,
        inventory,
        products
      });
      addToast('Executive business PDF report generated and downloaded.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to generate PDF report.', 'error');
    }
  };

  const handleExportExcel = () => {
    try {
      const revenue = totalRevenue;
      const ordersCount = orders.length;
      const aov = ordersCount > 0 ? revenue / ordersCount : 0;
      const taxCollected = getTotalTaxPayable();
      const cashBalance = getTotalCash() + revenue;
      const accountsReceivable = getTotalAR();
      const inventoryValue = inventory.reduce((s, i) => s + i.quantity * i.unitCost, 0);

      const ledger = [
        { account: 'Cash', balance: cashBalance, type: 'Asset' },
        { account: 'Accounts Receivable', balance: accountsReceivable, type: 'Asset' },
        { account: 'Inventory Valuation', balance: inventoryValue, type: 'Asset' },
        { account: 'Sales Tax Payable', balance: taxCollected, type: 'Liability' },
        { account: 'Sales Revenue', balance: revenue, type: 'Revenue' }
      ];

      exportDetailedExcel({
        revenue,
        ordersCount,
        aov,
        taxCollected,
        cashBalance,
        accountsReceivable,
        inventoryValue,
        ledger,
        orders,
        inventory,
        products,
        customers
      });
      addToast('Detailed multi-sheet Excel report generated and downloaded.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to generate Excel report.', 'error');
    }
  };

  const reportCards = [
    {
      title: 'Sales Summary',
      description: `${orders.length} total orders · $${totalRevenue.toLocaleString()} gross revenue`,
      icon: DollarSign,
      iconBg: '#D1FAE5',
      iconColor: '#065F46',
      action: () => navigate('/admin/finance'),
    },
    {
      title: 'Order Fulfillment',
      description: `${deliveredOrders} delivered · ${orders.filter(o => o.status === 'preparing').length} in production`,
      icon: Receipt,
      iconBg: '#DBEAFE',
      iconColor: '#1E40AF',
      action: () => navigate('/admin/orders'),
    },
    {
      title: 'Inventory Report',
      description: 'Stock levels, reorder history, and supplier performance',
      icon: BarChart3,
      iconBg: '#FEF3C7',
      iconColor: '#92400E',
      action: () => navigate('/admin/inventory'),
    },
    {
      title: 'Customer Insights',
      description: 'Lifetime value, repeat rate, and acquisition trends',
      icon: TrendingUp,
      iconBg: '#FDF5F5',
      iconColor: '#B05A5A',
      action: () => navigate('/admin/customers'),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports & Analytics</h1>
          <p className={styles.subtitle}>Business intelligence, financial exports, and operational audit tools.</p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className={styles.actionBtn} 
            onClick={handleExportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            <FileText size={16} /> Export Executive PDF
          </button>
          <button 
            className={styles.actionBtn} 
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            <Download size={16} /> Export Detailed Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {reportCards.map((card) => (
          <div
            key={card.title}
            onClick={card.action}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8EAE6',
              borderRadius: '14px',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(42,49,39,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <card.icon size={22} style={{ color: card.iconColor }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.375rem', fontFamily: 'var(--font-serif)' }}>
                {card.title}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
