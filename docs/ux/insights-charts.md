<!--
UX SPEC — UX8: accessible charts on the six Insights views. Add a hand-rolled SVG chart above each
view's existing table (the table is the chart's accessible fallback), restyle onto the UX4 design
system, rename Analysis → Insights. Pairs with FEAT-UX8. Contract: ADR-0007.
-->

# UX Spec — Insights: accessible charts on the six analysis views

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Status       | Accepted                                                    |
| Feature      | FEAT-UX8 ([feature spec](../features/insights-charts.md))   |
| Owner        | Wesley Cutting                                              |
| Last updated | 2026-06-28                                                  |

## 1. User & job

The user opens an Insights view to **see a pattern at a glance** — "is net worth climbing?", "which
envelopes did I overspend?", "am I on budget?", "will cash dip negative?", "how close am I to my
credit limit / paying off this loan?". A number grid answers precisely but slowly; a chart answers
the shape instantly. UX8 adds the chart **without losing** the exact figures or the accessibility
bar — the grid stays, as the chart's accessible source of truth.

## 2. Entry point & navigation

Unchanged from UX3: the shell's **Insights** nav → the sub-nav tabs (Spend · Budget · Forecast ·
Credit · Payoff · Net worth), each a deep-linkable `/insights/:view` route. Each view is a
self-contained page with its own `<h1>` ("Insights — …").

## 3. Primary flow

1. Open an Insights view → the headline figures (where present), then the **chart**, then the
   **data table** load.
2. The user reads the chart for the shape, and scans the table for exact numbers.
3. On the editor views (Budget / Credit / Payoff) the user sets a target / limit / principal inline
   in the table; the chart re-renders from the updated read.
4. A keyboard or screen-reader user hears the chart's one-line **summary**, then navigates the
   **table** (native semantics) for every figure — or toggles the table closed once oriented.

## 4. Screens & states

Per view, four states (all pre-existing, unchanged):

- **Loading** — `role="status"` "Loading…/Projecting…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — guidance copy ("no activity yet / add a target / add a credit account…"); **no chart**.
- **Populated** — the chart (`role="img"` + summary) above the data table; on gauge views with no
  aggregate ratio yet (no limit / principal), the table renders **without** a gauge.

## 5. The chart, as a screen element

- A `<figure>`: a **caption**, the **SVG** chart, a **"Hide/Show data table"** toggle, then the
  **table**. The toggle defaults to *shown* so the editor tables stay reachable.
- **Accessible name** = a one-line summary of the trend/figures (e.g. *"Net worth over 3 periods,
  2026-01 to 2026-03: … net worth $1,000.00 to $1,300.00."*). Decorative innards are hidden from AT.
- **Colour never the sole signal**: line series carry a dash pattern + an end-marker shape + a direct
  label; bars use direction (above/below the zero baseline) + a hatch on the 2nd series + a text
  legend; gauges show the truthful percentage as text (including "over limit" / "paid off") plus a
  threshold marker. Series colours are the `--chart-*` tokens (≥ 3:1, light + dark).

## 6. Visual / motion

- On the **UX4 token sheet** — surfaces, type, spacing, focus ring, table styling all from tokens +
  the shared `Insights.module.css`. Desktop-first; the SVG scales fluidly (max-width caps it).
- **No animation** on the charts; the disclosure toggles with `hidden` (never opacity on text), so the
  WCAG contrast gate and `prefers-reduced-motion` both hold.

## 7. Accessibility checklist

- [x] Chart `role="img"` + one-line `aria-label` summary; innards `aria-hidden`.
- [x] Real `<table>` fallback (native semantics) is the keyboard + SR source of truth.
- [x] Disclosure toggle: keyboard-operable, `aria-expanded` + `aria-controls`.
- [x] Colour never the sole signal; truthful figures always present as table text.
- [x] axe-clean (WCAG 2.2 AA) **light and dark**, with each chart rendered.
