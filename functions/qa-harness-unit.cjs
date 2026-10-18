/**
 * QA harness for the COMPILED BloomPro functions (lib/index.js) — LOCAL
 * ONLY, not shipped.
 *
 * Why this exists: in this sandbox, every client transport to the
 * Firestore emulator is broken at the network layer (rules PUT → 500
 * "http2 exception" from the emulator on two versions/ports; web SDK and
 * Admin SDK operations hang). So this harness stubs ONLY the transport
 * modules (firebase-admin, firebase-functions HTTP wrappers, params,
 * logger) with an in-memory Firestore, and runs the REAL compiled
 * function handlers end to end:
 *   - createStripeCheckoutSession validation + server-side line items
 *     (the Stripe client is a fake that RECORDS the session params it
 *     was asked to create with — amounts are verified exactly);
 *   - stripeWebhook signature verification uses the REAL Stripe SDK
 *     crypto (constructEvent is pure HMAC — no network), so signature
 *     acceptance/rejection and the resulting status flips are genuine;
 *   - confirmDemoPayment gate, flip, idempotency, refusal cases.
 *
 * Not covered (needs a working emulator or Alan's keys — see
 * COMPLETION-REPORT.md): real Firestore transport, real Stripe API.
 */
const Module = require('module');
const RealStripe = require('stripe');

// ── In-memory Firestore stub (only the surface index.ts uses) ─────────
const store = new Map(); // "collection/id" -> data object
const key = (col, id) => `${col}/${id}`;
const docRef = (col, id) => ({
  _col: col,
  _id: id,
  async get() {
    const data = store.get(key(col, id));
    return { exists: data !== undefined, data: () => data };
  },
  async update(fields) {
    const cur = store.get(key(col, id));
    if (!cur) throw new Error('update on missing doc');
    store.set(key(col, id), { ...cur, ...fields });
  },
});
const fakeDb = {
  collection: (col) => ({ doc: (id) => docRef(col, id) }),
  async runTransaction(fn) {
    const tx = {
      get: (ref) => ref.get(),
      update: (ref, fields) => {
        const cur = store.get(key(ref._col, ref._id)) || {};
        store.set(key(ref._col, ref._id), { ...cur, ...fields });
      },
      set: (ref, data) => store.set(key(ref._col, ref._id), data),
    };
    return fn(tx);
  },
};

// ── Recording fake Stripe (session creation only) ─────────────────────
const stripeCalls = [];
class FakeStripe {
  constructor() {
    this.checkout = {
      sessions: {
        create: async (params) => {
          stripeCalls.push(params);
          return { id: 'cs_test_fake', url: 'https://checkout.stripe.com/c/pay/cs_test_fake' };
        },
      },
    };
    const real = new RealStripe('sk_test_dummy');
    this.webhooks = real.webhooks; // genuine constructEvent implementation
  }
}

// ── Module stubs ──────────────────────────────────────────────────────
class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const secrets = {
  STRIPE_SECRET_KEY: 'sk_test_dummy_for_local_verification',
  STRIPE_WEBHOOK_SECRET: 'whsec_local_test_secret',
};
const params = { PAYMENTS_DEMO_MODE: process.env.QA_DEMO_PARAM || 'disabled' };

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  switch (request) {
    case 'firebase-admin/app':
      return { initializeApp: () => ({}) };
    case 'firebase-admin/firestore':
      return { getFirestore: () => fakeDb };
    case 'firebase-functions/v2/https':
      return {
        onCall: (a, b) => (typeof a === 'function' ? a : b),
        onRequest: (a, b) => (typeof a === 'function' ? a : b),
        HttpsError,
      };
    case 'firebase-functions/params':
      return {
        defineSecret: (name) => ({ value: () => secrets[name] }),
        defineString: (name, opts) => ({ value: () => params[name] ?? opts?.default ?? '' }),
      };
    case 'firebase-functions/logger':
      return { info: () => {}, warn: () => {}, error: () => {} };
    case 'stripe':
      return FakeStripe;
    default:
      return origLoad.call(this, request, ...rest);
  }
};

const fns = require('./lib/index.js');

// ── Test scaffolding ──────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const check = (cond, label, extra = '') => {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label} ${extra}`); failed++; }
};
const guestOrder = (overrides = {}) => ({
  companyId: 'DEFAULT_COMPANY',
  customerId: 'guest',
  status: 'pending_payment',
  paymentStatus: 'pending',
  glPostingStatus: 'unposted',
  items: [{ name: 'Classic Red Roses', price: 59.99, quantity: 1 }],
  subtotal: 59.99,
  deliveryFee: 9.99,
  taxes: 5.32,
  total: 75.30,
  orderNumber: 'BLM-11111',
  orderNumberNormalized: 'blm-11111',
  senderEmailNormalized: 'qa@example.com',
  recipientName: 'Recipient QA',
  recipientCity: 'QATown',
  recipientState: 'NY',
  deliveryDate: '2026-06-15',
  ...overrides,
});
const seed = (id, data) => store.set(key('orders', id), data);
const getOrder = (id) => store.get(key('orders', id));
const getTracking = (id) => store.get(key('publicOrderTracking', id));
async function expectHttpsError(promise, code, label) {
  try {
    await promise;
    check(false, label, '(expected throw, got success)');
  } catch (e) {
    check(e instanceof HttpsError && e.code === code, label, `(got ${e.constructor.name}:${e.code} ${e.message})`);
  }
}

async function main() {
console.log(`\n=== FUNCTIONS UNIT HARNESS (compiled lib, PAYMENTS_DEMO_MODE=${params.PAYMENTS_DEMO_MODE}) ===\n`);

seed('ord_pending', guestOrder());
seed('ord_paid', guestOrder({ status: 'confirmed', paymentStatus: 'paid', orderNumber: 'BLM-99999', orderNumberNormalized: 'blm-99999' }));
seed('ord_staff', guestOrder({ customerId: 'user-123', orderNumber: 'BLM-88888', orderNumberNormalized: 'blm-88888' }));
seed('ord_badmath', guestOrder({
  items: [{ name: 'X', price: 10, quantity: 1 }], subtotal: 10, deliveryFee: 0, taxes: 0, total: 5,
  orderNumber: 'BLM-77777', orderNumberNormalized: 'blm-77777',
}));
seed('ord_webhook', guestOrder({ orderNumber: 'BLM-22222', orderNumberNormalized: 'blm-22222' }));
seed('ord_expiry', guestOrder({ orderNumber: 'BLM-33333', orderNumberNormalized: 'blm-33333' }));
seed('ord_demo', guestOrder({ orderNumber: 'BLM-44444', orderNumberNormalized: 'blm-44444' }));

console.log('[createStripeCheckoutSession]');
await expectHttpsError(fns.createStripeCheckoutSession({ data: {} }), 'invalid-argument', 'missing orderId → invalid-argument');
await expectHttpsError(fns.createStripeCheckoutSession({ data: { orderId: 'nope' } }), 'not-found', 'unknown order → not-found');
await expectHttpsError(fns.createStripeCheckoutSession({ data: { orderId: 'ord_paid' } }), 'failed-precondition', 'already-paid order → failed-precondition');
await expectHttpsError(fns.createStripeCheckoutSession({ data: { orderId: 'ord_staff' } }), 'permission-denied', 'non-guest order → permission-denied');
await expectHttpsError(fns.createStripeCheckoutSession({ data: { orderId: 'ord_badmath' } }), 'internal', 'inconsistent totals (server-side re-read) → internal');
{
  const before = stripeCalls.length;
  const res = await fns.createStripeCheckoutSession({ data: { orderId: 'ord_pending' } });
  check(res.url === 'https://checkout.stripe.com/c/pay/cs_test_fake' && res.sessionId === 'cs_test_fake',
    'valid pending order → session created and URL returned');
  check(stripeCalls.length === before + 1, 'exactly one Stripe session creation call');
  const p = stripeCalls[stripeCalls.length - 1];
  const amounts = p.line_items.map((li) => li.price_data.unit_amount * li.quantity);
  check(JSON.stringify(amounts) === JSON.stringify([5999, 999, 532]),
    `line items are SERVER-SIDE amounts [item 5999, delivery 999, tax 532] (got ${JSON.stringify(amounts)})`);
  check(amounts.reduce((a, b) => a + b, 0) === 7530, 'line items sum to the order total to the cent (7530)');
  check(p.client_reference_id === 'ord_pending' && p.metadata.orderId === 'ord_pending', 'session carries order linkage (client_reference_id + metadata)');
  check(p.success_url.includes('/order-confirmation/blm-11111_qa@example.com') && p.success_url.includes('session_id={CHECKOUT_SESSION_ID}'),
    'success URL follows the confirmation pattern');
  check(p.cancel_url.endsWith('/checkout?payment=cancelled'), 'cancel URL returns to checkout with the cart intact');
  const after = getOrder('ord_pending');
  check(after.paymentStatus === 'pending' && after.stripeCheckoutSessionId === 'cs_test_fake',
    'order records the session id and STAYS pending (only the webhook may confirm)');
}

console.log('\n[stripeWebhook]');
const realStripe = new RealStripe('sk_test_dummy');
function fakeRes() {
  return {
    code: null, body: null,
    status(c) { this.code = c; return this; },
    send(b) { this.body = b; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function postWebhook(payloadObj, secret) {
  const payload = JSON.stringify(payloadObj);
  const sig = realStripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = fakeRes();
  await fns.stripeWebhook(
    { headers: { 'stripe-signature': sig }, rawBody: Buffer.from(payload) },
    res
  );
  return res;
}
const completedEvent = {
  id: 'evt_test_1', object: 'event', type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123', object: 'checkout.session', payment_status: 'paid',
      client_reference_id: 'ord_webhook',
      metadata: { orderId: 'ord_webhook', orderNumber: 'BLM-22222', trackingLookupId: 'blm-22222_qa@example.com' },
      payment_intent: 'pi_test_123',
    },
  },
};
{
  const res = await postWebhook(completedEvent, 'whsec_WRONG_secret');
  check(res.code === 400, 'WRONG signature → 400');
  check(getOrder('ord_webhook').paymentStatus === 'pending', 'order untouched after bad signature');
}
{
  const res = await postWebhook(completedEvent, 'whsec_local_test_secret');
  check(res.code === 200, 'VALID signature (real Stripe HMAC) → 200');
  const o = getOrder('ord_webhook');
  check(o.status === 'confirmed' && o.paymentStatus === 'paid', 'order flipped confirmed/paid');
  check(o.stripePaymentIntentId === 'pi_test_123' && !!o.paidAt, 'payment intent + paidAt recorded');
  const tr = getTracking('blm-22222_qa@example.com');
  check(!!tr && tr.status === 'placed' && tr.paymentMode === undefined, 'tracking doc created, NO demo marker on the Stripe path');
}
{
  const res = await postWebhook(completedEvent, 'whsec_local_test_secret');
  check(res.code === 200 && getOrder('ord_webhook').paymentStatus === 'paid', 'duplicate webhook delivery is idempotent');
}
{
  const expired = {
    id: 'evt_test_2', object: 'event', type: 'checkout.session.expired',
    data: {
      object: {
        id: 'cs_test_999', object: 'checkout.session', payment_status: 'unpaid',
        client_reference_id: 'ord_expiry',
        metadata: { orderId: 'ord_expiry', orderNumber: 'BLM-33333' },
        payment_intent: null,
      },
    },
  };
  const res = await postWebhook(expired, 'whsec_local_test_secret');
  const o = getOrder('ord_expiry');
  check(res.code === 200 && o.paymentStatus === 'failed' && o.status === 'pending_payment',
    'expired session → paymentStatus failed, order never confirmed');
  check(getTracking('blm-33333_qa@example.com') === undefined, 'no tracking doc for an unpaid order');
}
{
  const res = fakeRes();
  await fns.stripeWebhook({ headers: {}, rawBody: Buffer.from('{}') }, res);
  check(res.code === 400, 'missing stripe-signature header → 400');
}

console.log('\n[confirmDemoPayment]');
if (params.PAYMENTS_DEMO_MODE !== 'enabled') {
  await expectHttpsError(fns.confirmDemoPayment({ data: { orderId: 'ord_demo' } }), 'failed-precondition',
    'gate OFF (param not enabled) → refused failed-precondition');
  check(getOrder('ord_demo').paymentStatus === 'pending', 'order still pending after gated refusal');
} else {
  await expectHttpsError(fns.confirmDemoPayment({ data: {} }), 'invalid-argument', 'missing orderId → invalid-argument');
  await expectHttpsError(fns.confirmDemoPayment({ data: { orderId: 'ord_staff' } }), 'permission-denied', 'non-guest order → permission-denied');
  await expectHttpsError(fns.confirmDemoPayment({ data: { orderId: 'ord_paid' } }), 'failed-precondition', 'real paid order → failed-precondition');
  check(getOrder('ord_paid').paymentStatus === 'paid', 'real paid order unchanged');
  {
    const res = await fns.confirmDemoPayment({ data: { orderId: 'ord_demo' } });
    check(res.ok === true && res.trackingLookupId === 'blm-44444_qa@example.com', 'demo confirm returns ok + tracking id');
    const o = getOrder('ord_demo');
    check(o.status === 'confirmed' && o.paymentStatus === 'demo_paid', "demo flip: status confirmed, paymentStatus 'demo_paid'");
    check(o.paymentStatus !== 'paid' && o.paymentProvider === 'demo' && o.demoPayment === true, 'demo flip stamps provider/demo flag; never paid');
    const tr = getTracking('blm-44444_qa@example.com');
    check(!!tr && tr.paymentMode === 'demo' && tr.status === 'placed', "tracking doc created with paymentMode 'demo'");
  }
  {
    const res = await fns.confirmDemoPayment({ data: { orderId: 'ord_demo' } });
    check(res.ok === true, 'repeat demo confirm is idempotent (ok:true, no error)');
  }
}

console.log('\n==================================================');
if (failed > 0) {
  console.error(`❌ Functions Unit Harness FAILED: ${failed} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✅ Functions Unit Harness PASSED: all ${passed} assertions passed.`);
process.exit(0);
}

main().catch((e) => {
  console.error('Harness crashed:', e);
  process.exit(1);
});
