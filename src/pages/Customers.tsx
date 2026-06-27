import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Download, UserPlus, Users, Star, DollarSign, Activity, Mail } from 'lucide-react';
import { exportCustomersPDF } from '../services/pdfExportService';
import { exportCustomersExcel } from '../services/excelExportService';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonTableRows } from '../components/ui/Skeleton';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../components/layout/AdminList.module.css';

export const Customers: React.FC = () => {
  const { selectedCompany, companySettings } = useCompany();
  const { customers, setActiveModal, customersLoading } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);
  const { t, language } = useI18n();

  // Filter local states
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const searchTerm = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalCRM = customers.length;
  const loyaltyMembersCount = customers.filter(c => 
    c.loyaltyTier && c.loyaltyTier !== 'bronze'
  ).length;
  const ltvSum = customers.reduce((sum, c) => sum + (c.lifetimeValue || 0), 0);
  const outstandingBalance = customers.reduce((sum, c) => sum + (c.openBalance || 0), 0);

  // Status Tab Counts based on Loyalty Tiers
  const allCount = totalCRM;
  const bronzeCount = customers.filter(c => (c.loyaltyTier || 'bronze') === 'bronze').length;
  const silverCount = customers.filter(c => c.loyaltyTier === 'silver').length;
  const goldCount = customers.filter(c => c.loyaltyTier === 'gold').length;
  const platinumCount = customers.filter(c => c.loyaltyTier === 'platinum').length;

  const filteredCustomers = customers.filter(c => {
    // Search filter
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Loyalty Tier Tab Filter
    const currentTier = c.loyaltyTier || 'bronze';
    if (selectedTierFilter !== 'all' && currentTier !== selectedTierFilter) {
      return false;
    }

    // Customer Type Filter
    const currentType = c.customerType || 'retail';
    if (typeFilter !== 'all' && currentType !== typeFilter) {
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

  const handleEmailCampaign = () => {
    addToast(`Email campaign builder initialized. Selected ${filteredCustomers.length} customer contacts.`, 'success');
  };

  const handleExport = () => {
    exportCustomersPDF(filteredCustomers, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredCustomers.length} customers to PDF.`, 'success');
  };

  const handleExportExcel = () => {
    exportCustomersExcel(filteredCustomers, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredCustomers.length} customers as Excel.`, 'success');
  };

  const handleViewProfile = (customer: typeof customers[0]) => {
    setActiveModal('newCustomer', customer as unknown as Record<string, unknown>);
    addToast(`Opening client dossier for ${customer.name}.`, 'info');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Client Relationships (CRM)
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Manage client dossier profiles, track purchase metrics, configure loyalty tiers, and audit accounts.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleEmailCampaign} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Mail size={15} style={{ marginRight: '0.35rem' }} /> Email Campaign
          </Button>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newCustomer')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <UserPlus size={16} style={{ marginRight: '0.35rem' }} /> Add Customer
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('customers.totalCrmProfiles')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalCRM} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280' }}>Clients</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('customers.activeDatabaseContacts')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Star size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{t('customers.loyaltyMembers')}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {loyaltyMembersCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#b45309' }}>Tiered</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Silver, Gold & Platinum status</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Lifetime Value (LTV)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${ltvSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('customers.cumulativeRevenueSettled')}</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', padding: '0.75rem', borderRadius: '12px' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Outstanding (AR)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>{t('customers.uncollectedClientLedgerCredit')}</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Loyalty Tier Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Clients', count: allCount },
            { key: 'bronze', label: 'Bronze Tier', count: bronzeCount },
            { key: 'silver', label: 'Silver Tier', count: silverCount },
            { key: 'gold', label: 'Gold Tier', count: goldCount },
            { key: 'platinum', label: 'Platinum Tier', count: platinumCount },
          ].map((tab) => {
            const isActive = selectedTierFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedTierFilter(tab.key)}
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
            placeholder="Search by Name, Email, Phone..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('customers.accountType')}</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">{t('customers.allAccounts')}</option>
              <option value="retail">{t('customers.retailClient')}</option>
              <option value="corporate">{t('customers.corporateAccount')}</option>
            </select>
          </div>

          {(typeFilter !== 'all' || selectedTierFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setSelectedTierFilter('all');
                searchParams.delete('search');
                setSearchParams(searchParams);
              }}
              style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Customer Data Table */}
        {customersLoading ? (
          <div className={styles.tableWrapper}>
            <SkeletonTableRows rows={6} cols={6} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching clients found." : "No client profiles in this filter."}
            description={searchTerm ? `No customer dossier matches your search term "${searchTerm}".` : "Adjust your filters or register a new client profile."}
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
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.clientName')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.contactInfo')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.accountType')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.loyaltyLevel')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.totalOrders')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.openBalance')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>{t('customers.lifetimeValue')}</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => {
                  const currentTier = customer.loyaltyTier || 'bronze';
                  const currentType = customer.customerType || 'retail';
                  
                  return (
                    <tr 
                      key={customer.id}
                      onDoubleClick={() => handleViewProfile(customer)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      title="Double-click to open client dossier console"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', background: '#F5F1E7', color: '#4A6B50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 600 }}>
                            {customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#2C302E' }}>{customer.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#8a8f8c' }}>ID: {customer.id.substring(0, 8).toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <div>{customer.email}</div>
                        <div style={{ marginTop: '0.125rem', color: '#8a8f8c' }}>{customer.phone}</div>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={styles.statusBadge} style={{
                          background: currentType === 'corporate' ? '#E0E7FF' : '#F3F4F6',
                          color: currentType === 'corporate' ? '#3730A3' : '#374151',
                          fontSize: '0.7rem'
                        }}>
                          {currentType.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={styles.statusBadge} style={{
                          background: currentTier === 'platinum' ? '#F3E8FF' : (currentTier === 'gold' ? '#FEF3C7' : (currentTier === 'silver' ? '#F3F4F6' : '#F5F1E7')),
                          color: currentTier === 'platinum' ? '#6B21A8' : (currentTier === 'gold' ? '#92400E' : (currentTier === 'silver' ? '#4B5563' : '#4A6B50')),
                          fontSize: '0.7rem',
                          border: currentTier === 'platinum' ? '1px solid #D8B4FE' : 'none'
                        }}>
                          {currentTier.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500, color: '#4b5563' }}>
                        {customer.totalOrders} orders
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: (customer.openBalance || 0) > 0 ? '#DC2626' : '#2C302E' }}>
                        ${(customer.openBalance || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#4A6B50' }}>
                        ${customer.lifetimeValue.toFixed(2)}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => handleViewProfile(customer)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                        >
                          View Profile
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
