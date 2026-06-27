# P2 — Premium UX Audit & Checklist (BloomPro Studio / Florist)

First deliverable for P2. **Audit + prioritized backlog only** — no UI code changes
in this document. Implementation follows one focused, low-risk item at a time.

**Guardrails for all P2 work:** no Firebase rules / App Check / auth / env /
deploy / release changes; verify:prod green before each commit; small,
documentation-backed commits.

## Current state (what's already good)

- Shared UI primitives exist and are used: `Button`, `Card`, `Input`, `Modal`,
  `FormModal`, `Drawer`, `Toast`, **`EmptyState`** (`src/components/ui/`).
  `EmptyState` is used in ~12 files; `Card` in ~14 pages.
- A CSS-variable **design-token** system exists (`var(--color-*)`, `var(--font-*)`).
- **Storefront** pages are responsive (`@media` in Home/Shop/Cart/Checkout/
  ProductDetail/TrackOrder/OrderConfirmation/CustomBouquet) — see `walkthrough.md`.
- Global `ErrorBoundary` + `CompanyGuard` loading/error/"access required" states.

## Findings (evidence-based)

| # | Finding | Evidence | Impact | Risk to fix |
|---|---------|----------|--------|-------------|
| F1 | **No skeleton loaders anywhere** — data loads show spinners/blank | 0 files match `skeleton` | High (perceived performance/polish) | Low (additive) |
| F2 | **Inline-style sprawl**; 13 admin pages have **no CSS module** | FinanceAdmin 164, ReconciliationCenter 142, AccountsReceivable 129, QA 98, Inventory 90 `style={{}}` | Med (consistency, theming, spacing drift) | Med-High (refactor) |
| F3 | **Admin not responsive** — Topbar + most admin pages lack `@media` | `@media` only in storefront pages + Dashboard/Settings; Topbar.module.css has none | Med-High (tablet/mobile admin) | Med |
| F4 | **Empty-state coverage gaps** — primitive exists but not on every list | `EmptyState` in ~12 files; many list pages render raw "none" text or nothing | Med | Low |
| F5 | **Per-module error states** are toast-only — a failed fetch leaves an empty page | pages catch + `addToast`, no inline retry surface (unlike `CompanyGuard`) | Med | Low-Med |
| F6 | **Hardcoded hex bypasses tokens** (e.g. `#6C8271`, `#E8EAE6` repeated inline) | pervasive in inline styles | Low-Med (theming consistency) | Med (incremental) |
| F7 | **Form consistency** — maintenance forms mix inline styles with `FormModal` | `OrderMaintenanceForm` 78 inline styles | Low-Med | Med |

## Prioritized P2 backlog (safest / highest-impact first)

### P2.1 — Skeleton loading states  ⟵ recommended first
Add reusable `Skeleton` primitives (line/box/table-row/card) and apply to the
highest-traffic data surfaces (dashboard KPIs/tables, Orders/Customers lists)
during fetch, replacing spinners/blank.
- **Impact:** High · **Risk:** Low (additive, no logic change)
- **Acceptance:** lists show skeletons while `loading`, real content after;
  no layout shift; verify:prod green.

### P2.2 — Empty-state coverage
Ensure every list/table routes through `EmptyState` with a clear message +
primary CTA (e.g. "No orders yet → Create order").
- **Impact:** Med · **Risk:** Low
- **Acceptance:** each admin list renders `EmptyState` when empty; copy is i18n
  (passes `i18n:audit`).

### P2.3 — Inline per-module error state
A small reusable inline error card (retry) for failed module fetches, mirroring
`CompanyGuard`'s error UX, so a fetch failure isn't a blank page.
- **Impact:** Med · **Risk:** Low-Med
- **Acceptance:** simulated fetch error shows retry card, not blank; i18n copy.

### P2.4 — Admin responsive pass
Topbar (collapse search/company-switcher on small screens), sidebar drawer on
mobile, and horizontal-scroll wrappers for wide tables.
- **Impact:** Med-High · **Risk:** Med
- **Acceptance:** no horizontal overflow at 768px/1024px; nav reachable on mobile.

### P2.5 — Design-token consolidation
Replace repeated hardcoded hex with existing CSS vars; incremental, per surface.
- **Impact:** Low-Med · **Risk:** Med · do gradually alongside P2.6.

### P2.6 — Inline-style → CSS module migration
Migrate the heaviest pages (FinanceAdmin, ReconciliationCenter, AccountsReceivable)
to CSS modules. Largest effort; do last, page by page, behavior-preserving.
- **Impact:** Med (maintainability) · **Risk:** Med-High

## Recommended sequence

1. **P2.1 Skeletons** (biggest perceived-quality win, lowest risk)
2. **P2.2 Empty states** + **P2.3 error states** (resilience + polish, low risk)
3. **P2.4 Admin responsive** (real usability on tablet/mobile)
4. **P2.5 / P2.6** consolidation/migration (incremental, behind the visible wins)

Each item ships as its own focused commit with `verify:prod` green; no deploy/
push/tag until you explicitly approve a release candidate.
