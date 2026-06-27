# Firebase App Check — Rollout Plan (BloomPro Studio / Florist)

**Status: planning only.** This document scopes how to add App Check safely. It
does **not** enable enforcement and does **not** change runtime behavior. Code
integration is a separate, later step (P1.7) and enforcement is later still.

App Check attests that traffic to Firebase backends originates from *your* app,
blocking abusive/non-app traffic (scraping, credential stuffing, billing abuse).
It complements — does not replace — Firestore/Storage security rules and the
authenticated cross-company isolation tests already in place.

## 1. Current Firebase surface (from `src/firebase/config.ts`)

| Product | Initialized | Used | Needs App Check enforcement eventually |
|---------|-------------|------|----------------------------------------|
| Firebase App | yes | — | — |
| **Auth** | `getAuth` | yes (email/password, Google, Microsoft) | App Check supports Auth abuse protection (optional) |
| **Firestore** | `getFirestore` | yes (primary data layer) | **Yes — highest priority** |
| **Storage** | `getStorage` | initialized, no operations (deny-all rules) | Yes, once a real Storage feature ships |
| **Analytics** | `getAnalytics` | browser only | n/a (not an App Check-enforced resource) |
| Hosting | `firebase.json` | yes (SPA on `florist-d5026.web.app`) | serves the app; not itself App Check-gated |

Config is provided via `VITE_FIREBASE_*` env vars (public web keys). Hosting is a
single-page app with a catch-all rewrite to `index.html`.

## 2. Provider choice

Web apps use a **reCAPTCHA** attestation provider:

- **reCAPTCHA Enterprise** — recommended for production (better risk scoring,
  quotas, and Google support). Requires a Cloud project with reCAPTCHA Enterprise
  enabled and a site key.
- **reCAPTCHA v3** — simpler, free tier; acceptable to start.

Both use a **public site key** (safe to ship in the bundle / `.env`). Decision:
start the pilot on **reCAPTCHA v3**, plan to move to **Enterprise** before
production enforcement if abuse volume warrants it.

> Note: `ReCaptchaEnterpriseProvider` / `ReCaptchaV3Provider` come from
> `firebase/app-check`. The site key is **not** a secret; the App Check **debug
> token** (below) is sensitive-ish and must never be committed.

## 3. Local / dev behavior

- Use the **App Check debug token** so `localhost` and CI work without solving
  reCAPTCHA: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` (dev only) to print a
  debug token on first load, then register that token in the Firebase console
  (App Check → Apps → Manage debug tokens).
- Debug tokens are **per-developer / per-CI** and must be provided via local env
  or CI secrets — never hardcoded or committed.
- `.env.example` carries only the **public site key placeholder**
  (`VITE_FIREBASE_APPCHECK_SITE_KEY`); debug tokens are not placed there.

## 4. Staging / pilot rollout (no enforcement)

1. Add `initializeAppCheck(...)` in `src/firebase/config.ts` guarded so a missing
   site key is a no-op (P1.7 — separate change).
2. Deploy with App Check **registered but UNENFORCED** (monitoring mode).
3. Watch the **App Check metrics** dashboard for each product (Firestore, Storage)
   for ≥ 1–2 weeks: confirm a high % of *verified* requests from the real app and
   identify any legitimate clients that would be blocked.
4. Register debug tokens for every dev machine and the CI/Playwright runner so the
   authenticated smoke keeps producing verified traffic.

## 5. Production enforcement checklist

Only after monitoring shows near-100% verified legitimate traffic:

- [ ] reCAPTCHA (v3 or Enterprise) site key configured in prod env
- [ ] App Check initialized in the deployed bundle (verified via metrics)
- [ ] Debug tokens registered for CI / Playwright smoke runner
- [ ] `npm run smoke:auth` passes against a **monitoring-mode** deploy first
- [ ] Enforcement enabled **per-product, one at a time**: Firestore first, then
      Storage (when a Storage feature exists)
- [ ] Post-enforcement: re-run `npm run smoke:auth` and confirm dashboard +
      reconciliation flows still work; watch error rates for 24–48h

## 6. Rollback plan

- Enforcement is toggled **per-product in the Firebase console** and takes effect
  quickly — the immediate rollback is to **switch the product back to
  "unenforced" (monitoring)**; no redeploy required.
- If the app-side `initializeAppCheck` call itself causes issues, the guarded
  integration (P1.7) makes it a no-op when the site key env var is absent, so a
  config rollback (unset `VITE_FIREBASE_APPCHECK_SITE_KEY` + redeploy) fully
  disables it client-side.
- Keep the previous release tag available for `firebase hosting:rollback`.

## 7. Smoke-test requirements

App Check enforcement can break automated browsers (reCAPTCHA may distrust
headless/automation traffic). Before enforcing:

- Register an App Check **debug token** for the Playwright/CI environment and
  inject it via env (not committed), so `smoke:auth` produces verified tokens.
- Add `smoke:auth` against a monitoring-mode deploy to the release checklist
  **before** flipping enforcement.
- Treat a smoke failure that correlates with enforcement as a **rollback trigger**
  (return the product to monitoring) — the manual owner smoke remains the source
  of truth.

## 8. Sequencing

| Step | Scope | State |
|------|-------|-------|
| **P1.6** | This document (planning) | ← current |
| **P1.7** | Guarded `initializeAppCheck` integration (no-op without site key), `.env.example` wired, still **no enforcement** | next, optional |
| Pilot | Deploy in monitoring mode, watch metrics | owner-approved |
| Enforce | Per-product enforcement, Firestore first | owner-approved release |

Nothing in this plan is executed until explicitly approved; enabling enforcement
is an owner decision made against live App Check metrics.
