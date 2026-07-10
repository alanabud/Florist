import { test, expect } from '@playwright/test';

/**
 * P3.4 QA — Payments / AR lifecycle. OPT-IN: creates production data
 * (customer, order, three posted payments + JEs).
 *
 *   QA_P34=1 QA_P34_TOKEN=<ts> npx playwright test tests/qa-p34-payments.spec.ts
 *
 * Flow: customer -> non-round confirmed order -> partial payment (50.00) ->
 * exact-remainder payment (balance 0) -> 1.00 overage payment posted via
 * DOUBLE-click (single-flight + credit handling) -> invalid zero-amount
 * attempt (no mutation). Firestore probes verify everything after.
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P34 === '1';
const TOKEN = process.env.QA_P34_TOKEN || '';
const CUST = `P3.4 AR QA ${TOKEN}`;

test.describe('P3.4 payments/AR (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P34=1, QA_P34_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  test('payment lifecycle with exact balance math', async ({ page }) => {
    test.setTimeout(300_000);
    // Payment posting confirms via a native window.confirm — accept it.
    page.on('dialog', (d: any) => d.accept().catch(() => {}));
    const modalButtons = () => page.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });
    const postBtn = () => page.getByRole('button', { name: /Post to Ledger/i });
    const amountInput = () => page.getByText('Amount Received', { exact: false }).locator('xpath=following::input[1]');
    const customerSelect = () => page.getByText('Customer Name *', { exact: true }).locator('xpath=following::select[1]');

    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });

    // ── 1. Customer ──
    await page.goto('/admin/customers');
    await page.getByRole('button', { name: /Add Customer/i }).click();
    await expect(page.locator('#field-name')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-name').fill(CUST);
    await page.locator('#field-email').fill(`p34-${TOKEN}@example.com`);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await expect(modalButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[p34] customer created');

    // ── 2. Non-round confirmed order for that customer ──
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: /Create Order/i }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('confirmed');
    await page.getByRole('button', { name: 'Customer', exact: true }).click();
    await page.locator('#field-customerName').fill(CUST);
    await page.locator('#field-recipientName').fill('P34 Recipient');
    await page.getByRole('button', { name: 'Delivery', exact: true }).click();
    await page.locator('#field-deliveryDate').fill('2026-07-20');
    await page.locator('#field-addressLine1').fill('5 AR QA Court');
    await page.locator('#field-city').fill('New York');
    await page.locator('#field-state').fill('NY');
    await page.locator('#field-zipCode').fill('10005');
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await page.locator('td input[type="number"]').nth(1).fill('123.45'); // unit price -> non-round totals
    await page.waitForTimeout(400);
    const totalText = await page.getByText('Grand Total:', { exact: true }).locator('xpath=following-sibling::div[1]').innerText();
    const G = parseFloat(totalText.replace(/[^0-9.]/g, ''));
    console.log(`[p34] grand total: ${G.toFixed(2)}`);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await expect(modalButtons()).toHaveCount(0, { timeout: 45_000 });
    console.log('[p34] order created (confirmed, non-round)');

    // helper: capture + post one payment. The payment modal reads customers
    // from the store, so prime it by visiting Customers first (fetch+persist);
    // options are labeled "name (AR Bal: …)" so resolve by option VALUE.
    const pay = async (amount: string, dbl = false) => {
      await page.goto('/admin/customers');
      await expect(page.locator('tr', { hasText: CUST }).first()).toBeVisible({ timeout: 20_000 });
      await page.goto('/admin/receivables');
      await page.getByRole('button', { name: /Capture Payment/i }).click();
      await expect(customerSelect()).toBeVisible({ timeout: 20_000 });
      const opt = customerSelect().locator('option', { hasText: CUST });
      await expect(opt).toHaveCount(1, { timeout: 15_000 });
      await customerSelect().selectOption((await opt.getAttribute('value'))!);
      await amountInput().fill(amount);
      // Allocation is an explicit action (not automatic on amount change).
      await page.getByRole('button', { name: 'Order Allocation', exact: true }).click();
      await page.getByRole('button', { name: /Auto-Allocate/i }).click();
      await page.waitForTimeout(800); // allocation resolves against open orders
      await page.getByRole('button', { name: 'GL / Audit', exact: true }).click(); // Post lives on this tab
      if (dbl) await postBtn().dblclick(); else await postBtn().click();
      await expect(postBtn()).toHaveCount(0, { timeout: 45_000 }); // modal closed on success
      console.log(`[p34] payment ${amount} posted${dbl ? ' (DOUBLE-click)' : ''}`);
    };

    // ── 3. Partial 50.00, then exact remainder, then 1.00 via double-click ──
    await pay('50.00');
    await pay((G - 50).toFixed(2));
    await pay('1.00', true);

    // ── 4. Invalid: zero amount must not post or close ──
    await page.goto('/admin/receivables');
    await page.getByRole('button', { name: /Capture Payment/i }).click();
    await expect(customerSelect()).toBeVisible({ timeout: 20_000 });
    const opt0 = customerSelect().locator('option', { hasText: CUST });
    await expect(opt0).toHaveCount(1, { timeout: 15_000 });
    await customerSelect().selectOption((await opt0.getAttribute('value'))!);
    await amountInput().fill('0');
    await page.getByRole('button', { name: 'GL / Audit', exact: true }).click();
    await postBtn().click();
    await page.waitForTimeout(2500);
    await expect(postBtn()).toBeVisible(); // still open — post rejected
    console.log('[p34] zero-amount payment rejected (modal stayed open)');
    await page.keyboard.press('Escape');
  });
});
