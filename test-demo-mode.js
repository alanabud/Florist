/**
 * Demo payment mode — regression guard (certification completion pass,
 * 2026-10-18).
 *
 * What this suite proves, in the style of test-delivery-core.js:
 *  1. The demo-order predicate semantics: isDemoOrder is true ONLY for
 *     paymentStatus 'demo_paid' (mirrors src/services/demoOrder.ts; the
 *     mirror is verified against the real source below).
 *  2. Source-integrity checks on the REAL files, so a future edit cannot
 *     silently break the demo-mode safety properties:
 *       - stripeConfig derives the mode fail-closed (Stripe key checked
 *         BEFORE demo can be selected);
 *       - the confirmDemoPayment function flips to 'demo_paid' and the
 *         demo handler never assigns paymentStatus 'paid';
 *       - every money surface (Dashboard, Reports, ReconciliationDrawer,
 *         CommandSummary, Orders GL button, qaService) actually imports
 *         and applies isDemoOrder;
 *       - all four locales carry the demoCheckout namespace, the checkout
 *         demo banner keys, the confirmation demoNotice, and no locale
 *         still ships TODO placeholder copy in the info pages.
 *  3. The demo lifecycle state machine (pending → demo_paid) is reached
 *     from the client ONLY through the rules-quarantined transition
 *     (Spark rework, 2026-10-18): the client writes exactly the five
 *     pinned confirmation fields + the demo-stamped tracking doc, the
 *     rules source carries the quarantine shape, and the simulated page
 *     accepts exactly the two documented test cards (mirror-checked
 *     against demoCheckoutService.ts constants).
 *
 * What it does NOT prove: live behavior against Firebase/Stripe — that
 * is covered by the emulator suites (test-guest-order-rules.mjs) and the
 * functions verification recorded in COMPLETION-REPORT.md.
 */
import fs from 'fs';
import path from 'path';

let failedTests = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ── 1. Predicate semantics (mirror of src/services/demoOrder.ts) ──────
const DEMO_PAYMENT_STATUS = 'demo_paid';
const isDemoOrder = (order) => order?.paymentStatus === DEMO_PAYMENT_STATUS;

assert(isDemoOrder({ paymentStatus: 'demo_paid' }) === true, "Predicate flags paymentStatus 'demo_paid' as demo.");
assert(isDemoOrder({ paymentStatus: 'paid' }) === false, "Predicate does NOT flag a real 'paid' order.");
assert(isDemoOrder({ paymentStatus: 'pending' }) === false, 'Predicate does not flag a pending order.');
assert(isDemoOrder({ paymentStatus: 'unpaid' }) === false, 'Predicate does not flag an unpaid order.');
assert(isDemoOrder({}) === false && isDemoOrder(null) === false && isDemoOrder(undefined) === false,
  'Predicate is safe on missing orders/fields.');

const demoOrderSrc = read('src/services/demoOrder.ts');
assert(demoOrderSrc.includes("DEMO_PAYMENT_STATUS = 'demo_paid'"), 'demoOrder.ts defines DEMO_PAYMENT_STATUS as demo_paid.');
assert(demoOrderSrc.includes("order?.paymentStatus === DEMO_PAYMENT_STATUS"), 'demoOrder.ts predicate matches the tested mirror.');

// ── 2a. Fail-closed mode derivation ───────────────────────────────────
const stripeConfig = read('src/config/stripeConfig.ts');
const keyCheckIdx = stripeConfig.indexOf('isStripeConfigured()');
const modeIdx = stripeConfig.indexOf('PAYMENTS_MODE');
assert(modeIdx > -1 && keyCheckIdx > -1 && stripeConfig.indexOf("'stripe'", modeIdx) > -1,
  'stripeConfig derives PAYMENTS_MODE with stripe as a possible value.');
assert(stripeConfig.includes("import.meta.env.VITE_PAYMENTS_DEMO_MODE === 'false'"),
  'Demo can be forced off with VITE_PAYMENTS_DEMO_MODE=false.');
// The ternary must test the Stripe key first: the first branch after
// PAYMENTS_MODE's '=' must be isStripeConfigured() ? 'stripe'.
const modeDecl = stripeConfig.slice(modeIdx, modeIdx + 400);
assert(/PAYMENTS_MODE: PaymentsMode = isStripeConfigured\(\)\s*\?\s*'stripe'/.test(modeDecl),
  'FAIL-CLOSED: a configured Stripe key always wins over demo mode.');

// ── 2b. Server-side demo flip (functions retained for the Blaze path;
// on Spark the same transition is performed client-side — see 2b′) ────
const fnSrc = read('functions/src/index.ts');
const demoStart = fnSrc.indexOf('export const confirmDemoPayment');
assert(demoStart > -1, 'functions expose confirmDemoPayment.');
const demoSlice = fnSrc.slice(demoStart, demoStart + 4000);
assert(demoSlice.includes("paymentStatus: 'demo_paid'"), "confirmDemoPayment flips paymentStatus to 'demo_paid'.");
assert(!demoSlice.includes("paymentStatus: 'paid'"), "confirmDemoPayment never assigns paymentStatus 'paid'.");
assert(demoSlice.includes("paymentProvider: 'demo'"), 'Demo flip stamps paymentProvider demo.');
assert(demoSlice.includes("PAYMENTS_DEMO_MODE") || fnSrc.includes("demoPaymentsMode.value() !== 'enabled'"),
  'confirmDemoPayment is gated on the server-side PAYMENTS_DEMO_MODE parameter.');
assert(demoSlice.includes("status: 'confirmed'"), 'Demo flip moves the order to confirmed (fulfilment parity with the webhook).');
assert(demoSlice.includes('writeTrackingDoc'), 'Demo flip creates the public tracking doc through the shared builder.');
assert(fnSrc.includes("freshOrder.paymentStatus === 'demo_paid'"), 'Demo flip is idempotent for repeat confirmations.');

// The webhook path remains the only 'paid' writer.
const webhookPaidCount = (fnSrc.match(/paymentStatus: 'paid'/g) || []).length;
assert(webhookPaidCount === 1, "Exactly one code path in functions assigns paymentStatus 'paid' (the Stripe webhook flip).");

// ── 2b′. Client-side demo flip (Spark rework) ───────────────────────
// The demo confirmation no longer calls a Cloud Function: it performs
// the quarantined Firestore batch directly. These source checks pin
// the client half of the quarantine contract (the rules half is
// checked below; the live behavior is proven by the emulator suite).
const demoSvc = read('src/services/demoCheckoutService.ts');
assert(!demoSvc.includes('httpsCallable'), 'Client demo confirm calls NO Cloud Function (Spark has none).');
assert(demoSvc.includes('writeBatch'), 'Client demo confirm writes the order flip + tracking doc as one atomic batch.');
assert(demoSvc.includes("paymentStatus: 'demo_paid'"), "Client demo flip sets paymentStatus 'demo_paid'.");
assert(!demoSvc.includes("paymentStatus: 'paid'"), "Client demo service NEVER assigns paymentStatus 'paid'.");
assert(demoSvc.includes("paymentProvider: 'demo'") && demoSvc.includes('demoPayment: true'),
  'Client demo flip stamps paymentProvider demo + demoPayment true (same field set as the callable wrote).');
assert(demoSvc.includes("paymentMode: 'demo'"), 'Client demo flip stamps the tracking doc paymentMode demo.');
assert(demoSvc.includes("success: '4242424242424242'") && demoSvc.includes("decline: '4000000000000002'"),
  'Demo test card constants are the documented success/decline cards.');

// Exact key sets of the two batched writes. The Firestore SDK derives
// the updateMask from the update object's keys, so these key sets ARE
// the wire contract the rules quarantine is checked against (proven
// live by test-guest-order-rules.mjs in CI).
const extractBlockKeys = (src, marker) => {
  const start = src.indexOf(marker);
  assert(start > -1, `demoCheckoutService contains ${marker}.`);
  const block = src.slice(start, src.indexOf('});', start));
  return [...block.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).sort();
};
const orderUpdateKeys = extractBlockKeys(demoSvc, "batch.update(doc(db, 'orders'");
assert(JSON.stringify(orderUpdateKeys) === JSON.stringify(['demoPayment', 'paidAt', 'paymentProvider', 'paymentStatus', 'status']),
  `Client order update touches EXACTLY the five quarantined fields (got ${orderUpdateKeys.join(',')}).`);
const trackingKeys = extractBlockKeys(demoSvc, "batch.set(doc(db, 'publicOrderTracking'");
const expectedTrackingKeys = ['city', 'companyId', 'deliveryDate', 'deliveryFee', 'deliveryType', 'itemsSummary', 'orderNumber', 'orderNumberNormalized', 'paymentMode', 'recipientFirstName', 'senderEmailNormalized', 'state', 'status', 'subtotal', 'taxes', 'timeline', 'total', 'trackingToken', 'updatedAt'].sort();
assert(JSON.stringify(trackingKeys) === JSON.stringify(expectedTrackingKeys),
  `Client tracking doc carries EXACTLY the public allowlist + paymentMode (got ${trackingKeys.join(',')}).`);

// ── 2c. Money surfaces apply the exclusion ────────────────────────────
// Minimum call counts reflect each file's shape: Dashboard /
// ReconciliationDrawer / CommandSummary filter in several places, while
// Reports (single reportableOrders filter feeding every figure) and
// qaService (single anomaly filter) apply it exactly once by design.
const moneySurfaces = [
  ['src/pages/Dashboard.tsx', 3],
  ['src/pages/Reports.tsx', 1],
  ['src/components/dashboard/ReconciliationDrawer.tsx', 3],
  ['src/components/dashboard/CommandSummary.tsx', 2],
  ['src/services/qaService.ts', 1],
];
for (const [file, minCalls] of moneySurfaces) {
  const src = read(file);
  assert(src.includes("isDemoOrder") && (src.match(/isDemoOrder\(/g) || []).length >= minCalls,
    `${file} imports and applies isDemoOrder exclusions.`);
}
const reports = read('src/pages/Reports.tsx');
assert(reports.includes('reportableOrders'), 'Reports derives its figures from reportableOrders (demo-free).');
const ordersPage = read('src/pages/Orders.tsx');
assert(ordersPage.includes('isDemoOrder(order)') && ordersPage.includes('orders.demoBadge'),
  'Admin Orders shows the DEMO badge for demo orders.');
assert(ordersPage.includes("glPostingStatus === 'unposted' && !isDemoOrder(order)"),
  'Admin Orders hides the Post-to-Ledger action for demo orders.');

// Rules: creation is unchanged (pending only); the demo flip exists
// ONLY as the quarantined transition (Spark rework). These checks pin
// its shape so the allowance cannot silently widen: exact pre-state,
// complete-and-only field set, pinned demo outcome — and 'paid' is
// never a client-reachable value.
const rules = read('firestore.rules');
assert(rules.includes("request.resource.data.status == 'pending_payment'") &&
       rules.includes("request.resource.data.paymentStatus == 'pending'"),
  'Guest order creation still requires the pending state.');
assert(rules.includes('isValidGuestDemoPaymentConfirm'), 'Rules carry the quarantined guest demo-confirm transition.');
assert(rules.includes("resource.data.status == 'pending_payment'") &&
       rules.includes("resource.data.paymentStatus == 'pending'"),
  'Demo transition requires the order to be in its PENDING state.');
assert(rules.includes('hasAll(demoPaymentConfirmFields())') &&
       rules.includes('hasOnly(demoPaymentConfirmFields())'),
  'Demo transition requires the COMPLETE confirmation field set and NOTHING else.');
assert(rules.includes("request.resource.data.paymentStatus == 'demo_paid'"),
  "Demo transition pins the outcome to paymentStatus 'demo_paid'.");
assert(rules.includes('isValidGuestDemoTrackingCreate') &&
       rules.includes("request.resource.data.paymentMode == 'demo'"),
  'Guest tracking creation is allowed ONLY in demo-stamped form.');

// ── 2d. Locales carry the demo copy; no TODO placeholders ship ───────
for (const loc of ['en-US', 'es-US', 'fr-FR', 'nl-NL']) {
  const src = read(`src/i18n/locales/${loc}.ts`);
  const q = loc === 'en-US' ? '' : '"';
  assert(src.includes(`${q}demoCheckout${q}`) || src.includes('demoCheckout'), `${loc} has the demoCheckout namespace.`);
  assert(src.includes('demoNotice'), `${loc} has the confirmation demoNotice.`);
  assert(src.includes('demoBannerTitle'), `${loc} has the checkout demo banner keys.`);
  assert(!src.includes('TODO(ALAN)'), `${loc} ships no TODO(ALAN) placeholder copy.`);
  assert(!src.includes('areasTodo'), `${loc} no longer carries the areasTodo placeholder key.`);
}
const siteConfig = read('src/config/siteConfig.ts');
assert(siteConfig.includes("contactEmail: 'alanabud@gmail.com'"), 'siteConfig carries the launch contact email.');
assert(!siteConfig.includes('TODO_'), 'siteConfig ships no TODO_ placeholder values.');

console.log('==================================================');
if (failedTests > 0) {
  console.error(`❌ Demo Mode Verification Failed: ${failedTests} test(s) failed.`);
  process.exit(1);
}
console.log('✅ Demo Mode Verification Succeeded: all demo-mode safety properties hold.');
process.exit(0);
