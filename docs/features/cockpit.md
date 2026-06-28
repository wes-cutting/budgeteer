<!--
FEATURE SPEC — scopes roadmap item UX5 (2026-06-25 UX Uplift, Phase 2). Build as a vertical slice:
replace the console home at `/` with a budget + future-planning cockpit that COMPOSES EXISTING
READS (fan-out, no new endpoint). Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Home: budget + future-planning cockpit

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX5                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-27-ux5.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-27                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX5`) · builds on [FEAT-UX3](app-shell.md) (shell + routes) + [FEAT-UX4](design-system.md) (design system) · reuses [budget-vs-actual](budget-vs-actual.md) · [cash-flow-forecast](cash-flow-forecast.md) · [recurring](recurring.md) · [net-worth (R9)](../03_ROADMAP.md) · needs-allocation |

## 1. Summary

The home route `/` opens on a **budget + future-planning cockpit** — a forward-looking overview that
answers "how am I doing this month, and what's coming?" at a glance. It is the home's new
**headline**. Five panels, each deep-linking to its detail route:

1. **This month's budget** — target / spent / remaining across the envelopes that have a monthly
   target → `/insights/budget`.
2. **Needs allocation** — how many transactions need allocating and the unallocated total →
   `/needs-allocation`.
3. **Upcoming** — the next recurring transactions (with a "due to post" callout) → `/recurring`.
4. **Cash-flow forecast** — the projected ending / lowest balance for the primary cash account →
   `/insights/forecast`.
5. **Net worth** — current assets / liabilities / net → `/insights/networth`.

**The cockpit COMPOSES EXISTING READS (fan-out, no new endpoint)** — the R4/R5 precedent, and the
answer to the brief's open question (*"does the cockpit need a single home-summary endpoint, or can
it fan out?"* → **fan out first**). Every figure derives from the ledger and reconciles to it.

## 2. Boundaries — what stays on the home (UX5) vs. moves (UX6)

This slice **reframes** the home; it does **not** demote management yet. Deliberately:

- **Cockpit on top** as the headline (a named `Overview` region).
- **Account/envelope management stays below it, unchanged** — the Add-account/Add-envelope forms,
  the account/envelope lists (rename/archive), the R4 net-worth summary, the R5 inline targets, and
  Move-money. They are **not** removed, because the `/manage` surface that will receive them does not
  exist yet — building empty target routes, or stripping the only setup path, would break
  *usable-at-every-step*. **Demoting management to `/manage` + list routes is `UX6`'s explicit
  acceptance** ("home no longer renders add-forms").
- **Download backup** already left the home for the shell nav in UX3.

This keeps every existing home test green (the `<h1>Budgeteer</h1>`, the management forms/lists, the
aria) and the app fully usable, while the cockpit becomes the main event.

## 3. Composition (data → UI)

`apps/web/src/Cockpit.tsx` (rendered by `Dashboard.tsx`, inside its `<main>` so the home keeps one
`<h1>`). It fans out to existing `api.ts` reads, each panel loading and degrading **independently**
(R2/R5 pattern — a failed read shows an inline note, never blanks the cockpit):

| Panel | Read | Notes |
| ----- | ---- | ----- |
| This month's budget | `getBudgetVsActual(currentMonth)` | Sums **only targeted** envelopes so budgeted − spent = remaining reconciles (the report's `totalSpent` also counts untargeted spend, which would break the identity). |
| Needs allocation | `listNeedsAllocation()` | Count + Σ\|unallocated\|. |
| Upcoming | `listRecurring()` | Next ≤4 by `nextOccurrenceOn`; Σ`dueCount` → a "due to post" badge. |
| Cash-flow forecast | `listAccounts()` → pick → `getCashFlowForecast(id)` | Primary account = first active **checking**, else first active non-liability; null → empty state. |
| Net worth | `listAccounts()` (shared with the forecast pick) | Client-side Σ split by `isLiabilityKind` (R4) — **provably equal** to `/analysis/net-worth`; `net = assets + liabilities`. |

One `listAccounts()` read feeds both the net-worth snapshot and the forecast account pick.

**No new endpoint, no schema/domain change.** Presentation-only, on the UX4 design system
(`Card`/`Badge`/`EmptyState`/`Skeleton`) and the UX3 router (`<Link>` deep-links).

## 4. States & a11y

- **Loading** → `Skeleton`; **error** → an inline muted note (not `role="alert"` — avoids 5 alerts);
  **empty** → an `EmptyState` per panel (e.g. no targets, no recurring, no cash account, no accounts).
- **Color is never the sole signal:** budget health and forecast safety use `Badge` (which always
  carries text — "On track" / "N over budget" / "Stays positive" / "Projected negative on …").
- **Headings:** `<h1>Budgeteer</h1>` kept; the cockpit is a `<section aria-labelledby>` named
  **Overview** (`<h2>`) of five `<h3>` panels; management sections stay `<h2>`. One banner, one main.
- **Money** via `formatCents`; figures are `<dl>` term/value pairs (no `role` override → dt/dd
  containment intact, the #16 lesson). **No animation** in the cockpit (the shell owns the
  transform-based, reduced-motion-aware route transition — never an opacity fade over text).
- Axe-clean (WCAG 2.2 AA) in **light and dark** — `e2e/a11y.spec.ts` scans the populated home in both.

## 5. Acceptance criteria

- ✅ The home loads the cockpit at `/`; the five panels render.
- ✅ Each panel deep-links to its detail route (`/insights/budget` · `/needs-allocation` ·
  `/recurring` · `/insights/forecast` · `/insights/networth`).
- ✅ Figures reconcile to the ledger — asserted in `Cockpit.test.tsx` (budget: budgeted − spent =
  remaining, untargeted spend excluded; net worth: net = assets + liabilities; forecast: ending =
  starting with no activity) and in `e2e/cockpit.spec.ts` (net-worth invariant on real data).
- ✅ a11y green (light + dark); `<h1>` + aria preserved.
- ✅ Composes existing reads — **no new endpoint**, no schema/API/domain change.

## 6. Out of scope (later slices)

Demote management to `/manage` + `/accounts`·`/envelopes` list routes (`UX6`) · global quick-add
modal route (`UX7`) · Insights rename + charts (`UX8`) · within-month burn-down viz that pairs with
the cockpit (`UX11`).
