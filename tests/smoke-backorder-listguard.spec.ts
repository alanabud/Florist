import { test, expect } from '@playwright/test';

/**
 * Focused, NON-DESTRUCTIVE live check for the Orders-list status-dropdown
 * backorder guard (#6): flipping a draft order that has an unreasoned
 * backordered line to a non-draft status must be blocked, leaving it draft.
 *
 * Reuses an EXISTING draft (matched by a unique customerName fragment) so it
 * creates no data. Opt-in via BACKORDER_SMOKE=1.
 *
 *   BACKORDER_SMOKE=1 LISTGUARD_ORDER_MATCH="23:03:00" \
 *   npx playwright test tests/smoke-backorder-listguard.spec.ts
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
const RUN = process.env.BACKORDER_SMOKE === '1';
const MATCH = process.env.LISTGUARD_ORDER_MATCH || '';

test.describe('backorder list-dropdown guard (non-destructive)', () => {
  test.skip(!RUN || !EMAIL || !PASSWORD || !MATCH,
    'Set BACKORDER_SMOKE=1, SMOKE_AUTH_EMAIL/PASSWORD and LISTGUARD_ORDER_MATCH (a unique customerName fragment of an existing draft w/ unreasoned backorder).');

  test('list draft->confirmed blocked while backorder reason missing', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });

    await page.goto(`/admin/orders?search=${encodeURIComponent(MATCH)}`);
    const row = page.locator('tr', { hasText: MATCH }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    const select = row.locator('select');
    await expect(select).toHaveValue('draft'); // precondition

    await select.selectOption('confirmed');
    // Guard throws in updateOrderStatus -> handleStatusChange shows an error and
    // does not mutate status, so the controlled <select> snaps back to 'draft'.
    await expect(select).toHaveValue('draft', { timeout: 15_000 });
    console.log('[listguard] draft->confirmed blocked; status stayed draft');
  });
});
