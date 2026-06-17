import type { ReconciliationException, ReconciliationAdjustment, AdjustmentJournalLine } from './reconciliationTypes';

export interface AiRunInsightResult {
  summary: string;
  aiRiskScore: number;
}

export function generateAiRunInsights(
  exceptions: ReconciliationException[],
  healthScore: number
): AiRunInsightResult {
  const exceptionCount = exceptions.length;
  const criticalCount = exceptions.filter(e => e.severity === 'critical').length;
  const blockingCount = exceptions.filter(e => e.severity === 'blocking').length;

  let summary = '';
  let aiRiskScore = 100 - healthScore; // simple mapping
  aiRiskScore = Math.max(0, Math.min(100, aiRiskScore));

  if (exceptionCount === 0) {
    summary = "The reconciliation run completed successfully. All subledger balances are fully aligned with the General Ledger control accounts, and all posted journal entries are balanced. No compliance risks were identified.";
  } else {
    summary = `The reconciliation identified ${exceptionCount} exception(s) (${blockingCount} blocking, ${criticalCount} critical). `;
    
    // Add context based on what modules failed
    const modules = Array.from(new Set(exceptions.map(e => e.module)));
    
    summary += `Issues were detected in the following modules: ${modules.map(m => m.toUpperCase()).join(', ')}. `;
    
    const largestVariance = exceptions.reduce((max, e) => {
      return (e.varianceAmount || 0) > (max.varianceAmount || 0) ? e : max;
    }, exceptions[0]);

    if (largestVariance && (largestVariance.varianceAmount || 0) > 0) {
      summary += `The largest discrepancy is a $${largestVariance.varianceAmount?.toFixed(2)} variance in the ${largestVariance.module.toUpperCase()} module ("${largestVariance.title}"). `;
      summary += `Recommended action: Review the source transactions and apply the suggested offset adjustments.`;
    } else {
      summary += `Please review the exception lists and apply necessary corrections.`;
    }
  }

  return {
    summary,
    aiRiskScore
  };
}

export interface AiExceptionExplanation {
  aiExplanation: string;
  aiSuggestedFix: string;
  likelyCause: string;
  recommendedAction: string;
  proposedLines?: AdjustmentJournalLine[];
}

export function generateExceptionSuggestedFix(
  e: ReconciliationException
): AiExceptionExplanation {
  let aiExplanation = '';
  let aiSuggestedFix = '';
  let likelyCause = '';
  let recommendedAction = '';
  let proposedLines: AdjustmentJournalLine[] = [];

  const variance = e.varianceAmount || 0;

  switch (e.module) {
    case 'gl':
      if (e.title.includes('Unbalanced')) {
        likelyCause = "A manual journal entry or system webhook posted with unequal debits and credits.";
        recommendedAction = "Review the journal lines, identify the mismatch, and apply a balanced offset.";
        aiExplanation = "Possible root cause: The journal was recorded with unbalanced debit/credit lines, possibly due to a manual typing error or browser transaction disruption.";
        aiSuggestedFix = "Suggested adjustment: Review the original source document and adjust the debit/credit lines until they balance to zero.";
      } else if (e.title.includes('Closed Period')) {
        likelyCause = "A transaction was back-dated into a previous month that has already been locked.";
        recommendedAction = "Move the transaction posting date to the current open period.";
        aiExplanation = "Possible root cause: An order or restock receipt was recorded using a posting date earlier than the closed period locking threshold.";
        aiSuggestedFix = "Suggested adjustment: Move the transaction's accounting date forward to the first day of the currently open period.";
      } else {
        likelyCause = "Orphan journal lines or use of invalid account codes.";
        recommendedAction = "Re-map the lines to active accounts in the Chart of Accounts.";
        aiExplanation = "Possible root cause: The transaction references accounts that have been deactivated or are missing from the Chart of Accounts setup.";
        aiSuggestedFix = "Suggested adjustment: Re-map the journal line accounts to active codes.";
      }
      break;

    case 'ar':
      likelyCause = "Customer payments applied to invoices in the AR subledger without posting corresponding Cash/AR journals, or vice versa.";
      recommendedAction = "Reconcile payment records for the period and post an offset entry to GL Accounts Receivable.";
      aiExplanation = "Possible root cause: The AR subledger shows a difference from the general ledger control account (code 1200). This occurs when payment allocations are saved but the journal ledger posting fails to post.";
      aiSuggestedFix = "Suggested adjustment: Post a manual correcting journal. If the subledger is higher, debit Cash (1010) and credit Accounts Receivable (1200) for the variance.";
      
      if (variance > 0) {
        proposedLines = [
          { accountId: '1010', accountCode: '1010', accountName: 'Cash', debit: variance, credit: 0, memo: 'Correct AR subledger variance' },
          { accountId: '1200', accountCode: '1200', accountName: 'Accounts Receivable', debit: 0, credit: variance, memo: 'Correct AR subledger variance' }
        ];
      }
      break;

    case 'ap':
      likelyCause = "Vendor bills received but not recorded in AP, or inventory receipts recorded without matching vendor accruals.";
      recommendedAction = "Verify received items against vendor bills and accrue unbilled receipts.";
      aiExplanation = "Possible root cause: The Accounts Payable control account (code 2000) does not match the vendor subledger. This typically occurs when vendor bills or bills matching inventory receipts are left unposted.";
      aiSuggestedFix = "Suggested adjustment: Accrue unbilled receipts or post outstanding vendor bills to align the AP control account.";

      if (variance > 0) {
        proposedLines = [
          { accountId: '2000', accountCode: '2000', accountName: 'Accounts Payable', debit: variance, credit: 0, memo: 'Correct AP subledger variance' },
          { accountId: '2050', accountCode: '2050', accountName: 'Accrued Purchases / GRNI', debit: 0, credit: variance, memo: 'Correct AP subledger variance' }
        ];
      }
      break;

    case 'inventory':
      likelyCause = "Inventory stock adjustments recorded without ledger postings, or negative stock quantities.";
      recommendedAction = "Perform a physical count, write off inventory variance, and post adjustments.";
      aiExplanation = "Possible root cause: The inventory stock ledger asset value does not match the Inventory control account (code 1300). This occurs when stock quantities are updated manually in the catalog without posting the cost adjustments to the GL.";
      aiSuggestedFix = "Suggested adjustment: Post a correcting journal debiting Spoilage & Shrinkage Expense (5500) and crediting Inventory (1300) to match subledger cost.";

      if (variance > 0) {
        proposedLines = [
          { accountId: '5500', accountCode: '5500', accountName: 'Spoilage & Shrinkage Expense', debit: variance, credit: 0, memo: 'Correct Inventory valuation variance' },
          { accountId: '1300', accountCode: '1300', accountName: 'Inventory', debit: 0, credit: variance, memo: 'Correct Inventory valuation variance' }
        ];
      }
      break;

    case 'cogs':
      likelyCause = "Deliveries completed without invoking COGS calculation webhooks.";
      recommendedAction = "Approve and post the suggested COGS adjustment entry for this order.";
      aiExplanation = "Possible root cause: The order was successfully delivered to the customer, but the Cost of Goods Sold journal entry was not created.";
      aiSuggestedFix = "Suggested adjustment: Approve the drafted adjustment to record COGS for this order, debiting Cost of Goods Sold and crediting Inventory.";
      
      const cogsEst = e.varianceAmount || 15.00; // fallback default
      proposedLines = [
        { accountId: '5100', accountCode: '5100', accountName: 'Cost of Goods Sold', debit: cogsEst, credit: 0, memo: `Record COGS for Order #${e.sourceDocumentId?.substring(0, 8).toUpperCase()}` },
        { accountId: '1300', accountCode: '1300', accountName: 'Inventory', debit: 0, credit: cogsEst, memo: `Record COGS for Order #${e.sourceDocumentId?.substring(0, 8).toUpperCase()}` }
      ];
      break;

    case 'payments':
      likelyCause = "Customer payments marked as posted in checkout but missing Cash/AR journal entries.";
      recommendedAction = "Audit payment logs and post the corresponding cash receipt entries.";
      aiExplanation = "Possible root cause: The payment subledger has a difference from the general ledger cash receipts. This occurs when customer credit card settlements are processed but the cash ledger remains unposted.";
      aiSuggestedFix = "Suggested adjustment: Post a correcting journal debiting Cash (1010) and crediting Accounts Receivable (1200).";
      
      if (variance > 0) {
        proposedLines = [
          { accountId: '1010', accountCode: '1010', accountName: 'Cash', debit: variance, credit: 0, memo: 'Record unposted customer payments' },
          { accountId: '1200', accountCode: '1200', accountName: 'Accounts Receivable', debit: 0, credit: variance, memo: 'Record unposted customer payments' }
        ];
      }
      break;

    case 'sales_tax':
      likelyCause = "Order sales tax calculations differ from the net movement in the Sales Tax Payable liability account.";
      recommendedAction = "Audit order tax logs and post adjusting entry to Sales Tax Payable.";
      aiExplanation = "Possible root cause: The sales tax collected from customer orders does not align with the Net Sales Tax Payable liability balance (code 2100). This occurs when refunds are processed without reversing tax liability.";
      aiSuggestedFix = "Suggested adjustment: Post an adjusting entry debiting Sales Tax Payable (2100) and crediting Sales Revenue (4000) for the variance.";

      if (variance > 0) {
        proposedLines = [
          { accountId: '2100', accountCode: '2100', accountName: 'Sales Tax Payable', debit: variance, credit: 0, memo: 'Adjust sales tax payable variance' },
          { accountId: '4000', accountCode: '4000', accountName: 'Sales Revenue', debit: 0, credit: variance, memo: 'Adjust sales tax payable variance' }
        ];
      }
      break;

    case 'irs_tax_readiness':
      likelyCause = "Vendor W-9 tax IDs are missing for accounts exceeding reporting thresholds.";
      recommendedAction = "Contact the vendor, request their Form W-9, and update their Tax ID profile.";
      aiExplanation = "Possible root cause: Vendor was paid an amount exceeding the IRS threshold for this tax year, but has no Federal Tax ID or W-9 recorded.";
      aiSuggestedFix = "Suggested adjustment: No ledger posting required. Update vendor tax profile upon receipt of Form W-9.";
      break;

    default:
      likelyCause = "Miscellaneous transactional mismatch.";
      recommendedAction = "Review matching ledger source documents.";
      aiExplanation = "Possible root cause: Mismatch between subledger balances and GL control accounts.";
      aiSuggestedFix = "Suggested adjustment: Post a manual journal entry to align the ledger.";
      break;
  }

  return {
    aiExplanation,
    aiSuggestedFix,
    likelyCause,
    recommendedAction,
    proposedLines
  };
}

export async function draftExceptionAdjustment(
  companyId: string,
  runId: string,
  exception: ReconciliationException,
  createdBy: string
): Promise<ReconciliationAdjustment | null> {
  const { proposedLines, aiSuggestedFix } = generateExceptionSuggestedFix(exception);
  if (!proposedLines || proposedLines.length === 0) return null;

  const adj: ReconciliationAdjustment = {
    companyId,
    reconciliationRunId: runId,
    exceptionId: exception.id || '',
    adjustmentType: exception.module === 'cogs' ? 'reversal' : 'journal_entry',
    status: 'draft',
    riskLevel: exception.severity === 'blocking' ? 'critical' : (exception.severity === 'critical' ? 'high' : 'medium'),
    sourceExceptionIds: [exception.id || ''],
    reason: aiSuggestedFix,
    aiGenerated: true,
    proposedJournalLines: proposedLines,
    createdBy,
    createdAt: new Date().toISOString()
  };

  return adj;
}
