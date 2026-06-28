import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Download, Plus, Flower2, Package, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { exportProductsPDF } from '../services/pdfExportService';
import { exportProductsExcel } from '../services/excelExportService';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonTableRows } from '../components/ui/Skeleton';
import { ModuleErrorState } from '../components/ui/ModuleErrorState';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../components/layout/AdminList.module.css';

export const Products: React.FC = () => {
  const { selectedCompany, companySettings } = useCompany();
  const { products, setActiveModal, productsLoading, productsError, fetchProducts } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);
  const { t, language } = useI18n();

  // Filter local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sameDayFilter, setSameDayFilter] = useState<string>('all');

  const searchTerm = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalCatalog = products.length;
  const inStockCount = products.filter(p => p.inStock).length;
  const lowStockCount = products.filter(p => {
    const stock = p.stockQuantity !== undefined ? p.stockQuantity : (p.inStock ? 20 : 0);
    const reorder = p.reorderPoint !== undefined ? p.reorderPoint : 5;
    return stock <= reorder;
  }).length;
  const avgPrice = products.reduce((sum, p) => sum + (p.basePrice || p.price || 0), 0) / (totalCatalog || 1);

  // Status Tab Counts
  const allCount = totalCatalog;
  const activeCount = products.filter(p => (p.productStatus || 'active') === 'active').length;
  const draftCount = products.filter(p => (p.productStatus || 'active') === 'draft').length;
  const archivedCount = products.filter(p => (p.productStatus || 'active') === 'archived').length;

  const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  const filteredProducts = products.filter(p => {
    // Search filter
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Status Tab Filter
    const currentStatus = p.productStatus || 'active';
    if (selectedStatusFilter !== 'all' && currentStatus !== selectedStatusFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && p.category !== categoryFilter) {
      return false;
    }

    // Same-day eligibility filter
    if (sameDayFilter !== 'all') {
      const isSameDay = p.isSameDay || p.deliveryEligible;
      if (sameDayFilter === 'eligible' && !isSameDay) return false;
      if (sameDayFilter === 'ineligible' && isSameDay) return false;
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

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-products-${selectedStatusFilter}-${dateStr}.pdf`;
    exportProductsPDF(filteredProducts, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(t('products.exportedPdf', { count: filteredProducts.length }), 'success');
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-products-${selectedStatusFilter}-${dateStr}.xlsx`;
    exportProductsExcel(filteredProducts, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(t('products.exportedExcel', { count: filteredProducts.length }), 'success');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Products Catalog Console
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Manage floral designs, seasonal arrangements, pricing matrices, and inventory triggers.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newProduct')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} /> Add Product
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Flower2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('products.totalCatalog')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalCatalog} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280' }}>Items</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('products.activeDesignerCollections')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
            <Package size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('products.inStock')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {inStockCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#047857' }}>Active</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('products.availableForOrdering')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('products.lowStockItems')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {lowStockCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#b45309' }}>Alerts</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('products.belowThresholdTriggers')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('products.averageRetailPrice')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${avgPrice.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('products.retailMarkupStandard')}</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counters Tab-bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Catalog', count: allCount },
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'draft', label: 'Drafts', count: draftCount },
            { key: 'archived', label: 'Archived', count: archivedCount },
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
            placeholder="Search by Product Name, SKU, Category..." 
            className={styles.searchInput}
            value={searchTerm}
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
              <option value="all">{t('products.allCategories')}</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('products.deliveryMode')}</span>
            <select
              value={sameDayFilter}
              onChange={(e) => setSameDayFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">{t('products.allModes')}</option>
              <option value="eligible">Same-Day Delivery</option>
              <option value="ineligible">{t('products.standardShipping')}</option>
            </select>
          </div>

          {(categoryFilter !== 'all' || sameDayFilter !== 'all' || selectedStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setSameDayFilter('all');
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

        {/* Product Data Table */}
        {productsError ? (
          <ModuleErrorState detail={productsError} onRetry={fetchProducts} />
        ) : productsLoading ? (
          <div className={styles.tableWrapper}>
            <SkeletonTableRows rows={6} cols={6} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching products found." : "No product entries in this filter."}
            description={searchTerm ? `No item matches your search term "${searchTerm}".` : "Adjust your filters or add a new catalog product."}
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
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('products.catalogItem')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>SKU</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Category</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('products.retailPrice')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('products.deliveryEligibility')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('products.fulfillmentStatus')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const isSameDay = product.isSameDay || product.deliveryEligible;
                  const currentStatus = product.productStatus || 'active';
                  
                  return (
                    <tr 
                      key={product.id}
                      onDoubleClick={() => {
                        setActiveModal('newProduct', product);
                        addToast(t('products.openingProduct', { name: product.name }), 'info');
                      }}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      title="Double-click to open product console"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '40px', height: '40px', background: '#F5F1E7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', overflow: 'hidden' }}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              '🌸'
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#2C302E' }}>{product.name}</div>
                            {product.seasonalProduct && (
                              <span style={{ fontSize: '0.6875rem', background: '#FEF3C7', color: '#92400E', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase', display: 'inline-block', marginTop: '0.125rem' }}>
                                <Sparkles size={8} style={{ display: 'inline-block', marginRight: '0.15rem' }} /> Seasonal
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#4b5563' }}>
                        {product.sku || 'N/A'}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        {product.category}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>
                        ${(product.basePrice || product.price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={styles.statusBadge} style={{
                          background: isSameDay ? '#E0F2FE' : '#F3F4F6',
                          color: isSameDay ? '#0369A1' : '#374151',
                          fontSize: '0.7rem'
                        }}>
                          {isSameDay ? 'Same-Day' : 'Standard Shipping'}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={styles.statusBadge} style={{
                          background: product.inStock ? '#DEF7EC' : '#FDE8E8',
                          color: product.inStock ? '#03543F' : '#9B1C1C',
                          fontSize: '0.7rem'
                        }}>
                          {product.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={`${styles.statusBadge} ${currentStatus === 'active' ? styles.statusActive : styles.statusDraft}`}>
                          {currentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => setActiveModal('newProduct', product)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
