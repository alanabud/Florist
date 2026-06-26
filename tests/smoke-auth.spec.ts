import { test, expect, type Page } from '@playwright/test';

/**
 * Deterministic authenticated smoke for the v1.6.1 release.
 *
 * Replaces the manual "log in and click around" check that depended on a live
 * browser session being shared with an agent. Credentials are read from the
 * gitignored .env (SMOKE_AUTH_EMAIL / SMOKE_AUTH_PASSWORD) — never hardcoded.
 * Use a dedicated test account that has an ACTIVE DEFAULT_COMPANY membership.
 *
 * Covers the 7 release smoke checks:
 *   1. Admin login succeeds (redirect to /admin/dashboard, not back to /login)
 *   2. Dashboard renders the Operations Command Center
 *   3. No React error boundary ("Something went wrong")
 *   4. Company context resolves (not stuck on "Loading company context")
 *   5. Reconciliation Center opens
 *   6. Audit modal: default end date is today (not future) and a future end
 *      date shows the visible validation reason + disables Start Scan
 *   7. No critical app console/runtime errors during the flow
 */

const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Errors that are environmental noise rather than app failures.
//
// Firestore "Missing or insufficient permissions" is intentionally ignored:
// the app makes role-gated reads (e.g. journalEntries is manager+ only) and
// handles denials gracefully, so they are expected and vary by account role.
// A denial that actually breaks the app surfaces structurally instead — the
// dashboard fails to render or the error boundary appears (steps 2–6), and any
// UNCAUGHT exception is captured as a `pageerror` (always treated as critical).
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /favicon/i,
  /net::ERR_/i,
  /Failed to load resource/i,
  /status of 4\d\d/i,
  /analytics|measurement|gtag/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /Missing or insufficient permissions/i,
  /permission-denied/i,
];

function attachErrorCollector(page: Page, sink: string[]) {
  page.on('pageerror', (err) => sink.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(`console.error: ${msg.text()}`);
  });
}

function criticalErrors(all: string[]): string[] {
  return all.filter((e) => !IGNORED_ERROR_PATTERNS.some((p) => p.test(e)));
}

test.describe('v1.6.1 authenticated smoke', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Set SMOKE_AUTH_EMAIL and SMOKE_AUTH_PASSWORD in .env (dedicated test account with an active DEFAULT_COMPANY membership) to run the authenticated smoke.'
  );

  test('7-step authenticated smoke', async ({ page }) => {
    const errors: string[] = [];
    attachErrorCollector(page, errors);

    // ── Step 1: admin login ──
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(EMAIL!);
    await page.locator('input[type="password"]').fill(PASSWORD!);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 45_000 });
    expect(page.url(), 'should land on the dashboard, not bounce back to login').toContain('/admin/dashboard');

    // ── Step 2: dashboard renders ──
    await expect(page.getByText('Operations Command Center')).toBeVisible({ timeout: 30_000 });

    // ── Step 3: no error boundary ──
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    // ── Step 4: company context resolved (not stuck loading) ──
    await expect(page.getByText(/Loading company context/i)).toHaveCount(0);

    // ── Step 5: Reconciliation Center opens ──
    await page.goto('/admin/reconciliation');
    await expect(page.getByRole('heading', { name: /AI Reconciliation/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    // ── Step 6: audit modal default date + validation ──
    await page.getByRole('button', { name: /Trigger New Audit/i }).click();
    await expect(page.getByText('Configure Audit Parameters')).toBeVisible();

    const endDate = page.locator('input[type="date"]').nth(1);
    await expect(endDate, 'default end date must be today, never in the future').toHaveValue(todayStr());

    const startScan = page.getByRole('button', { name: /Start Scan/i });
    await expect(startScan, 'Start Scan should be enabled for the valid default range').toBeEnabled();

    // Force a future end date -> visible reason + disabled button.
    const futureYear = new Date().getFullYear() + 1;
    await endDate.fill(`${futureYear}-12-31`);
    await expect(page.getByText('End date cannot be in the future.')).toBeVisible();
    await expect(startScan, 'Start Scan must disable when end date is in the future').toBeDisabled();

    // ── Step 7: no critical console/runtime errors ──
    const critical = criticalErrors(errors);
    expect(critical, `Critical app errors during smoke:\n${critical.join('\n') || '(none)'}`).toHaveLength(0);
  });
});
