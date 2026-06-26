# Authenticated Smoke Test (`npm run smoke:auth`)

A deterministic, repeatable Playwright smoke test for the authenticated admin
flow. It replaces the manual "log in and click around" check that depended on a
live browser session being shared with an agent — so release verification no
longer hangs on a human-driven login.

## What it verifies (the 7 release smoke checks)

1. Admin login succeeds (redirects to `/admin/dashboard`, not back to `/admin/login`)
2. Dashboard renders the **Operations Command Center**
3. No React error boundary ("Something went wrong")
4. Company context resolves (not stuck on "Loading company context")
5. Reconciliation Center opens
6. Audit modal: default **End Date is today** (never a future date), and a
   future End Date shows **"End date cannot be in the future."** and disables
   Start Scan
7. No critical app console/runtime errors during the flow

## Prerequisites

### 1. A dedicated test account

Use a **dedicated** Email/Password account — never a real owner account. It must
have an **active `DEFAULT_COMPANY` membership**. Provision one with the Admin SDK:

```bash
node scripts/bootstrap-default-company-user.js smoke-test-user@example.com owner
```

(The account must already exist in Firebase Auth — have it sign in once, or create
it via the Firebase console / Email-Password sign-up, then run the script.)

Also ensure **Email/Password** is enabled in Firebase Auth and that the smoke
account's UI language resolves to English (the assertions match English copy).

### 2. Local environment variables (gitignored `.env`)

Add to your **`.env`** (never to `.env.example`, never committed):

```
SMOKE_AUTH_EMAIL=smoke-test-user@example.com
SMOKE_AUTH_PASSWORD=your_test_account_password
# Optional — defaults to the live hosting URL when unset:
SMOKE_BASE_URL=https://florist-d5026.web.app
```

In CI, provide these as **GitHub Actions secrets** instead of a file.

### 3. Browser binary (one-time)

```bash
npx playwright install chromium
```

## Running

```bash
npm run smoke:auth
```

- If `SMOKE_AUTH_EMAIL` / `SMOKE_AUTH_PASSWORD` are not set, the test **skips**
  with a clear message (it does not fail the build).
- Target a different environment with `SMOKE_BASE_URL` (e.g. a preview deploy or
  `http://localhost:5173` after `npm run dev`).

## Notes

- Credentials are read **only** from the gitignored `.env` (loaded by
  `playwright.config.ts`) or real environment variables — never hardcoded.
- Playwright artifacts (`test-results/`, `playwright-report/`, traces) are
  gitignored.
- This is **test-only infrastructure**; it does not change product behavior.
