import { test, expect } from '@playwright/test';

/**
 * P3.2 QA — Customer → Order lifecycle (create → edit → duplicate → backorder).
 * OPT-IN ONLY: creates real production data (customer, orders, GL entries).
 * Run with QA_P32=1 and a unique QA_P32_TOKEN shared with the Firestore probes:
 *
 *   QA_P32=1 QA_P32_TOKEN=<ts> npx playwright test tests/qa-p32-lifecycle.spec.ts --grep lifecycle
 *   (probe) → then: ... --grep cleanup → (final probe deletes artifacts)
 *
 * Evidence bar: UI action → truthful toast/error → Firestore probe → reload →
 * identical state. UI assertions here target durable state (row selects,
 * persisted input values, modal open/closed via footer buttons).
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P32 === '1';
const TOKEN = process.env.QA_P32_TOKEN || '';
const CUSTOMER = `P3.2 QA CUSTOMER ${TOKEN}`;
const ORDERS_URL = `/admin/orders?search=${TOKEN}`;

const IGNORED = [
  /favicon/i, /net::ERR_/i, /Failed to load resource/i, /status of 4\d\d/i,
  /analytics|measurement|gtag/i, /ERR_BLOCKED_BY_CLIENT/i,
  /Missing or insufficient permissions/i, /permission-denied/i,
];

test.describe.configure({ mode: 'serial' });

test.describe('P3.2 customer→order lifecycle (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P32=1, QA_P32_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  const login = async (page: any) => {
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
  };
  const card = (page: any) => page.locator('div[role="alert"]').filter({ hasText: 'Backorder Detected' });
  const saveBtn = (page: any) => page.getByRole('button', { name: /^(Create|Save Changes)$/ });
  const modalButtons = (page: any) => page.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });

  test('lifecycle: create, guard, edit, duplicate, resolve', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (e: any) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m: any) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await login(page);

    // ── 1. CREATE customer ──
    await page.goto('/admin/customers');
    await page.getByRole('button', { name: /Add Customer/i }).click();
    await expect(page.locator('#field-name')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-name').fill(CUSTOMER);
    await page.locator('#field-email').fill(`p32-${TOKEN}@example.com`);
    await saveBtn(page).click();
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32] customer created (modal closed)');

    // ── 2. CREATE order linked to the customer, with shortage, saved as DRAFT ──
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: /Create Order/i }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await page.locator('#field-customerName').fill(CUSTOMER);
    await page.locator('#field-recipientName').fill('P32 Recipient');
    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    await page.locator('#field-deliveryDate').fill('2026-07-12');
    await page.locator('#field-addressLine1').fill('2 QA Lifecycle Way');
    await page.locator('#field-city').fill('New York');
    await page.locator('#field-state').fill('NY');
    await page.locator('#field-zipCode').fill('10002');
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    const qty = page.locator('td input[type="number"]').first();
    await qty.fill('9999');
    await expect(qty).toHaveValue('9999');
    await expect(card(page)).toBeVisible();
    await saveBtn(page).click(); // status stays 'draft'
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32] order draft created with unreasoned shortage');

    // ── 3. FAILURE PATH: list draft->confirmed blocked (no reason yet) ──
    await page.goto(ORDERS_URL);
    const row = page.locator('tr', { hasText: CUSTOMER }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator('select').selectOption('confirmed');
    await expect(row.locator('select')).toHaveValue('draft', { timeout: 15_000 });
    console.log('[p32] guard: draft->confirmed blocked without reason');

    // ── 4. EDIT: header field + line fields + reason + confirm, one save ──
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('confirmed');
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await page.locator('#field-recipientName').fill('P32 EDITED RECIPIENT');
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await page.locator('input[placeholder="e.g. Keep pink"]').first().fill(`P32-EDIT-NOTE-${TOKEN}`);
    await card(page).locator('select').selectOption('vendor_shipment_delay');
    await card(page).locator('input[type="date"]').fill('2026-07-15');
    await card(page).locator('input[type="text"]').last().fill('P32 customer note: ships after restock.');
    await saveBtn(page).click();
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32] edit+confirm saved (header, line note, reason, date, note)');

    // ── 5. RELOAD → persisted state, not optimistic store ──
    await page.goto(ORDERS_URL);
    const row2 = page.locator('tr', { hasText: CUSTOMER }).first();
    await expect(row2).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4000); // let fetchOrders replace stale store state
    await expect(row2.locator('select')).toHaveValue('confirmed');
    await row2.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await expect(page.locator('#field-recipientName')).toHaveValue('P32 EDITED RECIPIENT');
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await expect(page.locator('input[placeholder="e.g. Keep pink"]').first()).toHaveValue(`P32-EDIT-NOTE-${TOKEN}`);
    await expect(card(page).locator('select')).toHaveValue('vendor_shipment_delay');
    console.log('[p32] reload: edited fields + reason persisted in UI');

    // ── 6. DUPLICATE from the open edit modal ──
    await page.getByRole('button', { name: /Duplicate Order/i }).click();
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
    await page.goto(ORDERS_URL);
    await page.waitForTimeout(4000);
    await expect(page.locator('tr', { hasText: CUSTOMER })).toHaveCount(2, { timeout: 20_000 });
    console.log('[p32] duplicate: exactly two rows for token');

    // ── 7. RESOLVE shortage on the ORIGINAL (confirmed row): qty -> 1 ──
    const confirmedRow = page.locator('tr', { hasText: CUSTOMER }).filter({ has: page.locator('select option[value="confirmed"]:checked') }).first();
    // fallback: find row whose select value is confirmed
    const rows = page.locator('tr', { hasText: CUSTOMER });
    const n = await rows.count();
    let target = rows.first();
    for (let i = 0; i < n; i++) {
      if (await rows.nth(i).locator('select').inputValue() === 'confirmed') { target = rows.nth(i); break; }
    }
    await target.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    const qty2 = page.locator('td input[type="number"]').first();
    await qty2.fill('1');
    await expect(card(page)).toHaveCount(0);
    await saveBtn(page).click();
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32] shortage resolved on original (card cleared, saved)');

    const critical = errors.filter(e => !IGNORED.some(p => p.test(e)));
    expect(critical, `Critical errors:\n${critical.join('\n') || '(none)'}`).toHaveLength(0);
    void confirmedRow;
  });

  test('cleanup: cancel both orders via the guarded list dropdown', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    await page.goto(ORDERS_URL);
    const rows = page.locator('tr', { hasText: CUSTOMER });
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const sel = rows.nth(i).locator('select');
      if (await sel.inputValue() !== 'cancelled') {
        await sel.selectOption('cancelled');
        await expect(sel).toHaveValue('cancelled', { timeout: 20_000 });
      }
    }
    await page.waitForTimeout(3000);
    console.log(`[p32] cleanup: ${n} order(s) cancelled via UI (GL reversal path)`);
  });
});
