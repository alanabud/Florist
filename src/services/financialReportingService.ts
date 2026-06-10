import { type JournalEntry } from './financeService';
import { CHART_OF_ACCOUNTS, type AccountDefinition } from './chartOfAccounts';

export type ReportingPeriod = 'this_month' | 'this_quarter' | 'this_year' | 'all_time' | 'custom';

export interface TrialBalanceLine {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  netBalance: number;
  normalBalance: 'debit' | 'credit';
}

export interface TrialBalanceResult {
  lines: TrialBalanceLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

export interface IncomeStatementResult {
  revenues: { name: string; balance: number }[];
  totalRevenue: number;
  expenses: { name: string; balance: number }[];
  totalExpense: number;
  netIncome: number;
  netMarginPercent: number;
}

export interface BalanceSheetResult {
  assets: { name: string; balance: number }[];
  totalAssets: number;
  liabilities: { name: string; balance: number }[];
  totalLiabilities: number;
  equity: { name: string; balance: number }[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

// Safe date conversion helper
export function getEntryDate(je: JournalEntry): Date {
  const raw = je.createdAt;
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string') return new Date(raw);
  if (typeof raw === 'object' && raw !== null) {
    if ('toDate' in raw && typeof (raw as any).toDate === 'function') {
      return (raw as any).toDate();
    }
    if ('seconds' in raw && typeof (raw as any).seconds === 'number') {
      return new Date((raw as any).seconds * 1000);
    }
  }
  return new Date(raw as any);
}

// Period filtering helper
export function filterEntriesByPeriod(
  entries: JournalEntry[],
  period: ReportingPeriod,
  customRange?: { start?: string | Date; end?: string | Date }
): JournalEntry[] {
  const now = new Date();
  
  return entries.filter(je => {
    const date = getEntryDate(je);
    
    switch (period) {
      case 'this_month': {
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }
      case 'this_quarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const entryQuarter = Math.floor(date.getMonth() / 3);
        return date.getFullYear() === now.getFullYear() && entryQuarter === currentQuarter;
      }
      case 'this_year': {
        return date.getFullYear() === now.getFullYear();
      }
      case 'custom': {
        if (!customRange) return true;
        const start = customRange.start ? new Date(customRange.start) : new Date(0);
        const end = customRange.end ? new Date(customRange.end) : new Date();
        // Set end of day for the end date parameter
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
      }
      case 'all_time':
      default:
        return true;
    }
  });
}

// Filter entries up to the end of the period (useful for Balance Sheet cumulative accounts)
export function filterEntriesCumulative(
  entries: JournalEntry[],
  period: ReportingPeriod,
  customRange?: { start?: string | Date; end?: string | Date }
): JournalEntry[] {
  const now = new Date();
  let cutOffDate = new Date();

  switch (period) {
    case 'this_month': {
      // Last day of current month
      cutOffDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'this_quarter': {
      // Last day of current quarter
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const endMonth = (currentQuarter + 1) * 3;
      cutOffDate = new Date(now.getFullYear(), endMonth, 0, 23, 59, 59, 999);
      break;
    }
    case 'this_year': {
      // Last day of current year
      cutOffDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (customRange?.end) {
        cutOffDate = new Date(customRange.end);
        cutOffDate.setHours(23, 59, 59, 999);
      }
      break;
    }
    case 'all_time':
    default:
      return entries; // All entries
  }

  return entries.filter(je => getEntryDate(je) <= cutOffDate);
}

// 1. Build Trial Balance
export function buildTrialBalance(
  journalEntries: JournalEntry[],
  chartOfAccounts: AccountDefinition[] = CHART_OF_ACCOUNTS
): TrialBalanceResult {
  const lines: TrialBalanceLine[] = chartOfAccounts
    .map(account => {
      let debit = 0;
      let credit = 0;

      journalEntries.forEach(je => {
        // Include all entries. If reversed, the reversal entry offsets it.
        je.lines.forEach(l => {
          const isMatch = (account.id && (l as any).accountId === account.id) ||
            ((l as any).accountName === account.name) ||
            (l.account === account.name);
          if (isMatch) {
            debit += l.debit || 0;
            credit += l.credit || 0;
          }
        });
      });

      const netBalance = account.normalBalance === 'debit'
        ? debit - credit
        : credit - debit;

      const displayName = account.active !== false ? account.name : `${account.name} (Inactive)`;

      return {
        code: account.code,
        name: displayName,
        type: account.type,
        debit,
        credit,
        netBalance,
        normalBalance: account.normalBalance
      };
    })
    .filter(line => {
      const coaItem = chartOfAccounts.find(a => a.code === line.code);
      const isActive = coaItem?.active !== false;
      const hasBalance = Math.abs(line.debit) > 0.009 || Math.abs(line.credit) > 0.009;
      return isActive || hasBalance;
    });

  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.01;

  return {
    lines,
    totalDebits,
    totalCredits,
    isBalanced,
    difference
  };
}

// 2. Build Income Statement (Profit & Loss)
export function buildIncomeStatement(
  journalEntries: JournalEntry[],
  chartOfAccounts: AccountDefinition[] = CHART_OF_ACCOUNTS,
  period: ReportingPeriod,
  customRange?: { start?: string | Date; end?: string | Date }
): IncomeStatementResult {
  const filtered = filterEntriesByPeriod(journalEntries, period, customRange);
  const trialBalance = buildTrialBalance(filtered, chartOfAccounts);

  const revenueLines = trialBalance.lines.filter(l => l.type === 'revenue');
  const expenseLines = trialBalance.lines.filter(l => l.type === 'expense');

  const revenues = revenueLines.map(r => ({ name: r.name, balance: r.netBalance }));
  const totalRevenue = revenues.reduce((sum, r) => sum + r.balance, 0);

  const expenses = expenseLines.map(e => ({ name: e.name, balance: e.netBalance }));
  const totalExpense = expenses.reduce((sum, e) => sum + e.balance, 0);

  const netIncome = totalRevenue - totalExpense;
  const netMarginPercent = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    revenues,
    totalRevenue,
    expenses,
    totalExpense,
    netIncome,
    netMarginPercent
  };
}

// 3. Build Balance Sheet
export function buildBalanceSheet(
  journalEntries: JournalEntry[],
  chartOfAccounts: AccountDefinition[] = CHART_OF_ACCOUNTS,
  period: ReportingPeriod,
  customRange?: { start?: string | Date; end?: string | Date }
): BalanceSheetResult {
  // Balance Sheet contains cumulative balances as of the end of the selected period
  const filteredCumulative = filterEntriesCumulative(journalEntries, period, customRange);
  const trialBalance = buildTrialBalance(filteredCumulative, chartOfAccounts);

  // Filter Assets, Liabilities, and Equity
  const assetLines = trialBalance.lines.filter(l => l.type === 'asset');
  const liabilityLines = trialBalance.lines.filter(l => l.type === 'liability');
  const equityLines = trialBalance.lines.filter(l => l.type === 'equity');

  const assets = assetLines.map(a => ({ name: a.name, balance: a.netBalance }));
  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);

  const liabilities = liabilityLines.map(l => ({ name: l.name, balance: l.netBalance }));
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);

  // To balance the Balance Sheet, we must compute current year earnings from the Income Statement
  // for the cumulative duration up to the cutoff date.
  // P&L up to cut-off:
  const incomeResult = buildIncomeStatement(filteredCumulative, chartOfAccounts, 'all_time'); 
  const currentEarnings = incomeResult.netIncome;

  const equity = equityLines.map(e => ({ name: e.name, balance: e.netBalance }));
  
  // Add Current Earnings as a separate equity line
  const equityWithEarnings = [
    ...equity.map(e => ({ name: e.name, balance: e.balance })),
    { name: 'Retained Earnings (Current Year)', balance: currentEarnings }
  ];
  
  const totalEquity = equityWithEarnings.reduce((sum, e) => sum + e.balance, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity: equityWithEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced
  };
}
