export type ReconciliationRunType = 'daily' | 'weekly' | 'month_end' | 'year_end' | 'manual' | 'tax_readiness' | 'historical_baseline';

export type ReconciliationRunStatus = 'draft' | 'running' | 'completed' | 'failed' | 'locked' | 'superseded';

export interface ReconciliationSummarySnapshot {
  glDebits: number;
  glCredits: number;
  arSubledgerTotal: number;
  apSubledgerTotal: number;
  inventoryValuation: number;
  cashReceiptsTotal: number;
  salesTaxCollected: number;
  exceptionCount: number;
  blockingExceptionCount: number;
  healthScore: number;
}

export interface ReconciliationRun {
  id?: string;
  companyId: string;
  runNumber: string;
  runType: ReconciliationRunType;
  periodStart: string; // ISO Date YYYY-MM-DD
  periodEnd: string;   // ISO Date YYYY-MM-DD
  status: ReconciliationRunStatus;
  
  totalChecks: number;
  passedChecks: number;
  warningCount: number;
  criticalCount: number;
  blockingCount: number;

  glBalanced: boolean;
  arReconciled: boolean;
  apReconciled: boolean;
  inventoryReconciled: boolean;
  cashReconciled: boolean;
  taxReady: boolean;

  summary: ReconciliationSummarySnapshot;

  aiSummary?: string;
  aiRiskScore?: number; // 0 to 100

  createdBy: string;
  approvedBy?: string;
  createdAt: any; // Firebase Timestamp or string
  completedAt?: any;
  approvedAt?: any;
}

export type ExceptionModule = 
  | 'gl' 
  | 'ar' 
  | 'ap' 
  | 'inventory' 
  | 'cogs' 
  | 'cash' 
  | 'payments' 
  | 'sales_tax' 
  | 'irs_tax_readiness' 
  | 'delivery' 
  | 'multi_company';

export type ReconciliationSeverity = 'info' | 'warning' | 'critical' | 'blocking';

export type ExceptionStatus = 'open' | 'in_review' | 'resolved' | 'ignored' | 'approved_adjustment';

export interface ReconciliationException {
  id?: string;
  companyId: string;
  reconciliationRunId: string;

  module: ExceptionModule;
  severity: ReconciliationSeverity;

  title: string;
  description: string;

  expectedAmount?: number;
  actualAmount?: number;
  varianceAmount?: number;

  sourceCollection?: string;
  sourceDocumentId?: string;
  relatedDocumentIds?: string[];

  likelyCause?: string;
  recommendedAction?: string;

  aiExplanation?: string;
  aiSuggestedFix?: string;

  status: ExceptionStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: any;

  createdAt: any;
}

export type AdjustmentType = 
  | 'journal_entry' 
  | 'customer_adjustment' 
  | 'vendor_adjustment' 
  | 'inventory_adjustment' 
  | 'tax_adjustment' 
  | 'write_off' 
  | 'reversal';

export type AdjustmentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'posted';

export interface AdjustmentJournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
}

export interface ReconciliationAdjustment {
  id?: string;
  companyId: string;
  reconciliationRunId: string;
  exceptionId: string;

  adjustmentType: AdjustmentType;
  status: AdjustmentStatus;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sourceExceptionIds: string[];

  reason: string;
  aiGenerated: boolean;

  proposedJournalLines?: AdjustmentJournalLine[];

  createdBy: string;
  approvedBy?: string;
  postedJournalId?: string;
  approvalNotes?: string;

  createdAt: any;
  approvedAt?: any;
  postedAt?: any;
}

export type TaxReadinessStatus = 'draft' | 'in_review' | 'ready_for_accountant' | 'missing_information' | 'closed';

export interface TaxReadinessReview {
  id?: string;
  companyId: string;

  taxYear: number;
  status: TaxReadinessStatus;

  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;

  salesTaxCollected: number;
  salesTaxPayableBalance: number;
  salesTaxVariance: number;

  vendor1099ReviewCount: number;
  vendorsMissingTaxInfoCount: number;

  missingDocuments: string[];
  riskFlags: string[];

  aiSummary: string;
  accountantNotes?: string;

  createdAt: any;
  updatedAt: any;
}
