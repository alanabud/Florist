import { create } from 'zustand';
import { getRecentJournalEntries } from '../services/financeService';
import type { JournalEntry } from '../services/financeService';
import type { AccountDefinition } from '../services/chartOfAccounts';
import {
  fetchChartOfAccounts as fetchCOA,
  addGLAccount as addCOAAccount,
  updateGLAccount as updateCOAAccount,
  deactivateGLAccount as deactivateCOAAccount,
  reactivateGLAccount as reactivateCOAAccount,
} from '../services/chartOfAccountsService';

interface FinanceState {
  journalEntries: JournalEntry[];
  isLoading: boolean;
  fetchJournalEntries: () => Promise<void>;

  // Chart of Accounts
  chartOfAccounts: AccountDefinition[];
  coaLoading: boolean;
  fetchChartOfAccounts: () => Promise<void>;
  addAccount: (account: Omit<AccountDefinition, 'id'>, actor?: string) => Promise<AccountDefinition>;
  updateAccount: (id: string, updates: Partial<AccountDefinition>, actor?: string) => Promise<void>;
  deactivateAccount: (id: string, actor?: string) => Promise<void>;
  reactivateAccount: (id: string, actor?: string) => Promise<void>;

  // Computed stats
  getTotalRevenue: () => number;
  getTotalTaxPayable: () => number;
  getTotalCash: () => number;
  getTotalAR: () => number;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  journalEntries: [],
  isLoading: false,
  chartOfAccounts: [],
  coaLoading: false,

  fetchJournalEntries: async () => {
    set({ isLoading: true });
    try {
      const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
      const entries = await getRecentJournalEntries(companyId);
      set({ journalEntries: entries });
    } catch (error) {
      console.error("Failed to fetch journal entries", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchChartOfAccounts: async () => {
    set({ coaLoading: true });
    try {
      const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
      const accounts = await fetchCOA(companyId);
      set({ chartOfAccounts: accounts });
    } catch (error) {
      console.error("Failed to fetch chart of accounts", error);
    } finally {
      set({ coaLoading: false });
    }
  },

  addAccount: async (account, actor = 'Admin') => {
    const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
    const existing = get().chartOfAccounts;
    const newAccount = await addCOAAccount({ ...account, companyId }, existing, actor);
    set({ chartOfAccounts: [...existing, newAccount] });
    return newAccount;
  },

  updateAccount: async (id, updates, actor = 'Admin') => {
    const existing = get().chartOfAccounts;
    await updateCOAAccount(id, updates, existing, actor);
    set({
      chartOfAccounts: existing.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ),
    });
  },

  deactivateAccount: async (id, actor = 'Admin') => {
    const existing = get().chartOfAccounts;
    await deactivateCOAAccount(id, existing, actor);
    set({
      chartOfAccounts: existing.map(a =>
        a.id === id ? { ...a, active: false } : a
      ),
    });
  },

  reactivateAccount: async (id, actor = 'Admin') => {
    await reactivateCOAAccount(id, actor);
    const existing = get().chartOfAccounts;
    set({
      chartOfAccounts: existing.map(a =>
        a.id === id ? { ...a, active: true } : a
      ),
    });
  },

  getTotalRevenue: () => {
    const sr = get().chartOfAccounts.find(a => a.code === '4000');
    const dr = get().chartOfAccounts.find(a => a.code === '4100');
    return get().journalEntries.reduce((total, entry) => {
      const revLines = (entry.lines || []).filter(l => 
        (sr && (l as any).accountId === sr.id) ||
        (dr && (l as any).accountId === dr.id) ||
        l.account === 'Sales Revenue' || l.account === 'Delivery Revenue'
      );
      return total + revLines.reduce((sum, l) => sum + l.credit - l.debit, 0);
    }, 0);
  },

  getTotalTaxPayable: () => {
    const taxAcct = get().chartOfAccounts.find(a => a.code === '2100');
    return get().journalEntries.reduce((total, entry) => {
      const taxLines = (entry.lines || []).filter(l => 
        (taxAcct && (l as any).accountId === taxAcct.id) || 
        l.account === 'Sales Tax Payable'
      );
      return total + taxLines.reduce((sum, l) => sum + l.credit - l.debit, 0);
    }, 0);
  },

  getTotalCash: () => {
    const cashAcct = get().chartOfAccounts.find(a => a.code === '1010');
    return get().journalEntries.reduce((total, entry) => {
      const cashLines = (entry.lines || []).filter(l => 
        (cashAcct && (l as any).accountId === cashAcct.id) || 
        l.account === 'Cash'
      );
      return total + cashLines.reduce((sum, l) => sum + l.debit - l.credit, 0);
    }, 0);
  },

  getTotalAR: () => {
    const arAcct = get().chartOfAccounts.find(a => a.code === '1200');
    return get().journalEntries.reduce((total, entry) => {
      const arLines = (entry.lines || []).filter(l => 
        (arAcct && (l as any).accountId === arAcct.id) || 
        l.account === 'Accounts Receivable'
      );
      return total + arLines.reduce((sum, l) => sum + l.debit - l.credit, 0);
    }, 0);
  }
}));
