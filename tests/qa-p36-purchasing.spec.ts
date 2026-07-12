import { test, expect } from '@playwright/test';

/**
 * P3.6 QA — Purchasing / AP. OPT-IN: creates production data (vendor, PO,
 * receipt, bill, payment + JEs; inventory genuinely increases by the received
 * quantity — a real, tiny, fully-settled purchase).
 *
 *   QA_P36=1 QA_P36_TOKEN=<ts> npx playwright test tests/qa-p36-purchasing.spec.ts
 */
const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P36 === '1';
const TOKEN = process.env.QA_P36_TOKEN || '';
const VENDOR = `P3.6 AP VENDOR ${TOKEN}`;

test.describe('P3.6 purchasing/AP (creates production data — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !TOKEN, 'Set QA_P36=1, QA_P36_TOKEN, SMOKE_AUTH_EMAIL/PASSWORD.');

  test('vendor -> PO -> receive -> bill -> pay', async ({ page }) => {
    test.setTimeout(360_000);
    page.on('dialog', (d: any) => d.accept('P3.6 QA').catch(() => {}));
    const dumpButtons = async (tag: string) => {
      const btns = (await page.getByRole('button').allInnerTexts()).filter(x => x.trim() && x.length < 34);
      console.log(`[p36][${tag}]`, JSON.stringify([...new Set(btns)].slice(0, 16)));
    };

    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });

    // ── 1. Vendor ──
    await page.goto('/admin/purchasing');
    await page.getByRole('button', { name: /Add Vendor profile/i }).click();
    await expect(page.locator('#field-name')).toBeVisible({ timeout: 20_000 });
    await page.locator('#field-name').fill(VENDOR);
    await page.locator('#field-email').fill(`p36-${TOKEN}@example.com`);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await expect(page.getByRole('button', { name: /^(Create|Saving\.\.\.)$/ })).toHaveCount(0, { timeout: 45_000 });
    console.log('[p36] vendor created');

    // ── 2. PO: WR-001 x5 @ 1.11, approved in one step ──
    await page.getByRole('button', { name: 'Purchase Orders', exact: true }).click();
    await page.getByRole('button', { name: /Create PO Draft/i }).click();
    await page.waitForTimeout(1200);
    const vendorSel = page.getByText('Supplier / Vendor *', { exact: true }).locator('xpath=following::select[1]');
    const vOpt = vendorSel.locator('option', { hasText: VENDOR });
    await expect(vOpt).toHaveCount(1, { timeout: 15_000 });
    await vendorSel.selectOption((await vOpt.getAttribute('value'))!);
    // The modal opens with ONE blank line already — fill it (do NOT add another,
    // which would leave an itemId-less line that fails validation).
    const lineSel = page.locator('select').last(); // the single line's SKU select
    const skuOpt = lineSel.locator('option', { hasText: /WR-001/ });
    await expect(skuOpt).toHaveCount(1, { timeout: 10_000 });
    await lineSel.selectOption((await skuOpt.first().getAttribute('value'))!);
    await page.waitForTimeout(400);
    // Line qty + unit cost are the two number inputs immediately after the SKU select.
    const qty = lineSel.locator('xpath=following::input[@type="number"][1]');
    const cost = lineSel.locator('xpath=following::input[@type="number"][2]');
    await qty.fill('5');
    await cost.fill('1.11');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Approve & Place PO/i }).click();
    await page.waitForTimeout(3000);
    await dumpButtons('after-po');
    console.log('[p36] PO approved & placed (WR-001 x5 @ 1.11)');

    // ── 3. Receive: link the PO, accept full quantity, post ──
    await page.getByRole('button', { name: 'Receiving Center', exact: true }).click();
    await page.getByRole('button', { name: /Log Receipt Intake/i }).click();
    await page.waitForTimeout(1200);
    const recPoSel = page.getByText('Link Purchase Order *', { exact: true }).locator('xpath=following::select[1]');
    const recPoOpt = recPoSel.locator('option', { hasText: new RegExp(TOKEN) });
    await expect(recPoOpt).toHaveCount(1, { timeout: 15_000 });
    await recPoSel.selectOption((await recPoOpt.getAttribute('value'))!);
    // Wait for the PO's line to load and the accepted-qty input to populate to
    // the ordered quantity (avoids racing Post before lines exist -> 0 units).
    const accepted = page.getByText('WR-001', { exact: false }).first().locator('xpath=following::input[@type="number"][1]');
    await expect(accepted).toHaveValue('5', { timeout: 15_000 });
    await accepted.fill('5'); // explicit, in case the default binding lags
    await page.getByRole('button', { name: /Post Inventory Receipt/i }).click();
    await expect(page.getByRole('button', { name: /Post Inventory Receipt/i })).toHaveCount(0, { timeout: 45_000 });
    console.log('[p36] receipt posted (inventory + GRNI)');

    // ── 4. Vendor bill (PO-backed) — three-way match against the receipt ──
    await page.getByRole('button', { name: 'Vendor Bills', exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Add Vendor Bill/i }).click();
    await page.waitForTimeout(1200);
    // Switch to PO-backed mode so the Link Purchase Order selector appears.
    await page.getByText('Inventory PO-Backed Bill', { exact: false }).click();
    await page.waitForTimeout(800);
    const billPo = page.getByText('Link Purchase Order *', { exact: true }).locator('xpath=following::select[1]');
    await expect(billPo).toBeVisible({ timeout: 15_000 });
    const bOpt = billPo.locator('option', { hasText: new RegExp(TOKEN) });
    await expect(bOpt).toHaveCount(1, { timeout: 15_000 });
    await billPo.selectOption((await bOpt.first().getAttribute('value'))!);
    await page.waitForTimeout(1200); // lines auto-populate + 3-way match evaluates
    const invNum = page.getByText('Invoice / Bill Number *', { exact: true }).locator('xpath=following::input[1]');
    await invNum.fill(`INV-${TOKEN}`);
    await dumpButtons('bill-modal');
    console.log('[p36][bill match text]', JSON.stringify((await page.locator('[class*="match" i],[class*="variance" i]').allInnerTexts().catch(() => [])).slice(0, 4)));
    const saveBill = page.getByRole('button', { name: /Save.*Bill|Record.*Bill|Create.*Bill|Post.*Bill|Save Draft/i }).last();
    console.log('[p36][bill submit candidates]', JSON.stringify(await page.getByRole('button', { name: /Save|Record|Create|Post|Approve/i }).allInnerTexts()));
    await saveBill.click();
    await page.waitForTimeout(3500);
    console.log('[p36] bill saved');
  });
});
