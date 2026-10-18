/**
 * Functions-side configuration — certification fix pass, 2026-10-18.
 *
 * ⚠️ TODO(ALAN):
 * - APP_BASE_URL must be the production storefront origin (used to build
 *   Stripe success/cancel return URLs). It matches the default live
 *   hosting URL recorded in the root .env.example (SMOKE_BASE_URL).
 * - Stripe SECRET keys are NOT stored here or anywhere in source. They
 *   live in the Firebase Functions secret store and are injected at
 *   runtime (see index.ts):
 *     firebase functions:secrets:set STRIPE_SECRET_KEY
 *     firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   Use TEST keys (sk_test_… / whsec_… from a test-mode webhook) first.
 *   Going live = replacing those two secrets and the client's
 *   VITE_STRIPE_PUBLISHABLE_KEY. No code change is required.
 * - DEMO payments are gated server-side by the PAYMENTS_DEMO_MODE
 *   functions parameter (see index.ts): set it to 'enabled' (in
 *   functions/.env locally, or the deployed functions environment) ONLY
 *   while the store runs without real Stripe keys. The demo confirm
 *   function refuses to run otherwise, and demo orders are always
 *   paymentStatus 'demo_paid', never 'paid'.
 */
export const APP_BASE_URL = 'https://florist-d5026.web.app';

export const ORDER_CURRENCY = 'usd';

/** The storefront's single company scope for guest orders. */
export const GUEST_COMPANY_ID = 'DEFAULT_COMPANY';
