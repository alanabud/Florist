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
  const { user, role: globalRole } = useAuthStore();
  const { setLanguage } = useI18n();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
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
  };

  const refreshContext = async () => {
    if (!user) {
      setMemberships([]);
      setSelectedCompanyId(null);
      setSelectedCompany(null);
      setCompanySettings(null);
      setLoading(false);
      setCompanyContextError(null);
      return;
    }

    setLoading(true);
    setCompanyContextError(null);
    try {
      await bootstrapCompanies();

      // Query memberships from collectionGroup
      const q = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      
      let list = snap.docs.map(d => d.data() as CompanyMember);

      // If user has zero memberships, bootstrap default membership in all three companies
      if (list.length === 0) {
        const defaultRole = globalRole || 'staff';
        const userEmail = user.email || 'staff@example.com';
        const userDisplayName = user.displayName || userEmail.split('@')[0];

        const companiesToJoin = ['DEFAULT_COMPANY', 'rose-sage', 'orchid-lane'];
        const newMemberships: CompanyMember[] = [];

        for (const companyId of companiesToJoin) {
          const mRef = doc(db, 'companies', companyId, 'members', user.uid);
          
          // Map 'staff' global role to 'admin' for company-level permissions in demo
          const companyRole = companyId === 'DEFAULT_COMPANY' 
            ? (defaultRole === 'staff' ? 'admin' : defaultRole) 
            : (companyId === 'rose-sage' ? 'admin' : 'viewer');

          const memberObj: CompanyMember = {
            userId: user.uid,
            companyId,
            email: userEmail,
            displayName: userDisplayName,
            role: companyRole as any,
            status: 'active',
            joinedAt: new Date().toISOString()
          };
          await setDoc(mRef, memberObj);
          newMemberships.push(memberObj);
        }
        list = newMemberships;
      }

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

      console.log("[CompanyContext Dev Diagnostic]", {
        authUid: user?.uid,
        userRole: globalRole,
        companiesLoaded: comps.map(c => c.id),
        activeCompanyId
      });

      await loadCompanyData(activeCompanyId, list);
    } catch (err) {
      console.error("Failed to load company memberships context:", err);
      setCompanyContextError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyData = async (companyId: string, currentMemberships: CompanyMember[]) => {
    try {
      const companyRef = doc(db, 'companies', companyId);
      const settingsRef = doc(db, 'companies', companyId, 'settings', 'profile');

      const [compSnap, settingsSnap] = await Promise.all([
        getDoc(companyRef),
        getDoc(settingsRef)
      ]);

      if (compSnap.exists() && settingsSnap.exists()) {
        const cData = { id: compSnap.id, ...compSnap.data() } as Company;
        const sData = settingsSnap.data() as CompanySettings;

        console.log("[CompanyContext loadCompanyData Diagnostic]", {
          selectedCompanyId: companyId,
          selectedCompany: cData.id,
          companySettings: sData ? 'loaded' : 'missing'
        });

        setSelectedCompanyId(companyId);
        setSelectedCompany(cData);
        setCompanySettings(sData);
        localStorage.setItem('bloompro-selected-company', companyId);

        // Apply regional default language if no user override exists
        const userMember = currentMemberships.find(m => m.companyId === companyId);
        const localLang = localStorage.getItem('bloompro-lang');
        const preferredLang = userMember?.languagePreference || localLang || sData.defaultLanguage;
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
