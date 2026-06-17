import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { JournalEntry } from '../financeService';
import type { Vendor, VendorPayment, Order } from '../../store/adminStore';
import type { ReconciliationException, TaxReadinessReview } from './reconciliationTypes';

export const TAX_REPORTING_THRESHOLDS: Record<string, Record<number, Record<string, number>>> = {
  US: {
    2025: {
      form1099NEC: 600,
      form1099MISC: 600,
      form1099KAmount: 20000,
      form1099KTransactions: 200,
    },
    2026: {
      form1099NEC: 2000,
      form1099MISC: 2000,
      form1099KAmount: 20000,
      form1099KTransactions: 200,
    },
  },
};

export interface TaxReadinessResult {
  taxReady: boolean;
  salesTaxVariance: number;
  exceptions: ReconciliationException[];
  review?: TaxReadinessReview;
}

export async function runTaxReadinessReview(
  companyId: string,
  taxYear: number,
  runId: string
): Promise<TaxReadinessResult> {
  const exceptions: ReconciliationException[] = [];
  const periodStart = `${taxYear}-01-01`;
  const periodEnd = `${taxYear}-12-31`;

  // 1. Fetch Orders
  const orderQuery = query(collection(db, 'orders'), where('companyId', '==', companyId));
  const orderSnap = await getDocs(orderQuery);
  const orders: Order[] = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));

  // 2. Fetch Vendors & Payments
  const vendorQuery = query(collection(db, 'vendors'), where('companyId', '==', companyId));
  const vendorSnap = await getDocs(vendorQuery);
  const vendors: Vendor[] = vendorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor));

  const vendorPaymentQuery = query(collection(db, 'vendorPayments'), where('companyId', '==', companyId));
  const vendorPaymentSnap = await getDocs(vendorPaymentQuery);
  const vendorPayments: VendorPayment[] = vendorPaymentSnap.docs.map(d => ({ id: d.id, ...d.data() } as VendorPayment));

  // 3. Fetch GL Journal entries for the tax year
  const journalQuery = query(collection(db, 'journalEntries'), where('companyId', '==', companyId));
  const journalSnap = await getDocs(journalQuery);
  const allJournals: JournalEntry[] = journalSnap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));

  const startDate = new Date(periodStart + 'T00:00:00');
  const endDate = new Date(periodEnd + 'T23:59:59');

  const yearJournals = allJournals.filter(j => {
    let dateVal: Date;
    if (j.createdAt) {
      if (typeof j.createdAt === 'string') {
        dateVal = new Date(j.createdAt);
      } else if (j.createdAt && typeof j.createdAt === 'object' && 'toDate' in j.createdAt) {
        dateVal = (j.createdAt as any).toDate();
      } else if ((j.createdAt as any).seconds) {
        dateVal = new Date((j.createdAt as any).seconds * 1000);
      } else {
        dateVal = new Date(j.createdAt as any);
      }
    } else {
      dateVal = new Date();
    }
    return dateVal >= startDate && dateVal <= endDate;
  });

  const yearOrders = orders.filter(o => {
    const oDate = new Date(o.createdAt);
    return oDate >= startDate && oDate <= endDate && o.status !== 'cancelled';
  });

  const yearVendorPayments = vendorPayments.filter(p => {
    const pDate = new Date(p.paymentDate || p.createdAt);
    return pDate >= startDate && pDate <= endDate && p.status === 'posted';
  });

  // A. Reconcile Sales Tax Collected to GL Sales Tax Payable Movement
  const orderSalesTaxCollected = yearOrders.reduce((sum, o) => sum + (o.taxes || 0), 0);
  
  let glSalesTaxPayableMovement = 0;
  for (const j of yearJournals) {
    for (const line of j.lines) {
      if (line.accountId === '2100' || line.account === 'Sales Tax Payable') {
        // Sales Tax Payable is credit-normal liability: credit - debit
        glSalesTaxPayableMovement += (line.credit || 0) - (line.debit || 0);
      }
    }
  }

  const salesTaxVariance = Math.abs(orderSalesTaxCollected - glSalesTaxPayableMovement);
  if (salesTaxVariance > 0.05) {
    exceptions.push({
      companyId,
      reconciliationRunId: runId,
      module: 'sales_tax',
      severity: 'critical',
      title: 'Sales Tax subledger to GL discrepancy',
      description: `Sales tax collected from orders ($${orderSalesTaxCollected.toFixed(2)}) does not match the net movement of the GL Sales Tax Payable Account ($${glSalesTaxPayableMovement.toFixed(2)}) for tax year ${taxYear}. Variance: $${salesTaxVariance.toFixed(2)}.`,
      expectedAmount: orderSalesTaxCollected,
      actualAmount: glSalesTaxPayableMovement,
      varianceAmount: salesTaxVariance,
      status: 'open',
      createdAt: new Date().toISOString()
    });
  }

  // B. 1099 Eligibility & Missing W-9 checks
  const thresholdConfig = TAX_REPORTING_THRESHOLDS.US[taxYear] || TAX_REPORTING_THRESHOLDS.US[2026];
  const necThreshold = thresholdConfig.form1099NEC;

  let vendor1099ReviewCount = 0;
  let vendorsMissingTaxInfoCount = 0;
  const missingDocuments: string[] = [];
  const riskFlags: string[] = [];

  for (const v of vendors) {
    // Sum payments to this vendor in the tax year
    const vPayments = yearVendorPayments.filter(p => p.vendorId === v.id);
    const totalPaid = vPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    if (totalPaid >= necThreshold) {
      vendor1099ReviewCount++;
      
      // Check if W-9 (taxId) is missing
      if (!v.taxId || v.taxId.trim() === '') {
        vendorsMissingTaxInfoCount++;
        missingDocuments.push(`Form W-9 for Vendor: "${v.name}"`);
        exceptions.push({
          companyId,
          reconciliationRunId: runId,
          module: 'irs_tax_readiness',
          severity: 'warning',
          title: `Missing Tax ID for 1099 Vendor: ${v.name}`,
          description: `Vendor "${v.name}" (ID: ${v.id}) was paid $${totalPaid.toFixed(2)} in tax year ${taxYear} (Threshold: $${necThreshold.toFixed(2)}), but has no registered Federal Tax ID / W-9 in their profile.`,
          sourceCollection: 'vendors',
          sourceDocumentId: v.id,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // C. Year-end income statement check
  const totalRevenue = yearOrders.reduce((sum, o) => sum + (o.subtotal || 0) + (o.deliveryFee || 0), 0);
  // Calculate expenses from GL
  let totalExpenses = 0;
  for (const j of yearJournals) {
    for (const line of j.lines) {
      if (line.account === 'Cost of Goods Sold' || line.account === 'Expense' || line.account === 'Supplies Expense' || line.account.includes('Expense')) {
        totalExpenses += (line.debit || 0) - (line.credit || 0);
      }
    }
  }

  const netIncome = totalRevenue - totalExpenses;

  if (vendorsMissingTaxInfoCount > 0) {
    riskFlags.push(`Missing Tax information for ${vendorsMissingTaxInfoCount} active 1099-eligible vendors.`);
  }
  if (salesTaxVariance > 0.05) {
    riskFlags.push(`Sales tax ledger discrepancy of $${salesTaxVariance.toFixed(2)} detected.`);
  }

  const aiSummary = `The tax readiness scan for year ${taxYear} completed. Evaluated $${totalRevenue.toFixed(2)} in total revenue and $${totalExpenses.toFixed(2)} in operational expenses. Identified ${vendor1099ReviewCount} vendors eligible for Form 1099-NEC. Missing W-9 documents were flagged for ${vendorsMissingTaxInfoCount} vendor accounts.`;

  const review: TaxReadinessReview = {
    companyId,
    taxYear,
    status: vendorsMissingTaxInfoCount > 0 ? 'missing_information' : 'ready_for_accountant',
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    salesTaxCollected: Math.round(orderSalesTaxCollected * 100) / 100,
    salesTaxPayableBalance: Math.round(glSalesTaxPayableMovement * 100) / 100,
    salesTaxVariance: Math.round(salesTaxVariance * 100) / 100,
    vendor1099ReviewCount,
    vendorsMissingTaxInfoCount,
    missingDocuments,
    riskFlags,
    aiSummary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const taxReady = exceptions.filter(e => e.module === 'irs_tax_readiness' && e.severity === 'critical').length === 0;

  return {
    taxReady,
    salesTaxVariance: Math.round(salesTaxVariance * 100) / 100,
    exceptions,
    review
  };
}
