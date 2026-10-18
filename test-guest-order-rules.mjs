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
});

const guestDb = testEnv.unauthenticatedContext().firestore();
const staffDb = testEnv.authenticatedContext('staffUser').firestore();
const viewerDb = testEnv.authenticatedContext('viewerUser').firestore();

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
await deny('Guest updates an order (self-marks DEMO paid — the flip is server-side only)', () =>
  updateDoc(doc(guestDb, 'orders/guestOrder1'), { paymentStatus: 'demo_paid', status: 'confirmed', paymentProvider: 'demo' }));
await deny('Guest deletes an order', () => deleteDoc(doc(guestDb, 'orders/guestOrder1')));

console.log('\n[3] Public tracking — webhook/staff create, guest read-by-id only');
await deny('Guest creates a publicOrderTracking doc (must come from webhook/staff)', () =>
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

await testEnv.cleanup();

console.log('\n==================================================');
if (failed > 0) {
  console.error(`❌ Guest-order lifecycle rules FAILED: ${failed} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✅ Guest-order lifecycle rules: all ${passed} assertions passed.`);
process.exit(0);
