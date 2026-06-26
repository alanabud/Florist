import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, collectionGroup, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import { useFinanceStore } from '../store/financeStore';
import { useI18n } from '../i18n/I18nProvider';

export interface Company {
  id: string;
  legalName: string;
  displayName: string;
  companyCode: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode: string;
  baseCurrencyCode: string;
  defaultLanguage: string;
  timezone: string;
  fiscalYearStartMonth: number;
  status: 'active' | 'suspended' | 'archived';
  createdAt: any;
  createdBy: string;
}

export interface CompanyMember {
  userId: string;
  companyId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'manager' | 'dispatcher' | 'driver' | 'designer' | 'sales' | 'accountant' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  languagePreference?: string;
  defaultBranchId?: string;
  joinedAt?: any;
}

export interface CompanySettings {
  companyId: string;
  defaultLanguage: string;
  enabledLanguages: string[];
  baseCurrencyCode: string;
  enabledCurrencies: string[];
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  numberFormatLocale: string;
  fiscalYearStartMonth: number;
  closePeriodPolicy: 'open' | 'softClose' | 'hardClose';
  invoicePrefix: string;
  orderPrefix: string;
  purchaseOrderPrefix: string;
  paymentPrefix: string;
  adjustmentPrefix: string;
  journalEntryPrefix: string;
  taxLabel: string;
  defaultTaxRate: number;
  reportFooterText?: string;
}

interface CompanyContextType {
  selectedCompanyId: string | null;
  selectedCompany: Company | null;
  memberships: CompanyMember[];
  companiesList: Company[];
  companySettings: CompanySettings | null;
  switchCompany: (companyId: string) => Promise<void>;
  can: (permission: string) => boolean;
  loading: boolean;
  refreshContext: () => Promise<void>;

  // Expected implementation pattern
  activeCompany: Company | null;
  activeCompanyId: string | null;
  activeMembership: CompanyMember | null;
  userRole: CompanyMember['role'] | null;
  companies: Company[];
  isCompanyLoading: boolean;
  companyContextError: Error | null;
  setActiveCompany: (companyId: string) => Promise<void>;
  refreshCompanyContext: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'company.view', 'company.update', 'members.view', 'members.invite', 'members.updateRole',
    'settings.view', 'settings.update', 'customers.manage', 'orders.manage', 'inventory.manage',
    'purchasing.manage', 'payments.manage', 'finance.view', 'finance.post', 'reports.view',
    'reports.export', 'audit.view', 'branch.manage'
  ],
  manager: [
    'company.view', 'members.view', 'settings.view', 'customers.manage', 'orders.manage',
    'inventory.manage', 'purchasing.manage', 'payments.manage', 'finance.view', 'reports.view',
    'reports.export', 'branch.manage'
  ],
  dispatcher: [
    'company.view', 'orders.manage', 'deliveries.view', 'deliveries.manage', 'reports.view'
  ],
  driver: [
    'company.view', 'deliveries.view', 'deliveries.updateStatus'
  ],
  designer: [
    'company.view', 'orders.manage', 'inventory.manage', 'reports.view'
  ],
  sales: [
    'company.view', 'customers.manage', 'orders.manage', 'payments.manage', 'reports.view'
  ],
  accountant: [
    'company.view', 'payments.manage', 'finance.view', 'finance.post', 'reports.view', 'reports.export'
  ],
  viewer: [
    'company.view', 'members.view', 'settings.view', 'reports.view'
  ]
};

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const { setLanguage } = useI18n();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeMembership, setActiveMembership] = useState<CompanyMember | null>(null);
  const [userRole, setUserRole] = useState<CompanyMember['role'] | null>(null);
  const [memberships, setMemberships] = useState<CompanyMember[]>([]);
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [companyContextError, setCompanyContextError] = useState<Error | null>(null);

  // 1. Bootstrap seed companies if they don't exist
  const bootstrapCompanies = async () => {
    const defaultCompRef = doc(db, 'companies', 'DEFAULT_COMPANY');
    const snap = await getDoc(defaultCompRef);
    if (!snap.exists()) {
      console.log('Bootstrapping multi-company demo profiles in Firestore...');
      
      const seedCompaniesList = [
        {
          id: 'DEFAULT_COMPANY',
          legalName: 'BloomPro Studio Demo Inc.',
          displayName: 'BloomPro Studio Demo',
          companyCode: 'BPS',
          countryCode: 'US',
          baseCurrencyCode: 'USD',
          defaultLanguage: 'en-US',
          timezone: 'America/New_York',
          fiscalYearStartMonth: 1,
          status: 'active' as const,
          settings: {
            defaultLanguage: 'en-US',
            enabledLanguages: ['en-US', 'es-US', 'fr-FR', 'nl-NL'],
            baseCurrencyCode: 'USD',
            enabledCurrencies: ['USD', 'EUR'],
            timezone: 'America/New_York',
            dateFormat: 'MM/DD/YYYY' as const,
            timeFormat: '12h' as const,
            numberFormatLocale: 'en-US',
            fiscalYearStartMonth: 1,
            closePeriodPolicy: 'open' as const,
            invoicePrefix: 'INV-BPS',
            orderPrefix: 'ORD-BPS',
            purchaseOrderPrefix: 'PO-BPS',
            paymentPrefix: 'PAY-BPS',
            adjustmentPrefix: 'ADJ-BPS',
            journalEntryPrefix: 'JE-BPS',
            taxLabel: 'Sales Tax',
            defaultTaxRate: 0.08875,
            reportFooterText: 'BloomPro Studio Demo - Executive Ledger Copy'
          }
        },
        {
          id: 'rose-sage',
          legalName: 'Rose & Sage Floral S.A.',
          displayName: 'Rose & Sage Floral',
          companyCode: 'RS',
          countryCode: 'US',
          baseCurrencyCode: 'USD',
          defaultLanguage: 'es-US',
          timezone: 'America/New_York',
          fiscalYearStartMonth: 1,
          status: 'active' as const,
          settings: {
            defaultLanguage: 'es-US',
            enabledLanguages: ['en-US', 'es-US'],
            baseCurrencyCode: 'USD',
            enabledCurrencies: ['USD'],
            timezone: 'America/New_York',
            dateFormat: 'DD/MM/YYYY' as const,
            timeFormat: '24h' as const,
            numberFormatLocale: 'es-US',
            fiscalYearStartMonth: 1,
            closePeriodPolicy: 'open' as const,
            invoicePrefix: 'INV-RS',
            orderPrefix: 'ORD-RS',
            purchaseOrderPrefix: 'PO-RS',
            paymentPrefix: 'PAY-RS',
            adjustmentPrefix: 'ADJ-RS',
            journalEntryPrefix: 'JE-RS',
            taxLabel: 'IVA',
            defaultTaxRate: 0.07,
            reportFooterText: 'Rose & Sage Floral - Copia de informes'
          }
        },
        {
          id: 'orchid-lane',
          legalName: 'Orchid Lane Events SARL',
          displayName: 'Orchid Lane Events',
          companyCode: 'OL',
          countryCode: 'FR',
          baseCurrencyCode: 'EUR',
          defaultLanguage: 'fr-FR',
          timezone: 'Europe/Paris',
          fiscalYearStartMonth: 1,
          status: 'active' as const,
          settings: {
            defaultLanguage: 'fr-FR',
            enabledLanguages: ['en-US', 'fr-FR'],
            baseCurrencyCode: 'EUR',
            enabledCurrencies: ['EUR', 'USD'],
            timezone: 'Europe/Paris',
            dateFormat: 'DD/MM/YYYY' as const,
            timeFormat: '24h' as const,
            numberFormatLocale: 'fr-FR',
            fiscalYearStartMonth: 1,
            closePeriodPolicy: 'open' as const,
            invoicePrefix: 'INV-OL',
            orderPrefix: 'ORD-OL',
            purchaseOrderPrefix: 'PO-OL',
            paymentPrefix: 'PAY-OL',
            adjustmentPrefix: 'ADJ-OL',
            journalEntryPrefix: 'JE-OL',
            taxLabel: 'TVA',
            defaultTaxRate: 0.20,
            reportFooterText: 'Orchid Lane Events - Copie Comptable'
          }
        }
      ];

      for (const comp of seedCompaniesList) {
        const cRef = doc(db, 'companies', comp.id);
        const { settings, ...cData } = comp;
        await setDoc(cRef, {
          ...cData,
          createdAt: serverTimestamp(),
          createdBy: 'system-seed'
        });

        // Set Settings Doc
        const sRef = doc(db, 'companies', comp.id, 'settings', 'profile');
        await setDoc(sRef, {
          companyId: comp.id,
          ...settings,
          createdAt: serverTimestamp()
        });
      }
    }

    // Self-heal: a DEFAULT_COMPANY doc can exist from a legacy/partial seed
    // without its settings/profile child. Ensure it exists so the workspace
    // can fully hydrate (demo-company settings writes are allowed by rules).
    const defaultSettingsRef = doc(db, 'companies', 'DEFAULT_COMPANY', 'settings', 'profile');
    const defaultSettingsSnap = await getDoc(defaultSettingsRef);
    if (!defaultSettingsSnap.exists()) {
      console.log('[CompanyContext] Healing missing DEFAULT_COMPANY settings/profile...');
      await setDoc(defaultSettingsRef, {
        companyId: 'DEFAULT_COMPANY',
        defaultLanguage: 'en-US',
        enabledLanguages: ['en-US', 'es-US', 'fr-FR', 'nl-NL'],
        baseCurrencyCode: 'USD',
        enabledCurrencies: ['USD', 'EUR'],
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        numberFormatLocale: 'en-US',
        fiscalYearStartMonth: 1,
        closePeriodPolicy: 'open',
        invoicePrefix: 'INV-BPS',
        orderPrefix: 'ORD-BPS',
        purchaseOrderPrefix: 'PO-BPS',
        paymentPrefix: 'PAY-BPS',
        adjustmentPrefix: 'ADJ-BPS',
        journalEntryPrefix: 'JE-BPS',
        taxLabel: 'Sales Tax',
        defaultTaxRate: 0.08875,
        reportFooterText: 'BloomPro Studio Demo - Executive Ledger Copy',
        createdAt: serverTimestamp()
      });
    }
  };

  const refreshContext = async () => {
    if (!user) {
      setMemberships([]);
      setSelectedCompanyId(null);
      setSelectedCompany(null);
      setActiveMembership(null);
      setUserRole(null);
      setCompanySettings(null);
      setLoading(false);
      setCompanyContextError(null);
      return;
    }

    setLoading(true);
    setCompanyContextError(null);
    try {
      await bootstrapCompanies();

      // ── Membership resolution: direct doc reads first ──
      // Try direct reads for the three known demo companies before
      // falling back to the heavier collectionGroup query.
      const knownCompanies = ['DEFAULT_COMPANY', 'rose-sage', 'orchid-lane'];
      let list: CompanyMember[] = [];

      const directReads = await Promise.allSettled(
        knownCompanies.map(cId =>
          getDoc(doc(db, 'companies', cId, 'members', user.uid))
        )
      );

      for (const result of directReads) {
        if (result.status === 'fulfilled' && result.value.exists()) {
          list.push(result.value.data() as CompanyMember);
        }
      }

      // If no direct hits, try collectionGroup as a non-primary catch-all
      // fallback only (covers memberships in non-demo companies).
      if (list.length === 0) {
        try {
          const q = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
          const snap = await getDocs(q);
          list = snap.docs.map(d => d.data() as CompanyMember);
        } catch (cgErr) {
          console.warn('[CompanyContext] collectionGroup fallback failed:', cgErr);
        }
      }

      // No client-side membership provisioning. If the user has no active
      // membership, surface a controlled "no active company membership"
      // state instead of self-granting access. Memberships are provisioned
      // out-of-band via scripts/bootstrap-default-company-user.js (Admin SDK).
      const activeList = list.filter(m => m.status === 'active');
      if (activeList.length === 0) {
        console.warn('[CompanyContext] No active company membership found for', user.uid);
        setMemberships([]);
        setCompaniesList([]);
        setSelectedCompanyId(null);
        setSelectedCompany(null);
        setActiveMembership(null);
        setUserRole(null);
        setCompanySettings(null);
        setLoading(false);
        return;
      }

      list = activeList;
      setMemberships(list);

      // Fetch company objects for display names
      const companyPromises = list.map(m => getDoc(doc(db, 'companies', m.companyId)));
      const companySnaps = await Promise.all(companyPromises);
      const comps = companySnaps
         .filter(s => s.exists())
         .map(s => ({ id: s.id, ...s.data() } as Company));
      setCompaniesList(comps);

      // Determine company to select
      let activeCompanyId = localStorage.getItem('bloompro-selected-company');
      if (activeCompanyId && !list.some(m => m.companyId === activeCompanyId)) {
        localStorage.removeItem('bloompro-selected-company');
        activeCompanyId = null;
      }
      if (!activeCompanyId) {
        activeCompanyId = list[0]?.companyId || 'DEFAULT_COMPANY';
      }

      const activeRole = list.find(m => m.companyId === activeCompanyId)?.role ?? null;
      console.log("[CompanyContext Dev Diagnostic]", {
        authUid: user?.uid,
        userRole: activeRole,
        companiesLoaded: comps.map(c => c.id),
        activeCompanyId
      });

      await loadCompanyData(activeCompanyId, list);
    } catch (err) {
      console.error("Failed to load company memberships context:", err);
      // Never crash the tree: null out all context and surface the error.
      setSelectedCompanyId(null);
      setSelectedCompany(null);
      setActiveMembership(null);
      setUserRole(null);
      setCompanySettings(null);
      setCompanyContextError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyData = async (companyId: string, currentMemberships: CompanyMember[]) => {
    try {
      const companyRef = doc(db, 'companies', companyId);
      const compSnap = await getDoc(companyRef);

      // Company doc is required to activate; settings are best-effort and must
      // NOT block activation (a missing settings/profile doc previously caused
      // the company selector to silently no-op).
      if (!compSnap.exists()) {
        console.warn(`[CompanyContext] Cannot activate ${companyId}: company doc not found.`);
        return;
      }

      const cData = { id: compSnap.id, ...compSnap.data() } as Company;
      const userMember = currentMemberships.find(m => m.companyId === companyId) || null;

      setSelectedCompanyId(companyId);
      setSelectedCompany(cData);
      setActiveMembership(userMember);
      setUserRole(userMember?.role ?? null);
      localStorage.setItem('bloompro-selected-company', companyId);

      // Best-effort settings read — never blocks activation.
      let sData: CompanySettings | null = null;
      try {
        const settingsSnap = await getDoc(doc(db, 'companies', companyId, 'settings', 'profile'));
        if (settingsSnap.exists()) sData = settingsSnap.data() as CompanySettings;
      } catch (settingsErr) {
        console.warn(`[CompanyContext] settings/profile read failed for ${companyId}:`, settingsErr);
      }
      setCompanySettings(sData);

      console.log("[CompanyContext loadCompanyData Diagnostic]", {
        selectedCompanyId: companyId,
        selectedCompany: cData.id,
        userRole: userMember?.role ?? null,
        companySettings: sData ? 'loaded' : 'missing'
      });

      // Apply regional default language if no user override exists
      const localLang = localStorage.getItem('bloompro-lang');
      const preferredLang = userMember?.languagePreference || localLang || sData?.defaultLanguage;
      if (preferredLang) {
        setLanguage(preferredLang as any);

        // Sync to Firestore user profile if logged in and has different preference
        if (user?.uid && userMember && userMember.languagePreference !== preferredLang) {
          const memberRef = doc(db, 'companies', companyId, 'members', user.uid);
          updateDoc(memberRef, { languagePreference: preferredLang }).catch((err: unknown) => {
            console.error('Failed to sync language preference on load:', err);
          });
        }
      }
    } catch (e) {
      console.error(`Error loading profile data for company ${companyId}:`, e);
    }
  };

  const switchCompany = async (companyId: string) => {
    setLoading(true);
    try {
      await loadCompanyData(companyId, memberships);
      
      // Clear Zustand states and trigger fetches
      const adminStore = useAdminStore.getState();
      const financeStore = useFinanceStore.getState();

      // Clear local records
      useAdminStore.setState({
        orders: [],
        payments: [],
        statements: [],
        vendors: [],
        purchaseOrders: [],
        inventoryReceipts: [],
        vendorBills: [],
        vendorPayments: [],
        inventory: [],
        customers: [],
        products: [],
        events: [],
        subscriptions: []
      });
      useFinanceStore.setState({
        journalEntries: [],
        chartOfAccounts: []
      });

      // Refetch with new company scoping (which is handled inside store queries)
      await Promise.all([
        adminStore.fetchOrders(),
        adminStore.fetchPayments(),
        adminStore.fetchCustomerStatements(),
        adminStore.fetchVendors(),
        adminStore.fetchPurchaseOrders(),
        adminStore.fetchInventoryReceipts(),
        adminStore.fetchVendorBills(),
        adminStore.fetchVendorPayments(),
        adminStore.fetchInventory ? adminStore.fetchInventory() : Promise.resolve(),
        adminStore.fetchCustomers ? adminStore.fetchCustomers() : Promise.resolve(),
        adminStore.fetchProducts ? adminStore.fetchProducts() : Promise.resolve(),
        adminStore.fetchEvents ? adminStore.fetchEvents() : Promise.resolve(),
        adminStore.fetchSubscriptions ? adminStore.fetchSubscriptions() : Promise.resolve(),
        financeStore.fetchJournalEntries(),
        financeStore.fetchChartOfAccounts()
      ]);

      // Write audit log
      const auditRef = doc(collection(db, 'auditLogs'));
      await setDoc(auditRef, {
        companyId,
        actorUserId: user?.uid || 'unknown',
        actorEmail: user?.email || 'unknown',
        action: 'company.switched',
        entityType: 'company',
        entityId: companyId,
        createdAt: new Date().toISOString()
      });

    } catch (err) {
      console.error("Failed to switch active company context:", err);
    } finally {
      setLoading(false);
    }
  };

  const can = (permission: string): boolean => {
    if (!selectedCompanyId) return false;
    const currentMember = memberships.find(m => m.companyId === selectedCompanyId);
    if (!currentMember) return false;

    // Check status
    if (currentMember.status !== 'active') return false;

    const role = currentMember.role || 'viewer';
    const rolePerms = ROLE_PERMISSIONS[role] || [];

    if (rolePerms.includes('*')) return true;
    return rolePerms.includes(permission);
  };

  useEffect(() => {
    refreshContext();
  }, [user]);

  useEffect(() => {
    if (!selectedCompanyId && companiesList.length === 1) {
      const singleCompanyId = companiesList[0].id;
      console.log("[CompanyContext Auto-Select Diagnostic] Auto-selecting single company:", singleCompanyId);
      loadCompanyData(singleCompanyId, memberships);
    }
  }, [companiesList, selectedCompanyId, memberships]);

  return (
    <CompanyContext.Provider value={{
      selectedCompanyId,
      selectedCompany,
      memberships,
      companiesList,
      companySettings,
      switchCompany,
      can,
      loading,
      refreshContext,

      activeCompany: selectedCompany,
      activeCompanyId: selectedCompanyId,
      activeMembership,
      userRole,
      companies: companiesList,
      isCompanyLoading: loading,
      companyContextError,
      setActiveCompany: switchCompany,
      refreshCompanyContext: refreshContext
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export function isValidCompanyId(companyId?: string | null): companyId is string {
  return Boolean(
    companyId &&
    companyId.trim() !== '' &&
    companyId !== 'MISSING_CONTEXT' &&
    companyId !== 'None selected'
  );
}

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
