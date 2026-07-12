import { test, expect } from '@playwright/test';

/**
 * P3.7 QA — Inventory truth. OPT-IN: mutates real inventory + posts adjustment
 * JEs (no new customer/vendor data). Uses WR-001. Firestore probes verify.
 *
 *   QA_P37=1 npx playwright test tests/qa-p37-inventory.spec.ts
 *
 * Three adjustments against WR-001, all persisted-state + JE verified by the
 * companion probe: spoilage -5 (also returns the P3.6 receipt's 5 stems to
 * true stock), found-correction +3, shrinkage -3 — net zero, so the spec is
 * self-cleaning and leaves WR-001 exactly where P3.7 began.
 */
const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.QA_P37 === '1';

test.describe('P3.7 inventory truth (mutates real inventory — opt-in)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD, 'Set QA_P37=1, SMOKE_AUTH_EMAIL/PASSWORD.');

  test('adjustments: spoilage, correction, shrinkage — persisted + journaled', async ({ page }) => {
    test.setTimeout(240_000);
    page.on('dialog', (d: any) => d.accept().catch(() => {}));

    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });

    const adjust = async (dirIndex: number, type: string, qty: string, reason: string) => {
      await page.goto('/admin/inventory');
      await page.waitForTimeout(1500);
      const row = page.locator('tr', { hasText: 'WR-001' }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole('button', { name: /^Adjust$/ }).click();
      // Wait for the modal to be fully mounted before touching its controls.
      await expect(page.getByRole('button', { name: /Post Adjustment/i })).toBeVisible({ timeout: 20_000 });
      const dirSel = page.getByText('DIRECTION', { exact: false }).locator('xpath=following::select[1]');
      await expect(dirSel).toBeVisible({ timeout: 10_000 });
      await dirSel.selectOption({ index: dirIndex }); // 0 = Decrease, 1 = Increase
      const typeSel = page.getByText('ADJUSTMENT TYPE', { exact: false }).locator('xpath=following::select[1]');
      await typeSel.selectOption({ label: type });
      await page.locator('input[type="number"]').last().fill(qty);
      const reasonBox = page.getByText('REASON', { exact: false }).locator('xpath=following::textarea[1]')
        .or(page.getByText('REASON', { exact: false }).locator('xpath=following::input[1]'));
      await reasonBox.first().fill(reason);
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Post Adjustment/i }).click();
      await expect(page.getByRole('button', { name: /Post Adjustment/i })).toHaveCount(0, { timeout: 45_000 });
    };

    await adjust(0, 'Spoilage', '5', 'P3.7 QA spoilage — wilted stems');
    console.log('[p37] spoilage -5 posted');
    await adjust(0, 'Shrinkage', '3', 'P3.7 QA shrinkage — damaged in cooler');
    console.log('[p37] shrinkage -3 posted');
    await adjust(1, 'Correction / Count', '8', 'P3.7 QA correction — recount found stock (net-zero restore)');
    console.log('[p37] correction +8 posted (net zero — WR-001 restored)');

    // ── Negative-stock guard: a decrease larger than on-hand must be blocked ──
    await page.goto('/admin/inventory');
    await page.waitForTimeout(1500);
    await page.locator('tr', { hasText: 'WR-001' }).first().getByRole('button', { name: /^Adjust$/ }).click();
    await expect(page.getByRole('button', { name: /Post Adjustment/i })).toBeVisible({ timeout: 20_000 });
    await page.getByText('DIRECTION', { exact: false }).locator('xpath=following::select[1]').selectOption({ index: 0 });
    await page.getByText('ADJUSTMENT TYPE', { exact: false }).locator('xpath=following::select[1]').selectOption({ label: 'Write-Off' });
    await page.locator('input[type="number"]').last().fill('999999');
    await page.getByText('REASON', { exact: false }).locator('xpath=following::textarea[1]')
      .or(page.getByText('REASON', { exact: false }).locator('xpath=following::input[1]')).first().fill('P3.7 QA over-decrease (must be blocked)');
    await page.getByRole('button', { name: /Post Adjustment/i }).click();
    await page.waitForTimeout(2500);
    await expect(page.getByRole('button', { name: /Post Adjustment/i })).toBeVisible(); // modal open — rejected
    console.log('[p37] negative-stock guard: over-decrease blocked (modal stayed open)');
  });
});
