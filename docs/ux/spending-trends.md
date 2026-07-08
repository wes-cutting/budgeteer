<!--
UX SPEC — UX10: spending trends over time. A NEW Insights view: total + top-2 envelope OUTFLOW,
month-over-month, as a multi-series line chart (chart + data-table fallback), on the UX4 design
system. Pairs with FEAT-UX10. Contract: ADR-0007.
-->

# UX Spec — Insights: spending trends over time

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------- |
| Status       | Accepted                                                       |
| Feature      | FEAT-UX10 ([feature spec](../features/spending-trends.md))    |
| Owner        | Wesley Cutting                                                 |
| Last updated | 2026-07-01                                                     |

## 1. User & job

The user wants to answer "**is my spending going up or down**?" — not one month's composition (the
Breakdown view does that), but **direction and momentum across several months**, and a rough sense
of what's driving the movement. A total trend line plus its top-2 contributing envelopes answers
both halves at once: the headline direction, and the biggest driver(s) of it.

## 2. Entry point & navigation

A new **"Trends"** tab in the Insights sub-nav, third — after **Spend** and **Breakdown**
(`/insights/trends`, deep-linkable per UX3). A self-contained page with its own `<h1>` ("Insights —
spending trends").

## 3. Primary flow

1. Open **Insights → Trends** → the **End month** picker (default: current month) and the
   **Months** horizon toggle (3 / 6 / 12, default 6) set the window, then the **chart**, then the
   **data table** load.
2. The user reads the **Total** line for the headline direction (rising/falling/flat, stated in the
   chart's summary), then the two lighter lines for which envelopes are moving with it.
3. To look at a different window, the user changes the **End month** picker and/or clicks a
   different **Months** button; the chart and table re-render.
4. A keyboard or screen-reader user hears the chart's one-line **summary** (window, total outflow
   start → end, direction, top spenders), then navigates the **table** (native semantics) for every
   month · total · top-envelope figure — or toggles the table closed once oriented.

## 4. Screens & states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — the whole window has no outflow: "No outflow in the {n} months ending {month} yet —
  spend from an envelope, then come back to see the trend." **No chart.**
- **Populated** — the chart (`role="img"` + summary) above the data table (Month · Total · each
  charted envelope).

## 5. The chart, as a screen element

- A `<figure>`: a **caption** ("Spending trend — {n} months ending {month}"), the **SVG** (a
  multi-series line chart), a **"Hide/Show data table"** toggle, then the **table**. The toggle
  defaults to *shown*.
- **Accessible name** = a one-line summary, e.g. *"Spending trend over 6 months, 2026-02 to
  2026-07: total outflow $420.00 to $610.00 (up). Top spenders: Groceries, Dining."* Decorative
  innards are hidden.
- **Colour is never the sole signal.** Three series, one `--chart-*` token each (Total = `--chart-1`
  solid/circle; the two ranked envelopes = `--chart-2` dashed/square and `--chart-3` dashed/
  triangle) — dash pattern, end-marker shape, and a direct end-of-line text label all reinforce each
  series independently of colour. The exact figures are also always present as table text.
- Envelopes with **zero** outflow across the whole window never appear (no flat, meaningless zero
  line); a ranked envelope that had no spend in one particular month within the window still shows
  as **$0.00** that month (0-filled), not a gap — so the line/table stay aligned to a continuous
  month axis.

## 6. Visual / motion

- On the **UX4 token sheet** + the shared `Insights.module.css` (controls, table styling); the
  **Months** toggle reuses the segmented-button convention from the Forecast view's day-horizon
  control. Desktop-first; the SVG scales fluidly.
- **No animation**; the disclosure toggles with `hidden` (never opacity on text), so the WCAG
  contrast gate and `prefers-reduced-motion` both hold.

## 7. Accessibility checklist

- [x] Chart `role="img"` + one-line `aria-label` summary; innards `aria-hidden`.
- [x] Real `<table>` fallback (native semantics) is the keyboard + SR source of truth, mirroring
      exactly what's charted.
- [x] Disclosure toggle: keyboard-operable, `aria-expanded` + `aria-controls` (inherited from
      `ChartFigure`).
- [x] Colour never the sole signal — one token per series, each also carrying its own dash + marker
      + direct label.
- [x] axe-clean (WCAG 2.2 AA) **light and dark**, with the chart rendered.
