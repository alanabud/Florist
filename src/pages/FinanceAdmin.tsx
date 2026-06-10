import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceStore } from '../store/financeStore';
import { useAdminStore } from '../store/adminStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  DollarSign, FileText, PiggyBank, Landmark, 
  Download, Plus, ShieldCheck, ShieldAlert, BookOpen, Scale, Landmark as CoaIcon, ClipboardList
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { reverseJournalEntry } from '../services/financeService';
import { CHART_OF_ACCOUNTS } from '../services/chartOfAccounts';
import { 
  buildTrialBalance, 
  buildIncomeStatement, 
  buildBalanceSheet, 
  filterEntriesCumulative,
  getEntryDate,
  type ReportingPeriod 
} from '../services/financialReportingService';
import { exportBalanceSheetPDF, exportIncomeStatementPDF } from '../services/pdfExportService';
import { exportFinancialsExcel } from '../services/excelExportService';
import styles from './FinanceAdmin.module.css';

export const FinanceAdmin: React.FC = () => {
  const { 
    journalEntries, 
    isLoading, 
    fetchJournalEntries,
    chartOfAccounts,
    fetchChartOfAccounts,
    deactivateAccount,
    reactivateAccount
  } = useFinanceStore();

  const { role, user } = useAuthStore();
  const { setActiveModal } = useAdminStore();
  const addToast = useToastStore(s => s.addToast);
  const [searchParams, setSearchParams] = useSearchParams();

  // Local/URL Params
  const tabParam = searchParams.get('tab') || 'overview';
  const searchParam = searchParams.get('search') || '';
  const activeTab = tabParam === 'ledger' ? 'ledger' : 'overview';

  // Reporting sub-tabs and filters
  const [overviewSubTab, setOverviewSubTab] = useState<'pnl' | 'balance_sheet' | 'trial_balance' | 'coa'>('pnl');
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>('all_time');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    fetchJournalEntries();
    fetchChartOfAccounts();
  }, [fetchJournalEntries, fetchChartOfAccounts]);

  const activeCOA = chartOfAccounts.length > 0 ? chartOfAccounts : CHART_OF_ACCOUNTS;

  const handleReverse = async (id: string) => {
    if (!window.confirm("Are you sure you want to post a reversing entry for this transaction? Reversal entries are immutable and will correct general ledger balances.")) return;
    try {
      await reverseJournalEntry(id, user?.email || 'Admin');
      await fetchJournalEntries();
      addToast("Reversing entry posted successfully to general ledger.", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast((err as { message?: string })?.message || "Failed to reverse journal entry.", "error");
    }
  };

  const handleToggleActive = async (account: any) => {
    const actor = user?.email || 'Admin';
    if (account.active) {
      if (account.isSystem) {
        const confirm1 = window.confirm(
          `"${account.name}" is a System Account.\n\nThis account is used by automated workflows. Deactivating it may break checkout, order posting, journal automation, reports, or tax calculations.\n\nAre you sure you want to proceed?`
        );
        if (!confirm1) return;
        
        const confirmText = window.prompt(
          `To confirm deactivation of this critical system account, please type "DEACTIVATE SYSTEM ACCOUNT":`
        );
        if (confirmText !== 'DEACTIVATE SYSTEM ACCOUNT') {
          addToast("Deactivation aborted: confirmation phrase did not match.", "error");
          return;
        }
      } else {
        if (!window.confirm(`Are you sure you want to deactivate the "${account.name}" account?`)) {
          return;
        }
      }
      try {
        await deactivateAccount(account.id!, actor);
        addToast(`Account "${account.name}" has been deactivated.`, 'success');
      } catch (err: any) {
        console.error(err);
        addToast(err.message || 'Failed to deactivate account.', 'error');
      }
    } else {
      try {
        await reactivateAccount(account.id!, actor);
        addToast(`Account "${account.name}" has been reactivated.`, 'success');
      } catch (err: any) {
        console.error(err);
        addToast(err.message || 'Failed to reactivate account.', 'error');
      }
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      searchParams.set('search', val);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const setActiveTab = (tab: 'overview' | 'ledger') => {
    if (tab === 'ledger') {
      searchParams.set('tab', 'ledger');
    } else {
      searchParams.delete('tab');
    }
    setSearchParams(searchParams);
  };

  // 1. Calculate Dynamic Statements & GAAP reports
  const customRange = reportingPeriod === 'custom' ? { start: customStartDate, end: customEndDate } : undefined;
  
  // Income Statement ( respects reporting period )
  const incomeStatement = buildIncomeStatement(journalEntries, activeCOA, reportingPeriod, customRange);
  
  // Balance Sheet ( cumulative as of cutoff )
  const balanceSheet = buildBalanceSheet(journalEntries, activeCOA, reportingPeriod, customRange);
  
  // Trial Balance ( cumulative up to cutoff )
  const trialBalance = buildTrialBalance(filterEntriesCumulative(journalEntries, reportingPeriod, customRange), activeCOA);

  // Cash and A/R derived from Balance Sheet values
  const cashBalance = balanceSheet.assets.find(a => a.name === 'Cash')?.balance || 0;
  const arBalance = balanceSheet.assets.find(a => a.name === 'Accounts Receivable')?.balance || 0;
  const taxPayable = balanceSheet.liabilities.find(l => l.name === 'Sales Tax Payable')?.balance || 0;

  // Period label formatter
  const getPeriodLabel = () => {
    if (reportingPeriod === 'this_month') return 'This Month';
    if (reportingPeriod === 'this_quarter') return 'This Quarter';
    if (reportingPeriod === 'this_year') return 'This Year';
    if (reportingPeriod === 'custom') {
      return `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
    }
    return 'All-Time';
  };

  // Summary stats
  const stats = [
    { id: 'rev', name: 'Sales & Delivery Revenue', value: `$${incomeStatement.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: DollarSign, sub: 'For chosen period' },
    { id: 'net', name: 'Net Income / Profit', value: `$${incomeStatement.netIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: ClipboardList, sub: 'Revenues minus Expenses', color: incomeStatement.netIncome >= 0 ? '#10b981' : '#dc2626' },
    { id: 'cash', name: 'Cash Account Balance', value: `$${cashBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: PiggyBank, sub: 'Cumulative cash assets' },
    { id: 'ar', name: 'Accounts Receivable', value: `$${arBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: FileText, sub: 'Outstanding client credit' },
    { id: 'tax', name: 'Sales Tax Owed', value: `$${taxPayable.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: Landmark, sub: 'Collected tax liability' },
    { 
      id: 'tb', 
      name: 'Trial Balance Verification', 
      value: trialBalance.isBalanced ? 'Balanced' : 'Unbalanced', 
      icon: Scale, 
      sub: trialBalance.isBalanced ? 'Debits = Credits' : `Difference: $${trialBalance.difference.toFixed(2)}`,
      color: trialBalance.isBalanced ? '#10b981' : '#dc2626'
    },
  ];

  // Filters for General Ledger tab listing
  const filteredLedgerEntries = journalEntries.filter(je => {
    // Search query filter
    if (searchParam) {
      const q = searchParam.toLowerCase();
      const matches = 
        je.description.toLowerCase().includes(q) ||
        je.createdBy.toLowerCase().includes(q) ||
        je.orderId.toLowerCase().includes(q) ||
        je.lines.some(l => l.account.toLowerCase().includes(q));
      if (!matches) return false;
    }

    // Respect period selectors for the entries grid if selected in toolbar
    if (reportingPeriod !== 'all_time') {
      const date = getEntryDate(je);
      const now = new Date();
      if (reportingPeriod === 'this_month') {
        if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return false;
      } else if (reportingPeriod === 'this_quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const entryQuarter = Math.floor(date.getMonth() / 3);
        if (date.getFullYear() !== now.getFullYear() || entryQuarter !== currentQuarter) return false;
      } else if (reportingPeriod === 'this_year') {
        if (date.getFullYear() !== now.getFullYear()) return false;
      } else if (reportingPeriod === 'custom') {
        const start = customStartDate ? new Date(customStartDate) : new Date(0);
        const end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        if (date < start || date > end) return false;
      }
    }

    return true;
  });

  // Export actions
  const handleExportIncomeStatement = () => {
    exportIncomeStatementPDF(incomeStatement, getPeriodLabel());
    addToast('Profit & Loss statement exported to PDF.', 'success');
  };

  const handleExportBalanceSheet = () => {
    exportBalanceSheetPDF(balanceSheet, getPeriodLabel());
    addToast('Balance Sheet exported to PDF.', 'success');
  };

  const handleExportFullWorkbook = () => {
    exportFinancialsExcel({
      trialBalance,
      incomeStatement,
      balanceSheet,
      chartOfAccounts: activeCOA,
      journalEntries: filteredLedgerEntries
    }, `BloomPro_Financial_Workbook_${getPeriodLabel().replace(/[\s/:]/g, '_')}.xlsx`);
    addToast('Full general ledger financial spreadsheet workbook exported.', 'success');
  };

  // Staff gate check
  if (role === 'staff') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <Landmark size={64} style={{ color: '#EF4444', marginBottom: '1.5rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 0.5rem 0' }}>Access Denied</h2>
        <p style={{ color: '#726E64', fontSize: '0.95rem', maxWidth: '400px', lineHeight: 1.6 }}>
          You do not have authorization to view the Financial Ledger. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ maxWidth: '1600px', padding: '2rem 3rem' }}>
      
      {/* Header Area */}
      <div className={styles.header} style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title} style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            Finance & General Ledger
          </h1>
          <p className={styles.subtitle} style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Audits real-time double-entry journal postings, maps general ledger balances, and structures GAAP-compliant statements.
          </p>
        </div>
        <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="dropdown" style={{ position: 'relative', display: 'inline-block' }}>
            <Button variant="outline" style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E', display: 'inline-flex', gap: '0.25rem' }}>
              <Download size={15} /> Export Reports ▼
            </Button>
            <div className="dropdown-content" style={{
              display: 'none',
              position: 'absolute',
              right: 0,
              backgroundColor: '#FFFFFF',
              minWidth: '220px',
              boxShadow: '0px 8px 16px 0px rgba(0,0,0,0.1)',
              zIndex: 10,
              borderRadius: '8px',
              border: '1px solid #E8EAE6',
              overflow: 'hidden',
              marginTop: '4px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.display = 'block'; }}
            onMouseLeave={(e) => { e.currentTarget.style.display = 'none'; }}
            >
              <button onClick={handleExportIncomeStatement} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#2C302E' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF9F5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Export P&L PDF</button>
              <button onClick={handleExportBalanceSheet} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#2C302E' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF9F5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Export Balance Sheet PDF</button>
              <button onClick={handleExportFullWorkbook} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#2C302E' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAF9F5'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Export Full Financial Workbook (Excel)</button>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              .dropdown:hover .dropdown-content { display: block !important; }
            `}} />
          </div>

          {activeTab === 'overview' && overviewSubTab === 'coa' && (
            <Button onClick={() => setActiveModal('newAccount')} style={{ border: '1px solid #E8EAE6', background: '#FFFFFF', color: '#2C302E', marginRight: '0.5rem' }}>
              <Plus size={16} style={{ marginRight: '0.35rem' }} /> New GL Account
            </Button>
          )}
          <Button onClick={() => setActiveModal('newJournal')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', boxShadow: '0 4px 12px rgba(74,107,80,0.2)' }}>
            <Plus size={16} style={{ marginRight: '0.35rem' }} /> Log Journal Entry
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {stats.map((stat) => (
          <div key={stat.id} style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>{stat.name}</span>
              <div style={{ background: 'rgba(74, 107, 80, 0.08)', color: '#4A6B50', padding: '0.4rem', borderRadius: '8px' }}>
                <stat.icon size={16} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stat.color || '#2C302E', fontFamily: 'var(--font-serif)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.25rem' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Tabs Navigation */}
      <div className={styles.tabsHeader} style={{ marginBottom: '2rem', display: 'flex', borderBottom: '1px solid #E8EAE6', gap: '1rem' }}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('overview')}
          style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Financial Overview
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'ledger' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('ledger')}
          style={{ padding: '0.75rem 1.25rem', fontSize: '0.9375rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          General Ledger Listing
        </button>
      </div>

      {/* Overview tab content */}
      {activeTab === 'overview' && (
        <div>
          {/* Controls & Reporting Period bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: '#FAFAF8', border: '1px solid #E8EAE6', borderRadius: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            
            {/* Reporting Period dropdown */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#8a8f8c', letterSpacing: '0.05em' }}>Reporting Period:</span>
              <select
                value={reportingPeriod}
                onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriod)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
              >
                <option value="all_time">All Time (Cumulative)</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {reportingPeriod === 'custom' && (
                <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                  <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.8125rem' }} />
                  <span style={{ color: '#8a8f8c', fontSize: '0.8125rem' }}>to</span>
                  <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ padding: '0.4rem 0.6rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.8125rem' }} />
                </div>
              )}
            </div>

            {/* Sub-tab buttons */}
            <div style={{ display: 'flex', background: '#E8EAE6', borderRadius: '8px', padding: '0.25rem', gap: '0.125rem' }}>
              {[
                { key: 'pnl', label: 'Income Statement (P&L)', icon: BookOpen },
                { key: 'balance_sheet', label: 'Balance Sheet', icon: Landmark },
                { key: 'trial_balance', label: 'Trial Balance', icon: Scale },
                { key: 'coa', label: 'Chart of Accounts', icon: CoaIcon },
              ].map(sub => {
                const isActive = overviewSubTab === sub.key;
                return (
                  <button
                    key={sub.key}
                    onClick={() => setOverviewSubTab(sub.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: isActive ? '#4A6B50' : '#4b5563',
                      background: isActive ? '#FFFFFF' : 'transparent',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 150ms'
                    }}
                  >
                    <sub.icon size={14} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-tab content card panel */}
          <div className={styles.ledgerCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF', padding: '2rem' }}>
            
            {/* Income Statement view */}
            {overviewSubTab === 'pnl' && (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#2C302E', margin: '0 0 0.25rem 0' }}>Income Statement (Profit & Loss)</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#8a8f8c', fontWeight: 600 }}>For reporting cycle: {getPeriodLabel()}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Revenues Section */}
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', borderBottom: '2px solid #4A6B50', paddingBottom: '0.25rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.05em' }}>Operating Revenues</h4>
                    {incomeStatement.revenues.map(r => (
                      <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#2C302E' }}>
                        <span>{r.name}</span>
                        <span>${r.balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, borderTop: '1px solid #E8EAE6', background: '#FAF9F5' }}>
                      <span>Total Revenue</span>
                      <span>${incomeStatement.totalRevenue.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', borderBottom: '2px solid #4A6B50', paddingBottom: '0.25rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.05em' }}>Cost & Operating Expenses</h4>
                    {incomeStatement.expenses.map(e => (
                      <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#2C302E' }}>
                        <span>{e.name}</span>
                        <span>${e.balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 700, borderTop: '1px solid #E8EAE6', background: '#FAF9F5' }}>
                      <span>Total Expenses</span>
                      <span>${incomeStatement.totalExpense.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Net Profit Summary */}
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#F5F1E7', borderRadius: '12px', border: '1px solid #E8EAE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#2C302E' }}>NET OPERATING INCOME</div>
                      <div style={{ fontSize: '0.75rem', color: '#8a8f8c', marginTop: '0.125rem' }}>Net margin for the period is {incomeStatement.netMarginPercent.toFixed(1)}%</div>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: incomeStatement.netIncome >= 0 ? '#10b981' : '#dc2626', fontFamily: 'var(--font-serif)', borderBottom: '4px double #4A6B50', paddingBottom: '0.25rem' }}>
                      ${incomeStatement.netIncome.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Balance Sheet view */}
            {overviewSubTab === 'balance_sheet' && (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#2C302E', margin: '0 0 0.25rem 0' }}>Balance Sheet</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#8a8f8c', fontWeight: 600 }}>Cumulative balance sheet as of end period</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                  
                  {/* Assets Left Column */}
                  <div>
                    <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', borderBottom: '2px solid #4A6B50', paddingBottom: '0.25rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.05em' }}>Assets</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minHeight: '180px' }}>
                      {balanceSheet.assets.map(a => (
                        <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#2C302E' }}>
                          <span>{a.name}</span>
                          <span>${a.balance.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0.75rem', fontSize: '0.875rem', fontWeight: 700, borderTop: '2px solid #2C302E', borderBottom: '4px double #2C302E', background: '#FAF9F5', marginTop: 'auto' }}>
                      <span>Total Assets</span>
                      <span>${balanceSheet.totalAssets.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Liabilities and Equity Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Liabilities */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', borderBottom: '2px solid #4A6B50', paddingBottom: '0.25rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.05em' }}>Liabilities</h4>
                      {balanceSheet.liabilities.map(l => (
                        <div key={l.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#2C302E' }}>
                          <span>{l.name}</span>
                          <span>${l.balance.toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, borderTop: '1px solid #E8EAE6', color: '#8a8f8c' }}>
                        <span>Total Liabilities</span>
                        <span>${balanceSheet.totalLiabilities.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Equity */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c', borderBottom: '2px solid #4A6B50', paddingBottom: '0.25rem', margin: '0 0 0.75rem 0', fontWeight: 700, letterSpacing: '0.05em' }}>Owner Equity</h4>
                      {balanceSheet.equity.map(e => (
                        <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#2C302E' }}>
                          <span>{e.name}</span>
                          <span>${e.balance.toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, borderTop: '1px solid #E8EAE6', color: '#8a8f8c' }}>
                        <span>Total Equity</span>
                        <span>${balanceSheet.totalEquity.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Total Liabilities & Equity footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0.75rem', fontSize: '0.875rem', fontWeight: 700, borderTop: '2px solid #2C302E', borderBottom: '4px double #2C302E', background: '#FAF9F5', marginTop: 'auto' }}>
                      <span>Total Liabilities & Equity</span>
                      <span>${balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</span>
                    </div>

                  </div>
                </div>

                {/* Balanced Verification Alert */}
                <div style={{ marginTop: '2rem', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: balanceSheet.isBalanced ? '#ECFDF5' : '#FEF2F2', border: balanceSheet.isBalanced ? '1px solid #A7F3D0' : '1px solid #FCA5A5', color: balanceSheet.isBalanced ? '#065F46' : '#991B1B', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {balanceSheet.isBalanced ? (
                    <>
                      <ShieldCheck size={16} />
                      <span>Accounting Verification: Balance Sheet is fully balanced (Assets = Liabilities + Equity).</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={16} />
                      <span>Accounting Warning: Balance Sheet is out of balance. Check Trial Balance values.</span>
                    </>
                  )}
                </div>

              </div>
            )}

            {/* Trial Balance view */}
            {overviewSubTab === 'trial_balance' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#2C302E', margin: '0 0 0.25rem 0' }}>General Ledger Trial Balance</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#8a8f8c', fontWeight: 600 }}>Checks that total debits match total credits</span>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table} style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#FDFCFA' }}>
                        <th>Account Code</th>
                        <th>Account Name</th>
                        <th>Classification</th>
                        <th style={{ textAlign: 'right' }}>Debit Balance ($)</th>
                        <th style={{ textAlign: 'right' }}>Credit Balance ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.lines.map(line => (
                        <tr key={line.code} style={{ borderBottom: '1px solid #F0EDE6' }}>
                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{line.code}</td>
                          <td>{line.name}</td>
                          <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f8c' }}>{line.type}</td>
                          <td style={{ textAlign: 'right', fontWeight: line.normalBalance === 'debit' ? 600 : 400 }}>
                            {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: line.normalBalance === 'credit' ? 600 : 400 }}>
                            {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#FAF9F5', fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: '1rem' }}>General Ledger Totals</td>
                        <td style={{ textAlign: 'right', padding: '1rem' }}>${trialBalance.totalDebits.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '1rem' }}>${trialBalance.totalCredits.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Difference check */}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '8px', background: trialBalance.isBalanced ? '#ECFDF5' : '#FEF2F2', border: trialBalance.isBalanced ? '1px solid #A7F3D0' : '1px solid #FCA5A5', color: trialBalance.isBalanced ? '#065F46' : '#991B1B', fontSize: '0.8125rem', fontWeight: 600 }}>
                  <span>Double-Entry Matching Audit Status</span>
                  <span>
                    {trialBalance.isBalanced ? 'Balanced (Diff: $0.00)' : `Out of Balance by $${trialBalance.difference.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            {/* Chart of Accounts view */}
            {overviewSubTab === 'coa' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: '#2C302E', margin: '0 0 0.25rem 0' }}>Chart of Accounts Registry</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#8a8f8c', fontWeight: 600 }}>Standard business ledger account rules</span>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table} style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#FDFCFA' }}>
                        <th>GL Code</th>
                        <th>Account Name</th>
                        <th>Type</th>
                        <th>Normal Balance</th>
                        <th>Active Status</th>
                        <th>Account Description</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCOA.map(coa => (
                        <tr key={coa.code} style={{ borderBottom: '1px solid #F0EDE6' }}>
                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{coa.code}</td>
                          <td><strong>{coa.name}</strong></td>
                          <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>{coa.type}</td>
                          <td style={{ textTransform: 'capitalize', fontSize: '0.8125rem' }}>{coa.normalBalance}</td>
                          <td>
                            <span className={styles.statusBadge} style={{ background: coa.active ? '#DEF7EC' : '#FDE8E8', color: coa.active ? '#03543F' : '#9B1C1C', fontSize: '0.65rem' }}>
                              {coa.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: '#6b7280', maxWidth: '300px' }}>{coa.description || 'N/A'}</td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'right', display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => setActiveModal('newAccount', coa)}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.75rem', 
                                border: '1px solid #E8EAE6', 
                                borderRadius: '4px', 
                                background: '#FFFFFF', 
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleToggleActive(coa)}
                              style={{ 
                                padding: '0.25rem 0.5rem', 
                                fontSize: '0.75rem', 
                                border: '1px solid #E8EAE6', 
                                borderRadius: '4px', 
                                background: coa.active ? '#FEF2F2' : '#ECFDF5', 
                                color: coa.active ? '#991B1B' : '#065F46',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              {coa.active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* General Ledger Tab content */}
      {activeTab === 'ledger' && (
        <Card className={styles.ledgerCard} style={{ border: '1px solid #E8EAE6', borderRadius: '16px', boxShadow: '0 8px 32px rgba(44, 48, 46, 0.02)', background: '#FFFFFF' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #E8EAE6', background: '#FAFAF8' }}>
            <input 
              type="text" 
              placeholder="Search ledger entries by description, account, ref..." 
              className={styles.ledgerSearchInput}
              value={searchParam}
              onChange={handleSearchChange}
              style={{ minWidth: '350px', flex: 1, padding: '0.5rem 1rem', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#8a8f8c', letterSpacing: '0.05em' }}>Period</span>
              <select
                value={reportingPeriod}
                onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriod)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #E8EAE6', borderRadius: '8px', background: '#FFFFFF', fontSize: '0.8125rem', color: '#2C302E', outline: 'none' }}
              >
                <option value="all_time">All Ledger History</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {(searchParam || reportingPeriod !== 'all_time') && (
              <button
                onClick={() => {
                  setReportingPeriod('all_time');
                  searchParams.delete('search');
                  setSearchParams(searchParams);
                }}
                style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                Reset Filter
              </button>
            )}
          </div>

          <CardContent>
            {isLoading ? (
              <p style={{ padding: '2rem', textAlign: 'center' }}>Loading journal entries...</p>
            ) : filteredLedgerEntries.length === 0 ? (
              <EmptyState
                title={searchParam ? "No matching journal entries." : "No ledger entries logged."}
                description={searchParam ? `No journal records match your search query "${searchParam}".` : "Post manual journals or complete order checkouts to log transactions."}
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
                      <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Date</th>
                      <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Order Ref / ID</th>
                      <th style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>General Ledger Account</th>
                      <th className={styles.amountCol} style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Debit Balance ($)</th>
                      <th className={styles.amountCol} style={{ padding: '1.125rem 1.5rem', fontWeight: 600, fontSize: '0.8125rem', textTransform: 'uppercase', color: '#8a8f8c' }}>Credit Balance ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedgerEntries.map((je) => (
                      <React.Fragment key={je.id}>
                        <tr className={styles.entryHeader} style={{ background: je.status === 'reversed' ? '#FEF2F2' : '#FDFDFB' }}>
                          <td colSpan={5} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E8EAE6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ color: '#2C302E', fontSize: '0.9375rem' }}>{je.description}</strong>
                                <span className={styles.metaText} style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}> (Entry ID: {je.id?.substring(0,8).toUpperCase()} • By: {je.createdBy})</span>
                                {je.status === 'reversed' && (
                                  <span style={{ marginLeft: '0.5rem', background: '#FEE2E2', color: '#991B1B', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>REVERSED</span>
                                )}
                                {je.reversalOf && (
                                  <span style={{ marginLeft: '0.5rem', background: '#E0F2FE', color: '#0369A1', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>REVERSAL ENTRY</span>
                                )}
                              </div>
                              {je.status === 'posted' && !je.reversalOf && (role === 'admin' || role === 'owner') && (
                                <button 
                                  onClick={() => handleReverse(je.id!)}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.75rem',
                                    background: '#EF4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.15)'
                                  }}
                                >
                                  Reverse Entry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {je.lines.map((line, idx) => (
                          <tr key={`${je.id}-${idx}`} className={styles.entryLine} style={{ borderBottom: idx === je.lines.length - 1 ? '2px solid #E8EAE6' : '1px solid #FAF9F5' }}>
                            <td className={styles.metaText} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8125rem' }}>
                              {dateStr(je)}
                            </td>
                            <td className={styles.metaText} style={{ padding: '0.75rem 1.5rem', fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                              {je.orderId.substring(0, 10).toUpperCase()}
                            </td>
                            <td className={line.credit > 0 ? styles.indentAccount : ''} style={{ padding: '0.75rem 1.5rem', fontWeight: line.credit > 0 ? 400 : 600, color: '#2C302E' }}>
                              {line.account}
                            </td>
                            <td className={styles.amountCol} style={{ padding: '0.75rem 1.5rem', fontWeight: line.debit > 0 ? 600 : 400, color: '#2C302E' }}>
                              {line.debit > 0 ? `$${line.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                            </td>
                            <td className={styles.amountCol} style={{ padding: '0.75rem 1.5rem', fontWeight: line.credit > 0 ? 600 : 400, color: '#2C302E' }}>
                              {line.credit > 0 ? `$${line.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Date formatter helper inside the file
const dateStr = (je: any): string => {
  try {
    const d = getEntryDate(je);
    return d.toLocaleDateString();
  } catch {
    return 'Just now';
  }
};
