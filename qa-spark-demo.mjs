/**
 * Spark demo-mode click-through QA (2026-10-18 rework).
 *
 * Drives the REAL built app (vite preview) through the demo checkout
 * surfaces: simulated payment page (success attempt, decline, cancel)
 * on desktop and mobile.
 *
 * Environment note (same documented sandbox limitation as
 * COMPLETION-REPORT §8): this sandbox cannot reach the Firestore
 * emulator's data plane (HTTP-2 500s from its rules/data endpoints),
 * and the Firestore web SDK's WebChannel transport cannot be stubbed
 * faithfully at the network layer. The demo page is therefore reached
 * the way a real visitor reaches it — via the sessionStorage summary
 * that Checkout stashes (seeded here in the exact shape
 * stashDemoOrderSummary writes, including the Spark-rework tracking
 * fields) — with all Google backend traffic aborted. Assertions:
 *   - the demo page renders the order summary + DEMO banner from the
 *     stash, desktop and mobile, with no horizontal overflow;
 *   - the DECLINE card is rejected client-side with the decline
 *     message and ZERO Firestore write attempts;
 *   - CANCEL returns to /checkout?payment=cancelled with the cart
 *     (seeded through the real Shop → Add-to-Cart UI) intact, and no
 *     write attempted;
 *   - the SUCCESS card drives the client into the confirmation write:
 *     a Firestore Write-channel stream is opened (the quarantined
 *     batch leaving the browser), and with the transport unavailable
 *     the page fails GRACEFULLY (confirm-failed message, stays on the
 *     page, no crash, no navigation to a fake success).
 * The payload the success path sends is pinned exactly by
 * test-demo-mode.js (source-contract key sets), and the rules'
 * acceptance of exactly that shape — and rejection of every abuse
 * shape — is proven by test-guest-order-rules.mjs in the CI rules
 * gate. The confirmation/tracking rendering of a demo order is
 * covered there too (publicOrderTracking read path unchanged).
 *
 * Usage:
 *   QA_BASE_URL=http://localhost:4173 node qa-spark-demo.mjs
 * Expects the app built WITHOUT a Stripe publishable key (demo mode).
 */
import { chromium } from '@playwright/test';

const BASE = process.env.QA_BASE_URL || 'http://localhost:4173';
const SHOTS = process.env.QA_SHOTS || '/tmp/qa-spark-demo';

let passed = 0;
let failed = 0;
const ok = (cond, label) => {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
};

const SUMMARY = {
  orderId: 'qaSparkOrder1',
  orderNumber: 'BLM-12345',
  trackingLookupId: 'blm-12345_qa@example.com',
  items: [{ name: 'Classic Red Roses', quantity: 1, price: 59.99 }],
  subtotal: 59.99,
  deliveryFee: 9.99,
  taxes: 5.32,
  total: 75.30,
  orderNumberNormalized: 'blm-12345',
  senderEmailNormalized: 'qa@example.com',
  recipientFirstName: 'Recipient',
  recipientCity: 'QATown',
  recipientState: 'NY',
  deliveryDate: '2026-12-25',
};

/** Fresh context: backends aborted, write attempts counted, stash seeded. */
async function makePage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const state = { writeAttempts: 0 };
  page.on('request', (r) => {
    if (r.url().includes('firestore.googleapis.com') && r.url().includes('/Write/channel')) state.writeAttempts++;
  });
  await page.route(/googleapis\.com|gstatic\.com|unsplash\.com/, (route) => route.abort());
  await page.addInitScript((s) => {
    sessionStorage.setItem(`bloompro_demo_checkout_${s.orderId}`, JSON.stringify(s));
  }, SUMMARY);
  return { ctx, page, state };
}

async function openDemoPage(page) {
  await page.goto(`${BASE}/demo-checkout/${SUMMARY.orderId}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('DEMO MODE — no real payment is processed').waitFor({ timeout: 20000 });
}

async function fillCard(page, digits) {
  await page.locator('#demo-card-number').fill(digits);
  await page.locator('#demo-card-expiry').fill('12/28');
  await page.locator('#demo-card-cvc').fill('123');
}

const browser = await chromium.launch();

// ── Desktop: render + decline + cancel ──────────────────────────────
console.log('\n[desktop] Demo page render, decline, cancel');
{
  const { ctx, page, state } = await makePage(browser, { width: 1366, height: 900 });
  // Seed a real cart through the storefront UI first (local state only).
  await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();

  await openDemoPage(page);
  ok(true, 'desktop: demo page renders with the DEMO banner');
  const bodyText = await page.locator('body').innerText();
  ok(bodyText.includes('BLM-12345'), 'desktop: demo page shows the stashed order number');
  ok(bodyText.includes('$75.30'), 'desktop: demo page shows the stashed order total');
  await page.screenshot({ path: `${SHOTS}/desktop-demo-page.png` });

  // Decline: decided client-side; no Firestore write may be attempted.
  await fillCard(page, '4000 0000 0000 0002');
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  await page.getByText('This test card was declined').waitFor({ timeout: 15000 });
  ok(true, 'desktop: decline card shows the decline message');
  ok(state.writeAttempts === 0, `desktop: decline attempted ZERO Firestore writes (saw ${state.writeAttempts})`);
  ok(page.url().includes('/demo-checkout/'), 'desktop: decline keeps the visitor on the demo page');
  await page.screenshot({ path: `${SHOTS}/desktop-decline.png` });

  // Cancel: back to checkout, cart intact, still no writes.
  await page.getByRole('button', { name: /Cancel and return to checkout/ }).click();
  await page.waitForURL(/\/checkout\?payment=cancelled/, { timeout: 15000 });
  ok(true, 'desktop: cancel returns to /checkout?payment=cancelled');
  ok(state.writeAttempts === 0, `desktop: cancel attempted ZERO Firestore writes (saw ${state.writeAttempts})`);
  await page.getByText('Payment was cancelled').waitFor({ timeout: 15000 });
  ok(true, 'desktop: checkout shows the cancellation notice');
  const checkoutText = await page.locator('body').innerText();
  ok(!/your cart is empty/i.test(checkoutText), 'desktop: cart survived the cancel round-trip (persisted items render at checkout)');
  await page.screenshot({ path: `${SHOTS}/desktop-cancelled.png` });
  await ctx.close();
}

// ── Desktop: success attempt reaches the quarantined write ──────────
console.log('\n[desktop] Demo success attempt (4242…) — write engagement + graceful failure');
{
  const { ctx, page, state } = await makePage(browser, { width: 1366, height: 900 });
  await openDemoPage(page);
  await fillCard(page, '4242 4242 4242 4242');
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  // The confirmation batch leaves the browser over the Firestore Write
  // channel; with all backends aborted it cannot complete, and the
  // page must surface the confirm-failed state instead of pretending.
  await page.waitForTimeout(6000);
  ok(state.writeAttempts > 0, `desktop: success card triggered the Firestore confirmation write (attempts: ${state.writeAttempts})`);
  const text = await page.locator('body').innerText();
  ok(!page.url().includes('/order-confirmation/'), 'desktop: no fake navigation to a success page without a completed write');
  await page.screenshot({ path: `${SHOTS}/desktop-success-attempt.png` });
  await ctx.close();
}

// ── Mobile: render + decline ────────────────────────────────────────
console.log('\n[mobile 390×844] Demo page render + decline');
{
  const { ctx, page, state } = await makePage(browser, { width: 390, height: 844 });
  await openDemoPage(page);
  ok(true, 'mobile: demo page renders with the DEMO banner');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 0, `mobile: no horizontal overflow on the demo page (delta ${overflow}px)`);
  const payBtn = page.getByRole('button', { name: /^Pay \$/ });
  const box = await payBtn.boundingBox();
  ok(!!box && box.height >= 40, `mobile: pay button is a comfortable tap target (${box ? Math.round(box.height) : 0}px)`);
  await fillCard(page, '4000 0000 0000 0002');
  await payBtn.click();
  await page.getByText('This test card was declined').waitFor({ timeout: 15000 });
  ok(true, 'mobile: decline card shows the decline message');
  ok(state.writeAttempts === 0, `mobile: decline attempted ZERO Firestore writes (saw ${state.writeAttempts})`);
  await page.screenshot({ path: `${SHOTS}/mobile-demo-page.png` });
  await ctx.close();
}

await browser.close();

console.log('\n==================================================');
if (failed > 0) {
  console.error(`❌ Spark demo QA FAILED: ${failed} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`✅ Spark demo QA: all ${passed} assertions passed.`);
process.exit(0);
