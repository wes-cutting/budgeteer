<!--
SPIKE REPORT — the deliverable; the code is disposable (lives at spikes/07-accessible-charting/,
gitignored deps). See docs/00_WAYS_OF_WORKING.md §6. Scopes roadmap item UX2 of the 2026-06-25
UX Uplift initiative; gates UX8 (Analysis → Insights migration).
-->

# SPIKE-07 (UX2): Can a chart be accessible (axe AA + keyboard + screen reader, light & dark) with a data-table fallback, within the 120 KB gz bundle budget — and at what cost, hand-rolled vs a library?

| Field      | Value                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| Status     | **Done**                                                                                     |
| Type       | Technical / feasibility (a11y + bundle)                                                       |
| Owner      | Wesley Cutting + agent                                                                        |
| Time-box   | ~1 focused session — honored (converged once axe was green light+dark and the two bundle numbers were in) |
| Date       | 2026-06-28                                                                                   |
| Blocks     | [`ADR-0007`](../adr/ADR-0007-accessible-charting.md) (charting / viz-a11y) · `UX8` (Analysis → Insights migration) · the whole Insights phase (`UX8`–`UX11`) |
| Scopes     | `UX2` in the [2026-06-25 UX uplift initiative](../reviews/2026-06-25-ux-uplift-initiative.md) |
| Result     | **Viable accessible chart confirmed, hand-rolled.** A hand-rolled SVG chart + data-table fallback is **0 axe violations** (WCAG 2.2 AA) in real Chromium, **light AND dark**, table shown **and** hidden, keyboard- and SR-reachable — at **1.94 KB gz** marginal. **A charting library is disqualified on bundle:** Recharts alone is **129 KB gz**, exceeding the entire 120 KB app budget. |

## 1. The question

`UX8` replaces the six analysis number-grids with **charts**. The UX Uplift reverses the repo's
"no design system" stance, so — exactly as `SPIKE-06` gated the design-system ADRs — viz a11y must
be **proven on one real screen before** we build six on top of it. Charts are the **axe risk**
(color-only signals, no accessible name, no keyboard/SR path) **and** the **bundle risk** (the app
is at 105.4 KB gz against a 120 KB ceiling — only ~14.6 KB of headroom). One question:

> **Can one real chart be made fully accessible — axe-clean (WCAG 2.2 AA), keyboard-operable,
> screen-reader-usable, with a data-table fallback, in light AND dark — and does it fit the bundle
> budget? Specifically: do we need a charting library, or does hand-rolled SVG suffice — and what
> does each cost?**

The probe screen is **net-worth-over-time** (the V1 `getNetWorth` read) — a genuine multi-series
time series, the most "chart-like" of the six analysis views, so the hardest a11y case.

## 2. Method

A **throwaway** harness at `spikes/07-accessible-charting/` (Vite + React 18 + TS, standalone —
*not* the V1 app), with the **production design tokens copied verbatim** (`src/tokens.css`) so the
contrast gate is meaningful against real values. It:

- **Builds one real chart hand-rolled** (`src/AccessibleChart.tsx`): an SVG line chart of
  assets / liabilities / net over six synthetic months (integer cents, ADR-0003 shape), plus a
  `<table>` fallback and a disclosure toggle. Strict `tsc` + `vite build`.
- **Scans accessibility in real Chromium** (`scripts/axe-browser.mjs` → repo-root Playwright +
  `@axe-core/playwright`, the **same WCAG 2.2 AA tag set and serious/critical filter** as the app's
  `e2e/a11y.spec.ts`), across **four targets**: {light, dark} × {table shown, table hidden}.
- **Measures bundle cost two ways, React-externalized** (the app already bundles React), so each
  number is the **marginal** cost of adding that approach to the app bundle — the same lib-mode
  technique `SPIKE-06` used: the **hand-rolled chart** (`src/measure/handrolled-entry.tsx`) vs
  **Recharts** (`src/measure/recharts-entry.tsx`), the most popular React charting lib, as the
  representative library alternative.

**Deliberately not done:** the other five views, interactive datapoint tooltips, the full Insights
restyle, production wiring. Harness code is discarded once findings are absorbed (`UX8` rebuilds the
pattern in-app and re-runs the real gate).

Resolved versions: `recharts@2.15.4` · `vite@5.4.21` · `react@18.3.1`.

## 3. Findings

**Existence proof.** The hand-rolled chart type-checks (strict, exit 0) and builds. It renders
correctly in light and dark (screenshots captured), with each series distinguished **four ways** so
**color is never the sole signal** (WCAG 1.4.1): line **color** (token), **dash pattern** (solid /
dashed / dotted), **end-marker shape** (circle / square / triangle), and a **direct text label** at
the end of each line.

**Accessibility (real Chromium, WCAG 2.2 AA tags, serious/critical) — the gate:**

```
## light · table shown    violations: 0  [PASS]
## light · table hidden   violations: 0  [PASS]
## dark  · table shown    violations: 0  [PASS]
## dark  · table hidden   violations: 0  [PASS]
=== TOTAL blocking violations across all targets: 0 ===
```

The a11y pattern that passed:
- the **SVG is `role="img"` with a one-line `aria-label` summary** ("Net worth over 6 months … net
  worth $8,800.00 to $14,450.00"); its decorative innards (gridlines, ticks, polylines, 200+ tspans)
  are `aria-hidden` — a screen reader hears the headline, not the noise.
- a **real `<table>` carries the exact figures** — the keyboard + screen-reader path, via **native
  table semantics** (no ARIA needed). It is the source of truth, toggled by a `<button>` with
  `aria-expanded` + `aria-controls` (the chart's one interactive control; keyboard-operable).
- the **`--chart-1/2/3` stroke tokens** are tuned ≥ 3:1 vs the surface in both schemes (WCAG 1.4.11
  non-text contrast); but a11y does **not depend** on that — color is reinforced by shape/label.
- **no opacity animation on text** (would trip the contrast gate) — the disclosure uses `hidden`.

**Bundle cost (gzipped; React externalized → marginal cost added to the app bundle):**

| Approach | gz (JS) | vs ~14.6 KB headroom | Verdict |
| -------- | ------- | -------------------- | ------- |
| **Hand-rolled SVG chart** (component code) | **1.94 KB** (+0.60 KB gz CSS) | **~13%** of headroom | **fits comfortably** |
| **Recharts** (LineChart + grid + axes + tooltip) | **129.03 KB** | **~9× the headroom; exceeds the entire 120 KB budget alone** | **disqualified** |

### Confirmed
- **A fully accessible chart is achievable** — the falsifiable core is **YES**: 0 axe violations
  across light/dark × table-shown/hidden, keyboard- and SR-reachable, with a table fallback.
- **Hand-rolled SVG is the way** — **1.94 KB gz** marginal keeps the app at ~107 KB gz with the
  Insights charts, inside the 120 KB ceiling.
- **The "chart as `img` + table fallback" pattern works** and is the recommended a11y contract:
  summary accessible name on the SVG, native `<table>` as the SR/keyboard source of truth,
  color-plus-shape-plus-label encoding.

### Invalidated
- **"We need a charting library for the Insights phase" is false** — and worse, **a library would
  blow the budget**: Recharts alone (129 KB gz) is larger than the entire 120 KB app budget and ~9×
  the remaining headroom. The bundle constraint **forces** hand-rolled (or rules a lib out), and the
  a11y result shows hand-rolled is also the *better* a11y story (full control of the encoding).

### Surprises / unknowns uncovered
- Recharts v2's tree-shaken cost is far higher than its marketing "modular" framing suggests at this
  usage (grid + 2 axes + tooltip + 3 lines pulls ~129 KB gz). Lighter libs exist (uPlot ~40 KB,
  visx modular) but **even the smallest credible option eats most/all of the 14.6 KB headroom** for
  *one* chart — and we need six. Hand-rolled is decisively cheaper and gives total a11y control.
- The table fallback does double duty: it is **both** the a11y path **and** the existing analysis
  view's content — so `UX8` is largely "keep the table, add an SVG above it," a low-risk migration.

## 4. Recommendation / decision

Adopt **hand-rolled SVG charts + a data-table fallback**, no charting library — recorded in
[`ADR-0007`](../adr/ADR-0007-accessible-charting.md). The a11y contract every Insights chart must
meet:

1. **Accessible name** — `role="img"` + a concise `aria-label` summary on the SVG; decorative
   innards `aria-hidden`.
2. **Data-table fallback** — a real `<table>` with the exact figures, the keyboard + SR source of
   truth (native semantics; the existing analysis grids already are this table).
3. **Color never the sole signal** — reinforce with dash pattern, marker shape, and/or direct
   labels (WCAG 1.4.1); stroke tokens ≥ 3:1 for 1.4.11.
4. **Light + dark** — series colors via `--chart-*` tokens; re-scanned in both schemes.
5. **No opacity animation on text**; honor `prefers-reduced-motion`.

A small shared **`Chart` primitive** (and `--chart-*` tokens) should live in `apps/web/src/ui/` so
the six views share the figure/caption/table-toggle scaffolding.

**Residual (low):** validated on a line/time-series; the spend-by-envelope and budget-vs-actual
views want **bars**, and credit/payoff want **gauges/progress**. The *pattern* (img summary + table
fallback + non-color encoding) is shape-agnostic, so the residual is small — `UX8` builds each shape
on the same contract and re-runs the real axe gate (light+dark) as it goes. **No follow-up spike
needed.**

## 5. Impact on the plan

- **Specs/ADRs:** [`ADR-0007`](../adr/ADR-0007-accessible-charting.md) written from this
  recommendation → **`Validated`** by SPIKE-07.
- **Sequencing:** `UX2` → **Done**; `UX8` (Analysis → Insights migration) → **Ready**, built on
  the hand-rolled-SVG + table-fallback contract.
- **Bundle budget:** the chart approach adds **~1.94 KB gz per the shared primitive** (not per
  chart), leaving the 120 KB ceiling intact; recorded in [`07_NFR.md`](../07_NFR.md).

## 6. Follow-ups

- [x] Write `ADR-0007` from the recommendation; set `Validated`.
- [x] `UX2` → Done; promote `UX8` to `Ready` in [`03_ROADMAP.md`](../03_ROADMAP.md); log the re-sequence.
- [x] Record the chart bundle cost + the `--chart-*` token decision in [`07_NFR.md`](../07_NFR.md).
- [ ] Discard `spikes/07-accessible-charting/` once its findings are absorbed into `UX8` (throwaway).
