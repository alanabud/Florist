import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useFinanceStore } from '../../../store/financeStore';
import { useToastStore } from '../../../store/toastStore';
import { useAdminStore } from '../../../store/adminStore';
import { validateGLAccount } from '../../../services/chartOfAccountsService';
import { type AccountType, type NormalBalance } from '../../../services/chartOfAccounts';

interface AccountMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMaintenanceForm: React.FC<AccountMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { chartOfAccounts, addAccount, updateAccount, journalEntries } = useFinanceStore();
  const { modalPayload } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';

  // Helper to match journal line with ID-first priority
  const isLineMatch = (line: any, accountName: string, accountId: string) => {
    if (line.accountId && accountId && line.accountId === accountId) return true;
    if (line.accountName && line.accountName === accountName) return true;
    return line.account === accountName;
  };

  // Derived Calculations
  const getAccountBalance = (accountName: string, accountId: string, normalBalance: string) => {
    let debit = 0;
    let credit = 0;
    (journalEntries || []).forEach(entry => {
      (entry.lines || []).forEach(line => {
        if (isLineMatch(line, accountName, accountId)) {
          debit += line.debit || 0;
          credit += line.credit || 0;
        }
      });
    });
    const norm = (normalBalance || '').toLowerCase();
    return norm === 'debit' ? (debit - credit) : (credit - debit);
  };

  const getTransactionCount = (accountName: string, accountId: string) => {
    let count = 0;
    (journalEntries || []).forEach(entry => {
      (entry.lines || []).forEach(line => {
        if (isLineMatch(line, accountName, accountId)) {
          count++;
        }
      });
    });
    return count;
  };

  const balance = modalPayload?.name ? getAccountBalance(modalPayload.name, modalPayload.id || '', modalPayload.normalBalance) : 0;
  const transCount = modalPayload?.name ? getTransactionCount(modalPayload.name, modalPayload.id || '') : 0;

  const initialValues = modalPayload?.id ? {
    code: modalPayload.code || '',
    name: modalPayload.name || '',
    alias: modalPayload.alias || '',
    type: modalPayload.type || 'asset',
    normalBalance: modalPayload.normalBalance || 'debit',
    active: modalPayload.active !== false,
    subtype: modalPayload.subtype || '',
    description: modalPayload.description || '',
    isSystem: modalPayload.isSystem === true,

    // Reporting Mapping
    parentAccount: modalPayload.parentAccount || '',
    isPostingAccount: modalPayload.isPostingAccount !== false,
    displayOrder: modalPayload.displayOrder !== undefined ? modalPayload.displayOrder : 100,
    statementType: modalPayload.statementType || (modalPayload.type === 'asset' || modalPayload.type === 'liability' || modalPayload.type === 'equity' ? 'balance_sheet' : 'profit_loss'),
    statementSection: modalPayload.statementSection || modalPayload.reportingSection || '',
    reportLineGroup: modalPayload.reportLineGroup || '',
    cashFlowCategory: modalPayload.cashFlowCategory || 'None',
    includeInTrialBalance: modalPayload.includeInTrialBalance !== false,
    includeInBalanceSheet: modalPayload.includeInBalanceSheet !== false,
    includeInProfitLoss: modalPayload.includeInProfitLoss !== (modalPayload.includeInIncomeStatement === false),
    includeInCashFlow: modalPayload.includeInCashFlow !== false,

    // Posting Rules
    allowManualPosting: modalPayload.allowManualPosting !== (modalPayload.allowManualJournals === false),
    allowSystemPosting: modalPayload.allowSystemPosting !== (modalPayload.allowSystemPostings === false),
    isCashAccount: modalPayload.isCashAccount !== (modalPayload.cashAccount === false),
    isControlAccount: modalPayload.isControlAccount !== (modalPayload.controlAccount === false),
    requiresCustomer: modalPayload.requiresCustomer === true,
    requiresVendor: modalPayload.requiresVendor === true,
    requiresOrder: modalPayload.requiresOrder === true,
    requiresLocation: modalPayload.requiresLocation === true,

    // Tax & Compliance
    taxCategory: modalPayload.taxCategory || '',
    salesTaxRelevant: modalPayload.salesTaxRelevant !== (modalPayload.taxRelated === false),
    salesTaxPayable: modalPayload.salesTaxPayable === true,
    salesTaxReceivable: modalPayload.salesTaxReceivable === true,
    taxLineCode: modalPayload.taxLineCode || '',
    deductibleExpense: modalPayload.deductibleExpense === true,
    form1099Eligible: modalPayload.form1099Eligible === true,

    // System Protection
    isSystemText: modalPayload.isSystem === true ? 'Yes (Core System Account)' : 'No (Custom User Account)',
    isProtectedText: modalPayload.isSystem === true ? 'Yes (Critical Account Structure is Locked)' : 'No',
    protectedReason: modalPayload.protectedReason || (modalPayload.isSystem ? 'Required for core checkout and posting flows' : 'N/A'),
    usedByWorkflowText: modalPayload.isSystem === true ? (modalPayload.usedByWorkflows || ['General Ledger Postings', 'Checkout Automation']).join(', ') : 'None',

    // Audit & Usage
    currentBalance: `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    journalUsageCount: transCount,
    createdBy: modalPayload.createdBy || 'System',
    createdAt: modalPayload.createdAt ? (modalPayload.createdAt.seconds ? new Date(modalPayload.createdAt.seconds * 1000).toLocaleString() : new Date(modalPayload.createdAt).toLocaleString()) : 'Seeded',
    lastModifiedBy: modalPayload.lastModifiedBy || 'System',
    lastModifiedAt: modalPayload.lastModifiedAt ? (modalPayload.lastModifiedAt.seconds ? new Date(modalPayload.lastModifiedAt.seconds * 1000).toLocaleString() : new Date(modalPayload.lastModifiedAt).toLocaleString()) : 'Seeded',
  } : {
    code: '',
    name: '',
    alias: '',
    type: 'asset',
    normalBalance: 'debit',
    active: true,
    subtype: '',
    description: '',
    isSystem: false,

    parentAccount: '',
    isPostingAccount: true,
    displayOrder: 100,
    statementType: 'balance_sheet',
    statementSection: '',
    reportLineGroup: '',
    cashFlowCategory: 'None',
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInProfitLoss: false,
    includeInCashFlow: false,

    allowManualPosting: true,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    requiresCustomer: false,
    requiresVendor: false,
    requiresOrder: false,
    requiresLocation: false,

    taxCategory: '',
    salesTaxRelevant: false,
    salesTaxPayable: false,
    salesTaxReceivable: false,
    taxLineCode: '',
    deductibleExpense: false,
    form1099Eligible: false,

    isSystemText: 'No (Custom User Account)',
    isProtectedText: 'No',
    protectedReason: 'N/A',
    usedByWorkflowText: 'None',

    currentBalance: '$0.00',
    journalUsageCount: 0,
    createdBy: 'Admin',
    createdAt: new Date().toLocaleString(),
    lastModifiedBy: 'Admin',
    lastModifiedAt: new Date().toLocaleString(),
  };

  const isSystem = initialValues.isSystem === true;

  const handleValidate = (values: Record<string, any>) => {
    return validateGLAccount(values, chartOfAccounts, modalPayload?.id);
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const actor = 'Admin';
      const cleanValues = {
        code: values.code,
        name: values.name,
        alias: values.alias || '',
        type: values.type as AccountType,
        normalBalance: values.normalBalance as NormalBalance,
        active: values.active !== false,
        subtype: values.subtype || '',
        description: values.description || '',

        // Reporting Mapping
        parentAccount: values.parentAccount || '',
        isPostingAccount: values.isPostingAccount !== false,
        displayOrder: Number(values.displayOrder) || 100,
        statementType: values.statementType || '',
        statementSection: values.statementSection || '',
        reportLineGroup: values.reportLineGroup || '',
        cashFlowCategory: values.cashFlowCategory || 'None',
        includeInTrialBalance: values.includeInTrialBalance !== false,
        includeInBalanceSheet: values.includeInBalanceSheet !== false,
        includeInProfitLoss: values.includeInProfitLoss !== false,
        includeInCashFlow: values.includeInCashFlow !== false,

        // Posting Rules
        allowManualPosting: values.allowManualPosting !== false,
        allowSystemPosting: values.allowSystemPosting !== false,
        isCashAccount: values.isCashAccount === true,
        isControlAccount: values.isControlAccount === true,
        requiresCustomer: values.requiresCustomer === true,
        requiresVendor: values.requiresVendor === true,
        requiresOrder: values.requiresOrder === true,
        requiresLocation: values.requiresLocation === true,

        // Tax & Compliance
        taxCategory: values.taxCategory || '',
        salesTaxRelevant: values.salesTaxRelevant === true,
        salesTaxPayable: values.salesTaxPayable === true,
        salesTaxReceivable: values.salesTaxReceivable === true,
        taxLineCode: values.taxLineCode || '',
        deductibleExpense: values.deductibleExpense === true,
        form1099Eligible: values.form1099Eligible === true,

        // Mapping to legacy fields for backward compatibility
        reportingSection: values.statementSection || '',
        statementGrouping: values.statementType === 'balance_sheet' ? 'Assets' : 'Revenue',
        allowManualJournals: values.allowManualPosting !== false,
        allowSystemPostings: values.allowSystemPosting !== false,
        cashAccount: values.isCashAccount === true,
        controlAccount: values.isControlAccount === true,
        taxRelated: values.salesTaxRelevant === true,
      };

      if (mode === 'create') {
        await addAccount(cleanValues, actor);
        addToast(`GL Account "${cleanValues.name}" created successfully.`, 'success');
      } else {
        await updateAccount(modalPayload!.id, cleanValues, actor);
        addToast(`GL Account "${cleanValues.name}" updated successfully.`, 'success');
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to save account details.', 'error');
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'details',
      label: 'Account Details',
      fields: [
        { name: 'code', label: 'GL Code', type: 'text', required: true, colSpan: 1, readOnly: isSystem, placeholder: 'e.g. 1010' },
        { name: 'name', label: 'Account Name', type: 'text', required: true, colSpan: 2, readOnly: isSystem, placeholder: 'e.g. Cash in Bank' },
        { name: 'alias', label: 'Short Name / Alias', type: 'text', colSpan: 1, placeholder: 'e.g. Cash' },
        {
          name: 'type',
          label: 'Account Type',
          type: 'select',
          required: true,
          colSpan: 1,
          readOnly: isSystem,
          options: [
            { value: 'asset', label: 'Asset' },
            { value: 'liability', label: 'Liability' },
            { value: 'equity', label: 'Equity' },
            { value: 'revenue', label: 'Revenue' },
            { value: 'cogs', label: 'Cost of Goods Sold (COGS)' },
            { value: 'expense', label: 'Expense' },
          ],
        },
        {
          name: 'normalBalance',
          label: 'Normal Balance',
          type: 'select',
          required: true,
          colSpan: 1,
          readOnly: isSystem,
          options: [
            { value: 'debit', label: 'Debit' },
            { value: 'credit', label: 'Credit' },
          ],
        },
        { name: 'subtype', label: 'Subtype', type: 'text', colSpan: 1, readOnly: isSystem, placeholder: 'e.g. Current Assets' },
        {
          name: 'parentAccount',
          label: 'Parent Account',
          type: 'select',
          colSpan: 1,
          options: (chartOfAccounts || []).map(a => ({ value: a.name, label: `${a.code} - ${a.name}` })),
        },
        { name: 'isPostingAccount', label: 'Posting Account', type: 'checkbox', colSpan: 1, readOnly: isSystem },
        { name: 'active', label: 'Active Account', type: 'checkbox', colSpan: 1 },
        { name: 'description', label: 'Account Description', type: 'textarea', colSpan: 3, placeholder: 'Provide detailed context about transactions posted to this account.' },
        {
          name: 'codeGuide',
          label: '',
          type: 'custom',
          colSpan: 3,
          render: () => (
            <div style={{
              background: '#FAF9F5',
              border: '1px solid #E8EAE6',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.75rem',
              color: '#726E64',
              lineHeight: '1.4'
            }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Suggested GL Code Reference Structure:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div><strong>1000–1999:</strong> Assets</div>
                <div><strong>2000–2999:</strong> Liabilities</div>
                <div><strong>3000–3999:</strong> Equity</div>
                <div><strong>4000–4999:</strong> Revenue</div>
                <div><strong>5000–5999:</strong> Cost of Goods Sold</div>
                <div><strong>6000–6999:</strong> Operating Expenses</div>
                <div><strong>7000–7999:</strong> Other Income</div>
                <div><strong>8000–8999:</strong> Other Expenses</div>
              </div>
            </div>
          )
        }
      ],
    },
    {
      id: 'reporting',
      label: 'Reporting Mapping',
      fields: [
        {
          name: 'statementType',
          label: 'Statement Type',
          type: 'select',
          colSpan: 1,
          readOnly: isSystem,
          section: 'Financial Statements Mapping',
          options: [
            { value: 'balance_sheet', label: 'Balance Sheet' },
            { value: 'profit_loss', label: 'Profit & Loss (P&L)' },
            { value: 'cash_flow', label: 'Cash Flow' },
          ]
        },
        {
          name: 'statementSection',
          label: 'Statement Section',
          type: 'select',
          colSpan: 1,
          readOnly: isSystem,
          section: 'Financial Statements Mapping',
          options: [
            { value: 'Current Assets', label: 'Current Assets' },
            { value: 'Fixed Assets', label: 'Fixed Assets' },
            { value: 'Current Liabilities', label: 'Current Liabilities' },
            { value: 'Long-Term Liabilities', label: 'Long-Term Liabilities' },
            { value: 'Owner Equity', label: 'Owner Equity' },
            { value: 'Operating Revenues', label: 'Operating Revenues' },
            { value: 'Operating Expenses', label: 'Operating Expenses' },
            { value: 'Cost of Goods Sold', label: 'Cost of Goods Sold' },
            { value: 'Other Income/Expense', label: 'Other Income/Expense' },
          ]
        },
        { name: 'reportLineGroup', label: 'Report Line Group', type: 'text', colSpan: 1, readOnly: isSystem, section: 'Financial Statements Mapping', placeholder: 'e.g. Sales Revenue' },
        {
          name: 'cashFlowCategory',
          label: 'Cash Flow Category',
          type: 'select',
          colSpan: 1,
          readOnly: isSystem,
          section: 'Financial Statements Mapping',
          options: [
            { value: 'Operating', label: 'Operating Activity' },
            { value: 'Investing', label: 'Investing Activity' },
            { value: 'Financing', label: 'Financing Activity' },
            { value: 'None', label: 'None / Non-Cash' },
          ]
        },
        { name: 'displayOrder', label: 'Display Order / Priority', type: 'number', colSpan: 1, readOnly: isSystem, section: 'Financial Statements Mapping' },
        { name: 'includeInTrialBalance', label: 'Include in Trial Balance', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Statement Inclusions' },
        { name: 'includeInBalanceSheet', label: 'Include in Balance Sheet', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Statement Inclusions' },
        { name: 'includeInProfitLoss', label: 'Include in Profit & Loss (P&L)', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Statement Inclusions' },
        { name: 'includeInCashFlow', label: 'Include in Cash Flow', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Statement Inclusions' },
      ]
    },
    {
      id: 'posting',
      label: 'Posting Rules',
      fields: [
        { name: 'allowManualPosting', label: 'Allow Manual Journal Posting', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Posting Permissions & Controls' },
        { name: 'allowSystemPosting', label: 'Allow Automated System Posting', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Posting Permissions & Controls' },
        { name: 'isCashAccount', label: 'Cash / Bank Account indicator', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Posting Permissions & Controls' },
        { name: 'isControlAccount', label: 'Control Account (e.g. A/R or A/P)', type: 'checkbox', colSpan: 1, readOnly: isSystem, section: 'Posting Permissions & Controls' },
        { name: 'requiresCustomer', label: 'Require Customer Reference', type: 'checkbox', colSpan: 1, section: 'Required Dimension Constraints' },
        { name: 'requiresVendor', label: 'Require Vendor Reference', type: 'checkbox', colSpan: 1, section: 'Required Dimension Constraints' },
        { name: 'requiresOrder', label: 'Require Order Reference', type: 'checkbox', colSpan: 1, section: 'Required Dimension Constraints' },
        { name: 'requiresLocation', label: 'Require Branch / Department Code', type: 'checkbox', colSpan: 1, section: 'Required Dimension Constraints' },
      ]
    },
    {
      id: 'tax',
      label: 'Tax & Compliance',
      fields: [
        {
          name: 'taxCategory',
          label: 'Tax Classification Category',
          type: 'select',
          colSpan: 1,
          section: 'Tax Settings',
          options: [
            { value: 'Taxable Sales', label: 'Taxable Sales' },
            { value: 'Non-taxable Sales', label: 'Non-taxable Sales' },
            { value: 'Sales Tax Payable', label: 'Sales Tax Payable' },
            { value: 'Deductible Operating Expense', label: 'Deductible Expense' },
            { value: 'Non-deductible Expense', label: 'Non-deductible Expense' },
            { value: '1099 Contractor Services', label: '1099 Eligible Payments' },
          ]
        },
        { name: 'salesTaxRelevant', label: 'Sales Tax Relevant Account', type: 'checkbox', colSpan: 1, section: 'Tax Settings' },
        { name: 'salesTaxPayable', label: 'Sales Tax Liability (Payable)', type: 'checkbox', colSpan: 1, section: 'Tax Settings' },
        { name: 'salesTaxReceivable', label: 'Sales Tax Asset (Receivable)', type: 'checkbox', colSpan: 1, section: 'Tax Settings' },
        { name: 'taxLineCode', label: 'Tax Return Line Code (e.g. Form 1120 / Sch C)', type: 'text', colSpan: 1, section: 'Tax Settings', placeholder: 'e.g. Sch C Line 1a' },
        { name: 'deductibleExpense', label: 'Tax-Deductible Expense', type: 'checkbox', colSpan: 1, section: 'Compliance Auditing' },
        { name: 'form1099Eligible', label: '1099 Reporting Eligible Account', type: 'checkbox', colSpan: 1, section: 'Compliance Auditing' },
      ]
    },
    {
      id: 'protection',
      label: 'System Protection',
      fields: [
        { name: 'isSystemText', label: 'System Created Account', type: 'display', colSpan: 1, section: 'System Constraints' },
        { name: 'isProtectedText', label: 'Protected Account Status', type: 'display', colSpan: 1, section: 'System Constraints' },
        { name: 'protectedReason', label: 'Protection Rules Detail', type: 'display', colSpan: 1, section: 'System Constraints' },
        { name: 'usedByWorkflowText', label: 'Workflows Accessing Account', type: 'display', colSpan: 3, section: 'System Constraints' },
      ]
    },
    {
      id: 'audit',
      label: 'Audit & Usage',
      fields: [
        { name: 'currentBalance', label: 'Live General Ledger Balance', type: 'display', colSpan: 1, section: 'Usage Metrics' },
        { name: 'journalUsageCount', label: 'Total Transaction Lines Count', type: 'display', colSpan: 1, section: 'Usage Metrics' },
        { name: 'createdBy', label: 'Created By Actor', type: 'display', colSpan: 1, section: 'Audit Logging' },
        { name: 'createdAt', label: 'Registration Timestamp', type: 'display', colSpan: 1, section: 'Audit Logging' },
        { name: 'lastModifiedBy', label: 'Last Updated By Actor', type: 'display', colSpan: 1, section: 'Audit Logging' },
        { name: 'lastModifiedAt', label: 'Update Timestamp', type: 'display', colSpan: 1, section: 'Audit Logging' },
      ]
    }
  ];

  return (
    <MaintenanceModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title={mode === 'create' ? 'Create General Ledger Account' : `GL Account Console: ${initialValues.name}`}
      subtitle="Define GL accounting code rules, normal balance structures, and statement mapping."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={isSystem ? 'system' : 'custom'}
      statusBadgeClass={isSystem ? 'status-delivered' : 'status-preparing'}
      validate={handleValidate}
    />
  );
};
