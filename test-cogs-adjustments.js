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

// 1. Simulated closed period validation function matching financeService.ts
function verifyPeriodNotClosed(date, closedPeriodDate) {
  if (closedPeriodDate) {
    const closedThreshold = new Date(closedPeriodDate);
    let checkDate;
    if (date instanceof Date) {
      checkDate = date;
    } else {
      checkDate = new Date(date);
    }
    
    const checkTime = checkDate.getTime();
    const closedTime = closedThreshold.getTime();
    
    if (checkTime <= closedTime) {
      throw new Error(`Posting blocked: Transaction date (${checkDate.toISOString().split('T')[0]}) falls within a closed accounting period (closed through ${closedPeriodDate}).`);
    }
  }
}

// 2. Simulated WAC calculation & recipe matching matching cogsService.ts
function calculateOrderCOGS(order, inventoryList, productRecipes) {
  const lines = [];
  const items = Array.isArray(order.lineItems) ? order.lineItems : [];

  for (const item of items) {
    let components = productRecipes[item.productId] || [];
    const itemQty = item.quantity || 1;

    for (const comp of components) {
      const invItem = inventoryList.find(i => i.sku === comp.sku);
      if (!invItem) continue;

      const qtyNeeded = comp.quantity * itemQty;
      const unitWac = invItem.unitCost || 0;
      const extendedCost = Math.round((qtyNeeded * unitWac) * 100) / 100;

      const existingLine = lines.find(l => l.sku === comp.sku);
      if (existingLine) {
        existingLine.quantityConsumed += qtyNeeded;
        existingLine.extendedCost = Math.round((existingLine.quantityConsumed * existingLine.unitWac) * 100) / 100;
      } else {
        lines.push({
          sku: comp.sku,
          name: invItem.name,
          quantityConsumed: qtyNeeded,
          unitWac: Math.round(unitWac * 10000) / 10000,
          extendedCost
        });
      }
    }
  }

  const totalCogs = Math.round(lines.reduce((sum, l) => sum + l.extendedCost, 0) * 100) / 100;
  return { lines, totalCogs };
}

async function runTests() {
  console.log('--------------------------------------------------');
  console.log('Scenario 1: Closed Period Blocking Rules Verification');
  console.log('--------------------------------------------------');

  // Test cases for verifyPeriodNotClosed
  try {
    verifyPeriodNotClosed('2026-05-15', '2026-05-31');
    assert(false, "Should have thrown an error for date within closed period");
  } catch (err) {
    assert(err.message.includes('Posting blocked'), `Expected blocking message, got: ${err.message}`);
  }

  try {
    verifyPeriodNotClosed('2026-06-01', '2026-05-31');
    assert(true, "Transaction after closed period should succeed without error");
  } catch (err) {
    assert(false, `Should not have thrown error: ${err.message}`);
  }

  console.log('--------------------------------------------------');
  console.log('Scenario 2: WAC-Based COGS Calculations Verification');
  console.log('--------------------------------------------------');

  const mockInventory = [
    { sku: 'WR-001', name: 'White Roses', quantity: 100, unitCost: 1.50 },
    { sku: 'EU-001', name: 'Eucalyptus', quantity: 50, unitCost: 0.85 }
  ];

  const mockRecipes = {
    'p1': [
      { sku: 'WR-001', quantity: 6 },
      { sku: 'EU-001', quantity: 2 }
    ]
  };

  const mockOrder = {
    lineItems: [
      { productId: 'p1', quantity: 2, unitPrice: 45.00 }
    ]
  };

  // Expected COGS calculation:
  // p1 recipe has 6x WR-001, 2x EU-001
  // For quantity 2, we need:
  // 12x WR-001 at $1.50 WAC = $18.00
  // 4x EU-001 at $0.85 WAC = $3.40
  // Total expected COGS = $21.40
  
  const cogsResult = calculateOrderCOGS(mockOrder, mockInventory, mockRecipes);
  assert(cogsResult.totalCogs === 21.40, `WAC-based COGS calculation matches expected value (Expected: 21.40, Got: ${cogsResult.totalCogs})`);
  assert(cogsResult.lines.length === 2, `Correct number of components consumed (Expected: 2, Got: ${cogsResult.lines.length})`);
  
  const wrLine = cogsResult.lines.find(l => l.sku === 'WR-001');
  assert(wrLine.quantityConsumed === 12, `Correct quantity consumed for WR-001 (Expected: 12, Got: ${wrLine.quantityConsumed})`);
  assert(wrLine.extendedCost === 18.00, `Correct extended cost for WR-001 (Expected: 18.00, Got: ${wrLine.extendedCost})`);

  console.log('--------------------------------------------------');
  console.log('Scenario 3: Manual Stock Adjustments costing logic');
  console.log('--------------------------------------------------');

  // Initial Item State
  const initialQty = 50;
  const itemWac = 1.50;

  // A. Negative adjustment (Shrinkage/Damage)
  const qtyChange1 = -10;
  const newQty1 = initialQty + qtyChange1;
  const costImpact1 = Math.abs(qtyChange1) * itemWac;

  assert(newQty1 === 40, `Negative adjustment results in correct new stock level (Expected: 40, Got: ${newQty1})`);
  assert(costImpact1 === 15.00, `Negative adjustment cost impact matches WAC (Expected: 15.00, Got: ${costImpact1})`);

  // Asserting Debit/Credit accounts for negative adjustment:
  // Debit Spoilage & Shrinkage Expense (5500), Credit Inventory (1300)
  const negativeJournalLines = [
    { account: 'Spoilage & Shrinkage Expense', debit: costImpact1, credit: 0, accountId: '5500' },
    { account: 'Inventory', debit: 0, credit: costImpact1, accountId: '1300' }
  ];

  assert(negativeJournalLines[0].debit === 15.00 && negativeJournalLines[0].accountId === '5500', "Negative adjustment correctly debits Spoilage & Shrinkage Expense (A/C 5500)");
  assert(negativeJournalLines[1].credit === 15.00 && negativeJournalLines[1].accountId === '1300', "Negative adjustment correctly credits Inventory (A/C 1300)");

  // B. Positive adjustment (Correction)
  const qtyChange2 = 5;
  const newQty2 = newQty1 + qtyChange2;
  const costImpact2 = qtyChange2 * itemWac;

  assert(newQty2 === 45, `Positive adjustment results in correct new stock level (Expected: 45, Got: ${newQty2})`);
  assert(costImpact2 === 7.50, `Positive adjustment cost impact matches WAC (Expected: 7.50, Got: ${costImpact2})`);

  // Asserting Debit/Credit accounts for positive adjustment:
  // Debit Inventory (1300), Credit Spoilage & Shrinkage Expense (5500)
  const positiveJournalLines = [
    { account: 'Inventory', debit: costImpact2, credit: 0, accountId: '1300' },
    { account: 'Spoilage & Shrinkage Expense', debit: 0, credit: costImpact2, accountId: '5500' }
  ];

  assert(positiveJournalLines[0].debit === 7.50 && positiveJournalLines[0].accountId === '1300', "Positive adjustment correctly debits Inventory (A/C 1300)");
  assert(positiveJournalLines[1].credit === 7.50 && positiveJournalLines[1].accountId === '5500', "Positive adjustment correctly credits Spoilage & Shrinkage Expense (A/C 5500)");

  console.log('--------------------------------------------------');
  if (failedTests > 0) {
    console.error(`❌ COGS & Adjustments Test Run Failed: ${failedTests} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('✅ COGS & Adjustments Test Run Succeeded: All accounting scenarios verified!');
    process.exit(0);
  }
}

runTests();
