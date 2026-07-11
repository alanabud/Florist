import { test, expect } from '@playwright/test';

/**
 * P3.5 QA — Finance / GL. OPT-IN: creates production data (orders, JEs,
 * reversals). Proves journal balance+linkage, revenue reversal on cancel,
 * COGS posting at delivery + reversal via the form button, and the
 * form status-edit guard (P3.5-DEF-1). Firestore probes verify after.
 *
 *   QA_P35=1 QA_P35_TOKEN=<ts> npx playwright test tests/qa-p35-finance.spec.ts
 */
const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P35 === '1';
const TOKEN = process.env.QA_P35_TOKEN || '';
const REV = `P3.5 REVENUE QA ${TOKEN}`;   // will be cancelled -> revenue JE reversed
const COGS = `P3.5 COGS QA ${TOKEN}`;      // delivered -> COGS posts -> form reverses COGS
const GUARD = `P3.5 GUARD QA ${TOKEN}`;    // unpaid; form save to 'delivered' must be blocked

test.describe.configure({ mode: 'serial' });

test.describe('P3.5 finance/GL (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P35=1, QA_P35_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  const modalButtons = (p: any) => p.getByRole('button', { name: /^(Create|Save Changes|Saving\.\.\.)$/ });
  const login = async (p: any) => {
    await p.goto('/admin/login');
    await p.locator('input[type="email"]').fill(EMAIL!);
    await p.locator('input[type="password"]').fill(PASSWORD!);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
  };
  const createOrder = async (p: any, name: string, opts: { paid: boolean }) => {
    await p.goto('/admin/orders');
    await p.getByRole('button', { name: /Create Order/i }).click();
    await expect(p.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await p.locator('#field-status').selectOption('confirmed');
    await p.getByRole('button', { name: 'Customer', exact: true }).click();
    await p.locator('#field-customerName').fill(name);
    await p.locator('#field-recipientName').fill('P35 Recipient');
    await p.getByRole('button', { name: 'Delivery', exact: true }).click();
    await p.locator('#field-deliveryDate').fill('2026-07-22');
    await p.locator('#field-addressLine1').fill('6 GL QA Way');
    await p.locator('#field-city').fill('New York');
    await p.locator('#field-state').fill('NY');
    await p.locator('#field-zipCode').fill('10006');
    await p.getByRole('button', { name: 'Items', exact: true }).click();
    await p.locator('td input[type="number"]').nth(1).fill('77.77'); // non-round unit price
    await p.waitForTimeout(400);
    if (opts.paid) {
      const g = await p.getByText('Grand Total:', { exact: true }).locator('xpath=following-sibling::div[1]').innerText();
      await p.getByRole('button', { name: 'Payment', exact: true }).click();
      await p.locator('#field-amountPaid').fill(g.replace(/[^0-9.]/g, ''));
    }
    await p.getByRole('button', { name: /^Create$/ }).click();
    await expect(modalButtons(p)).toHaveCount(0, { timeout: 45_000 });
  };

  test('journal integrity, reversals, COGS, and status-edit guard', async ({ page }) => {
    test.setTimeout(300_000);
    // Accept confirms AND supply text for the COGS-reversal window.prompt
    // (accept() alone returns '' which the reason guard rejects).
    page.on('dialog', (d: any) => d.accept('P3.5 QA COGS reversal').catch(() => {}));
    await login(page);

    await createOrder(page, REV, { paid: false });
    console.log('[p35] revenue order created (confirmed, GL posts)');
    await createOrder(page, COGS, { paid: true });
    console.log('[p35] COGS order created (paid, confirmed)');
    await createOrder(page, GUARD, { paid: false });
    console.log('[p35] guard order created (unpaid, confirmed)');

    // ── Revenue reversal: cancel REV via list dropdown -> reversal JE ──
    await page.goto(`/admin/orders?search=${TOKEN}`);
    const revRow = page.locator('tr', { hasText: REV }).first();
    await expect(revRow).toBeVisible({ timeout: 20_000 });
    await revRow.locator('select').selectOption('cancelled');
    await expect(revRow.locator('select')).toHaveValue('cancelled', { timeout: 20_000 });
    console.log('[p35] REV cancelled (revenue reversal path)');

    // ── COGS: deliver COGS order (paid), then reverse COGS via the form ──
    const cogsRow = page.locator('tr', { hasText: COGS }).first();
    await cogsRow.locator('select').selectOption('delivered');
    await expect(cogsRow.locator('select')).toHaveValue('delivered', { timeout: 20_000 });
    await page.waitForTimeout(2500); // COGS posts at delivery
    console.log('[p35] COGS order delivered (COGS should post)');
    // Reverse COGS from the order form (GL/Audit area). dialog handler answers the reason prompt.
    await page.goto(`/admin/orders?search=${TOKEN}`);
    await page.locator('tr', { hasText: COGS }).first().getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'GL / Audit', exact: true }).click(); // Reverse COGS lives here
    const revBtn = page.getByRole('button', { name: /Reverse COGS Posting/i });
    await expect(revBtn).toBeVisible({ timeout: 10_000 });
    await revBtn.click();
    await page.waitForTimeout(3000); // reversal transaction (COGS JE + inventory restore)
    console.log('[p35] Reverse COGS invoked');
    await page.keyboard.press('Escape');

    // ── Status-edit guard (P3.5-DEF-1): edit GUARD (unpaid) -> set Delivered
    // -> Save. Must be blocked (unpaid delivered guard); modal stays open. ──
    await page.goto(`/admin/orders?search=${TOKEN}`);
    await page.locator('tr', { hasText: GUARD }).first().getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('#field-status')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-status').selectOption('delivered');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.waitForTimeout(3000);
    await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible(); // still open — blocked
    console.log('[p35] status-edit guard: unpaid->delivered save blocked (modal open)');
  });
});
