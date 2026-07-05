import { test, expect } from '@playwright/test';

/**
 * P3.2 re-verification — cancel-of-posted-order must reverse GL (P3.2-DEF-2 fix)
 * and duplicates must carry a boolean hasBackorder. OPT-IN: creates production
 * data (order + JE + reversal JE), cleaned by the P3.2 cleanup probe.
 *
 *   QA_P32=1 QA_P32_TOKEN=<ts> npx playwright test tests/qa-p32-reversal.spec.ts
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P32 === '1';
const TOKEN = process.env.QA_P32_TOKEN || '';
const CUSTOMER = `P3.2 REVERSAL QA ${TOKEN}`;
const ORDERS_URL = `/admin/orders?search=${TOKEN}`;

test.describe('P3.2 reversal re-verification (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P32=1, QA_P32_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  test('create -> duplicate -> cancel reverses posted GL', async ({ page }) => {
    test.setTimeout(240_000);
    const saveBtn = () => page.getByRole('button', { name: /^(Create|Save Changes)$/ });
    const modalButtons = () => page.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });

    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });

    // Create a minimal, non-backordered CONFIRMED order (creation GL-posts).
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: /Create Order/i }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('confirmed');
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await page.locator('#field-customerName').fill(CUSTOMER);
    await page.locator('#field-recipientName').fill('P32R Recipient');
    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    await page.locator('#field-deliveryDate').fill('2026-07-12');
    await page.locator('#field-addressLine1').fill('3 Reversal QA Road');
    await page.locator('#field-city').fill('New York');
    await page.locator('#field-state').fill('NY');
    await page.locator('#field-zipCode').fill('10003');
    await saveBtn().click(); // default line qty 1 — no backorder
    await expect(modalButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32r] confirmed order created (GL posts on create)');

    // Duplicate it (from edit modal) — probe will assert hasBackorder === false (boolean).
    await page.goto(ORDERS_URL);
    const row = page.locator('tr', { hasText: CUSTOMER }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Duplicate Order/i }).click();
    await expect(modalButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[p32r] duplicated');

    // Cancel every token order via the guarded dropdown. The ORIGINAL is
    // GL-posted: with the normalizer fix its store copy retains journalEntryId,
    // so the cancel path must create a reversal JE (probe verifies).
    await page.goto(ORDERS_URL);
    await page.waitForTimeout(4000);
    const rows = page.locator('tr', { hasText: CUSTOMER });
    await expect(rows).toHaveCount(2, { timeout: 20_000 });
    for (let i = 0; i < 2; i++) {
      const sel = rows.nth(i).locator('select');
      if (await sel.inputValue() !== 'cancelled') {
        await sel.selectOption('cancelled');
        await expect(sel).toHaveValue('cancelled', { timeout: 20_000 });
      }
    }
    await page.waitForTimeout(3000);
    console.log('[p32r] both cancelled via UI');
  });
});
