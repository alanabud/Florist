# App Check Pilot Monitoring Checklist (BloomPro Studio / Florist)

Operational runbook for the **monitoring-only** App Check pilot. Enforcement
stays **OFF** for the entire pilot. This complements:
- `docs/appcheck-rollout-plan.md` (strategy)
- the guarded client integration shipped in P1.7 (`src/firebase/config.ts`)

> **Enforcement is OFF.** Nothing in this checklist enables enforcement. Flipping
> enforcement is a separate, explicitly-approved owner action made against live
> metrics. The client integration is a no-op until `VITE_FIREBASE_APPCHECK_SITE_KEY`
> is set, so registering the provider below does not, by itself, block any traffic.

## A. Firebase Console — provider & site key

1. Firebase Console → **App Check** → **Apps** → select the web app.
2. Register the **reCAPTCHA v3** provider (pilot choice; Enterprise later).
   - In reCAPTCHA admin, create a **v3** site key for the app's domains.
   - The site key is **public** — store it as `VITE_FIREBASE_APPCHECK_SITE_KEY`
     in the deploy environment (not a secret; never store the reCAPTCHA *secret*
     key in this repo or `.env`).
3. Paste the site key into the App Check provider config and save.
4. Set a reasonable **token TTL** (default is fine for the pilot).

## B. Allowed domains

- [ ] reCAPTCHA site key lists every domain that serves the app:
      `florist-d5026.web.app`, `florist-d5026.firebaseapp.com`, `localhost`,
      and any custom/staging domain.
- [ ] Firebase Auth **Authorized domains** already include these (unchanged here).
- [ ] No wildcard/extra domains beyond what is actually used.

## C. Enable monitoring / metrics (NOT enforcement)

1. App Check → **APIs** (or **Metrics**) tab → for each product, leave the
   enforcement toggle **OFF** (state: *Unenforced / Monitoring*).
2. Confirm metrics are being collected for:
   - [ ] **Cloud Firestore** (primary)
   - [ ] **Cloud Storage** (will read ~0 verified until a Storage feature ships)
3. Review metrics for **≥ 1–2 weeks**:
   - [ ] % **verified** requests trends toward ~100% of legitimate app traffic
   - [ ] **Outdated/invalid/unverified** requests are understood (bots vs. real
         clients missing tokens)
   - [ ] No legitimate client (CI/Playwright, internal tools) is producing
         unverified traffic that enforcement would later block

## D. Keep enforcement OFF during pilot

- [ ] Firestore enforcement = **OFF** for the whole pilot
- [ ] Storage enforcement = **OFF**
- [ ] Auth (optional App Check) = **OFF**
- [ ] Any "enforce" action requires explicit owner approval + a release (out of
      scope for the pilot)

## E. Local / staging debug-token procedure (instructions only)

> Never commit a debug token. Tokens are per-developer / per-CI and live in local
> env or CI secrets only.

1. In the target env's `.env` (gitignored), set:
   - `VITE_FIREBASE_APPCHECK_SITE_KEY=<public site key>`
   - `VITE_FIREBASE_APPCHECK_DEBUG=true` (dev only)
2. Run the app (`npm run dev`); the console prints an **App Check debug token**.
3. Firebase Console → App Check → **Apps → Manage debug tokens** → add that token
   with a descriptive name (e.g. `dev-<machine>`, `ci-playwright`).
4. For the **Playwright smoke** runner, register its debug token and inject the
   two env vars via CI secrets so `smoke:auth` produces verified traffic. Until
   enforcement is ON this is optional, but set it up **before** any enforcement.
5. Rotate/remove debug tokens when a machine or CI runner is decommissioned.

## F. Pilot-readiness acceptance criteria

- [ ] **Keyless** local/dev path still **no-ops** (App Check skipped when
      `VITE_FIREBASE_APPCHECK_SITE_KEY` is unset) — no crash
- [ ] **Build with** the site key **succeeds**
- [ ] `npm run verify:prod` is **green**
- [ ] **No debug tokens or secrets** committed (only public placeholders in
      `.env.example`)
- [ ] Enforcement is **explicitly OFF** in the console for all products
- [ ] Metrics dashboard shows incoming App Check data for Firestore

## G. Rollback / disable procedure

- **Fastest:** in App Check console, ensure each product stays **Unenforced**
  (monitoring). If anything was enforced by mistake, switch it back to
  **Unenforced** — effective quickly, **no redeploy**.
- **Client-side disable:** unset `VITE_FIREBASE_APPCHECK_SITE_KEY` in the deploy
  env and redeploy hosting — the guarded `initializeAppCheck` becomes a no-op, so
  the app stops requesting tokens entirely.
- **Provider removal:** delete the reCAPTCHA provider registration in the console
  to stop attestation; keep the previous release tag for `firebase hosting:rollback`.
- Treat any smoke/app failure that correlates with App Check as a rollback
  trigger; the owner manual smoke remains the source of truth.

## H. Exit criteria (to consider enforcement later — separate approval)

- [ ] ≥ 1–2 weeks of monitoring with near-100% verified legitimate traffic
- [ ] All dev/CI clients have registered debug tokens and produce verified traffic
- [ ] `smoke:auth` passes against a monitoring-mode deploy
- [ ] Owner sign-off to enforce **per-product, Firestore first** (new release)
