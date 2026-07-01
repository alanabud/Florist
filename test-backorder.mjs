/**
 * Backorder derivation & confirm-gate validation tests.
 * Mirrors src/services/backorderService.ts — keep the two in sync.
 * Run: node test-backorder.mjs  (wired into verify:prod as test-backorder)
 */
let failed = 0;
const assert = (cond, msg) => {
  if (cond) console.log(`✅ [PASS] ${msg}`);
  else { console.error(`❌ [FAIL] ${msg}`); failed++; }
};

// ── Mirrors of the pure service functions ──
function getAvailableQtyForLine(line, products, inventory) {
  const sku = products.find(p => p.id === line.productId)?.sku || line.sku;
  if (!sku) return null;
  const inv = inventory.find(i => i.sku === sku);
  return inv ? Math.max(inv.quantity ?? 0, 0) : null;
}
function deriveBackorderedQty(orderedQty, availableQty) {
  if (availableQty === null) return 0;
  return Math.max((orderedQty || 0) - availableQty, 0);
}
function applyBackorderDerivation(line, products, inventory) {
  const available = getAvailableQtyForLine(line, products, inventory);
  const backorderedQty = deriveBackorderedQty(parseInt(line.quantity) || 0, available);
  if (backorderedQty <= 0) {
    const { backorderedQty: _q, backorderReasonCode: _c, backorderReasonText: _t,
      expectedRestockDate: _d, customerBackorderNote: _n, ...rest } = line;
    return rest;
  }
  return { ...line, backorderedQty };
}
function validateBackorderLines(lineItems, targetStatus) {
  if (targetStatus === 'draft') return [];
  const issues = [];
  lineItems.forEach((line, index) => {
    if ((line.backorderedQty || 0) <= 0) return;
    if (!line.backorderReasonCode) issues.push({ index, code: 'missing_reason' });
    else if (line.backorderReasonCode === 'other' && !(line.backorderReasonText || '').trim())
      issues.push({ index, code: 'missing_other_text' });
  });
  return issues;
}
function orderHasBackorder(lineItems) {
  return lineItems.some(line => (line.backorderedQty || 0) > 0);
}

// ── Fixtures ──
const products = [{ id: 'p1', sku: 'WR-001' }, { id: 'p2', sku: 'TL-002' }, { id: 'p9' /* no sku */ }];
const inventory = [{ sku: 'WR-001', quantity: 4 }, { sku: 'TL-002', quantity: 0 }];

console.log('--- Backorder derivation ---');
assert(deriveBackorderedQty(12, 4) === 8, 'ordered 12 / available 4 -> backordered 8 = max(o - a, 0)');
assert(deriveBackorderedQty(3, 4) === 0, 'ordered <= available -> 0 (normal line)');
assert(getAvailableQtyForLine({ productId: 'pX', sku: 'NEG-1' }, [], [{ sku: 'NEG-1', quantity: -5 }]) === 0, 'negative inventory quantity clamps to 0 availability');
assert(deriveBackorderedQty(0, 4) === 0 && deriveBackorderedQty(-3, 4) === 0, 'backorderedQty can never be negative');
assert(deriveBackorderedQty(10, null) === 0, 'untracked SKU (null availability) -> no backorder flag');
assert(getAvailableQtyForLine({ productId: 'p1', sku: 'STALE' }, products, inventory) === 4, 'availability resolves product sku first (stale line sku ignored)');
assert(getAvailableQtyForLine({ productId: 'p9' }, products, inventory) === null, 'product without sku -> untracked (null)');

const derived = applyBackorderDerivation({ productId: 'p1', sku: 'WR-001', quantity: 12 }, products, inventory);
assert(derived.backorderedQty === 8, 'applyBackorderDerivation sets derived qty on the line');
const resolved = applyBackorderDerivation(
  { productId: 'p1', sku: 'WR-001', quantity: 2, backorderedQty: 8, backorderReasonCode: 'other', backorderReasonText: 'x', expectedRestockDate: '2026-07-02' },
  products, inventory
);
assert(resolved.backorderedQty === undefined && resolved.backorderReasonCode === undefined && resolved.expectedRestockDate === undefined,
  'resolving the shortage clears stale backorder fields (no undefined values kept for Firestore)');

console.log('\n--- Confirm-gate validation ---');
const boLineNoReason = { backorderedQty: 8 };
const boLineReason = { backorderedQty: 8, backorderReasonCode: 'vendor_shipment_delay' };
const boLineOtherNoText = { backorderedQty: 8, backorderReasonCode: 'other', backorderReasonText: '  ' };
const boLineOtherOk = { backorderedQty: 8, backorderReasonCode: 'other', backorderReasonText: 'Grower strike' };
const normalLine = {};

assert(validateBackorderLines([boLineNoReason], 'draft').length === 0, 'draft saves are allowed without a reason (gentle warning only)');
assert(validateBackorderLines([boLineNoReason], 'confirmed').length === 1, 'confirm blocked when a backordered line has no reason');
assert(validateBackorderLines([boLineNoReason], 'scheduled').length === 1, 'any non-draft status requires the reason');
assert(validateBackorderLines([boLineOtherNoText], 'confirmed')[0]?.code === 'missing_other_text', 'reason "other" requires free text');
assert(validateBackorderLines([boLineOtherOk], 'confirmed').length === 0, 'reason "other" with text passes');
assert(validateBackorderLines([boLineReason, normalLine], 'confirmed').length === 0, 'reasoned backorder + normal line passes');
const multi = validateBackorderLines([boLineReason, boLineNoReason, boLineNoReason], 'confirmed');
assert(multi.length === 2 && multi[0].index === 1 && multi[1].index === 2, 'each backordered line needs its OWN reason (per-line issues)');

console.log('\n--- Order flag ---');
assert(orderHasBackorder([normalLine, boLineReason]) === true, 'hasBackorder true when any line is backordered');
assert(orderHasBackorder([normalLine]) === false, 'hasBackorder false for fully stocked orders');

console.log('\n==================================================');
if (failed > 0) { console.error(`❌ Backorder tests FAILED: ${failed}`); process.exit(1); }
console.log('✅ Backorder derivation & validation: all assertions passed.');
process.exit(0);
