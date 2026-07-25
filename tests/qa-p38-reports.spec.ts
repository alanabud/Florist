import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * P3.8 QA — Reports / Exports / Settings. OPT-IN. Captures real PDF/Excel
 * exports (verified by a Python probe afterwards), round-trips the report
 * footer setting through the UI (and restores it), and proves language
 * persistence (UI + membership doc). Restores all settings — net zero.
 *
 *   QA_P38=1 QA_P38_TOKEN=<ts> npx playwright test tests/qa-p38-reports.spec.ts
 */
const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P38 === '1';
const TOKEN = process.env.QA_P38_TOKEN || '';
const ORIG_FOOTER = 'BloomPro Studio Demo - Executive Ledger Copy';
const QA_FOOTER = `P38 FOOTER QA ${TOKEN}`;
const OUT = 'test-results/p38';

test.describe.configure({ mode: 'serial' });

test.describe('P3.8 reports/exports/settings (opt-in, self-restoring)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P38=1, QA_P38_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  const login = async (p: any) => {
    await p.goto('/admin/login');
    await p.locator('input[type="email"]').fill(EMAIL!);
    await p.locator('input[type="password"]').fill(PASSWORD!);
    await p.locator('button[type="submit"]').click();
    await p.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
  };
  const saveFooter = async (p: any, text: string) => {
    await p.goto('/admin/settings');
    await p.getByRole('button', { name: /Default Language & Base Currency/i }).click();
    await p.waitForTimeout(800);
    const footer = p.getByText(/Report Footer/i).first().locator('xpath=following::input[1] | following::textarea[1]');
    await expect(footer.first()).toBeVisible({ timeout: 15_000 });
    await footer.first().fill(text);
    // Submit the form that contains the footer field.
    await footer.first().locator('xpath=ancestor::form[1]').getByRole('button', { name: /Save|Update/i }).first().click();
    await p.waitForTimeout(2500);
  };
  const download = async (p: any, buttonRe: RegExp, dest: string) => {
    const dl = p.waitForEvent('download', { timeout: 30_000 });
    await p.getByRole('button', { name: buttonRe }).click();
    const d = await dl;
    await d.saveAs(dest);
    const size = fs.statSync(dest).size;
    console.log(`[p38] downloaded ${dest} (${size} bytes)`);
    return size;
  };

  test('exports carry branding; footer + language round-trip', async ({ page }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT, { recursive: true });
    await login(page);

    // ── 1. Baseline exports from Orders ──
    await page.goto('/admin/orders');
    await page.waitForTimeout(2500);
    expect(await download(page, /Export PDF/i, `${OUT}/orders-baseline.pdf`)).toBeGreaterThan(2000);
    expect(await download(page, /Export Excel/i, `${OUT}/orders.xlsx`)).toBeGreaterThan(1000);

    // ── 2. Footer round-trip: set QA footer -> export -> restore ──
    await saveFooter(page, QA_FOOTER);
    console.log('[p38] QA footer saved');
    await page.goto('/admin/orders');
    await page.waitForTimeout(2500);
    expect(await download(page, /Export PDF/i, `${OUT}/orders-qafooter.pdf`)).toBeGreaterThan(2000);
    await saveFooter(page, ORIG_FOOTER);
    console.log('[p38] footer restored');

    // ── 3. Language persistence: Español -> reload -> sidebar localized ──
    await page.getByRole('button', { name: /^EN$/ }).click();
    await page.waitForTimeout(600);
    await page.getByText(/Español/i).first().click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.getByText('Pedidos', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    console.log('[p38] Español persisted across reload (sidebar: Pedidos)');
    // back to English
    await page.getByRole('button', { name: /^ES$/ }).click();
    await page.waitForTimeout(600);
    await page.getByText(/English/i).first().click();
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByText('Orders', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    console.log('[p38] English restored');

    // ── 4. Reports page renders without error boundary ──
    const errs: string[] = [];
    page.on('pageerror', (e: any) => errs.push(e.message));
    await page.goto('/admin/reports');
    await page.waitForTimeout(3000);
    expect(errs, errs.join('\n')).toHaveLength(0);
    console.log('[p38] Reports page rendered clean');
  });

  test('currency setting round-trips into exports', async ({ page }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(OUT, { recursive: true });
    await login(page);

    const setCurrency = async (code: string) => {
      await page.goto('/admin/settings');
      await page.getByRole('button', { name: /Default Language & Base Currency/i }).click();
      await page.waitForTimeout(1000);
      // Regional tab select order (verified live): 0 language, 1 base currency.
      const sel = page.locator('select').nth(1);
      await expect(sel).toBeVisible({ timeout: 15_000 });
      await sel.selectOption(code);
      await page.getByRole('button', { name: /Save Settings/i }).click();
      await page.waitForTimeout(2500);
      console.log(`[p38] currency set to ${code}`);
    };

    await setCurrency('EUR');
    await page.goto('/admin/orders');
    await page.waitForTimeout(2500);
    await download(page, /Export PDF/i, `${OUT}/orders-eur.pdf`);
    await setCurrency('USD'); // restore
    await page.goto('/admin/orders');
    await page.waitForTimeout(2000);
    await download(page, /Export PDF/i, `${OUT}/orders-usd-restored.pdf`);
  });
});
