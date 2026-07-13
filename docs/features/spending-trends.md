---
type: feature-spec
roadmap-item: BUD-S55
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX10 (2026-06-25 UX Uplift, Phase 3 "Insights"). Build as a
vertical slice that adds a NEW visualisation (not a migration): total + top-envelope OUTFLOW
month-over-month, on the ADR-0007 contract via the shared ui/Chart primitive. Composes an EXISTING
read (several calls, still no new endpoint / schema / domain change). Status ladder:
docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Insights: spending trends over time

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX10                                                              |
| Status       | Implemented ([status report](../status-reports/2026-07-01-ux10.md))   |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-07-01                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX10`) · on the [ADR-0007](../adr/ADR-0007-accessible-charting.md) contract · builds on [FEAT-UX8](insights-charts.md) (the shared `ui/Chart` primitive) · composes the existing [budget-vs-actual](budget-vs-actual.md) read, several times · sibling of [FEAT-UX9](spending-breakdown.md) (one month's composition; this is movement across several) |

## 1. Summary

UX9 answered "where did the money go **this month**?"; UX10 answers "**is my spending going up or
down**?" — a month-over-month **trend**, so direction and momentum are visible, not just one
month's snapshot. A new `/insights/trends` view charts the **household's total outflow** plus the
**top-2 envelopes by outflow** over a selectable trailing window (3 / 6 / 12 months ending at a
chosen month), as a multi-series line chart on the [ADR-0007](../adr/ADR-0007-accessible-charting.md)
contract, reusing the `LineChart` shape shipped in UX8 (no new chart shape).

This is a **vertical slice that adds a new visualisation**, but **no new endpoint, schema, API, or
domain change**: it **composes the existing `getBudgetVsActual(month)` read**, once per month in the
window (`Promise.all`) — extending the R4/R5/UX9 fan-out precedent to several calls, since that read
is per-month only.

## 2. The read decision — several `getBudgetVsActual` calls, not `getEnvelopeSpend`

A "spending" trend's y-axis is **pure outflow**, per month. Two shapes were candidates:

| Read | What it gives | Fit for a spending trend |
| ---- | -------------- | ------------------------- |
| `getEnvelopeSpend(grain)` | **One call**, already period-aligned across ALL envelopes and ALL history — a natural-looking trend source. But each cell is **net** signed flow (funded `+`, spent `−`, netted) | ✗ the same problem UX9 already reasoned through for its numerator: an envelope funded and spent in the same month **understates** true outflow. Calling a net-flow line a "spending trend" would be actively misleading — some months would show a shallow (or even positive) net dip in a month the user actually spent heavily, simply because they also funded the envelope that month |
| `getBudgetVsActual(month)`, called once per month in the window | `spentCents` = `−Σ` allocations on **withdrawal** transactions that month (funding excluded; refunds netted) + `totalSpentCents` (household total) | ✓ **exactly** the outflow numerator a spending trend needs — same semantics UX9 already established as correct |

So UX10 calls **`getBudgetVsActual(month)`** once per month in the selected trailing window
(`Promise.all([...months].map(m => api.getBudgetVsActual(m)))`) and composes the results
client-side: `totalSpentCents` becomes the "Total" series; each envelope's `spentCents` across the
window (0-filled for months it had no row) becomes a candidate series. **No new endpoint** — the
kickoff explicitly anticipated this trade-off ("a multi-month outflow trend would need composing
several calls") and it is preferred over a new endpoint per the repo's fan-out precedent. The cost
is N parallel requests instead of one; at V1 scale (a single household, a bounded window of 3–12
months) this is negligible and avoids adding server surface for a client-composable shape.

## 3. Chart design — Total + top-2 envelopes, on the existing `LineChart` shape

A multi-envelope trend risks too many line series to read (colour-only differentiation breaks down
past 3–4 series, mirroring the reasoning that drove UX9's "many-category" breakdown design). UX10
resolves this by charting:

- **Total** — the household's `totalSpentCents` each month (the headline "is spending going up or
  down" line), and
- the **top-2 envelopes by outflow summed over the window** (the "what's driving it" detail).

Three series total, matching the **3 `--chart-1/2/3` tokens 1:1** — no colour reuse. Each series is
further distinguished by **dash pattern + end marker + a direct label** per ADR-0007 (Total: solid /
circle; rank-1 envelope: dashed `6 4` / square; rank-2: dashed `2 3` / triangle) — colour is never
the sole signal even though there happens to be one token per series here. Envelopes with **zero**
outflow over the whole window are excluded from ranking (an all-zero line would just add noise); an
envelope missing a value in a specific month (it didn't spend that month) is **0-filled**, not
omitted, so the axis stays aligned across series.

This **reuses the existing `LineChart` shape** (`apps/web/src/ui/Chart.tsx`) unchanged — no new
chart shape, matching the kickoff's steer ("the `LineChart` shape already exists… likely REUSE it").
The alternative — per-envelope small multiples (one mini line chart per envelope) — was considered
and rejected: it would need a new chart shape (a small-multiples grid), more markup/bundle, and a
harder-to-scan "biggest picture" question ("is total spending trending up?") than one combined chart
answers directly.

## 4. The view (`/insights/trends`)

`SpendingTrendsView.tsx`, an 8th Insights tab ("Trends") next to Breakdown:

- An **End month** picker (`type="month"`, defaults to the current month, capped at this month —
  same control convention as Breakdown/Budget) and a **Months** horizon toggle (3 / 6 / 12, default
  6 — same segmented-button convention as the Forecast view's day horizon).
- The chart: `LineChart` with Total + top-2 envelope series, a one-line summary naming the total's
  direction (up/down/flat) and the top spenders; above the **data table** (Month · Total · each
  charted envelope) — the keyboard/SR source of truth, mirroring exactly what's charted (not a wider
  all-envelopes table), matching the `NetWorthView`/`ForecastView` table-mirrors-chart convention.
- Cockpit: **left unchanged** (same reasoning as UX9 — the cockpit's budget panel already deep-links
  into Insights; a trend panel doesn't fit a cockpit slot without scope creep).

## 5. Acceptance criteria

- [x] `/insights/trends` renders a line chart of the household's **total outflow** plus its **top-2
      envelopes by outflow** over a selectable trailing window (3/6/12 months) ending at a chosen
      month, values 0-filled where a series had no activity that month.
- [x] Composes the **existing** `getBudgetVsActual` read, once per month in the window — **no new
      endpoint / schema / API / domain change**; funding excluded, refunds netted (inherited from
      `spentCents`).
- [x] Envelope ranking is **by total outflow summed over the window**; envelopes with zero outflow
      over the whole window are excluded (never shown as a flat zero line).
- [x] Three series max, **one `--chart-*` token each** (no colour reuse) — each also carries a
      distinct **dash pattern + marker shape + direct label**, so colour is never the sole signal.
- [x] The chart is `role="img"` with a concise one-line `aria-label` summary (direction + top
      spenders); decorative innards are `aria-hidden`; the table carries every exact figure charted.
- [x] **axe-clean (WCAG 2.2 AA, serious/critical) in LIGHT and DARK** with the chart rendered —
      `e2e/a11y.spec.ts` seeds outflow across two real months and scans both schemes.
- [x] No opacity animation on text; honours `prefers-reduced-motion` (inherited from `ChartFigure`).
- [x] Bundle stays under the **120 KB gz** ceiling (109.90 KB gz after UX10, ~10.1 KB headroom).
- [x] Gate green: typecheck · lint · format · unit (323 Vitest) · e2e (78 Playwright) · build.

## 6. UX states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — when the whole window has no outflow: guidance copy ("No outflow in the {n} months
  ending {month} yet — spend from an envelope, then come back to see the trend."); **no chart**.
- **Populated** — the chart (`role="img"` + summary) above the exact-figures data table.

## 7. Out of scope (later Insights items)

Budget burn-down (`UX11`) builds on the same primitive but adds a within-month pace/projection
composition; it is not part of UX10. A per-envelope small-multiples layout, and a picker to chart a
specific (non-top-2) envelope, are deferred — the total + top-2 view answers the "is spending
trending up or down, and what's driving it" job without a new shape; a future slice can extend the
picker without changing the read or the chart contract.
