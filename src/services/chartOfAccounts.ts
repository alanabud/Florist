export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface AccountDefinition {
  // Identity
  id?: string;
  code: string;
  name: string;
  alias?: string;
  type: AccountType;
  subtype?: string;
  parentAccount?: string;
  description?: string;
  active: boolean;
  isPostingAccount?: boolean;

  // Accounting Rules
  normalBalance: NormalBalance;
  allowManualJournals?: boolean;
  allowSystemPostings?: boolean;
  includeInTrialBalance?: boolean;
  includeInIncomeStatement?: boolean;
  includeInBalanceSheet?: boolean;
  taxRelated?: boolean;
  cashAccount?: boolean;
  controlAccount?: boolean;

  // Reporting Mapping
  statementType?: string;
  statementSection?: string;
  reportLineGroup?: string;
  reportingSection?: string;
  displayOrder?: number;
  cashFlowCategory?: string;
  kpiMapping?: string;
  statementGrouping?: string;
  includeInProfitLoss?: boolean;
  includeInCashFlow?: boolean;

  // Posting Rules
  allowManualPosting?: boolean;
  allowSystemPosting?: boolean;
  isCashAccount?: boolean;
  isControlAccount?: boolean;
  requiresCustomer?: boolean;
  requiresVendor?: boolean;
  requiresOrder?: boolean;
  requiresLocation?: boolean;

  // Tax & Compliance
  taxCategory?: string;
  salesTaxRelevant?: boolean;
  salesTaxPayable?: boolean;
  salesTaxReceivable?: boolean;
  taxLineCode?: string;
  deductibleExpense?: boolean;
  form1099Eligible?: boolean;

  // System & Protection
  isSystem?: boolean;
  isProtected?: boolean;
  protectedReason?: string;
  usedByWorkflows?: string[];

  // Audit
  createdBy?: string;
  createdAt?: any;
  lastModifiedBy?: string;
  lastModifiedAt?: any;
  updatedBy?: string;
  updatedAt?: any;
  journalUsageCount?: number;
}

// Default accounting subtypes per type
export const ACCOUNT_SUBTYPES: Record<AccountType, string[]> = {
  asset: ['Cash', 'Accounts Receivable', 'Inventory', 'Prepaid Expenses', 'Fixed Assets', 'Other Current Asset'],
  liability: ['Accounts Payable', 'Sales Tax Payable', 'Accrued Liabilities', 'Notes Payable', 'Other Current Liability'],
  equity: ['Retained Earnings', "Owner's Capital", "Owner's Draw", 'Common Stock'],
  revenue: ['Sales Revenue', 'Delivery Revenue', 'Service Revenue', 'Other Income'],
  expense: ['Cost of Goods Sold', 'Operating Expense', 'Payroll', 'Rent', 'Utilities', 'Depreciation', 'Other Expense'],
};

// Valid normal balance rules: assets/expenses are debit-normal, liabilities/equity/revenue are credit-normal
export function getExpectedNormalBalance(type: AccountType): NormalBalance {
  return (type === 'asset' || type === 'expense') ? 'debit' : 'credit';
}

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  {
    code: '1010',
    name: 'Cash',
    type: 'asset',
    subtype: 'Cash',
    normalBalance: 'debit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: true,
    isControlAccount: false,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInIncomeStatement: false,
    cashAccount: true,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Current Assets',
    displayOrder: 100,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Assets',
    description: 'Cash in bank and drawer, checking accounts, and cash collections.'
  },
  {
    code: '1200',
    name: 'Accounts Receivable',
    type: 'asset',
    subtype: 'Accounts Receivable',
    normalBalance: 'debit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: true,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInIncomeStatement: false,
    cashAccount: false,
    controlAccount: true,
    taxRelated: false,
    reportingSection: 'Current Assets',
    displayOrder: 200,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Assets',
    description: 'Uncollected balances due from customers and commercial accounts.'
  },
  {
    code: '1300',
    name: 'Inventory',
    type: 'asset',
    subtype: 'Inventory',
    normalBalance: 'debit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: true,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: true,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInIncomeStatement: false,
    cashAccount: false,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Current Assets',
    displayOrder: 300,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Assets',
    description: 'Value of raw materials, flowers, stems, and supplies on hand.'
  },
  {
    code: '2100',
    name: 'Sales Tax Payable',
    type: 'liability',
    subtype: 'Sales Tax Payable',
    normalBalance: 'credit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInIncomeStatement: false,
    cashAccount: false,
    controlAccount: false,
    taxRelated: true,
    reportingSection: 'Current Liabilities',
    displayOrder: 400,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Liabilities',
    description: 'Sales taxes collected from customers and owed to state/local authorities.'
  },
  {
    code: '3000',
    name: 'Retained Earnings',
    type: 'equity',
    subtype: 'Retained Earnings',
    normalBalance: 'credit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: true,
    includeInIncomeStatement: false,
    cashAccount: false,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Owner Equity',
    displayOrder: 500,
    cashFlowCategory: 'Financing',
    statementGrouping: 'Equity',
    description: 'Cumulative net earnings of the business retained for operations.'
  },
  {
    code: '4000',
    name: 'Sales Revenue',
    type: 'revenue',
    subtype: 'Sales Revenue',
    normalBalance: 'credit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: false,
    includeInIncomeStatement: true,
    cashAccount: false,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Operating Revenues',
    displayOrder: 600,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Revenue',
    description: 'Gross revenues from selling flower bouquets, custom designs, and retail goods.'
  },
  {
    code: '4100',
    name: 'Delivery Revenue',
    type: 'revenue',
    subtype: 'Delivery Revenue',
    normalBalance: 'credit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: false,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: false,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: false,
    includeInIncomeStatement: true,
    cashAccount: false,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Operating Revenues',
    displayOrder: 700,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Revenue',
    description: 'Revenues collected from customers for courier dispatch fees.'
  },
  {
    code: '5000',
    name: 'Expense',
    type: 'expense',
    subtype: 'Operating Expense',
    normalBalance: 'debit',
    active: true,
    isSystem: true,
    isPostingAccount: true,
    allowManualPosting: true,
    allowSystemPosting: true,
    isCashAccount: false,
    isControlAccount: false,
    allowManualJournals: true,
    allowSystemPostings: true,
    includeInTrialBalance: true,
    includeInBalanceSheet: false,
    includeInIncomeStatement: true,
    cashAccount: false,
    controlAccount: false,
    taxRelated: false,
    reportingSection: 'Operating Expenses',
    displayOrder: 800,
    cashFlowCategory: 'Operating',
    statementGrouping: 'Expense',
    description: 'Operating expenses, material costs, vendor payments, and waste.'
  }
];

