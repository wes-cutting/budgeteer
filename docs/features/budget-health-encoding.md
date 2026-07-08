<!--
FEATURE SPEC — scopes roadmap item UX13 (2026-06-25 UX Uplift, Phase 4 "Polish"): money &
budget-health visual encoding. Fast-path ceremony (docs/00_WAYS_OF_WORKING.md §11): this note IS the
spec — a small, single-primitive presentation slice on the UX4 token sheet. No ADR / no spike / no
new dependency (a hand-rolled ProgressBar on tokens + CSS; the richer SVG Gauge/BarChart from UX8
remain for the Insights charts). No data / API / domain / chart change.
-->

# Feature Spec — Money & budget-health visual encoding (UX13)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX13                                                             |
| Status       | Implemented ([status report](../status-reports/2026-07-02-ux13.md))   |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-02                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX13`, §5 Phase 4) · adds the `ProgressBar` primitive named in [FEAT-UX4](design-system.md)'s seed-and-grow list · complements the SVG `Gauge`/`BarChart` from [FEAT-UX8](../features/insights-charts.md) |

## 1. Summary

Budget health was **text-only**: the budget table and cockpit budget panel showed target / spent /
remaining as bare numbers, and over-budget/negative money was signalled by a **minus sign alone** (the
V1 encoding). This slice adds a lightweight **visual** layer on top of that text — a filling
**progress bar** for spent-of-target, and **weight + colour** on negative money — so budget health
reads at a glance while every figure stays present as text.

It introduces the **`ProgressBar`** primitive (`apps/web/src/ui/ProgressBar.tsx`) — the last of the
UX4 seed-and-grow primitives, hand-rolled on the design tokens + CSS with **no charting dependency**.
This is the row-/panel-scale encoding; the richer SVG `Gauge`/`BarChart` (UX8) stay for the Insights
charts (utilization/payoff already have a `Gauge`, so the genuinely new bar surface is **budget
target-vs-spent**).

## 2. Scope

- **New `ProgressBar` primitive** — a track + fill on the tokens; a `tone` (`accent` · `success` ·
  `caution` · `over`) and a `ratio` (clamped for the fill width; > 1 forces the `over` treatment).
- **`BudgetVsActualView`** (the Budget insight's data table) — a per-row **Spent-of-target** progress
  bar column, and the over-budget **Remaining** figure gets weight + danger tone. The totals footer
  gets the same.
- **`Cockpit` budget panel** — a **spent-of-target summary bar** beneath the figures; the negative
  **Remaining** figure is weighted.
- **`Cockpit` net-worth panel** — negative **Liabilities** / **Net worth** figures get weight + tone.

**Out of scope (right-sized, §11):** no sweep of every money figure in the app; the Insights `Gauge`
(utilization/payoff) and `BarChart` (budget vs. actual chart) are unchanged; no data/API/domain
change. A broader `Amount`/money primitive is a possible later consolidation, not needed here.

## 3. Design — encode with text + shape + weight ALONGSIDE colour, never colour alone

The a11y non-negotiable (WCAG **1.4.1 Use of Color**) drives every choice:

- **The bar is DECORATIVE** (`aria-hidden`, no `progressbar` role). Every call site already renders the
  truthful figure as adjacent text, so colour and bar length are **never** the sole signal, and there
  is nothing for a screen reader to double-announce.
- **The `over` tone lays a diagonal HATCH over the danger fill** — a non-colour **shape** signal for
  "past 100%" (mirrors the SVG `Gauge`'s over-cap), so over-budget reads without colour. The fill also
  clamps to 100% width while the row's negative remaining carries the exact figure.
- **Negative money keeps its minus sign** (the non-colour signal); weight + `--color-danger` tone
  **reinforce** it — they never replace it. This supersedes the V1 "minus sign only" encoding.
- **Non-text contrast (WCAG 1.4.11):** the track carries a `--color-border-strong` outline so an empty
  track is perceivable at ≥ 3:1; each fill token clears 3:1 vs the `--color-surface-2` track in
  **light and dark** (from the token sheet's `prefers-color-scheme` variants).
- **Reduced motion:** the bar has **no animation** — reduced-motion-safe by construction.

- **No ADR / no spike / no new dependency:** additive presentation on the UX4 tokens; hand-rolled CSS.
  §11 fast-path — this note is the paperwork.

## 4. A11y coverage

- **Unit** (`ui/ProgressBar.test.tsx`): the bar is decorative (`aria-hidden`, no `progressbar` role);
  fill width tracks + clamps the ratio; a ratio > 1 forces the `over` treatment (width 100% + the
  hatch shape class); `tone` selects the fill class. Plus wiring assertions in
  `BudgetVsActualView.test.tsx` (per-row bar; over-budget remaining weighted) and `Cockpit.test.tsx`
  (budget summary bar + negative remaining; negative liabilities/net worth weighted).
- **E2E axe (`e2e/a11y.spec.ts`), LIGHT AND DARK:** the existing `scanBudget` already renders the
  budget table with an **under-budget** bar visible; a new **over-budget** scan seeds a row spent past
  its target so the danger fill + hatch **shape** and the weighted remaining text are gated with the
  encoding **visible**, in both schemes.

## 5. Acceptance criteria

1. The Budget table shows a spent-of-target bar per budgeted row; untargeted rows show an em-dash. ✅
2. Over-budget / negative money is encoded by **text + weight + colour** (minus sign preserved), never
   colour alone; the over bar adds a hatch **shape**. ✅
3. The cockpit budget panel shows a summary bar; negative remaining / liabilities / net worth are
   weighted. ✅
4. `ProgressBar` is decorative (no new AT surface); track + fills clear 3:1; no animation. ✅
5. Axe-clean with the encoding visible in **light AND dark** (under- and over-budget). ✅
6. Gate green; **no new dependency**; bundle within budget. ✅ (360 Vitest passing + 91 e2e;
   **116.87 KB gz** < 120 KB)
