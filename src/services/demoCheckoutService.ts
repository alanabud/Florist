import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { isDemoPaymentsMode } from '../config/stripeConfig';

/**
 * DEMO checkout client service (certification completion pass 2026-10-18;
 * Spark rework 2026-10-18).
 *
 * Active only while PAYMENTS_MODE is 'demo' (no Stripe publishable key —
 * see stripeConfig.ts; the moment a real key is configured this path is
 * unreachable because Checkout routes to Stripe instead).
 *
 * SPARK REWORK — why the confirmation is client-side now: the store runs
 * on Firebase's free Spark plan, which has NO Cloud Functions, so the
 * original server-gated `confirmDemoPayment` callable cannot run there.
 * The confirmation therefore happens here, in the client, under a strict
 * Firestore-rules quarantine (see isValidGuestDemoPaymentConfirm in
 * firestore.rules): the rules permit this transition ONLY for the
 * anonymous guest session that owns the checkout, ONLY from the pending
 * state, ONLY touching the five confirmation fields, and ONLY ending at
 * paymentStatus 'demo_paid' — a client still cannot write 'paid' (or
 * any other payment status) through any path. The `functions/` code is
 * retained untouched as the future Blaze path.
 *
 * Flow parity with the real Stripe flow:
 *  1. The order already exists in Firestore in its PENDING state
 *     (createGuestOrder — status 'pending_payment', paymentStatus
 *     'pending'). The guest-create security rules are unchanged.
 *  2. Checkout stashes a display summary in sessionStorage (guests
 *     cannot read orders back from Firestore, by design of the rules)
 *     and routes to the simulated hosted page at
 *     /demo-checkout/:orderId — the local stand-in for Stripe's hosted
 *     page.
 *  3. On a successful test card, this service performs ONE atomic batch:
 *     the order flips to status 'confirmed' with paymentStatus
 *     'demo_paid' (NEVER 'paid'), paymentProvider 'demo', demoPayment
 *     true and an ISO paidAt stamp — the exact field set the callable
 *     used to write — and the public tracking document is created in its
 *     demo-stamped form (paymentMode 'demo'), mirroring the server's
 *     writeTrackingDoc. Both writes are rules-quarantined; if the order
 *     is not in its pending guest state the whole batch is rejected.
 *  4. The browser then lands on the SAME success URL pattern as Stripe:
 *     /order-confirmation/:trackingLookupId?session_id=demo_:orderId.
 *     Cancel returns to /checkout?payment=cancelled, cart intact.
 *
 * No card data is collected for any real purpose: the simulated page
 * accepts only the well-known test card numbers and never transmits the
 * entered number anywhere.
 */

export interface DemoOrderSummaryItem {
  name: string;
  quantity: number;
  price: number;
}

export interface DemoOrderSummary {
  orderId: string;
  orderNumber: string;
  trackingLookupId: string;
  items: DemoOrderSummaryItem[];
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  total: number;
  // Tracking-document fields (Spark rework): the client now writes the
  // public tracking doc itself at confirmation time, so the stash must
  // carry everything writeTrackingDoc used to read from the order doc
  // (guests cannot read the order back from Firestore).
  orderNumberNormalized: string;
  senderEmailNormalized: string;
  recipientFirstName: string;
  recipientCity: string;
  recipientState: string;
  deliveryDate: string;
}

const storageKey = (orderId: string) => `bloompro_demo_checkout_${orderId}`;

/** Stashes the display summary for the simulated hosted page. */
export const stashDemoOrderSummary = (summary: DemoOrderSummary): void => {
  try {
    sessionStorage.setItem(storageKey(summary.orderId), JSON.stringify(summary));
  } catch {
    // sessionStorage unavailable (private mode) — the demo page will show
    // its "session not found" state rather than guessing at amounts.
  }
};

/** Reads back the stashed summary, or null if this browser never started it. */
export const readDemoOrderSummary = (orderId: string): DemoOrderSummary | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(orderId));
    return raw ? (JSON.parse(raw) as DemoOrderSummary) : null;
  } catch {
    return null;
  }
};

/** Test card numbers understood by the simulated hosted page. */
export const DEMO_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
} as const;

interface ConfirmDemoResponse {
  ok: boolean;
  trackingLookupId: string;
}

/**
 * Confirms the demo payment for a pending guest order — client-side
 * under the rules quarantine (Spark rework; see the file header). Writes
 * exactly the transition the confirmDemoPayment callable used to perform
 * server-side: order → confirmed / demo_paid (never 'paid') plus the
 * demo-stamped public tracking document, in one atomic batch. The
 * security rules reject the batch unless the order is a pending
 * storefront guest order and the writes match the quarantined shape.
 */
export const confirmDemoPayment = async (orderId: string): Promise<ConfirmDemoResponse> => {
  if (!isDemoPaymentsMode()) {
    throw new Error('Demo payments are not active in this build.');
  }
  const summary = readDemoOrderSummary(orderId);
  if (!summary) {
    throw new Error('Demo checkout session not found for this order.');
  }

  const now = new Date().toISOString();
  const batch = writeBatch(db);

  batch.update(doc(db, 'orders', orderId), {
    status: 'confirmed',
    paymentStatus: 'demo_paid',
    paymentProvider: 'demo',
    demoPayment: true,
    paidAt: now,
  });

  // Mirror of functions' writeTrackingDoc(..., 'demo'): the tracking doc
  // exists only once the (demo) payment is confirmed, and it is stamped
  // paymentMode 'demo' so confirmation/tracking UIs label it as a demo.
  batch.set(doc(db, 'publicOrderTracking', summary.trackingLookupId), {
    orderNumber: summary.orderNumber,
    orderNumberNormalized: summary.orderNumberNormalized,
    senderEmailNormalized: summary.senderEmailNormalized,
    status: 'placed',
    deliveryDate: summary.deliveryDate,
    recipientFirstName: summary.recipientFirstName,
    city: summary.recipientCity,
    state: summary.recipientState,
    itemsSummary: summary.items
      .map((item) => `${item.quantity ?? 1}x ${item.name ?? ''}`)
      .join(', '),
    timeline: [{ status: 'placed', label: 'Order Placed', timestamp: now }],
    updatedAt: now,
    companyId: 'DEFAULT_COMPANY',
    paymentMode: 'demo',
  });

  await batch.commit();
  return { ok: true, trackingLookupId: summary.trackingLookupId };
};

/** The success URL for a confirmed demo payment — mirrors the Stripe return URL shape. */
export const demoSuccessPath = (summary: DemoOrderSummary): string =>
  `/order-confirmation/${summary.trackingLookupId}?session_id=demo_${summary.orderId}`;
