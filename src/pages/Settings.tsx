import React, { useState, useEffect } from 'react';
import { useCompany } from '../context/CompanyContext';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useAdminStore } from '../store/adminStore';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../i18n/I18nProvider';
import { 
  Building2, Globe, Users, GitBranch, Save, Plus, Trash2, 
  ShieldAlert, Edit, RefreshCw 
} from 'lucide-react';
import { updateCompanyProfile, updateCompanySettings } from '../services/companySettingsService';
import { 
  fetchCompanyMembers, inviteCompanyMember, updateCompanyMemberRole, 
  updateCompanyMemberStatus, removeCompanyMember 
} from '../services/companyMemberService';
import { 
  fetchBranches, addBranch, updateBranch, deleteBranch
} from '../services/branchService';
import type { Branch } from '../services/branchService';
import styles from './Settings.module.css';

export const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    selectedCompanyId, selectedCompany, companySettings, refreshContext, can 
  } = useCompany();
  const addToast = useToastStore((state) => state.addToast);
  const { resetToDemo } = useAdminStore();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'profile' | 'regional' | 'members' | 'branches'>('profile');

  // ==========================================
  // PROFILE TAB STATE
  // ==========================================
  const [profileLegalName, setProfileLegalName] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileCompanyCode, setProfileCompanyCode] = useState('');
  const [profileTaxId, setProfileTaxId] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileWebsite, setProfileWebsite] = useState('');
  const [profileAddressLine1, setProfileAddressLine1] = useState('');
  const [profileAddressLine2, setProfileAddressLine2] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profilePostalCode, setProfilePostalCode] = useState('');
  const [profileCountryCode, setProfileCountryCode] = useState('US');

  // ==========================================
  // REGIONAL SETTINGS TAB STATE
  // ==========================================
  const [regDefaultLanguage, setRegDefaultLanguage] = useState('en-US');
  const [regEnabledLanguages, setRegEnabledLanguages] = useState<string[]>([]);
  const [regBaseCurrency, setRegBaseCurrency] = useState('USD');
  const [regEnabledCurrencies, setRegEnabledCurrencies] = useState<string[]>([]);
  const [regTimezone, setRegTimezone] = useState('America/New_York');
  const [regDateFormat, setRegDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'>('MM/DD/YYYY');
  const [regTimeFormat, setRegTimeFormat] = useState<'12h' | '24h'>('12h');
  const [regNumberFormatLocale, setRegNumberFormatLocale] = useState('en-US');
  const [regFiscalYearStart, setRegFiscalYearStart] = useState(1);
  const [regClosePeriodPolicy, setRegClosePeriodPolicy] = useState<'open' | 'softClose' | 'hardClose'>('open');
  const [regInvoicePrefix, setRegInvoicePrefix] = useState('INV');
  const [regOrderPrefix, setRegOrderPrefix] = useState('ORD');
  const [regPurchaseOrderPrefix, setRegPurchaseOrderPrefix] = useState('PO');
  const [regPaymentPrefix, setRegPaymentPrefix] = useState('PAY');
  const [regAdjustmentPrefix, setRegAdjustmentPrefix] = useState('ADJ');
  const [regJournalEntryPrefix, setRegJournalEntryPrefix] = useState('JE');
  const [regTaxLabel, setRegTaxLabel] = useState('Tax');
  const [regDefaultTaxRate, setRegDefaultTaxRate] = useState(0);
  const [regReportFooter, setRegReportFooter] = useState('');

  // ==========================================
  // MEMBERS TAB STATE
  // ==========================================
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'manager' | 'designer' | 'sales' | 'accountant' | 'viewer'>('viewer');
  const [inviteUserId, setInviteUserId] = useState('');

  // ==========================================
  // BRANCHES TAB STATE
  // ==========================================
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  
  // Add branch form state
  const [brCode, setBrCode] = useState('');
  const [brDisplayName, setBrDisplayName] = useState('');
  const [brAddress, setBrAddress] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brState, setBrState] = useState('');
  const [brPostalCode, setBrPostalCode] = useState('');
  const [brCountry, _setBrCountry] = useState('US');
  const [brPhone, setBrPhone] = useState('');
  const [brEmail, setBrEmail] = useState('');
  const [brTimezone, setBrTimezone] = useState('America/New_York');
  const [brStatus, setBrStatus] = useState<'active' | 'inactive'>('active');

  // Edit branch state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Sync state with selected company / settings
  useEffect(() => {
    if (selectedCompany) {
      setProfileLegalName(selectedCompany.legalName || '');
      setProfileDisplayName(selectedCompany.displayName || '');
      setProfileCompanyCode(selectedCompany.companyCode || '');
      setProfileTaxId(selectedCompany.taxId || '');
      setProfileEmail(selectedCompany.email || '');
      setProfilePhone(selectedCompany.phone || '');
      setProfileWebsite(selectedCompany.website || '');
      setProfileAddressLine1(selectedCompany.addressLine1 || '');
      setProfileAddressLine2(selectedCompany.addressLine2 || '');
      setProfileCity(selectedCompany.city || '');
      setProfileState(selectedCompany.state || '');
      setProfilePostalCode(selectedCompany.postalCode || '');
      setProfileCountryCode(selectedCompany.countryCode || 'US');
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (companySettings) {
      setRegDefaultLanguage(companySettings.defaultLanguage || 'en-US');
      setRegEnabledLanguages(companySettings.enabledLanguages || ['en-US']);
      setRegBaseCurrency(companySettings.baseCurrencyCode || 'USD');
      setRegEnabledCurrencies(companySettings.enabledCurrencies || ['USD']);
      setRegTimezone(companySettings.timezone || 'America/New_York');
      setRegDateFormat(companySettings.dateFormat || 'MM/DD/YYYY');
      setRegTimeFormat(companySettings.timeFormat || '12h');
      setRegNumberFormatLocale(companySettings.numberFormatLocale || 'en-US');
      setRegFiscalYearStart(companySettings.fiscalYearStartMonth || 1);
      setRegClosePeriodPolicy(companySettings.closePeriodPolicy || 'open');
      setRegInvoicePrefix(companySettings.invoicePrefix || 'INV');
      setRegOrderPrefix(companySettings.orderPrefix || 'ORD');
      setRegPurchaseOrderPrefix(companySettings.purchaseOrderPrefix || 'PO');
      setRegPaymentPrefix(companySettings.paymentPrefix || 'PAY');
      setRegAdjustmentPrefix(companySettings.adjustmentPrefix || 'ADJ');
      setRegJournalEntryPrefix(companySettings.journalEntryPrefix || 'JE');
      setRegTaxLabel(companySettings.taxLabel || 'Tax');
      setRegDefaultTaxRate(companySettings.defaultTaxRate || 0);
      setRegReportFooter(companySettings.reportFooterText || '');
    }
  }, [companySettings]);

  // Load members or branches on demand based on tab selection
  useEffect(() => {
    if (selectedCompanyId) {
      if (activeTab === 'members') {
        loadMembers();
      } else if (activeTab === 'branches') {
        loadBranches();
      }
    }
  }, [selectedCompanyId, activeTab]);

  const loadMembers = async () => {
    if (!selectedCompanyId) return;
    setMembersLoading(true);
    try {
      const list = await fetchCompanyMembers(selectedCompanyId);
      setMembers(list);
    } catch (err) {
      console.error(err);
      addToast('Failed to load company members.', 'error');
    } finally {
      setMembersLoading(false);
    }
  };

  const loadBranches = async () => {
    if (!selectedCompanyId) return;
    setBranchesLoading(true);
    try {
      const list = await fetchBranches(selectedCompanyId);
      setBranches(list);
    } catch (err) {
      console.error(err);
      addToast('Failed to load branches.', 'error');
    } finally {
      setBranchesLoading(false);
    }
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!can('company.update')) {
      addToast('Unauthorized: You do not have permission to update company profile.', 'error');
      return;
    }

    try {
      const updates = {
        legalName: profileLegalName,
        displayName: profileDisplayName,
        companyCode: profileCompanyCode,
        taxId: profileTaxId,
        email: profileEmail,
        phone: profilePhone,
        website: profileWebsite,
        addressLine1: profileAddressLine1,
        addressLine2: profileAddressLine2,
        city: profileCity,
        state: profileState,
        postalCode: profilePostalCode,
        countryCode: profileCountryCode
      };

      await updateCompanyProfile(selectedCompanyId, updates, user?.email || 'unknown');
      addToast('Company profile updated successfully.', 'success');
      await refreshContext();
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleSaveRegional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!can('settings.update')) {
      addToast('Unauthorized: You do not have permission to update settings.', 'error');
      return;
    }

    try {
      const updates = {
        defaultLanguage: regDefaultLanguage,
        enabledLanguages: regEnabledLanguages,
        baseCurrencyCode: regBaseCurrency,
        enabledCurrencies: regEnabledCurrencies,
        timezone: regTimezone,
        dateFormat: regDateFormat,
        timeFormat: regTimeFormat,
        numberFormatLocale: regNumberFormatLocale,
        fiscalYearStartMonth: regFiscalYearStart,
        closePeriodPolicy: regClosePeriodPolicy,
        invoicePrefix: regInvoicePrefix,
        orderPrefix: regOrderPrefix,
        purchaseOrderPrefix: regPurchaseOrderPrefix,
        paymentPrefix: regPaymentPrefix,
        adjustmentPrefix: regAdjustmentPrefix,
        journalEntryPrefix: regJournalEntryPrefix,
        taxLabel: regTaxLabel,
        defaultTaxRate: Number(regDefaultTaxRate),
        reportFooterText: regReportFooter
      };

      await updateCompanySettings(selectedCompanyId, updates, user?.email || 'unknown');
      addToast('Localization settings updated successfully.', 'success');
      await refreshContext();
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!can('members.invite')) {
      addToast('Unauthorized: You do not have permission to invite members.', 'error');
      return;
    }

    try {
      const generatedUid = inviteUserId.trim() || `usr_${Math.random().toString(36).substr(2, 9)}`;
      const newMember = {
        userId: generatedUid,
        companyId: selectedCompanyId,
        email: inviteEmail.trim(),
        displayName: inviteName.trim(),
        role: inviteRole,
        status: 'active' as const
      };

      await inviteCompanyMember(selectedCompanyId, newMember, user?.email || 'unknown');
      addToast(`Invited member ${inviteName} successfully.`, 'success');
      
      // Clear invite form
      setInviteEmail('');
      setInviteName('');
      setInviteRole('viewer');
      setInviteUserId('');

      // Refresh list
      loadMembers();
    } catch (err: any) {
      addToast(`Error inviting member: ${err.message}`, 'error');
    }
  };

  const handleChangeMemberRole = async (targetUserId: string, newRole: any) => {
    if (!selectedCompanyId) return;
    if (!can('members.updateRole')) {
      addToast('Unauthorized: You cannot change member roles.', 'error');
      return;
    }

    try {
      await updateCompanyMemberRole(selectedCompanyId, targetUserId, newRole, user?.email || 'unknown');
      addToast('Member role updated successfully.', 'success');
      loadMembers();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleToggleMemberStatus = async (targetUserId: string, currentStatus: string) => {
    if (!selectedCompanyId) return;
    if (!can('members.updateRole')) {
      addToast('Unauthorized: You cannot update member statuses.', 'error');
      return;
    }

    try {
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      await updateCompanyMemberStatus(selectedCompanyId, targetUserId, newStatus, user?.email || 'unknown');
      addToast(`Member status updated to ${newStatus}.`, 'success');
      loadMembers();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!selectedCompanyId) return;
    if (!can('members.updateRole')) {
      addToast('Unauthorized: You cannot remove members.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to completely remove this member?')) return;

    try {
      await removeCompanyMember(selectedCompanyId, targetUserId, user?.email || 'unknown');
      addToast('Member removed successfully.', 'success');
      loadMembers();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!can('branch.manage')) {
      addToast('Unauthorized: You do not have permission to manage branches.', 'error');
      return;
    }

    try {
      const newBranch = {
        companyId: selectedCompanyId,
        branchCode: brCode.trim().toUpperCase(),
        displayName: brDisplayName.trim(),
        address: brAddress.trim(),
        city: brCity.trim(),
        state: brState.trim(),
        postalCode: brPostalCode.trim(),
        country: brCountry,
        phone: brPhone.trim(),
        email: brEmail.trim(),
        timezone: brTimezone,
        status: brStatus
      };

      await addBranch(newBranch, user?.email || 'unknown');
      addToast(`Branch ${brDisplayName} created successfully.`, 'success');

      // Reset branch form
      setBrCode('');
      setBrDisplayName('');
      setBrAddress('');
      setBrCity('');
      setBrState('');
      setBrPostalCode('');
      setBrPhone('');
      setBrEmail('');
      setBrStatus('active');

      loadBranches();
    } catch (err: any) {
      addToast(`Error adding branch: ${err.message}`, 'error');
    }
  };

  const handleSaveEditBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !editingBranch?.id) return;
    if (!can('branch.manage')) {
      addToast('Unauthorized: You do not have permission to manage branches.', 'error');
      return;
    }

    try {
      const updates = {
        branchCode: editingBranch.branchCode.toUpperCase(),
        displayName: editingBranch.displayName,
        address: editingBranch.address,
        city: editingBranch.city,
        state: editingBranch.state,
        postalCode: editingBranch.postalCode,
        country: editingBranch.country,
        phone: editingBranch.phone,
        email: editingBranch.email,
        timezone: editingBranch.timezone,
        status: editingBranch.status
      };

      await updateBranch(editingBranch.id, updates, user?.email || 'unknown');
      addToast(`Branch ${editingBranch.displayName} updated successfully.`, 'success');
      setEditingBranch(null);
      loadBranches();
    } catch (err: any) {
      addToast(`Error updating branch: ${err.message}`, 'error');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!selectedCompanyId) return;
    if (!can('branch.manage')) {
      addToast('Unauthorized: You do not have permission to manage branches.', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this branch?')) return;

    try {
      await deleteBranch(branchId, user?.email || 'unknown');
      addToast('Branch deleted successfully.', 'success');
      loadBranches();
    } catch (err: any) {
      addToast(`Error deleting branch: ${err.message}`, 'error');
    }
  };

  const handleResetDemoData = () => {
    if (window.confirm("Are you sure you want to reset all active company data to the demo seed?")) {
      resetToDemo();
      addToast('Active company data reset to demo defaults.', 'info');
    }
  };

  // Helper to toggle languages checklist
  const handleToggleLanguage = (langCode: string) => {
    if (regEnabledLanguages.includes(langCode)) {
      if (regEnabledLanguages.length === 1) {
        addToast('At least one language must remain enabled.', 'info');
        return;
      }
      setRegEnabledLanguages(regEnabledLanguages.filter(l => l !== langCode));
    } else {
      setRegEnabledLanguages([...regEnabledLanguages, langCode]);
    }
  };

  // Helper to toggle currencies checklist
  const handleToggleCurrency = (currCode: string) => {
    if (regEnabledCurrencies.includes(currCode)) {
      if (regEnabledCurrencies.length === 1) {
        addToast('At least one currency must remain enabled.', 'info');
        return;
      }
      setRegEnabledCurrencies(regEnabledCurrencies.filter(c => c !== currCode));
    } else {
      setRegEnabledCurrencies([...regEnabledCurrencies, currCode]);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('company.companySettings')}</h1>
        <p className={styles.subtitle}>
          {selectedCompany?.displayName || 'BloomPro'} &mdash; {t('navigation.settings')}
        </p>
      </div>

      {/* Tabs list */}
      <div className={styles.tabList}>
        <button 
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`${styles.tabButton} ${activeTab === 'profile' ? styles.tabButtonActive : ''}`}
        >
          <Building2 size={16} /> {t('company.companySettings')}
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('regional')}
          className={`${styles.tabButton} ${activeTab === 'regional' ? styles.tabButtonActive : ''}`}
        >
          <Globe size={16} /> {t('company.defaultLanguage')} &amp; {t('company.baseCurrency')}
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('members')}
          className={`${styles.tabButton} ${activeTab === 'members' ? styles.tabButtonActive : ''}`}
        >
          <Users size={16} /> {t('company.userManagement')}
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('branches')}
          className={`${styles.tabButton} ${activeTab === 'branches' ? styles.tabButtonActive : ''}`}
        >
          <GitBranch size={16} /> {t('company.branchManagement')}
        </button>
      </div>

      {/* ========================================== */}
      {/* 1. PROFILE TAB PANEL                       */}
      {/* ========================================== */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>
                <Building2 size={20} /> {t('company.companySettings')}
              </div>
            </CardHeader>
            <CardContent>
              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.displayName')} *</label>
                  <input 
                    type="text" 
                    value={profileDisplayName} 
                    onChange={(e) => setProfileDisplayName(e.target.value)} 
                    className={styles.input} 
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.legalName')} *</label>
                  <input 
                    type="text" 
                    value={profileLegalName} 
                    onChange={(e) => setProfileLegalName(e.target.value)} 
                    className={styles.input} 
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.companyCode')} *</label>
                  <input 
                    type="text" 
                    value={profileCompanyCode} 
                    onChange={(e) => setProfileCompanyCode(e.target.value)} 
                    className={styles.input} 
                    disabled={selectedCompanyId !== 'new-company'}
                    required 
                  />
                  <span className={styles.helperText}>{t('settings.companyCodeIsImmutableAfterCreation')}</span>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tax/VAT ID</label>
                  <input 
                    type="text" 
                    value={profileTaxId} 
                    onChange={(e) => setProfileTaxId(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address *</label>
                  <input 
                    type="email" 
                    value={profileEmail} 
                    onChange={(e) => setProfileEmail(e.target.value)} 
                    className={styles.input} 
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Phone Number *</label>
                  <input 
                    type="text" 
                    value={profilePhone} 
                    onChange={(e) => setProfilePhone(e.target.value)} 
                    className={styles.input} 
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.websiteUrl')}</label>
                  <input 
                    type="text" 
                    value={profileWebsite} 
                    onChange={(e) => setProfileWebsite(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Country Code *</label>
                  <select 
                    value={profileCountryCode} 
                    onChange={(e) => setProfileCountryCode(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="US">United States (US)</option>
                    <option value="FR">France (FR)</option>
                    <option value="NL">Netherlands (NL)</option>
                    <option value="ES">Spain (ES)</option>
                  </select>
                </div>

                <div className={styles.formGroupFull}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>{t('settings.addressInformation')}</h3>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Address Line 1</label>
                  <input 
                    type="text" 
                    value={profileAddressLine1} 
                    onChange={(e) => setProfileAddressLine1(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Address Line 2</label>
                  <input 
                    type="text" 
                    value={profileAddressLine2} 
                    onChange={(e) => setProfileAddressLine2(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>City</label>
                  <input 
                    type="text" 
                    value={profileCity} 
                    onChange={(e) => setProfileCity(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>State / Region</label>
                  <input 
                    type="text" 
                    value={profileState} 
                    onChange={(e) => setProfileState(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Postal / ZIP Code</label>
                  <input 
                    type="text" 
                    value={profilePostalCode} 
                    onChange={(e) => setProfilePostalCode(e.target.value)} 
                    className={styles.input} 
                  />
                </div>
              </div>

              <div className={styles.cardActions}>
                <Button type="submit" disabled={!can('company.update')}>
                  <Save size={16} style={{ marginRight: '0.5rem' }} /> {t('common.save')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reset Demo Data in Danger Zone */}
          <div className={`${styles.formSection} ${styles.dangerSection}`}>
            <h3 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
              <ShieldAlert size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Danger Zone
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '1rem' }}>
              Resetting demo data will wipe the active company collections and restore them to original florist ERP defaults. This cannot be undone.
            </p>
            <Button type="button" variant="outline" onClick={handleResetDemoData} style={{ borderColor: '#fca5a5', color: '#b91c1c' }}>
              Reset Active Company Demo Data
            </Button>
          </div>
        </form>
      )}

      {/* ========================================== */}
      {/* 2. REGIONAL / LOCALIZATION TAB PANEL       */}
      {/* ========================================== */}
      {activeTab === 'regional' && (
        <form onSubmit={handleSaveRegional} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1.25rem' }}>
                <Globe size={20} /> Localization &amp; Formats
              </div>
            </CardHeader>
            <CardContent>
              <div className={styles.grid}>
                {/* Languages */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.defaultLanguage')} *</label>
                  <select 
                    value={regDefaultLanguage} 
                    onChange={(e) => setRegDefaultLanguage(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="en-US">English (en-US)</option>
                    <option value="es-US">Spanish (es-US)</option>
                    <option value="fr-FR">French (fr-FR)</option>
                    <option value="nl-NL">Dutch (nl-NL)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.supportedLanguages')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                    {['en-US', 'es-US', 'fr-FR', 'nl-NL'].map(lang => (
                      <label key={lang} className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={regEnabledLanguages.includes(lang)}
                          onChange={() => handleToggleLanguage(lang)}
                        />
                        <span>{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Currency */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.baseCurrency')} *</label>
                  <select 
                    value={regBaseCurrency} 
                    onChange={(e) => setRegBaseCurrency(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.supportedTransactionCurrencies')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                    {['USD', 'EUR', 'GBP'].map(curr => (
                      <label key={curr} className={styles.checkboxContainer}>
                        <input 
                          type="checkbox" 
                          checked={regEnabledCurrencies.includes(curr)}
                          onChange={() => handleToggleCurrency(curr)}
                        />
                        <span>{curr}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Formats */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.timezone')} *</label>
                  <select 
                    value={regTimezone} 
                    onChange={(e) => setRegTimezone(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                    <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Date Display Format *</label>
                  <select 
                    value={regDateFormat} 
                    onChange={(e: any) => setRegDateFormat(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Time Format *</label>
                  <select 
                    value={regTimeFormat} 
                    onChange={(e: any) => setRegTimeFormat(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour (Military)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Numeric/Decimal Formatter Locale *</label>
                  <select 
                    value={regNumberFormatLocale} 
                    onChange={(e) => setRegNumberFormatLocale(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="en-US">en-US (1,234.56)</option>
                    <option value="es-US">es-US (1.234,56)</option>
                    <option value="fr-FR">fr-FR (1 234,56)</option>
                    <option value="nl-NL">nl-NL (1.234,56)</option>
                  </select>
                </div>

                <div className={styles.formGroupFull}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>Accounting &amp; Taxes</h3>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('company.fiscalYearStart')} *</label>
                  <select 
                    value={regFiscalYearStart} 
                    onChange={(e) => setRegFiscalYearStart(Number(e.target.value))} 
                    className={styles.select}
                    required
                  >
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>General Ledger Closing Policy *</label>
                  <select 
                    value={regClosePeriodPolicy} 
                    onChange={(e: any) => setRegClosePeriodPolicy(e.target.value)} 
                    className={styles.select}
                    required
                  >
                    <option value="open">Open (No restrictions)</option>
                    <option value="softClose">Soft Close (Warnings on edits)</option>
                    <option value="hardClose">Hard Close (No edits allowed)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tax / VAT Label *</label>
                  <input 
                    type="text" 
                    value={regTaxLabel} 
                    onChange={(e) => setRegTaxLabel(e.target.value)} 
                    className={styles.input} 
                    placeholder="e.g. Sales Tax, IVA, TVA"
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Default Tax Rate (%) *</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    value={regDefaultTaxRate} 
                    onChange={(e) => setRegDefaultTaxRate(Number(e.target.value))} 
                    className={styles.input} 
                    required 
                  />
                </div>

                <div className={styles.formGroupFull}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>{t('settings.documentNumberPrefixes')}</h3>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.invoicePrefix')}</label>
                  <input type="text" value={regInvoicePrefix} onChange={(e) => setRegInvoicePrefix(e.target.value)} className={styles.input} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.orderPrefix')}</label>
                  <input type="text" value={regOrderPrefix} onChange={(e) => setRegOrderPrefix(e.target.value)} className={styles.input} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.purchaseOrderPrefix')}</label>
                  <input type="text" value={regPurchaseOrderPrefix} onChange={(e) => setRegPurchaseOrderPrefix(e.target.value)} className={styles.input} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.paymentReceiptPrefix')}</label>
                  <input type="text" value={regPaymentPrefix} onChange={(e) => setRegPaymentPrefix(e.target.value)} className={styles.input} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.inventoryAdjustmentPrefix')}</label>
                  <input type="text" value={regAdjustmentPrefix} onChange={(e) => setRegAdjustmentPrefix(e.target.value)} className={styles.input} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.journalEntryPrefix')}</label>
                  <input type="text" value={regJournalEntryPrefix} onChange={(e) => setRegJournalEntryPrefix(e.target.value)} className={styles.input} required />
                </div>

                <div className={styles.formGroupFull}>
                  <label className={styles.label}>{t('company.reportFooter')}</label>
                  <textarea 
                    value={regReportFooter} 
                    onChange={(e) => setRegReportFooter(e.target.value)} 
                    className={styles.textarea} 
                    placeholder="Enter disclaimer or copy printed on official PDF/Excel statements"
                  />
                </div>
              </div>

              <div className={styles.cardActions}>
                <Button type="submit" disabled={!can('settings.update')}>
                  <Save size={16} style={{ marginRight: '0.5rem' }} /> {t('company.saveSettings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {/* ========================================== */}
      {/* 3. MEMBERS TAB PANEL                       */}
      {/* ========================================== */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>{t('company.membersTitle')}</div>
              <Button type="button" variant="outline" onClick={loadMembers} size="sm">
                <RefreshCw size={14} style={{ marginRight: '0.25rem' }} /> Refresh
              </Button>
            </div>
            
            {membersLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {t('common.loading')}
              </div>
            ) : members.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No active memberships found.
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>{t('company.role')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId}>
                      <td style={{ fontWeight: 600 }}>{member.displayName}</td>
                      <td>{member.email}</td>
                      <td>
                        <select 
                          value={member.role} 
                          onChange={(e) => handleChangeMemberRole(member.userId, e.target.value)}
                          className={styles.roleSelect}
                          disabled={!can('members.updateRole') || member.userId === user?.uid}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="designer">Designer</option>
                          <option value="sales">Sales</option>
                          <option value="accountant">Accountant</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${
                          member.status === 'active' ? styles.badgeActive : 
                          member.status === 'invited' ? styles.badgeInvited : styles.badgeDisabled
                        }`}>
                          {member.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button 
                            type="button" 
                            onClick={() => handleToggleMemberStatus(member.userId, member.status)}
                            className={styles.roleSelect}
                            style={{ cursor: 'pointer' }}
                            disabled={!can('members.updateRole') || member.userId === user?.uid}
                          >
                            {member.status === 'active' ? 'Disable' : 'Activate'}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveMember(member.userId)}
                            className={styles.roleSelect}
                            style={{ color: '#DC2626', borderColor: '#FCA5A5', cursor: 'pointer' }}
                            disabled={!can('members.updateRole') || member.userId === user?.uid}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Invitation Section */}
          {can('members.invite') && (
            <Card>
              <CardHeader>
                <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{t('company.inviteUser')}</div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteMember} className={styles.grid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Email Address *</label>
                    <input 
                      type="email" 
                      value={inviteEmail} 
                      onChange={(e) => setInviteEmail(e.target.value)} 
                      className={styles.input} 
                      required 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Display Name *</label>
                    <input 
                      type="text" 
                      value={inviteName} 
                      onChange={(e) => setInviteName(e.target.value)} 
                      className={styles.input} 
                      required 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('company.role')} *</label>
                    <select 
                      value={inviteRole} 
                      onChange={(e: any) => setInviteRole(e.target.value)} 
                      className={styles.select}
                      required
                    >
                      <option value="owner">Owner (Full rights)</option>
                      <option value="admin">Admin (All workflows)</option>
                      <option value="manager">Manager (Operations)</option>
                      <option value="designer">Designer (Orders &amp; Inventory)</option>
                      <option value="sales">Sales (Orders &amp; Customers)</option>
                      <option value="accountant">Accountant (Ledgers)</option>
                      <option value="viewer">Viewer (Read-only)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Firebase User ID (Optional)</label>
                    <input 
                      type="text" 
                      value={inviteUserId} 
                      onChange={(e) => setInviteUserId(e.target.value)} 
                      className={styles.input} 
                      placeholder="Leave blank to auto-generate"
                    />
                  </div>
                  <div className={styles.formGroupFull} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <Button type="submit">
                      <Plus size={16} style={{ marginRight: '0.5rem' }} /> {t('company.inviteUser')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Simple matrix guide */}
          <div className={styles.formSection}>
            <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('settings.accessLevelReferenceMatrix')}</h4>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.6' }}>
              <ul>
                <li><strong>Owner:</strong> {t('settings.completeManagementCanEditRolesAndSettingsManageBilling')}</li>
                <li><strong>Admin:</strong> {t('settings.completeOperationalAccessCanInviteUsersAndManageSettings')}</li>
                <li><strong>Manager:</strong> General view + edit capabilities, branch control. No administrative overrides.</li>
                <li><strong>Designer / Sales / Accountant:</strong> Workflow-restricted scopes (e.g. Sales cannot edit ledgers; Accountants cannot modify recipes).</li>
                <li><strong>Viewer:</strong> Read-only lookup across standard screens.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. BRANCHES TAB PANEL                      */}
      {/* ========================================== */}
      {activeTab === 'branches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>{t('company.branchesTitle')}</div>
              <Button type="button" variant="outline" onClick={loadBranches} size="sm">
                <RefreshCw size={14} style={{ marginRight: '0.25rem' }} /> Refresh
              </Button>
            </div>

            {branchesLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {t('common.loading')}
              </div>
            ) : branches.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No branches configured. Create one below.
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Phone</th>
                    <th>Timezone</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{branch.branchCode}</td>
                      <td style={{ fontWeight: 600 }}>{branch.displayName}</td>
                      <td>{[branch.city, branch.state].filter(Boolean).join(', ') || 'N/A'}</td>
                      <td>{branch.phone || 'N/A'}</td>
                      <td><span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{branch.timezone}</span></td>
                      <td>
                        <span className={`${styles.badge} ${
                          branch.status === 'active' ? styles.badgeActive : styles.badgeDisabled
                        }`}>
                          {branch.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button 
                            type="button" 
                            onClick={() => setEditingBranch(branch)}
                            className={styles.roleSelect}
                            style={{ cursor: 'pointer' }}
                            disabled={!can('branch.manage')}
                          >
                            <Edit size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Edit
                          </button>
                          <button 
                            type="button" 
                            onClick={() => branch.id && handleDeleteBranch(branch.id)}
                            className={styles.roleSelect}
                            style={{ color: '#DC2626', borderColor: '#FCA5A5', cursor: 'pointer' }}
                            disabled={!can('branch.manage')}
                          >
                            <Trash2 size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add Branch Form */}
          {can('branch.manage') && (
            <Card>
              <CardHeader>
                <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{t('settings.createNewBranch')}</div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddBranch} className={styles.grid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Branch Code *</label>
                    <input 
                      type="text" 
                      value={brCode} 
                      onChange={(e) => setBrCode(e.target.value)} 
                      className={styles.input} 
                      placeholder="e.g. NYC, MIA, LAX"
                      maxLength={10}
                      required 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Display Name *</label>
                    <input 
                      type="text" 
                      value={brDisplayName} 
                      onChange={(e) => setBrDisplayName(e.target.value)} 
                      className={styles.input} 
                      required 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.phoneNumber')}</label>
                    <input 
                      type="text" 
                      value={brPhone} 
                      onChange={(e) => setBrPhone(e.target.value)} 
                      className={styles.input} 
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('login.emailLabel')}</label>
                    <input 
                      type="email" 
                      value={brEmail} 
                      onChange={(e) => setBrEmail(e.target.value)} 
                      className={styles.input} 
                    />
                  </div>

                  <div className={styles.formGroupFull}>
                    <h4 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 600 }}>{t('settings.branchLocationDetails')}</h4>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.streetAddress')}</label>
                    <input type="text" value={brAddress} onChange={(e) => setBrAddress(e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>City</label>
                    <input type="text" value={brCity} onChange={(e) => setBrCity(e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>State / Region</label>
                    <input type="text" value={brState} onChange={(e) => setBrState(e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>{t('settings.postalCode')}</label>
                    <input type="text" value={brPostalCode} onChange={(e) => setBrPostalCode(e.target.value)} className={styles.input} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Timezone</label>
                    <select value={brTimezone} onChange={(e) => setBrTimezone(e.target.value)} className={styles.select}>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Status</label>
                    <select value={brStatus} onChange={(e: any) => setBrStatus(e.target.value)} className={styles.select}>
                      <option value="active">Active (Trading)</option>
                      <option value="inactive">Inactive (Suspended)</option>
                    </select>
                  </div>

                  <div className={styles.formGroupFull} style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <Button type="submit">
                      <Plus size={16} style={{ marginRight: '0.5rem' }} /> Register Branch
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Edit Branch Modal */}
          {editingBranch && (
            <Modal isOpen={true} onClose={() => setEditingBranch(null)} title={`Edit Branch - ${editingBranch.branchCode}`}>
              <form onSubmit={handleSaveEditBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Branch Code *</label>
                  <input 
                    type="text" 
                    value={editingBranch.branchCode} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, branchCode: e.target.value })} 
                    className={styles.input} 
                    disabled 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Display Name *</label>
                  <input 
                    type="text" 
                    value={editingBranch.displayName} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, displayName: e.target.value })} 
                    className={styles.input} 
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.phoneNumber')}</label>
                  <input 
                    type="text" 
                    value={editingBranch.phone || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('login.emailLabel')}</label>
                  <input 
                    type="email" 
                    value={editingBranch.email || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, email: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.streetAddress')}</label>
                  <input 
                    type="text" 
                    value={editingBranch.address || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>City</label>
                  <input 
                    type="text" 
                    value={editingBranch.city || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, city: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>State</label>
                  <input 
                    type="text" 
                    value={editingBranch.state || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, state: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{t('settings.postalCode')}</label>
                  <input 
                    type="text" 
                    value={editingBranch.postalCode || ''} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, postalCode: e.target.value })} 
                    className={styles.input} 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Timezone</label>
                  <select 
                    value={editingBranch.timezone || 'America/New_York'} 
                    onChange={(e) => setEditingBranch({ ...editingBranch, timezone: e.target.value })} 
                    className={styles.select}
                  >
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Status</label>
                  <select 
                    value={editingBranch.status} 
                    onChange={(e: any) => setEditingBranch({ ...editingBranch, status: e.target.value })} 
                    className={styles.select}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <Button type="button" variant="outline" onClick={() => setEditingBranch(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit">
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};
