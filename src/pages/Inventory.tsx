import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { PackagePlus, Download, Package, AlertTriangle, AlertOctagon, TrendingUp } from 'lucide-react';
import { restockInventoryAndPostFinancials } from '../services/financeService';
import { postInventoryAdjustment } from '../services/inventoryAdjustmentService';
import { exportInventoryPDF } from '../services/pdfExportService';
import { exportInventoryExcel } from '../services/excelExportService';
import { EmptyState } from '../components/ui/EmptyState';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../components/layout/AdminList.module.css';

export const Inventory: React.FC = () => {
  const { selectedCompany, companySettings } = useCompany();
  const { inventory, setActiveModal } = useAdminStore();
  const fetchJournalEntries = useFinanceStore(s => s.fetchJournalEntries);
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);
  const { t, language } = useI18n();

  // Filters local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Adjustment modal states
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'spoilage' | 'shrinkage' | 'damage' | 'write_off' | 'correction'>('spoilage');
  const [adjustDirection, setAdjustDirection] = useState<'decrease' | 'increase'>('decrease');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const openAdjustModal = (item: any) => {
    setAdjustItem(item);
    setAdjustQty(1);
    setAdjustType('spoilage');
    setAdjustDirection('decrease');
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    if (adjustQty <= 0) {
      addToast("Quantity must be greater than zero.", "error");
      return;
    }
    if (!adjustReason.trim()) {
      addToast("A justification reason is required.", "error");
      return;
    }

    const qtyChange = adjustDirection === 'decrease' ? -adjustQty : adjustQty;
    
    // Check if decrease exceeds on-hand quantity
    if (adjustDirection === 'decrease' && adjustQty > adjustItem.quantity) {
      addToast(`Cannot adjust below 0. Maximum decrease is ${adjustItem.quantity} units.`, "error");
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      await postInventoryAdjustment({
        sku: adjustItem.sku,
        qtyChange,
        type: adjustType,
        reason: adjustReason,
        actor: 'Admin'
      });
      await fetchJournalEntries();
      addToast(`Successfully adjusted SKU ${adjustItem.sku} stock.`, "success");
      setIsAdjustModalOpen(false);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "Failed to post inventory adjustment.", "error");
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const searchParam = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalStems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = inventory.filter(i => i.quantity <= i.reorderPoint && i.quantity > 0).length;
  const outOfStockCount = inventory.filter(i => i.quantity === 0).length;
  const totalValuation = inventory.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  // Status Tab Counts
  const allCount = inventory.length;
  const lowCount = inventory.filter(i => i.quantity <= i.reorderPoint && i.quantity > 0).length;
  const outCount = inventory.filter(i => i.quantity === 0).length;

  const filteredInventory = inventory.filter(i => {
    // Search filter
    const matchesSearch = 
      i.name.toLowerCase().includes(searchParam.toLowerCase()) || 
      i.sku.toLowerCase().includes(searchParam.toLowerCase());
    if (!matchesSearch) return false;

    // Status Tab Filter
    if (selectedStatusFilter === 'low') {
      if (i.quantity > i.reorderPoint || i.quantity === 0) return false;
    } else if (selectedStatusFilter === 'out') {
      if (i.quantity !== 0) return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && i.category !== categoryFilter) {
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

  const handleReceiveStock = async (sku: string, unitCost: number) => {
    const amountStr = window.prompt('Enter quantity to receive:', '50');
    if (amountStr === null) return;
    const amount = parseInt(amountStr, 10);
    
    if (amount > 0) {
      try {
        await restockInventoryAndPostFinancials(sku, amount, unitCost, 'DEFAULT_COMPANY', 'Admin');
        await fetchJournalEntries();
        addToast(`Successfully received ${amount} units and logged transaction in General Ledger.`, 'success');
      } catch (err) {
        console.error(err);
        addToast('Failed to post restock to General Ledger.', 'error');
      }
    }
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-inventory-${selectedStatusFilter}-${dateStr}.pdf`;
    exportInventoryPDF(filteredInventory, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredInventory.length} inventory items as PDF.`, 'success');
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-inventory-${selectedStatusFilter}-${dateStr}.xlsx`;
    exportInventoryExcel(filteredInventory, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredInventory.length} inventory items as Excel.`, 'success');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Inventory Control Desk
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Track floristry raw materials, stem levels, reorder points, and raw wholesale costs.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newInventory')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <PackagePlus size={16} style={{ marginRight: '0.35rem' }} /> Receive Stock
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('inventory.stemsOnHand')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalStems.toLocaleString()} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280' }}>units</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('inventory.grossMaterialInventory')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('dashboard.lowStockAlerts')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {lowStockCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#92400e' }}>Items</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('inventory.belowTargetReorderLevel')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', padding: '0.75rem', borderRadius: '12px' }}>
            <AlertOctagon size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('inventory.outOfStock')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {outOfStockCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#b91c1c' }}>Depleted</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('inventory.requireUrgentOrders')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('inventory.assetValuation')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('inventory.valuedAtWholesaleCost')}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card Workspace */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counters Tab-bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Catalog', count: allCount },
            { key: 'low', label: 'Low Stock Alerts', count: lowCount },
            { key: 'out', label: 'Depleted Stems', count: outCount },
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

        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
          <input 
            type="text" 
            placeholder="Search by Item Name, SKU, Supplier..." 
            className={styles.searchInput}
            value={searchParam}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">{t('inventory.allCategories')}</option>
              <option value="Flowers">Flowers</option>
              <option value="Greens">Greens</option>
              <option value="Supplies">Supplies</option>
            </select>
          </div>

          {(categoryFilter !== 'all' || selectedStatusFilter !== 'all' || searchParam) && (
            <button
              onClick={() => {
                setCategoryFilter('all');
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

        {/* Inventory Data Table */}
        {filteredInventory.length === 0 ? (
          <EmptyState
            title={searchParam ? "No matching stock items found." : "No inventory records in this category."}
            description={searchParam ? `No items match your search term "${searchParam}".` : "Adjust your status filter or receive a new stock dispatch."}
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
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>SKU</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('inventory.itemName')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Category</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Supplier</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('inventory.onHand')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('inventory.wholesaleCost')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const isLow = item.quantity <= item.reorderPoint;
                  const statusClass = isLow ? (item.quantity === 0 ? 'critical' : 'low') : 'healthy';
                  const statusText = isLow ? (item.quantity === 0 ? 'Out of Stock' : 'Low Stock') : 'Healthy';

                  return (
                    <tr 
                      key={item.id}
                      onDoubleClick={() => setActiveModal('newInventory', item)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      title="Double-click to open material console"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem' }}><strong>{item.sku}</strong></td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{item.category}</td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>{item.supplier || 'N/A'}</td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600 }}>{item.quantity} units</td>
                      <td style={{ padding: '1.125rem 1.5rem', color: '#2C302E' }}>${item.unitCost.toFixed(2)}</td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={`${styles.statusBadge} ${styles['status-' + statusClass]}`}>
                          {statusText}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => handleReceiveStock(item.sku, item.unitCost)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#F0F5F1', color: '#4A6B50', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Receive
                          </button>
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => openAdjustModal(item)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FEF2F2', color: '#991B1B', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Adjust
                          </button>
                          <button 
                            className={styles.actionBtn} 
                            onClick={() => setActiveModal('newInventory', item)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdjustModalOpen && adjustItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            border: '1px solid #E8EAE6'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#2C302E',
              margin: '0 0 1.5rem 0',
              fontFamily: 'var(--font-serif)'
            }}>
              Adjust Material Inventory
            </h3>

            <form onSubmit={handleAdjustSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Material Item
                </label>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#2C302E', background: '#FAFAF8', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E8EAE6' }}>
                  <strong>{adjustItem.sku}</strong> — {adjustItem.name}
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Current Stock: {adjustItem.quantity} units | Unit WAC: ${adjustItem.unitCost.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Direction
                  </label>
                  <select
                    value={adjustDirection}
                    onChange={(e) => {
                      setAdjustDirection(e.target.value as any);
                      if (e.target.value === 'increase') {
                        setAdjustType('correction');
                      } else {
                        setAdjustType('spoilage');
                      }
                    }}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.875rem', color: '#2C302E' }}
                  >
                    <option value="decrease">Decrease (Loss/Write-off)</option>
                    <option value="increase">Increase (Correction/Found)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Adjustment Type
                  </label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.875rem', color: '#2C302E' }}
                  >
                    {adjustDirection === 'decrease' ? (
                      <>
                        <option value="spoilage">Spoilage</option>
                        <option value="shrinkage">Shrinkage</option>
                        <option value="damage">Damage</option>
                        <option value="write_off">Write-Off</option>
                      </>
                    ) : (
                      <option value="correction">Correction / Count</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Quantity to Adjust
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty || ''}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Reason / Justification
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide audit detail for this stock change..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ background: '#FDFCFA', border: '1px dashed #E8EAE6', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 600, textTransform: 'uppercase' }}>{t('inventory.financialImpact')}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: adjustDirection === 'decrease' ? '#B91C1C' : '#047857' }}>
                  {adjustDirection === 'decrease' ? '-' : '+'}${ (adjustQty * adjustItem.unitCost).toFixed(2) }
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <Button type="button" variant="outline" onClick={() => setIsAdjustModalOpen(false)} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingAdjustment} style={{ background: adjustDirection === 'decrease' ? '#DC2626' : '#4A6B50', border: 'none', color: '#FFFFFF' }}>
                  {isSubmittingAdjustment ? 'Posting...' : 'Post Adjustment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
