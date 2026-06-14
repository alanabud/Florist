import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { exportExecutivePDF } from '../services/pdfExportService';
import { exportDetailedExcel } from '../services/excelExportService';
import { BarChart3, TrendingUp, Receipt, Download, FileText, DollarSign, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PRODUCT_RECIPES } from '../services/cogsService';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../components/layout/AdminList.module.css';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany, companySettings } = useCompany();
  const { t, formatCurrency, language } = useI18n();
  const { orders, inventory, products, customers, fetchOrders } = useAdminStore();
  const { 
    journalEntries,
    getTotalTaxPayable, 
    getTotalCash, 
    getTotalAR,
    fetchJournalEntries
  } = useFinanceStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'profitability'>('overview');

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
      }, {
        companyName: selectedCompany?.displayName,
        currencyCode: companySettings?.baseCurrencyCode,
        locale: language,
        reportFooterText: companySettings?.reportFooterText
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
      }, {
        companyName: selectedCompany?.displayName,
        currencyCode: companySettings?.baseCurrencyCode,
        locale: language,
        reportFooterText: companySettings?.reportFooterText
      });
      addToast('Detailed multi-sheet Excel report generated and downloaded.', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to generate Excel report.', 'error');
    }
  };

  // --- Calculations for Profitability & Margin Analytics ---
  const deliveredOrdersList = orders.filter(o => o.status === 'delivered');
  const deliveredRevenue = deliveredOrdersList.reduce((sum, o) => sum + (o.subtotal || 0) + (o.deliveryFee || 0), 0);
  const totalCOGS = deliveredOrdersList.reduce((sum, o) => sum + (o.cogsAmount || 0), 0);
  const grossMarginDollars = deliveredRevenue - totalCOGS;
  const grossMarginPercent = deliveredRevenue > 0 ? (grossMarginDollars / deliveredRevenue) * 100 : 0;

  // Inventory reconciliation
  const glInventoryBalance = journalEntries
    .filter(je => je.status === 'posted')
    .reduce((sum, je) => {
      const lines = je.lines || [];
      const invLines = lines.filter(l => l.account === 'Inventory' || l.accountId === '1300');
      return sum + invLines.reduce((acc, l) => acc + (l.debit - l.credit), 0);
    }, 0);

  const subledgerInventoryValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  const inventoryVariance = glInventoryBalance - subledgerInventoryValue;

  // Product Margins calculations
  const productMargins = products.map(product => {
    let quantitySold = 0;
    let revenue = 0;
    
    for (const order of deliveredOrdersList) {
      const items = Array.isArray(order.lineItems) ? order.lineItems : [];
      for (const item of items) {
        if (item.productId === product.id) {
          quantitySold += item.quantity || 1;
          revenue += (item.unitPrice || 0) * (item.quantity || 1);
        }
      }
    }

    const recipe = PRODUCT_RECIPES[product.id] || [];
    const unitCost = recipe.reduce((sum, comp) => {
      const invItem = inventory.find(i => i.sku === comp.sku);
      return sum + (comp.quantity * (invItem?.unitCost || 0));
    }, 0);

    const totalCost = quantitySold * unitCost;
    const marginDollars = revenue - totalCost;
    const marginPercent = revenue > 0 ? (marginDollars / revenue) * 100 : 0;

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      qtySold: quantitySold,
      revenue,
      cost: totalCost,
      marginDollars,
      marginPercent
    };
  }).filter(p => p.qtySold > 0);

  // Add custom bouquet margins
  let customQtySold = 0;
  let customRevenue = 0;
  let customCost = 0;

  for (const order of deliveredOrdersList) {
    const items = Array.isArray(order.lineItems) ? order.lineItems : [];
    for (const item of items) {
      if (item.isCustom || item.productId === 'custom-bouquet' || item.productId?.startsWith('p-custom-')) {
        customQtySold += item.quantity || 1;
        customRevenue += (item.unitPrice || 0) * (item.quantity || 1);
      }
    }
    if (order.lineItems?.some((i: any) => i.isCustom || i.productId === 'custom-bouquet' || i.productId?.startsWith('p-custom-'))) {
      customCost += (order.cogsAmount || 0);
    }
  }

  if (customQtySold > 0) {
    productMargins.push({
      id: 'custom-bouquet',
      name: 'Custom Bouquets',
      category: 'Custom',
      qtySold: customQtySold,
      revenue: customRevenue,
      cost: customCost,
      marginDollars: customRevenue - customCost,
      marginPercent: customRevenue > 0 ? ((customRevenue - customCost) / customRevenue) * 100 : 0
    });
  }

  // Material Stock Consumption calculations
  const materialStats = inventory.map(item => {
    let quantityConsumed = 0;
    for (const order of deliveredOrdersList) {
      const snapshot = order.cogsSnapshot || [];
      const matched = snapshot.find((l: any) => l.sku === item.sku);
      if (matched) {
        quantityConsumed += matched.quantityConsumed;
      }
    }
    const totalCost = quantityConsumed * item.unitCost;
    return {
      sku: item.sku,
      name: item.name,
      quantityConsumed,
      unitWac: item.unitCost,
      totalCost
    };
  }).filter(m => m.quantityConsumed > 0);

  const reportCards = [
    {
      title: t('reports.salesSummary'),
      description: `${orders.length} total orders · ${formatCurrency(totalRevenue, companySettings?.baseCurrencyCode || 'USD')} gross revenue`,
      icon: DollarSign,
      iconBg: '#D1FAE5',
      iconColor: '#065F46',
      action: () => navigate('/admin/finance'),
    },
    {
      title: 'Order Fulfillment',
      description: `${deliveredOrders} delivered · ${orders.filter(o => o.status === 'in_design').length} in production`,
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
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      <div className={styles.header} style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>Reports & Analytics</h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Business intelligence, financial exports, and operational audit tools.</p>
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

      {/* Tabs Navigation */}
      <div style={{ marginBottom: '2rem', display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '1rem' }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid #4A6B50' : '3px solid transparent',
            color: activeTab === 'overview' ? '#4A6B50' : '#6b7280',
            cursor: 'pointer',
            transition: 'all 200ms'
          }}
        >
          Overview Reports
        </button>
        <button 
          onClick={() => setActiveTab('profitability')}
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profitability' ? '3px solid #4A6B50' : '3px solid transparent',
            color: activeTab === 'profitability' ? '#4A6B50' : '#6b7280',
            cursor: 'pointer',
            transition: 'all 200ms'
          }}
        >
          Profitability & Margin Analytics
        </button>
      </div>

      {activeTab === 'overview' ? (
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Summary Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44,48,46,0.03)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Gross Revenue</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                {formatCurrency(deliveredRevenue, companySettings?.baseCurrencyCode || 'USD')}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Delivered orders only</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44,48,46,0.03)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Cost of Goods Sold (COGS)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                {formatCurrency(totalCOGS, companySettings?.baseCurrencyCode || 'USD')}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>WAC at fulfillment time</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44,48,46,0.03)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Gross Margin ($)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#047857', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                {formatCurrency(grossMarginDollars, companySettings?.baseCurrencyCode || 'USD')}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Revenue - COGS</span>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44,48,46,0.03)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Gross Margin (%)</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4A6B50', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                {grossMarginPercent.toFixed(1)}%
              </div>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Profitability yield ratio</span>
            </div>
          </div>

          {/* GL vs Subledger Reconciliation Panel */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E8EAE6',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 20px rgba(44,48,46,0.03)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: '0 0 1rem 0', fontWeight: 600 }}>
              Inventory GL vs. Subledger Reconciliation
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#FAFAF8', padding: '1rem', borderRadius: '8px', border: '1px solid #E8EAE6' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase' }}>Inventory GL Balance (A/C 1300)</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem' }}>
                  {formatCurrency(glInventoryBalance, companySettings?.baseCurrencyCode || 'USD')}
                </div>
              </div>
              <div style={{ background: '#FAFAF8', padding: '1rem', borderRadius: '8px', border: '1px solid #E8EAE6' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase' }}>Subledger Asset Value (Qty * WAC)</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem' }}>
                  {formatCurrency(subledgerInventoryValue, companySettings?.baseCurrencyCode || 'USD')}
                </div>
              </div>
              <div style={{
                background: Math.abs(inventoryVariance) < 0.01 ? '#ECFDF5' : '#FEF2F2',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: Math.abs(inventoryVariance) < 0.01 ? '#A7F3D0' : '#FCA5A5'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: Math.abs(inventoryVariance) < 0.01 ? '#047857' : '#B91C1C', textTransform: 'uppercase' }}>Inventory Variance</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: Math.abs(inventoryVariance) < 0.01 ? '#047857' : '#B91C1C', marginTop: '0.25rem' }}>
                  {formatCurrency(inventoryVariance, companySettings?.baseCurrencyCode || 'USD')}
                </div>
              </div>
            </div>

            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: Math.abs(inventoryVariance) < 0.01 ? '#ECFDF5' : '#FEF2F2',
              color: Math.abs(inventoryVariance) < 0.01 ? '#065F46' : '#991B1B',
              fontSize: '0.8125rem',
              fontWeight: 600
            }}>
              {Math.abs(inventoryVariance) < 0.01 ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Subledger and General Ledger inventory balances are fully reconciled.</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>Audit Alert: A variance of {formatCurrency(inventoryVariance, companySettings?.baseCurrencyCode || 'USD')} detected between subledger details and general ledger balance.</span>
                </>
              )}
            </div>
          </div>

          {/* Product Margins Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 4px 20px rgba(44,48,46,0.03)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>Product Gross Margins</h3>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table} style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#FDFCFA' }}>
                    <th style={{ padding: '0.75rem 1.5rem' }}>Product Name</th>
                    <th style={{ padding: '0.75rem 1.5rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'center' }}>Units Sold</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Revenue ({companySettings?.baseCurrencyCode || 'USD'})</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Cost of Goods ({companySettings?.baseCurrencyCode || 'USD'})</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Margin ({companySettings?.baseCurrencyCode || 'USD'})</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Margin (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {productMargins.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F0EDE6' }}>
                      <td style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '0.75rem 1.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>{p.category}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>{p.qtySold}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem' }}>{formatCurrency(p.revenue, companySettings?.baseCurrencyCode || 'USD')}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem' }}>{formatCurrency(p.cost, companySettings?.baseCurrencyCode || 'USD')}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: p.marginDollars >= 0 ? '#047857' : '#B91C1C' }}>
                        {formatCurrency(p.marginDollars, companySettings?.baseCurrencyCode || 'USD')}
                      </td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: p.marginPercent >= 0 ? '#047857' : '#B91C1C' }}>
                        {p.marginPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Material Stock Consumption Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 4px 20px rgba(44,48,46,0.03)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>Material consumption cost ledger</h3>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table} style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: '#FDFCFA' }}>
                    <th style={{ padding: '0.75rem 1.5rem' }}>SKU</th>
                    <th style={{ padding: '0.75rem 1.5rem' }}>Material Name</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'center' }}>Quantity Consumed</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Unit Cost (WAC)</th>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Total Cost Value ({companySettings?.baseCurrencyCode || 'USD'})</th>
                  </tr>
                </thead>
                <tbody>
                  {materialStats.map(m => (
                    <tr key={m.sku} style={{ borderBottom: '1px solid #F0EDE6' }}>
                      <td style={{ padding: '0.75rem 1.5rem', fontWeight: 600 }}>{m.sku}</td>
                      <td style={{ padding: '0.75rem 1.5rem' }}>{m.name}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>{m.quantityConsumed} units</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem' }}>{formatCurrency(m.unitWac, companySettings?.baseCurrencyCode || 'USD')}</td>
                      <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>{formatCurrency(m.totalCost, companySettings?.baseCurrencyCode || 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
