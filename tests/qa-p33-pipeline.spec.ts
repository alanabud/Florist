import { test, expect } from '@playwright/test';

/**
 * P3.3 QA — Fulfillment pipeline. OPT-IN: creates production data (orders M/U,
 * GL + COGS entries). Order M (paid, priority high, delivery today) walks
 * confirmed → in_design → ready → out_for_delivery → delivered via the
 * dashboard urgent panel, with a hard reload + rendered-status assertion after
 * every transition. The final transition is DOUBLE-clicked (single-flight +
 * audit exactly-once proven by the probe). Order U (unpaid, confirmed) proves
 * the delivered guard leaves Firestore unchanged; M post-delivery proves the
 * cancel guard.
 *
 *   QA_P33=1 QA_P33_TOKEN=<ts> npx playwright test tests/qa-p33-pipeline.spec.ts --grep pipeline
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P33 === '1';
const TOKEN = process.env.QA_P33_TOKEN || '';
const M = `P3.3 PIPELINE QA ${TOKEN}`;
const U = `P3.3 GUARD QA ${TOKEN}`;
const TODAY = new Date().toISOString().slice(0, 10);

test.describe.configure({ mode: 'serial' });

test.describe('P3.3 fulfillment pipeline (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P33=1, QA_P33_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  const login = async (page: any) => {
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
  };
  const saveBtn = (page: any) => page.getByRole('button', { name: /^(Create|Save Changes)$/ });
  const modalButtons = (page: any) => page.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });

  const createOrder = async (page: any, name: string, opts: { paid: boolean; priority: string; deliveryDate: string }) => {
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: /Create Order/i }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('confirmed');
    await page.locator('#field-priority').selectOption(opts.priority);
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await page.locator('#field-customerName').fill(name);
    await page.locator('#field-recipientName').fill('P33 Recipient');
    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    await page.locator('#field-deliveryDate').fill(opts.deliveryDate);
    await page.locator('#field-addressLine1').fill('4 Pipeline QA Blvd');
    await page.locator('#field-city').fill('New York');
    await page.locator('#field-state').fill('NY');
    await page.locator('#field-zipCode').fill('10004');
    if (opts.paid) {
      // Pay EXACTLY the grand total — the validator (correctly) rejects
      // overpayment. Read the rendered figure from the Items totals card.
      await page.getByRole('button', { name: 'Items', exact: true }).click();
      const totalText = await page.getByText('Grand Total:', { exact: true }).locator('xpath=following-sibling::div[1]').innerText();
      const grand = totalText.replace(/[^0-9.]/g, '');
      await page.getByRole('button', { name: 'Payment', exact: true }).click();
      await page.locator('#field-amountPaid').fill(grand);
      console.log(`[p33] paying exact grand total: ${grand}`);
    }
    await saveBtn(page).click();
    await expect(modalButtons(page)).toHaveCount(0, { timeout: 45_000 });
  };

  // Reload the dashboard, open the Urgent tab, return M's card.
  const urgentCard = async (page: any) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: /Urgent Shifts/i }).click();
    return page.locator('div', { hasText: M }).filter({ has: page.getByRole('button', { name: 'Resolve Status' }) }).last();
  };

  test('pipeline: per-transition persisted state + guards + double-action', async ({ page }) => {
    test.setTimeout(360_000);
    await login(page);

    await createOrder(page, M, { paid: true, priority: 'high', deliveryDate: TODAY });
    console.log('[p33] M created (confirmed, paid, priority high)');
    await createOrder(page, U, { paid: false, priority: 'normal', deliveryDate: '2026-07-20' });
    console.log('[p33] U created (confirmed, unpaid)');

    // ── Pipeline: each step = click Resolve → hard reload → rendered status ──
    const steps: Array<[string, string]> = [
      ['confirmed', 'in_design'],
      ['in_design', 'ready'],
      ['ready', 'out_for_delivery'],
    ];
    for (const [from, to] of steps) {
      const cardEl = await urgentCard(page);
      await expect(cardEl.getByText(`Status: ${from}`)).toBeVisible({ timeout: 20_000 });
      await cardEl.getByRole('button', { name: 'Resolve Status' }).click();
      await page.waitForTimeout(2500);
      const cardAfter = await urgentCard(page); // hard reload inside
      await expect(cardAfter.getByText(`Status: ${to}`)).toBeVisible({ timeout: 20_000 });
      console.log(`[p33] ${from} -> ${to} persisted (rendered after reload)`);
    }

    // ── Final transition DOUBLE-clicked: delivered once, audited once ──
    const cardEl = await urgentCard(page);
    await expect(cardEl.getByText('Status: out_for_delivery')).toBeVisible({ timeout: 20_000 });
    await cardEl.getByRole('button', { name: 'Resolve Status' }).dblclick();
    await page.waitForTimeout(4000);
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: /Urgent Shifts/i }).click();
    // Delivered orders leave the URGENT queue (they legitimately remain in
    // Today's Deliveries) — scope the absence check to Resolve-Status cards.
    await expect(
      page.locator('div', { hasText: M }).filter({ has: page.getByRole('button', { name: 'Resolve Status' }) })
    ).toHaveCount(0, { timeout: 20_000 });
    console.log('[p33] out_for_delivery -> delivered via DOUBLE-click (left urgent queue)');

    // ── Guards (durable UI evidence; Firestore proven by probe) ──
    await page.goto(`/admin/orders?search=${TOKEN}`);
    await page.waitForTimeout(4000);
    const uRow = page.locator('tr', { hasText: U }).first();
    await expect(uRow).toBeVisible({ timeout: 20_000 });
    await uRow.locator('select').selectOption('delivered'); // unpaid -> must be blocked
    await expect(uRow.locator('select')).toHaveValue('confirmed', { timeout: 15_000 });
    console.log('[p33] guard: unpaid U delivered attempt blocked (stays confirmed)');

    const mRow = page.locator('tr', { hasText: M }).first();
    await expect(mRow.locator('select')).toHaveValue('delivered');
    await mRow.locator('select').selectOption('cancelled'); // delivered -> cannot cancel
    await expect(mRow.locator('select')).toHaveValue('delivered', { timeout: 15_000 });
    console.log('[p33] guard: delivered M cancel attempt blocked (stays delivered)');
  });

  test('guards: post-delivery invariants on existing token orders', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    // Urgent queue no longer offers a Resolve card for delivered M
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: /Urgent Shifts/i }).click();
    await expect(
      page.locator('div', { hasText: M }).filter({ has: page.getByRole('button', { name: 'Resolve Status' }) })
    ).toHaveCount(0, { timeout: 20_000 });
    console.log('[p33] delivered M absent from urgent queue');

    await page.goto(`/admin/orders?search=${TOKEN}`);
    await page.waitForTimeout(4000);
    const uRow = page.locator('tr', { hasText: U }).first();
    await expect(uRow).toBeVisible({ timeout: 20_000 });
    await uRow.locator('select').selectOption('delivered'); // unpaid -> blocked
    await expect(uRow.locator('select')).toHaveValue('confirmed', { timeout: 15_000 });
    console.log('[p33] guard: unpaid U delivered attempt blocked (stays confirmed)');

    const mRow = page.locator('tr', { hasText: M }).first();
    await expect(mRow.locator('select')).toHaveValue('delivered');
    await mRow.locator('select').selectOption('cancelled'); // delivered -> cannot cancel
    await expect(mRow.locator('select')).toHaveValue('delivered', { timeout: 15_000 });
    console.log('[p33] guard: delivered M cancel attempt blocked (stays delivered)');
  });

  test('cleanupU: cancel all cancellable token orders (reverses posted GL)', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    const target = process.env.QA_P33_CLEANUP_TOKEN || TOKEN;
    await page.goto(`/admin/orders?search=${target}`);
    const rows = page.locator('tr', { hasText: `QA ${target}` });
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const sel = rows.nth(i).locator('select');
      const val = await sel.inputValue();
      if (val !== 'cancelled' && val !== 'delivered') { // delivered can't cancel (guard)
        await sel.selectOption('cancelled');
        await expect(sel).toHaveValue('cancelled', { timeout: 20_000 });
      }
    }
    await page.waitForTimeout(3000);
    console.log(`[p33] cleanup pass over ${n} row(s) for token ${target}`);
  });
});
