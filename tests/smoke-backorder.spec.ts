import { test, expect } from '@playwright/test';

/**
 * LIVE backorder-workflow smoke. OPT-IN ONLY: creates a real order (and GL
 * entries) in the target environment, so it is skipped unless BACKORDER_SMOKE=1
 * is set alongside SMOKE_AUTH_EMAIL/PASSWORD. Not part of verify:prod.
 *
 *   BACKORDER_SMOKE=1 npx playwright test tests/smoke-backorder.spec.ts
 *
 * Assertions target durable state (inline validation errors, modal open/closed,
 * the row's status <select> value) rather than transient toasts, which
 * auto-dismiss and race the test. The customer name is unique per run so
 * leftover demo orders never make row lookups ambiguous.
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.BACKORDER_SMOKE === '1';
const TOKEN = String(Date.now());
const CUSTOMER = `BACKORDER SMOKE TEST - Alan - ${TOKEN}`;
// Orders list search is URL-param driven; filtering by the unique token makes
// row lookups deterministic regardless of leftover demo orders or list length.
const LIST_URL = `/admin/orders?search=${TOKEN}`;

const IGNORED = [
  /favicon/i, /net::ERR_/i, /Failed to load resource/i, /status of 4\d\d/i,
  /analytics|measurement|gtag/i, /ERR_BLOCKED_BY_CLIENT/i,
  /Missing or insufficient permissions/i, /permission-denied/i,
];

test.describe('backorder live smoke (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD,
    'Set BACKORDER_SMOKE=1 plus SMOKE_AUTH_EMAIL/PASSWORD to run. Creates a real order.');

  test('card, stale-clear, draft save, list-guard, confirm-gate, persistence', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

    const card = () => page.locator('div[role="alert"]').filter({ hasText: 'Backorder Detected' });
    const saveBtn = () => page.getByRole('button', { name: /^(Create|Save Changes)$/ });
    // Modal-closure check must also match the in-flight "Saving..." label —
    // matching only the idle labels lets a HUNG write pass as "modal closed".
    const modalSaveButtons = () => page.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });
    const fillRequired = async () => {
      await page.getByRole('button', { name: 'Customer', exact: true }).click();
      await page.locator('#field-customerName').fill(CUSTOMER);
      await page.locator('#field-recipientName').fill('Smoke Recipient');
      await page.getByRole('button', { name: 'Delivery', exact: true }).click();
      await page.locator('#field-deliveryDate').fill('2026-07-05');
      await page.locator('#field-addressLine1').fill('1 Smoke Test Street');
      await page.locator('#field-city').fill('New York');
      await page.locator('#field-state').fill('NY');
      await page.locator('#field-zipCode').fill('10001');
      await page.getByRole('button', { name: 'Items', exact: true }).click();
    };

    // ── 1. Login + report deployed bundle ──
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
    const bundle = await page.evaluate(() =>
      (Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[])
        .map(s => s.src).find(s => s.includes('/assets/index-')) ?? '(none)');
    console.log(`[smoke] deployed bundle: ${bundle.split('/').pop()}`);
    console.log(`[smoke] customer: ${CUSTOMER}`);

    // ── 2. Create order, force shortage -> amber card with quantity math (#1) ──
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: /Create Order/i }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await fillRequired();
    const qty = page.locator('td input[type="number"]').first();
    await qty.fill('9999');
    await expect(card()).toBeVisible();
    await expect(card()).toContainText('Available');
    await expect(card()).toContainText('Ordered');
    await expect(card()).toContainText('Backordered');
    console.log('[smoke] #1 card visible with stats:', (await card().innerText()).split('\n')[0]);

    // ── 3. Reduce qty within stock -> card + stale fields clear (#5) ──
    await card().locator('select').selectOption('vendor_shipment_delay'); // set a reason first
    await qty.fill('1');
    await expect(card()).toHaveCount(0);
    console.log('[smoke] #5 shortage resolved -> card cleared');
    await qty.fill('9999'); // restore shortage; reason must be re-entered (was cleared)
    await expect(qty).toHaveValue('9999'); // let derivation settle before saving (avoids racing the click)
    await expect(card()).toBeVisible();
    await expect(card().locator('select')).toHaveValue(''); // stale reason was cleared
    console.log('[smoke] #5 stale reason cleared on resolve');

    // ── 4. Save as DRAFT without a reason -> allowed (#2). Modal closes. ──
    // status left at default 'draft'. Assert on the footer save button, which
    // renders while the modal is open regardless of the active tab
    // (#field-status only exists on the Order tab — asserting it hidden was
    // vacuous from any other tab).
    await saveBtn().click();
    await expect(modalSaveButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[smoke] #2 draft saved without reason (modal closed)');

    // ── 5. List status dropdown draft->confirmed blocked without reason (#6) ──
    await page.goto(LIST_URL);
    const row = page.locator('tr', { hasText: CUSTOMER }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator('select').selectOption('confirmed');
    await expect(row.locator('select')).toHaveValue('draft', { timeout: 15_000 }); // guard reverted it
    console.log('[smoke] #6 list draft->confirmed blocked (status stayed draft)');

    // ── 6. Reopen; confirm blocked w/o reason (#3), "Other" needs text (#4) ──
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('confirmed');
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await saveBtn().click();
    await expect(page.getByText(/backordered items need a backorder reason/i)).toBeVisible();
    // Modal still open — assert the footer save button (tab-agnostic; the
    // validation error auto-jumps to the Items tab, unmounting #field-status).
    await expect(saveBtn()).toBeVisible();
    console.log('[smoke] #3 confirm blocked without reason');

    await card().locator('select').selectOption('other');
    await saveBtn().click();
    await expect(page.getByText(/describe the .Other. backorder reason/i)).toBeVisible();
    console.log('[smoke] #4 "Other" requires free text');

    // ── 7. Valid reason (+ restock date + note) -> confirm succeeds ──
    await card().locator('select').selectOption('vendor_shipment_delay');
    await card().locator('input[type="date"]').fill('2026-07-10');
    await card().locator('input[type="text"]').last().fill('Remaining stems ship after vendor restock (smoke).');
    await saveBtn().click();
    await expect(modalSaveButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[smoke] #3-pass confirmed with reason (modal closed)');

    // ── 8. Reload + reopen: PERSISTED state, not optimistic store state ──
    await page.goto(LIST_URL);
    const row2 = page.locator('tr', { hasText: CUSTOMER }).first();
    await expect(row2).toBeVisible({ timeout: 20_000 });
    // Let fetchOrders finish replacing any stale local state: the row can
    // render from the pre-navigation store first, so an immediate assertion
    // could pass on an optimistic value Firestore never accepted.
    await page.waitForTimeout(4000);
    await expect(row2.locator('select')).toHaveValue('confirmed'); // persisted confirmed
    await row2.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await expect(card()).toBeVisible();
    await expect(card().locator('select')).toHaveValue('vendor_shipment_delay');
    console.log('[smoke] #persist card + reason survived reload');

    // ── 9. No critical console/runtime errors ──
    const critical = errors.filter(e => !IGNORED.some(p => p.test(e)));
    expect(critical, `Critical errors:\n${critical.join('\n') || '(none)'}`).toHaveLength(0);
  });
});
