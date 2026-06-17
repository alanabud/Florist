import fs from 'fs';

let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// ---------------------------------------------------------------------
// 1. GL Reconciliation Logic Simulation
// ---------------------------------------------------------------------
function simulateReconcileGL(companyId, journals, coaList, closedPeriodDateStr) {
  const exceptions = [];
  let totalDebits = 0;
  let totalCredits = 0;

  const closedThreshold = closedPeriodDateStr ? new Date(closedPeriodDateStr + 'T23:59:59') : null;

  for (const j of journals) {
    if (j.companyId !== companyId) continue;
    
    let jeDebits = 0;
    let jeCredits = 0;
    const shortJeId = j.id ? j.id.substring(0, 8).toUpperCase() : 'UNKNOWN';

    for (const line of j.lines) {
      jeDebits += line.debit || 0;
      jeCredits += line.credit || 0;
      totalDebits += line.debit || 0;
      totalCredits += line.credit || 0;

      // Verify Chart of Account mapping
      const matchingAcct = coaList.find(a => a.id === line.accountId || a.code === line.accountCode);
      if (!matchingAcct) {
        exceptions.push({
          companyId,
          module: 'gl',
          severity: 'critical',
          title: 'Orphan Journal Line',
          description: `Journal Entry #${shortJeId} references unrecognized account: "${line.accountCode}".`,
          sourceDocumentId: j.id,
          status: 'open'
        });
      }
    }

    // Check balance matching
    if (Math.abs(jeDebits - jeCredits) > 0.001) {
      exceptions.push({
        companyId,
        module: 'gl',
        severity: 'blocking',
        title: 'Unbalanced Journal Entry',
        varianceAmount: Math.abs(jeDebits - jeCredits),
        sourceDocumentId: j.id,
        status: 'open'
      });
    }

    // Check closed period
    if (closedThreshold && j.createdAt) {
      const jDate = new Date(j.createdAt);
      if (jDate <= closedThreshold) {
        exceptions.push({
          companyId,
          module: 'gl',
          severity: 'blocking',
          title: 'Closed Period Posting',
          sourceDocumentId: j.id,
          status: 'open'
        });
      }
    }
  }

  // Trial Balance Check
  const tbVariance = Math.abs(totalDebits - totalCredits);
  if (tbVariance > 0.01) {
    exceptions.push({
      companyId,
      module: 'gl',
      severity: 'blocking',
      title: 'Trial Balance Out of Balance',
      varianceAmount: tbVariance,
      status: 'open'
    });
  }

  const glBalanced = exceptions.filter(e => e.module === 'gl' && e.severity === 'blocking').length === 0;

  return { glBalanced, totalDebits, totalCredits, exceptions };
}

// ---------------------------------------------------------------------
// 2. AR / AP Reconciliation Logic Simulation
// ---------------------------------------------------------------------
function simulateReconcileAR(companyId, glBalance, customerBalances) {
  const exceptions = [];
  const sumCustomerBalances = customerBalances
    .filter(c => c.companyId === companyId)
    .reduce((sum, c) => sum + (c.openBalance || 0), 0);

  const variance = Math.abs(glBalance - sumCustomerBalances);
  if (variance > 0.05) {
    exceptions.push({
      companyId,
      module: 'ar',
      severity: 'critical',
      title: 'AR Subledger to GL Mismatch',
      varianceAmount: variance,
      status: 'open'
    });
  }
  return { reconciled: exceptions.length === 0, sumCustomerBalances, exceptions };
}

function simulateReconcileAP(companyId, glBalance, vendorBalances) {
  const exceptions = [];
  const sumVendorBalances = vendorBalances
    .filter(v => v.companyId === companyId)
    .reduce((sum, v) => sum + (v.unpaidBalance || 0), 0);

  const variance = Math.abs(glBalance - sumVendorBalances);
  if (variance > 0.05) {
    exceptions.push({
      companyId,
      module: 'ap',
      severity: 'critical',
      title: 'AP Subledger to GL Mismatch',
      varianceAmount: variance,
      status: 'open'
    });
  }
  return { reconciled: exceptions.length === 0, sumVendorBalances, exceptions };
}

// ---------------------------------------------------------------------
// 3. Inventory Reconciliation Logic Simulation
// ---------------------------------------------------------------------
function simulateReconcileInventory(companyId, glBalance, inventoryItems, orders) {
  const exceptions = [];
  
  // WAC Valuation sum
  const calculatedValuation = inventoryItems
    .filter(i => i.companyId === companyId)
    .reduce((sum, item) => {
      // Check negative stock
      if (item.quantity < 0) {
        exceptions.push({
          companyId,
          module: 'inventory',
          severity: 'blocking',
          title: 'Negative stock level detected',
          description: `Item ${item.name} (${item.sku}) has negative quantity: ${item.quantity}.`,
          status: 'open'
        });
      }
      return sum + (item.quantity * (item.unitCost || 0));
    }, 0);

  const variance = Math.abs(glBalance - calculatedValuation);
  if (variance > 0.05) {
    exceptions.push({
      companyId,
      module: 'inventory',
      severity: 'critical',
      title: 'Inventory Subledger to GL Mismatch',
      varianceAmount: variance,
      status: 'open'
    });
  }

  // Missing COGS check
  const companyOrders = orders.filter(o => o.companyId === companyId && o.status === 'delivered');
  for (const o of companyOrders) {
    if (!o.cogsPosted) {
      exceptions.push({
        companyId,
        module: 'cogs',
        severity: 'critical',
        title: 'Fulfillment missing COGS entry',
        description: `Order #${o.orderNumber} delivered but no matching cost of goods sold entry posted.`,
        sourceDocumentId: o.id,
        status: 'open'
      });
    }
  }

  return { reconciled: exceptions.length === 0, calculatedValuation, exceptions };
}

// ---------------------------------------------------------------------
// 4. Tax Readiness Configurable Threshold Logic Simulation
// ---------------------------------------------------------------------
const TAX_REPORTING_THRESHOLDS = {
  US: {
    2025: { form1099NEC: 600 },
    2026: { form1099NEC: 2000 }
  }
};

function simulateTaxReadiness(companyId, taxYear, vendors, payments) {
  const exceptions = [];
  const thresholdConfig = TAX_REPORTING_THRESHOLDS.US[taxYear] || TAX_REPORTING_THRESHOLDS.US[2026];
  const threshold = thresholdConfig.form1099NEC;

  for (const v of vendors) {
    if (v.companyId !== companyId) continue;

    const totalPaid = payments
      .filter(p => p.vendorId === v.id && p.status === 'posted')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    if (totalPaid >= threshold) {
      if (!v.taxId || v.taxId.trim() === '') {
        exceptions.push({
          companyId,
          module: 'irs_tax_readiness',
          severity: 'warning',
          title: `Missing Tax ID for 1099 Vendor: ${v.name}`,
          description: `Vendor "${v.name}" paid $${totalPaid.toFixed(2)} in year ${taxYear} (threshold $${threshold}), but is missing a Tax ID.`,
          status: 'open'
        });
      }
    }
  }

  return { taxReady: exceptions.length === 0, exceptions };
}

// ---------------------------------------------------------------------
// 5. Cross-Company Rejection Helper Simulation
// ---------------------------------------------------------------------
function assertCompanyIsolation(user, action, targetCompanyId) {
  if (user.companyId !== targetCompanyId) {
    throw new Error('Permission denied: Cross-company access rejected.');
  }
}

// ---------------------------------------------------------------------
// Run Test Scenarios
// ---------------------------------------------------------------------
async function runTests() {
  console.log('==================================================');
  console.log('BloomPro Studio: AI Reconciliation & Compliance Tests');
  console.log('==================================================\n');

  // -------------------------------------------------------------------
  // SCENARIO 1: Balanced & Unbalanced Journals
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 1: Balanced & Unbalanced Journal Entries ---');
  
  const mockCOA = [
    { id: '1010', code: '1010', name: 'Cash' },
    { id: '1200', code: '1200', name: 'Accounts Receivable' },
    { id: '4000', code: '4000', name: 'Sales Revenue' }
  ];

  const balancedJournals = [
    {
      id: 'je-1',
      companyId: 'COMP-A',
      createdAt: '2026-06-10',
      lines: [
        { accountId: '1010', accountCode: '1010', debit: 150.00, credit: 0 },
        { accountId: '4000', accountCode: '4000', debit: 0, credit: 150.00 }
      ]
    }
  ];

  const glResult1 = simulateReconcileGL('COMP-A', balancedJournals, mockCOA, null);
  assert(glResult1.glBalanced === true, 'Balanced journal entries pass GL checks successfully');
  assert(glResult1.exceptions.length === 0, 'No exceptions generated for balanced journals');

  const unbalancedJournals = [
    {
      id: 'je-2',
      companyId: 'COMP-A',
      createdAt: '2026-06-12',
      lines: [
        { accountId: '1010', accountCode: '1010', debit: 200.00, credit: 0 },
        { accountId: '4000', accountCode: '4000', debit: 0, credit: 195.00 } // Out of balance by $5
      ]
    }
  ];

  const glResult2 = simulateReconcileGL('COMP-A', unbalancedJournals, mockCOA, null);
  assert(glResult2.glBalanced === false, 'Unbalanced journal entries fail GL checks');
  const unbalancedException = glResult2.exceptions.find(e => e.title === 'Unbalanced Journal Entry');
  assert(unbalancedException !== undefined, 'Unbalanced journal entry triggers "Unbalanced Journal Entry" exception');
  assert(unbalancedException && unbalancedException.varianceAmount === 5, 'Unbalanced exception records the correct variance amount of 5.00');

  // Closed Period posting check
  const closedPeriodJournals = [
    {
      id: 'je-3',
      companyId: 'COMP-A',
      createdAt: '2026-05-15', // Posted in closed period
      lines: [
        { accountId: '1010', accountCode: '1010', debit: 100.00, credit: 0 },
        { accountId: '4000', accountCode: '4000', debit: 0, credit: 100.00 }
      ]
    }
  ];
  const glResult3 = simulateReconcileGL('COMP-A', closedPeriodJournals, mockCOA, '2026-05-31');
  assert(glResult3.glBalanced === false, 'Posting in closed period fails GL checks');
  assert(glResult3.exceptions.some(e => e.title === 'Closed Period Posting'), 'Closed period posting exception generated successfully');

  console.log();

  // -------------------------------------------------------------------
  // SCENARIO 2: Subledger to GL Mismatches (AR/AP)
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 2: AR / AP Subledger to GL Checks ---');
  
  const mockCustomerBalances = [
    { companyId: 'COMP-A', openBalance: 1200 },
    { companyId: 'COMP-A', openBalance: 300 } // Total sum = 1500
  ];

  // AR Match
  const arResult1 = simulateReconcileAR('COMP-A', 1500.00, mockCustomerBalances);
  assert(arResult1.reconciled === true, 'AR reconciles when GL balance matches customer subledger sum');

  // AR Mismatch
  const arResult2 = simulateReconcileAR('COMP-A', 1450.00, mockCustomerBalances); // Mismatch by $50
  assert(arResult2.reconciled === false, 'AR mismatch detected when GL balance deviates from customer subledger');
  assert(arResult2.exceptions.some(e => e.module === 'ar' && e.severity === 'critical'), 'AR mismatch generates a CRITICAL severity exception');

  // AP Mismatch
  const mockVendorBalances = [
    { companyId: 'COMP-A', unpaidBalance: 800 }
  ];
  const apResult = simulateReconcileAP('COMP-A', 850.00, mockVendorBalances); // Mismatch by $50
  assert(apResult.reconciled === false, 'AP mismatch detected when GL balance deviates from vendor subledger');
  assert(apResult.exceptions.some(e => e.module === 'ap' && e.severity === 'critical'), 'AP mismatch generates a CRITICAL severity exception');

  console.log();

  // -------------------------------------------------------------------
  // SCENARIO 3: Inventory Valuation & Negative Stock
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 3: Inventory & Negative Stock Blocking ---');

  const mockInventoryItems = [
    { sku: 'ROS-01', name: 'Red Roses', quantity: 100, unitCost: 1.50, companyId: 'COMP-A' },
    { sku: 'TUL-01', name: 'Tulips', quantity: -5, unitCost: 0.80, companyId: 'COMP-A' } // Negative stock
  ];

  const mockOrders = [
    { id: 'o-1', companyId: 'COMP-A', orderNumber: '1001', status: 'delivered', cogsPosted: false } // Missing COGS
  ];

  const invResult = simulateReconcileInventory('COMP-A', 146.00, mockInventoryItems, mockOrders);
  
  // Negative stock checks
  const negativeStockException = invResult.exceptions.find(e => e.title === 'Negative stock level detected');
  assert(negativeStockException !== undefined, 'Negative stock levels generate exceptions');
  assert(negativeStockException && negativeStockException.severity === 'blocking', 'Negative stock level exception is BLOCKING (blocks close)');

  // Missing COGS checks
  const missingCogsException = invResult.exceptions.find(e => e.title === 'Fulfillment missing COGS entry');
  assert(missingCogsException !== undefined, 'Delivered orders missing COGS entries generate exceptions');
  assert(missingCogsException && missingCogsException.severity === 'critical', 'Missing COGS exception has CRITICAL severity');

  console.log();

  // -------------------------------------------------------------------
  // SCENARIO 4: Year-Based Tax Readiness Configurable Thresholds
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 4: Configurable Tax Threshold Checks ---');

  const mockVendors = [
    { id: 'v-1', name: 'Courier Inc', taxId: '', companyId: 'COMP-A' } // Missing Tax ID
  ];

  const mockPayments = [
    { vendorId: 'v-1', amount: 800, status: 'posted' }
  ];

  // For Tax Year 2025: Threshold is $600. Paid $800. Expected: Warnings generated.
  const tax2025 = simulateTaxReadiness('COMP-A', 2025, mockVendors, mockPayments);
  assert(tax2025.taxReady === false, 'Tax Year 2025 flags vendor since paid amount $800 exceeds $600 threshold');
  assert(tax2025.exceptions.some(e => e.module === 'irs_tax_readiness'), 'W-9 exception generated for tax year 2025');

  // For Tax Year 2026: Threshold is $2,000. Paid $800. Expected: Tax ready, no warnings.
  const tax2026 = simulateTaxReadiness('COMP-A', 2026, mockVendors, mockPayments);
  assert(tax2026.taxReady === true, 'Tax Year 2026 passes since paid amount $800 is below new $2000 threshold');
  assert(tax2026.exceptions.length === 0, 'No W-9 exceptions generated for tax year 2026');

  console.log();

  // -------------------------------------------------------------------
  // SCENARIO 5: Cross-Company Rejection
  // -------------------------------------------------------------------
  console.log('--- SCENARIO 5: Cross-Company Access Rejection ---');

  const userA = { email: 'manager@company-a.com', companyId: 'COMP-A' };
  
  // Try to perform action for own company
  try {
    assertCompanyIsolation(userA, 'reconcile', 'COMP-A');
    assert(true, 'Manager successfully accesses own company data');
  } catch (err) {
    assert(false, `Manager should not be blocked from own company: ${err.message}`);
  }

  // Try to access other company
  try {
    assertCompanyIsolation(userA, 'reconcile', 'COMP-B');
    assert(false, 'Manager should have been rejected from cross-company access');
  } catch (err) {
    assert(err.message.includes('Cross-company access rejected'), `Cross-company access correctly rejected: ${err.message}`);
  }

  console.log();

  // -------------------------------------------------------------------
  // Exit Code Verification
  // -------------------------------------------------------------------
  console.log('==================================================');
  if (failedTests > 0) {
    console.error(`❌ Automated Reconciliation Test Suite FAILED: ${failedTests} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('✅ All Automated Reconciliation Test Suite scenarios PASSED successfully!');
    process.exit(0);
  }
}

runTests();
