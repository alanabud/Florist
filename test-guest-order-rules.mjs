/**
 * Guest-checkout order-lifecycle Firestore rules tests.
 *
 * Added 2026-10-18 (certification completion pass). The Stripe integration
 * hardened firestore.rules so that:
 *   - a guest (unauthenticated) order may ONLY be created in the pending
 *     state (status 'pending_payment', paymentStatus 'pending') — the old
 *     pattern of creating orders already 'confirmed'/'paid' must be DENIED;
 *   - guests may NOT create publicOrderTracking documents at all (tracking
 *     docs are created by the Stripe webhook via the Admin SDK, or by
 *     staff), but may still GET a tracking doc by its exact lookup id;
 *   - SPARK REWORK (2026-10-18): with no Cloud Functions on the free
 *     Spark plan, the DEMO confirmation moved client-side under a strict
 *     rules quarantine (section [6]): the anonymous guest session may
 *     flip its own PENDING guest order to exactly
 *     confirmed/'demo_paid' touching only the five confirmation fields,
 *     and may create the tracking document ONLY in demo-stamped form.
 *     'paid' remains unreachable for every client, in every path;
 *   - guests still cannot read/list/update/delete orders or touch any
 *     back-office collection;
 *   - company staff keep full order/tracking access; read-only viewers
 *     cannot create orders.
 *
 * The existing suites did not cover this: test-cross-company-rules.mjs is
 * about authenticated cross-company isolation, and test-rules-hardened.js
 * runs against PRODUCTION with real credentials (and still carried the
 * pre-hardening expectations — see the note in that file).
 *
 * Runs against the Firestore EMULATOR via @firebase/rules-unit-testing:
 *   firebase emulators:exec --only firestore "node test-guest-order-rules.mjs"
 */
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, addDoc, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');

const COMPANY = 'DEFAULT_COMPANY';
const TRACKING_ID = 'blm-12345_qa@example.com';

let passed = 0;
let failed = 0;
const allow = async (label, op) => {
  try { await assertSucceeds(op()); console.log(`  ✅ ALLOW  ${label}`); passed++; }
  catch (e) { console.log(`  ❌ ALLOW  ${label} — expected success: ${e.message}`); failed++; }
};
const deny = async (label, op) => {
  try { await assertFails(op()); console.log(`  ✅ DENY   ${label}`); passed++; }
  catch (e) { console.log(`  ❌ DENY   ${label} — expected denial: ${e.message}`); failed++; }
};

/** Mirrors the real client payload built in src/services/publicOrderService.ts. */
const guestOrder = (overrides = {}) => ({
  customerName: 'QA Guest Tester',
  customerEmail: 'qa@example.com',
  recipientName: 'Recipient QA',
  recipientPhone: '123-456-7890',
  recipientAddress: '123 QA St',
  recipientCity: 'QATown',
  recipientState: 'NY',
  recipientZip: '10001',
  deliveryType: 'standard',
  deliveryDate: '2026-06-15',
  senderName: 'QA Guest Tester',
  senderEmail: 'qa@example.com',
  cardMessage: 'Hello QA message',
  items: [
    { productId: 'prod-rose', name: 'Classic Red Roses', price: 59.99, quantity: 1, imageUrl: 'https://example.com/rose.jpg', isCustom: false },
  ],
  subtotal: 59.99,
  taxes: 5.32,
  deliveryFee: 9.99,
  total: 75.30,
  status: 'pending_payment',
  paymentStatus: 'pending',
  glPostingStatus: 'unposted',
  customerId: 'guest',
  companyId: COMPANY,
  id: 'placeholder',
  orderNumber: 'BLM-12345',
  orderNumberNormalized: 'blm-12345',
  senderEmailNormalized: 'qa@example.com',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const trackingDoc = (overrides = {}) => ({
  orderNumber: 'BLM-12345',
  orderNumberNormalized: 'blm-12345',
  senderEmailNormalized: 'qa@example.com',
  status: 'placed',
  deliveryDate: '2026-06-15',
  recipientFirstName: 'Recipient',
  city: 'QATown',
  state: 'NY',
  itemsSummary: '1x Classic Red Roses',
  timeline: [{ status: 'placed', label: 'Order Placed', timestamp: new Date().toISOString() }],
  companyId: COMPANY,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const testEnv = await initializeTestEnvironment({
  projectId: 'florist-rules-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// ── Seed: company + staff/viewer memberships, and a tracking doc created
// "by the webhook" (rules disabled = Admin SDK equivalent). ──
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `companies/${COMPANY}`), { id: COMPANY, companyId: COMPANY, status: 'active', createdBy: 'seed' });
  await setDoc(doc(db, `companies/${COMPANY}/members/staffUser`), { userId: 'staffUser', companyId: COMPANY, role: 'admin', status: 'active' });
  await setDoc(doc(db, `companies/${COMPANY}/members/viewerUser`), { userId: 'viewerUser', companyId: COMPANY, role: 'viewer', status: 'active' });
  await setDoc(doc(db, `publicOrderTracking/${TRACKING_ID}`), trackingDoc());
  // Section [6] fixtures: a registered-customer order and another
  // company's guest order, both pending — neither may be demo-confirmed
  // by the storefront guest session.
  await setDoc(doc(db, 'orders/customerOrder'), guestOrder({ id: 'customerOrder', customerId: 'user-123' }));
  await setDoc(doc(db, 'orders/otherCompanyOrder'), guestOrder({ id: 'otherCompanyOrder', companyId: 'OTHER_CO' }));
});

const guestDb = testEnv.unauthenticatedContext().firestore();
const staffDb = testEnv.authenticatedContext('staffUser').firestore();
const viewerDb = testEnv.authenticatedContext('viewerUser').firestore();
const strangerDb = testEnv.authenticatedContext('randomStranger').firestore();

console.log('\n=== GUEST ORDER LIFECYCLE (STRIPE-HARDENED RULES) ===\n');

console.log('[1] Guest order creation — pending only');
await allow('Guest creates a valid PENDING guest order', () =>
  setDoc(doc(guestDb, 'orders/guestOrder1'), guestOrder({ id: 'guestOrder1' })));
await deny('Guest creates order already CONFIRMED/PAID (old mock pattern)', () =>
  setDoc(doc(guestDb, 'orders/guestOrderPaid'), guestOrder({ id: 'guestOrderPaid', status: 'confirmed', paymentStatus: 'paid' })));
await deny('Guest creates order pending status but PAID paymentStatus', () =>
  setDoc(doc(guestDb, 'orders/guestOrderHalfPaid'), guestOrder({ id: 'guestOrderHalfPaid', paymentStatus: 'paid' })));
await deny('Guest creates order with forbidden field internalNotes', () =>
  setDoc(doc(guestDb, 'orders/guestOrderNotes'), guestOrder({ id: 'guestOrderNotes', internalNotes: 'smuggled' })));
await deny('Guest creates order with field outside the allowlist', () =>
  setDoc(doc(guestDb, 'orders/guestOrderExtra'), guestOrder({ id: 'guestOrderExtra', stripeSessionId: 'cs_test_123' })));
await deny('Guest creates order tagged with another companyId', () =>
  setDoc(doc(guestDb, 'orders/guestOrderSpoof'), guestOrder({ id: 'guestOrderSpoof', companyId: 'someone-else' })));
await deny('Guest creates order with customerId other than guest', () =>
  setDoc(doc(guestDb, 'orders/guestOrderCustomer'), guestOrder({ id: 'guestOrderCustomer', customerId: 'user-123' })));

console.log('\n[2] Guests cannot touch orders after creation');
await deny('Guest reads an order', () => getDoc(doc(guestDb, 'orders/guestOrder1')));
await deny('Guest lists orders', () => getDocs(collection(guestDb, 'orders')));
await deny('Guest updates an order (self-marks paid)', () =>
  updateDoc(doc(guestDb, 'orders/guestOrder1'), { paymentStatus: 'paid', status: 'confirmed' }));
// A PARTIAL demo flip stays denied: the quarantine (section [6])
// requires the complete five-field transition, stamps included.
await deny('Guest updates an order (PARTIAL demo flip — missing demoPayment/paidAt stamps)', () =>
  updateDoc(doc(guestDb, 'orders/guestOrder1'), { paymentStatus: 'demo_paid', status: 'confirmed', paymentProvider: 'demo' }));
await deny('Guest deletes an order', () => deleteDoc(doc(guestDb, 'orders/guestOrder1')));

console.log('\n[3] Public tracking — webhook/staff create, guest read-by-id only');
await deny('Guest creates a publicOrderTracking doc WITHOUT the demo stamp (non-demo stays webhook/staff-only)', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-99999_qa@example.com'), trackingDoc({ orderNumber: 'BLM-99999', orderNumberNormalized: 'blm-99999' })));
await allow('Guest reads a tracking doc by its exact lookup id', () =>
  getDoc(doc(guestDb, `publicOrderTracking/${TRACKING_ID}`)));
await deny('Guest lists publicOrderTracking', () => getDocs(collection(guestDb, 'publicOrderTracking')));
await deny('Guest updates a tracking doc', () =>
  updateDoc(doc(guestDb, `publicOrderTracking/${TRACKING_ID}`), { status: 'delivered' }));

console.log('\n[4] Guests stay out of the back office');
await deny('Guest reads payments', () => getDocs(collection(guestDb, 'payments')));
await deny('Guest writes payments', () => addDoc(collection(guestDb, 'payments'), { amount: 1 }));
await deny('Guest reads chartOfAccounts', () => getDocs(collection(guestDb, 'chartOfAccounts')));
await deny('Guest writes vendors', () => addDoc(collection(guestDb, 'vendors'), { name: 'x' }));

console.log('\n[5] Staff keep the intended order lifecycle access');
await allow('Staff reads the guest order', () => getDoc(doc(staffDb, 'orders/guestOrder1')));
await allow('Staff updates the guest order (e.g. fulfilment status)', () =>
  updateDoc(doc(staffDb, 'orders/guestOrder1'), { status: 'preparing' }));
await allow('Staff creates a tracking doc', () =>
  setDoc(doc(staffDb, 'publicOrderTracking/blm-77777_staff@example.com'), trackingDoc({ orderNumber: 'BLM-77777', orderNumberNormalized: 'blm-77777', senderEmailNormalized: 'staff@example.com' })));
await deny('Viewer (read-only) creates an order', () =>
  setDoc(doc(viewerDb, 'orders/viewerOrder'), { companyId: COMPANY, status: 'draft', total: 1 }));

console.log('\n[6] Spark demo confirmation — client-side under rules quarantine');
// The complete, exact transition the demo client performs (mirrors
// src/services/demoCheckoutService.ts): all five confirmation fields,
// pinned values, nothing else.
const demoConfirmPayload = (overrides = {}) => ({
  status: 'confirmed',
  paymentStatus: 'demo_paid',
  paymentProvider: 'demo',
  demoPayment: true,
  paidAt: new Date().toISOString(),
  ...overrides,
});

await allow('Guest creates pending order demoOrderA (demo-confirm target)', () =>
  setDoc(doc(guestDb, 'orders/demoOrderA'), guestOrder({ id: 'demoOrderA' })));
await allow('Guest demo-confirms its OWN pending guest order (complete quarantined transition)', () =>
  updateDoc(doc(guestDb, 'orders/demoOrderA'), demoConfirmPayload()));
await deny('Guest demo-confirms the SAME order again (no longer pending)', () =>
  updateDoc(doc(guestDb, 'orders/demoOrderA'), demoConfirmPayload()));

await allow('Guest creates pending order demoOrderB (abuse-case target)', () =>
  setDoc(doc(guestDb, 'orders/demoOrderB'), guestOrder({ id: 'demoOrderB' })));
await deny("Guest 'demo-confirms' with paymentStatus 'paid' instead of 'demo_paid'", () =>
  updateDoc(doc(guestDb, 'orders/demoOrderB'), demoConfirmPayload({ paymentStatus: 'paid' })));
await deny('Guest demo-confirms while smuggling a total change into the same update', () =>
  updateDoc(doc(guestDb, 'orders/demoOrderB'), demoConfirmPayload({ total: 0.01 })));
await deny('Guest demo-confirms with a PARTIAL field set (no demoPayment/paidAt stamps)', () =>
  updateDoc(doc(guestDb, 'orders/demoOrderB'), { status: 'confirmed', paymentStatus: 'demo_paid', paymentProvider: 'demo' }));
await deny('An authenticated stranger demo-confirms the guest order (not the guest session)', () =>
  updateDoc(doc(strangerDb, 'orders/demoOrderB'), demoConfirmPayload()));
await deny("Guest demo-confirms a REGISTERED CUSTOMER's order (customerId is not 'guest')", () =>
  updateDoc(doc(guestDb, 'orders/customerOrder'), demoConfirmPayload()));
await deny("Guest demo-confirms ANOTHER COMPANY's guest order", () =>
  updateDoc(doc(guestDb, 'orders/otherCompanyOrder'), demoConfirmPayload()));
await allow('Guest demo-confirms demoOrderB cleanly after the failed abuse attempts', () =>
  updateDoc(doc(guestDb, 'orders/demoOrderB'), demoConfirmPayload()));

console.log('\n[7] Spark demo tracking document — demo-stamped create only');
await allow('Guest creates the DEMO-stamped tracking doc for a demo-confirmed order', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-55555_qa@example.com'),
    trackingDoc({ orderNumber: 'BLM-55555', orderNumberNormalized: 'blm-55555', paymentMode: 'demo' })));
await deny('Guest creates a demo tracking doc whose id does not match its contents', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-66666_qa@example.com'),
    trackingDoc({ orderNumber: 'BLM-55555', orderNumberNormalized: 'blm-55555', paymentMode: 'demo' })));
await deny('Guest creates a demo tracking doc with a non-placed status', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-77777_qa@example.com'),
    trackingDoc({ orderNumber: 'BLM-77777', orderNumberNormalized: 'blm-77777', paymentMode: 'demo', status: 'shipped' })));
await deny('Guest creates a demo tracking doc with a field outside the public allowlist', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-88888_qa@example.com'),
    trackingDoc({ orderNumber: 'BLM-88888', orderNumberNormalized: 'blm-88888', paymentMode: 'demo', internalNote: 'smuggled' })));

const token = 'a'.repeat(32);
await allow('Guest order may carry a trackingToken (confirmation URL does not use the email)', () =>
  setDoc(doc(guestDb, 'orders/guestOrderToken'), guestOrder({ id: 'guestOrderToken', trackingToken: token })));
await allow('Guest creates a token-id demo tracking doc', () =>
  setDoc(doc(guestDb, `publicOrderTracking/blm-42424_${token}`),
    trackingDoc({
      orderNumber: 'BLM-42424',
      orderNumberNormalized: 'blm-42424',
      paymentMode: 'demo',
      trackingToken: token,
      deliveryType: 'pickup',
      subtotal: 125,
      deliveryFee: 0,
      taxes: 0,
      total: 125,
    })));
await deny('Guest creates a token tracking doc whose id does not match the token', () =>
  setDoc(doc(guestDb, 'publicOrderTracking/blm-42424_' + 'b'.repeat(32)),
    trackingDoc({
      orderNumber: 'BLM-42424',
      orderNumberNormalized: 'blm-42424',
      paymentMode: 'demo',
      trackingToken: token,
    })));
await allow('Guest creates the hashed demo lookup doc', () =>
  setDoc(doc(guestDb, 'publicOrderLookup/blm-42424_' + 'c'.repeat(64)), {
    trackingLookupId: `blm-42424_${token}`,
    companyId: COMPANY,
    paymentMode: 'demo',
  }));
await deny('Guest lists publicOrderLookup', () => getDocs(collection(guestDb, 'publicOrderLookup')));

await testEnv.cleanup();

console.log('\n==================================================');
if (failed > 0) {
  console.error(`❌ Guest-order lifecycle rules FAILED: ${failed} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✅ Guest-order lifecycle rules: all ${passed} assertions passed.`);
process.exit(0);
