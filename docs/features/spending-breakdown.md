---
type: feature-spec
roadmap-item: BUD-S54
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX9 (2026-06-25 UX Uplift, Phase 3 "Insights"). Build as a
vertical slice that adds a NEW visualisation (not a migration): each envelope's share of a month's
OUTFLOW, on the ADR-0007 contract via the shared ui/Chart primitive. Composes an EXISTING read — no
new endpoint / schema / domain change. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Insights: spending breakdown (share of outflow)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX9                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-28-ux9.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-28                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX9`) · on the [ADR-0007](../adr/ADR-0007-accessible-charting.md) contract · builds on [FEAT-UX8](insights-charts.md) (the shared `ui/Chart` primitive) · composes the existing [budget-vs-actual](budget-vs-actual.md) read |

## 1. Summary

The Insights phase had no "**where did the money go?**" view — the spend-by-envelope grid shows
*net flow* (funding minus spend) per period, not the **composition of a month's spending**. UX9 adds
a new `/insights/breakdown` view: for a chosen month, each envelope's **share of total outflow**,
shown as **ranked horizontal bars** so the user sees proportion at a glance, on the
[ADR-0007](../adr/ADR-0007-accessible-charting.md) contract (hand-rolled SVG + a data-table fallback,
**no charting library**), via the shared `ui/Chart` primitive shipped in UX8.

This is a **vertical slice that adds a new visualisation**, but **no new endpoint, schema, API, or
domain change**: it **composes the existing `getBudgetVsActual(month)` read** (the R4/R5/UX5 fan-out
precedent).

## 2. The read decision — compose `getBudgetVsActual`, not `getEnvelopeSpend`

A breakdown's numerator is **pure outflow** (money spent), per envelope. Two existing reads were
candidates:

| Read | What it gives | Fit for a breakdown |
| ---- | ------------- | ------------------- |
| `getEnvelopeSpend(grain)` | **Net** signed flow per envelope per period (funding `+`, spend `−`, netted) | ✗ the "negative component" understates gross outflow whenever an envelope was both funded **and** spent in the same period — funding contaminates the figure |
| `getBudgetVsActual(month)` | `spentCents` per envelope = `−Σ` allocations on **withdrawal** transactions that month (funding excluded; refunds netted) + `totalSpentCents` | ✓ **exactly** the outflow numerator a breakdown needs |

So UX9 reuses **`getBudgetVsActual(month)`** — `spentCents` is the per-envelope outflow, and each
slice's share is `spentCents ÷ (Σ displayed positive-outflow slices)`. **No new endpoint** was
needed; the only "extra" columns in that report (target / remaining) are simply ignored here. Basing
the share denominator on the **displayed** positive slices (rather than the report's `totalSpentCents`)
keeps the percentages summing to 100% even if a refund nets a row to ≤ 0 and it drops out.

## 3. The new chart shape — `BreakdownBars` (ranked horizontal bars)

A breakdown is a **new shape** on the ADR-0007 contract. `apps/web/src/ui/Chart.tsx` gains
`BreakdownBars`, rendered through the same `ChartFigure` scaffold (so the a11y contract is
inherited): one horizontal bar per envelope, length ∝ its share, **sorted descending**.

**A many-category breakdown is the hardest case for "colour is never the sole signal"** — there
aren't enough distinguishable, ≥ 3:1, pattern-friendly hues for N envelopes. The answer is to make
colour carry **no categorical meaning at all**:

- **Every bar is the same colour** (`--chart-1`). Colour therefore *cannot* be the sole signal,
  because it is not a signal — it's decoration.
- Each category is distinguished entirely by **non-colour** signals: a **direct text label**
  (`"1. Groceries — $360.00 (70.6%)"`), **rank order** (longest = largest, top of the list), and
  **bar length**.

This is a deliberate, ADR-0007-compliant choice; it adds a **new shape**, not a new contract, so no
ADR change is required. (A pie/donut was rejected: per-slice labelling and the no-colour-only rule
are far harder there; ranked bars label cleanly and read top-to-bottom.)

## 4. The view (`/insights/breakdown`)

`SpendingBreakdownView.tsx`, a 7th Insights tab ("Breakdown") next to Spend:

- A **Month** picker (defaults to the current month, capped at this month) — same control as the
  Budget view.
- The chart: `BreakdownBars` with a one-line summary naming the top slices; above the **data table**
  (Envelope · Outflow · % share, ranked, with a 100% total row) — the keyboard/SR source of truth.
- Cockpit: **left unchanged** — the cockpit's budget panel already deep-links into Insights, and a
  breakdown panel doesn't fit a cockpit slot without scope creep; the sub-nav surfaces the view.

## 5. Acceptance criteria

- [x] `/insights/breakdown` renders ranked horizontal bars of each envelope's **share of the chosen
      month's outflow**, largest first, above the data table (the table is the fallback).
- [x] Composes the **existing** `getBudgetVsActual` read — **no new endpoint / schema / API / domain
      change**; funding is excluded and refunds are netted (inherited from `spentCents`).
- [x] Shares are taken over the displayed positive-outflow slices and **sum to 100%**; the table
      footer shows the total outflow at 100%.
- [x] The chart is `role="img"` with a concise one-line `aria-label` summary; decorative innards are
      `aria-hidden`; the table carries every exact figure.
- [x] **Colour is never the sole signal** — one colour for all bars; categories read from the direct
      label + rank order + bar length.
- [x] **axe-clean (WCAG 2.2 AA, serious/critical) in LIGHT and DARK** with the chart rendered —
      `e2e/a11y.spec.ts` seeds real outflow and scans both schemes.
- [x] No opacity animation on text (the inherited disclosure uses `hidden`); honours
      `prefers-reduced-motion`.
- [x] Bundle stays under the **120 KB gz** ceiling (108.93 KB gz after UX9).
- [x] Gate green: typecheck · lint · format · unit (320 Vitest) · e2e (75 Playwright) · build.

## 6. UX states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — when the month has no outflow: guidance copy ("No spending recorded for {month} yet —
  enter some withdrawals allocated to envelopes…"); **no chart**.
- **Populated** — the chart (`role="img"` + summary) above the ranked data table.

## 7. Out of scope (later Insights items)

Trends over time (`UX10`) and budget burn-down (`UX11`) build on the same primitive but add new
compositions; they are not part of UX9. A year/all-time breakdown grain is deferred — the month
breakdown matches the "where did this month's money go" job; a wider grain can extend the picker
later without a new read shape.
