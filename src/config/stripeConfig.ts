/**
 * STRIPE CONFIG (client) — certification fix pass, 2026-10-18.
 *
 * Online payment is processed by Stripe's HOSTED Checkout page: the
 * customer is redirected to Stripe to enter card details, so card data
 * never touches this app, its backend, or Firestore (PCI SAQ-A posture).
 *
 * ⚠️ TODO(ALAN): put the Stripe PUBLISHABLE key (test key, pk_test_…, to
 * start) in `.env` as VITE_STRIPE_PUBLISHABLE_KEY. The publishable key is
 * safe to ship in the client. The SECRET key must NEVER appear here — it
 * lives only in the Firebase Functions secret store (see functions/).
 *
 * Going from test mode to live mode is a config change only: swap the
 * publishable key here and the secret/webhook secrets in Functions.
 */
export const STRIPE_CONFIG = {
  /** Stripe publishable key (pk_test_… in test mode, pk_live_… in live). */
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',

  /** Name of the callable Cloud Function that creates a Checkout Session. */
  createSessionFunctionName: 'createStripeCheckoutSession',
};

/** True once a real publishable key has been configured. */
export const isStripeConfigured = (): boolean =>
  STRIPE_CONFIG.publishableKey.startsWith('pk_test_') ||
  STRIPE_CONFIG.publishableKey.startsWith('pk_live_');

/**
 * PAYMENTS MODE — which checkout path the storefront offers.
 *
 * FAIL-CLOSED derivation (certification completion pass, 2026-10-18):
 *  - 'stripe'       — a publishable key is configured. This ALWAYS wins:
 *                     if a key exists, the real Stripe hosted checkout is
 *                     the only path and demo mode cannot be selected, no
 *                     matter what any other flag says.
 *  - 'demo'         — no key configured. Checkout runs through the
 *                     honestly-labeled DEMO flow (simulated hosted page,
 *                     orders end as paymentStatus 'demo_paid', never
 *                     'paid') so the store can be tried end to end until
 *                     Alan's real Stripe keys arrive. Alan can force demo
 *                     OFF by setting VITE_PAYMENTS_DEMO_MODE=false.
 *                     Spark rework (2026-10-18): demo availability is
 *                     gated on THIS client-visible config only — the
 *                     confirmation runs client-side under a strict
 *                     Firestore-rules quarantine because the free Spark
 *                     plan has no Cloud Functions (the functions-side
 *                     PAYMENTS_DEMO_MODE gate remains in the retained
 *                     functions code for the future Blaze path).
 *  - 'unconfigured' — no key AND demo explicitly disabled: checkout shows
 *                     a "payments not configured" notice and cannot
 *                     complete. Nothing silently falls back to a mock.
 */
export type PaymentsMode = 'stripe' | 'demo' | 'unconfigured';

export const PAYMENTS_MODE: PaymentsMode = isStripeConfigured()
  ? 'stripe'
  : import.meta.env.VITE_PAYMENTS_DEMO_MODE === 'false'
    ? 'unconfigured'
    : 'demo';

/** True when checkout should run the labeled demo flow. */
export const isDemoPaymentsMode = (): boolean => PAYMENTS_MODE === 'demo';
