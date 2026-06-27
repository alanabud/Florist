# Production-Readiness Report — BloomPro Studio (Florist)

Status snapshot captured during the production-hardening pass that follows the
`v1.6.1` release. This is an **audit + plan** document; it records findings and a
prioritized roadmap. It does not, by itself, change product behavior.

## Foundation already in place

Order-to-cash, payments, AR statements, procure-to-pay, inventory/COGS,
multi-company (`companyId` isolation), multi-language (EN/ES/FR/NL), QA checks,
AI reconciliation / control center, and an authenticated Playwright smoke.

## Completed in this hardening stack (local commits on top of `v1.6.1`)

| Commit | What |
|--------|------|
| `e265377` | Deterministic authenticated Playwright smoke (`npm run smoke:auth`) |
| `d6191a7` | Phase 1 release discipline: `verify:prod` gate, release checklist, in-app build metadata (`v<version> · <hash>`), version `1.6.1`, scratch files gitignored |
| `357801e` | Managed Firebase **Storage rules** (deny-by-default; documented company-scoped future pattern) + wired into `firebase.json` |
| `25c3ee2` | Docs: Storage rules deployment gate (`firebase deploy --only storage`) |

## Audit findings (evidence-based)

| Area | Finding | Severity |
|------|---------|----------|
| **Storage security** | Initialized but unused; now deny-by-default in `storage.rules`. **Live bucket only reflects this after `firebase deploy --only storage`** | 🟢 Resolved in repo · ⚠️ deploy-gated |
| **App Check** | Not configured — no abuse protection on Firestore/Storage | 🟠 Med-High |
| **i18n enforcement** | All 4 locales have exact key parity (**1090 each**), but `scripts/i18n-audit.mjs` **fails (exit 1)** on hardcoded user-facing strings (e.g. `ReconciliationCenter` "Period End Date", "Closed By", error text; reconciliation Start-Scan validation messages). Audit is **not wired into the build gate** | 🟠 Med-High |
| **Observability** | No error monitoring (Sentry/Crashlytics), no analytics, no health/diagnostics page | 🟠 Med |
| **Permission-denied UX** | Role-gated denials are caught but produce a console flood ("silently ignored" rather than intentional, typed handling) | 🟠 Med |
| **Tenant onboarding** | No invite flow / first-run wizard; no-membership state exists (`CompanyGuard`) but provisioning is Admin-script only | 🟠 Med |
| **Accounting trust** | Rules enforce immutability (journal entries delete-denied/reversal-only, periods immutable, adjustment approval) 👍 — but **no audit-log explorer UI / exportable audit trail** | 🟡 Med |
| **Premium UX** | Inconsistent empty/loading states across modules; landing/login un-polished; responsiveness unverified beyond storefront | 🟡 Med |
| **Cross-company rules tests** | `test-rules` covers **guest** boundaries only; no **authenticated cross-company** deny tests; no Storage-rules emulator suite | 🟠 Med |
| **SaaS billing** | None — `subscription` in code = the floral *product* subscription, not tenant billing. Greenfield | ⚪ Design |

## Prioritized roadmap (security boundary first)

### P1.5 — Security quick-hardening (in progress)
- [x] `storage.rules` deny-by-default + `firebase.json` wiring
- [x] Storage deploy-gate documented
- [ ] Wire `i18n-audit.mjs` into `verify:prod` (fail build on new hardcoded strings) + fix current violations
- [ ] Authenticated **cross-company** Firestore rules tests (extend `test-rules`)
- [ ] Plan App Check enablement

### P2 — Premium UX Hardening
Landing/login polish, first-run onboarding, empty/loading/error states, dashboard
refinement, mobile/tablet QA, unified card/table/modal design system.

### P3 — Tenant / Auth production hardening
Invite + bootstrap flows, intentional (typed, user-visible) permission-denied
handling with no console flood, company-context regression tests (extend the
Playwright smoke).

### P4 — Accounting control & audit
Audit-log explorer + exportable trail, reconciliation exception lifecycle UI,
reversal/correction flows, financial export package (PDF/Excel with branding).

### P5 — SaaS readiness (design only)
`companies/{id}/subscription` model (plan/status/seats/features), feature gates,
trial, billing-owner role, Stripe-ready boundary.

### Cross-cutting
Fold `i18n-audit` and error monitoring into the verification/release gate.

## Top risks (ranked)

1. 🟠 **Untested cross-company isolation** — multi-tenant security is asserted by
   rules but not covered by authenticated tests.
2. 🟠 **No abuse protection (App Check)** on a publicly-reachable Firebase backend.
3. 🟠 **i18n drift** — no build gate prevents new hardcoded user-facing strings.
4. 🟠 **No production observability** — failures are invisible without the console.

## Operating rules (carried forward)
- Never weaken Firestore/Storage rules to make a test pass.
- Never commit `scratch/*`, `.env`, service-account keys, or test passwords.
- Company access is provisioned via `scripts/bootstrap-default-company-user.js`
  (Admin SDK), never client-side.
- Prefer small, focused commits; run `verify:prod` before tagging; the owner
  manual smoke remains the source of truth for closing a release.
