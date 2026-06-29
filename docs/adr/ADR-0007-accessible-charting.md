<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike validates the assumptions.
-->

# ADR-0007: Accessible charting — hand-rolled SVG + a data-table fallback (no charting library)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Validated                                                          |
| Date          | 2026-06-28                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | [`SPIKE-07`](../spikes/07-accessible-charting.md) (one real chart: 0 axe violations WCAG 2.2 AA in real Chromium, light+dark × table-shown/hidden; bundle measured hand-rolled 1.94 KB gz vs Recharts 129 KB gz) |

## Context

The [UX Uplift initiative](../reviews/2026-06-25-ux-uplift-initiative.md) `UX8` replaces the six
analysis number-grids with **charts**. Two hard constraints collide:

- **Accessibility.** The project holds a **WCAG 2.2 AA / axe-clean** bar (light **and** dark).
  Charts are the classic regression: color used as the only signal, no accessible name, no
  keyboard/screen-reader path. ADR-0005 established the a11y discipline; charts must not break it.
- **Bundle budget.** [`07_NFR.md`](../07_NFR.md) caps the web JS bundle at **120 KB gz**; the app
  is at **105.4 KB gz** — only **~14.6 KB** of headroom, and we need **six** charts.

Per the project's spike-first, ADR-gated rule (and the `SPIKE-06`/ADR-0005–0006 precedent),
[`SPIKE-07`](../spikes/07-accessible-charting.md) proved the approach on one real chart
(net-worth-over-time) before committing the phase.

## Decision

Render Insights charts as **hand-rolled SVG with a data-table fallback — no charting library.**

Every chart meets this **a11y contract**:

1. **Accessible name** — the SVG is `role="img"` with a concise `aria-label` *summary* (the trend
   in one sentence). Decorative innards (gridlines, ticks, polylines, labels) are `aria-hidden` so a
   screen reader hears the headline, not hundreds of nodes.
2. **Data-table fallback** — a real `<table>` carrying the **exact figures** is the keyboard +
   screen-reader source of truth, via **native table semantics** (no ARIA grid needed). The existing
   analysis grids already *are* this table, so the migration is "add an SVG above the table."
3. **Color is never the sole signal** (WCAG 1.4.1) — reinforce series with **dash pattern**, **marker
   shape**, and/or **direct labels**. Stroke/fill colors come from new **`--chart-1/2/3` + `--chart-grid`
   tokens**, tuned ≥ 3:1 vs the surface (WCAG 1.4.11) in **both** schemes — but a11y does not depend
   on color discrimination.
4. **Light + dark** — series colors are tokens with a `prefers-color-scheme` dark variant; the axe
   gate is re-run in both schemes.
5. **No opacity animation on text** (trips the contrast gate — use `transform`/`hidden`); honor
   `prefers-reduced-motion`.

A small shared **`Chart` primitive** plus the `--chart-*` tokens live in `apps/web/src/ui/` (the
ADR-0005 component library) so the six views share the `<figure>`/caption/SVG/table-toggle
scaffolding and the encoding conventions.

## Consequences

### Positive
- **Stays inside the bundle budget** — the approach adds **~1.94 KB gz** (the shared primitive),
  vs **129 KB gz** for Recharts alone (which exceeds the *entire* 120 KB budget). Headroom intact.
- **Total a11y control, proven** — 0 axe violations across light/dark × table-shown/hidden; the
  encoding (color + shape + label + summary + table) is ours to get right, not a library's to fight.
- **Low-risk migration** — the fallback table is the *existing* analysis content, so `UX8` is
  additive (SVG on top of the table already shipped).
- **Matches the repo's restraint** — zero new runtime dependency, legible diffs (same rationale that
  chose tokens/CSS-Modules over Tailwind in ADR-0005).

### Negative / cost
- **More hand-authoring** — geometry (scales, ticks, paths) is written, not configured; each chart
  *shape* (line, bar, gauge) is bespoke. Mitigated by the shared `Chart` primitive + helpers.
- **No free interactivity** — hover tooltips / zoom / brushing must be hand-built if wanted later
  (not needed for V1 Insights; the table covers data access).

### Neutral
- The contract is shape-agnostic; bar/gauge charts reuse the same img-summary + table-fallback +
  non-color-encoding rules. Each new shape re-runs the axe gate (light+dark) as it lands.

## Alternatives considered

### A charting library (Recharts / Chart.js / nivo)
Fast to build and feature-rich, but **disqualified on bundle**: Recharts measured **129 KB gz** for
a basic multi-line chart (React-externalized) — alone larger than the whole 120 KB app budget and
~9× the remaining headroom; Chart.js/nivo are in the same order. A11y also varies and would still
need the table fallback. Rejected.

### A lean/modular charting lib (uPlot ~40 KB gz, visx modular)
Smaller, but even the lightest credible option consumes most/all of the ~14.6 KB headroom for **one**
chart, and we need six. The marginal saving over hand-rolled SVG is negative once a11y wiring (name,
table, non-color encoding) is added anyway. **Kept as the fallback** only if a future chart needs
heavy interactivity (zoom/brush) that hand-rolling can't justify — and only if the budget is raised.

### Canvas / image charts
Pixels are opaque to assistive tech and don't scale crisply; would *force* a parallel table and lose
DOM-level control. Rejected.

## Supersedes / superseded by

- Supersedes: — (first charting decision; builds on ADR-0005's tokens/CSS-Modules + a11y discipline).
- Superseded by: —
