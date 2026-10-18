import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { isDemoPaymentsMode } from '../config/stripeConfig';

/**
 * DEMO checkout client service (certification completion pass, 2026-10-18).
 *
 * Active only while PAYMENTS_MODE is 'demo' (no Stripe publishable key —
 * see stripeConfig.ts; the moment a real key is configured this path is
 * unreachable because Checkout routes to Stripe instead).
 *
 * Flow parity with the real Stripe flow:
 *  1. The order already exists in Firestore in its PENDING state
 *     (createGuestOrder — status 'pending_payment', paymentStatus
 *     'pending'). The guest-create security rules are unchanged.
 *  2. Checkout stashes a display summary in sessionStorage (guests cannot
 *     read orders back from Firestore, by design of the rules) and routes
 *     to the simulated hosted page at /demo-checkout/:orderId — the local
 *     stand-in for Stripe's hosted page.
 *  3. On the simulated page, a successful test card calls the
 *     `confirmDemoPayment` Cloud Function, which re-validates the order
 *     server-side and flips it to status 'confirmed' with paymentStatus
 *     'demo_paid' (NEVER 'paid') and creates the public tracking doc —
 *     the same transition shape as the Stripe webhook, through Admin SDK.
 *  4. The browser then lands on the SAME success URL pattern as Stripe:
 *     /order-confirmation/:trackingLookupId?session_id=demo_:orderId.
 *     Cancel returns to /checkout?payment=cancelled, cart intact.
 *
 * No card data is collected for any real purpose: the simulated page
 * accepts only the well-known test card numbers and never transmits the
 * entered number anywhere (the confirm call carries only the orderId).
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
 * Asks the server to confirm the demo payment for a pending order.
 * The function re-reads the order and performs the pending → demo_paid
 * flip with the Admin SDK; the client cannot flip an order itself.
 */
export const confirmDemoPayment = async (orderId: string): Promise<ConfirmDemoResponse> => {
  if (!isDemoPaymentsMode()) {
    throw new Error('Demo payments are not active in this build.');
  }
  const confirm = httpsCallable<{ orderId: string }, ConfirmDemoResponse>(
    functions,
    'confirmDemoPayment'
  );
  const { data } = await confirm({ orderId });
  if (!data?.ok || !data?.trackingLookupId) {
    throw new Error('Demo payment confirmation returned an unexpected response.');
  }
  return data;
};

/** The success URL for a confirmed demo payment — mirrors the Stripe return URL shape. */
export const demoSuccessPath = (summary: DemoOrderSummary): string =>
  `/order-confirmation/${summary.trackingLookupId}?session_id=demo_${summary.orderId}`;
