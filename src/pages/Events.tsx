import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Download, CalendarPlus, Calendar, Award, CheckSquare, DollarSign } from 'lucide-react';
import { exportEventsPDF } from '../services/pdfExportService';
import { exportEventsExcel } from '../services/excelExportService';
import { EmptyState } from '../components/ui/EmptyState';
import { useCompany } from '../context/CompanyContext';
import { useI18n } from '../i18n/I18nProvider';
import styles from '../components/layout/AdminList.module.css';

export const Events: React.FC = () => {
  const { selectedCompany, companySettings } = useCompany();
  const { events, setActiveModal } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const addToast = useToastStore((state) => state.addToast);
  const { language } = useI18n();

  // Filter local states
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const searchTerm = searchParams.get('search') || '';

  // 1. Calculate KPI Metrics
  const totalEvents = events.length;
  const planningCount = events.filter(e => e.status === 'planning').length;
  const confirmedCount = events.filter(e => e.status === 'confirmed').length;
  const grossBudgets = events.reduce((sum, e) => sum + (e.budget || 0), 0);

  // Status Tab Counts
  const allCount = totalEvents;
  const proposalCount = events.filter(e => e.status === 'proposal').length;
  const planCount = events.filter(e => e.status === 'planning').length;
  const confCount = events.filter(e => e.status === 'confirmed').length;
  const compCount = events.filter(e => e.status === 'completed').length;
  const cancCount = events.filter(e => e.status === 'cancelled').length;

  const uniqueTypes = Array.from(new Set(events.map(e => e.type))).filter(Boolean);

  const filteredEvents = events.filter(e => {
    // Search filter
    const matchesSearch = 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.venue || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Status Tab Filter
    if (selectedStatusFilter !== 'all' && e.status !== selectedStatusFilter) {
      return false;
    }

    // Event Type filter
    if (typeFilter !== 'all' && e.type !== typeFilter) {
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

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-events-${selectedStatusFilter}-${dateStr}.pdf`;
    exportEventsPDF(filteredEvents, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredEvents.length} events to PDF.`, 'success');
  };

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bloompro-events-${selectedStatusFilter}-${dateStr}.xlsx`;
    exportEventsExcel(filteredEvents, filename, {
      companyName: selectedCompany?.displayName,
      currencyCode: companySettings?.baseCurrencyCode,
      locale: language,
      reportFooterText: companySettings?.reportFooterText
    });
    addToast(`Exported ${filteredEvents.length} events as Excel.`, 'success');
  };

  const handleManageEvent = (event: typeof events[0]) => {
    setActiveModal('newEvent', event as unknown as Record<string, unknown>);
    addToast(`Loaded management workspace for "${event.name}".`, 'info');
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Events & Weddings Coordinator
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Coordinate wedding plans, manage large scale design budgets, track setup logistics and breakdown staff.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleExport} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E' }}>
            <Download size={15} style={{ marginRight: '0.35rem' }} /> Export Excel
          </Button>
          <Button onClick={() => setActiveModal('newEvent')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <CalendarPlus size={16} style={{ marginRight: '0.35rem' }} /> New Event
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(74, 107, 80, 0.1)', color: '#4A6B50', padding: '0.75rem', borderRadius: '12px' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Total Events</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {totalEvents} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6b7280' }}>Scheduled</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Proposals & active accounts</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '0.75rem', borderRadius: '12px' }}>
            <Award size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>In Planning Stage</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {planningCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#b45309' }}>Designs</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Arrangement drafts in build</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Confirmed Contracts</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              {confirmedCount} <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#047857' }}>Locked</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Deposits settled & signed</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>Gross Budgets Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'var(--font-serif)' }}>
              ${grossBudgets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.125rem' }}>Event bookings aggregate</div>
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className={styles.tableCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
        
        {/* Status Counter Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '0.25rem', padding: '1rem 1.5rem 0 1.5rem', overflowX: 'auto', background: '#FDFCFA', borderRadius: '16px 16px 0 0' }}>
          {[
            { key: 'all', label: 'All Events', count: allCount },
            { key: 'proposal', label: 'Proposals', count: proposalCount },
            { key: 'planning', label: 'Planning', count: planCount },
            { key: 'confirmed', label: 'Confirmed', count: confCount },
            { key: 'completed', label: 'Completed', count: compCount },
            { key: 'cancelled', label: 'Cancelled', count: cancCount },
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
            placeholder="Search by Event Name, Client, Venue..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ minWidth: '300px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#8a8f8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {(typeFilter !== 'all' || selectedStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setTypeFilter('all');
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

        {/* Event Data Table */}
        {filteredEvents.length === 0 ? (
          <EmptyState
            title={searchTerm ? "No matching events found." : "No events scheduled under this filter."}
            description={searchTerm ? `No event matches your search term "${searchTerm}".` : "Adjust your filters or register a new event schedule."}
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
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Event name</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Event Type</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Scheduled Date</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Client Account</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Venue Location</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Total Budget</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Status</th>
                  <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => {
                  const statusClass = 
                    event.status === 'confirmed' ? 'confirmed' : 
                    event.status === 'completed' ? 'delivered' : 
                    event.status === 'planning' ? 'preparing' : 
                    event.status === 'proposal' ? 'draft' : 'cancelled';

                  return (
                    <tr 
                      key={event.id}
                      onDoubleClick={() => handleManageEvent(event)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F0EDE6', transition: 'background-color 150ms' }}
                      title="Double-click to open event coordinator panel"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAF9F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>
                        {event.name}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        {event.type}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        {new Date(event.date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 500 }}>
                        {event.client}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontSize: '0.8125rem', color: '#8a8f8c' }}>
                        {event.venue || 'TBD'}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', fontWeight: 600, color: '#2C302E' }}>
                        ${event.budget.toFixed(2)}
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem' }}>
                        <span className={`${styles.statusBadge} ${styles['status-' + statusClass]}`}>
                          {event.status}
                        </span>
                      </td>
                      <td style={{ padding: '1.125rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => handleManageEvent(event)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FFFFFF', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Manage
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
