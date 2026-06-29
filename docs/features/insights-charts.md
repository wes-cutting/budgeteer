<!--
FEATURE SPEC — scopes roadmap item UX8 (2026-06-25 UX Uplift, Phase 3 "Insights"). Build as a
vertical, PRESENTATION-ONLY slice: rename + restyle the six analysis views onto the UX4 design
system and add an accessible chart per view, on the ADR-0007 contract. No new endpoint / schema /
domain change. Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Insights: accessible charts on the six analysis views

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX8                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-28-ux8.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-28                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX8`) · gated by [ADR-0007](../adr/ADR-0007-accessible-charting.md) (validated by [SPIKE-07](../spikes/07-accessible-charting.md)) · builds on [FEAT-UX4](design-system.md) (design system) + [FEAT-UX3](app-shell.md) (routes) · charts the existing reads: [envelope-spend](analysis-envelope-spend.md) · [budget-vs-actual](budget-vs-actual.md) · [cash-flow-forecast](cash-flow-forecast.md) · [credit-utilization](credit-utilization.md) · [debt-payoff](debt-payoff.md) · net-worth (R9) |

## 1. Summary

The six analysis views (`/insights/:view`) shipped as **number grids**. UX8 completes the
**Analysis → Insights** migration: each view is **renamed** ("Insights — …"), **restyled** onto the
UX4 design system, and gains a **hand-rolled, accessible chart** above its data table, on the
[ADR-0007](../adr/ADR-0007-accessible-charting.md) contract (hand-rolled SVG + a data-table fallback,
**no charting library**).

This is a **vertical, presentation-only slice**: **no new endpoint, schema, API, or domain change** —
the six reads (`getEnvelopeSpend` / `getBudgetVsActual` / `getCashFlowForecast` /
`getCreditUtilization` / `getDebtPayoff` / `getNetWorth`) were already done. The migration is, per the
ADR, "add an SVG above the existing table" — the table **is** the chart's data-table fallback.

## 2. Chart per view (shape chosen to fit the data)

| View (`/insights/…`) | Read | Chart shape | Encoding (colour never the sole signal) |
| -------------------- | ---- | ----------- | --------------------------------------- |
| `networth` | `getNetWorth` | **Line** (3 series: assets / liabilities / net) | colour + dash pattern + end-marker shape + direct label |
| `spend` | `getEnvelopeSpend` | **Bar** (diverging — net total per envelope) | bar direction above/below the zero baseline + value in the table |
| `budget` | `getBudgetVsActual` | **Bar** (grouped — target vs. spent per envelope) | 2nd series hatched + a text legend + direct labels |
| `forecast` | `getCashFlowForecast` | **Line** (running balance from today across events) | single series + a marker + a direct label; the negative date is text |
| `credit` | `getCreditUtilization` | **Gauge** (overall utilization, 100% limit marker) | direct % label (truthful, incl. "over limit") + an over-threshold cap |
| `payoff` | `getDebtPayoff` | **Gauge** (overall payoff, 100% paid-off marker) | direct % label + threshold marker |

The gauges chart the **portfolio aggregate**; the per-account utilization/payoff figures and the
month-by-month trends stay in their tables (the data-table fallback + detail).

## 3. The shared `ui/Chart` primitive (ADR-0005 component library)

`apps/web/src/ui/Chart.tsx` centralises the ADR-0007 a11y contract so the six views can't drift:

- **`ChartFigure`** — the scaffold: `<figure>` + caption + `<svg role="img" aria-label={summary}>`
  with its decorative innards wrapped in an `aria-hidden` group + a disclosure **toggle** + the
  data-table slot (default **shown**, so the inline editors in the budget/credit/payoff tables stay
  reachable).
- **`LineChart` / `BarChart` / `Gauge`** — the three shapes, each building its geometry + a one-line
  `summary` and rendering through `ChartFigure`. Series colours come from the new
  **`--chart-1/2/3` + `--chart-grid`** tokens (`apps/web/src/ui/tokens.css`), tuned ≥ 3:1 vs the
  surface (WCAG 1.4.11) in **both** schemes.

## 4. Acceptance criteria

- [x] All six views render their chart **above** the existing table; the table is the chart's
      data-table fallback (the keyboard/SR source of truth). One `<table>` per dataset — no duplicate.
- [x] Every chart is `role="img"` with a concise one-line `aria-label` **summary**; decorative
      innards are `aria-hidden`.
- [x] **Colour is never the sole signal** — reinforced by dash / marker shape / fill pattern / bar
      direction / direct text labels, and the truthful figure always appears as table text.
- [x] **axe-clean (WCAG 2.2 AA, serious/critical) in LIGHT and DARK** with each chart rendered —
      `e2e/a11y.spec.ts` seeds data per shape and scans both schemes.
- [x] No opacity animation on text (the disclosure uses `hidden`); honours `prefers-reduced-motion`.
- [x] The six headings read **"Insights — …"**; the sub-nav and shell nav already say "Insights".
- [x] **Presentation-only**: no new endpoint / schema / API / domain change.
- [x] Bundle stays under the **120 KB gz** ceiling (108.33 KB gz after UX8).
- [x] Gate green: typecheck · lint · format · unit (315 Vitest) · e2e (72 Playwright) · build.

## 5. UX states

Each view keeps its existing **loading / error / empty** states (unchanged). The chart renders only
when there is data to plot; the empty state ("no activity / no targets / no limit / no principal")
shows the existing guidance copy. The gauge views fall back to the table alone when no aggregate
ratio exists (no limit / no principal set).

## 6. Out of scope (later Insights items)

New visualisations — spending breakdown (`UX9`), trends over time (`UX10`), budget burn-down
(`UX11`) — build on this primitive but add new compositions; they are not part of UX8.
