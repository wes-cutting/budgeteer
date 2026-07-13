---
type: ux-spec
roadmap-item: BUD-S54
status: Accepted
---
<!--
UX SPEC — UX9: spending breakdown. A NEW Insights view: each envelope's share of a chosen month's
OUTFLOW as ranked horizontal bars (chart + data-table fallback), on the UX4 design system. Pairs
with FEAT-UX9. Contract: ADR-0007.
-->

# UX Spec — Insights: spending breakdown (share of outflow)

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | Accepted                                                       |
| Feature      | FEAT-UX9 ([feature spec](../features/spending-breakdown.md))   |
| Owner        | Wesley Cutting                                                 |
| Last updated | 2026-06-28                                                     |

## 1. User & job

The user wants to answer "**where did my money go this month?**" — not the precise number for one
envelope (the Budget view does that), but the **shape of the whole**: which envelopes dominate the
spending, and by how much. A ranked share chart answers it instantly: the longest bar at the top is
where most of the money went.

## 2. Entry point & navigation

A new **"Breakdown"** tab in the Insights sub-nav, second after **Spend** (`/insights/breakdown`,
deep-linkable per UX3). A self-contained page with its own `<h1>` ("Insights — spending breakdown").

## 3. Primary flow

1. Open **Insights → Breakdown** → the **Month** picker (default: current month), then the **chart**,
   then the **data table** load.
2. The user reads the ranked bars top-to-bottom: biggest spender first, each bar labelled with its
   envelope, dollar outflow, and percentage share.
3. To look at another month, the user changes the **Month** picker; the chart and table re-render.
4. A keyboard or screen-reader user hears the chart's one-line **summary** (count, total outflow, top
   slices), then navigates the **table** (native semantics) for every envelope · outflow · share — or
   toggles the table closed once oriented.

## 4. Screens & states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — month with no outflow: "No spending recorded for {month} yet — enter some withdrawals
  allocated to envelopes, then come back to see where the money went." **No chart.**
- **Populated** — the chart (`role="img"` + summary) above the ranked data table (Envelope · Outflow
  · Share, with a 100% total row).

## 5. The chart, as a screen element

- A `<figure>`: a **caption** ("Where the money went — {month}"), the **SVG** (ranked horizontal
  bars), a **"Hide/Show data table"** toggle, then the **table**. The toggle defaults to *shown*.
- **Accessible name** = a one-line summary, e.g. *"Spending breakdown for 2026-03: 3 envelopes, total
  outflow $555.00. Top: Groceries 64.9%, Dining 27.0%, Fun 8.1%."* Decorative innards are hidden.
- **Colour is never the sole signal — and here it carries no categorical meaning at all.** Every bar
  is one colour (`--chart-1`); a many-category breakdown can't get N distinguishable accessible hues,
  so the design leans entirely on **non-colour** signals: a **direct text label** per bar
  (`"1. Groceries — $360.00 (64.9%)"`), **rank order** (largest at the top), and **bar length**. The
  exact figures are also always present as table text.

## 6. Visual / motion

- On the **UX4 token sheet** + the shared `Insights.module.css` (controls, table styling). The
  per-bar label uses a dedicated `--color-text` style for full-contrast legibility. Desktop-first;
  the SVG scales fluidly and its height grows with the number of envelopes.
- **No animation**; the disclosure toggles with `hidden` (never opacity on text), so the WCAG
  contrast gate and `prefers-reduced-motion` both hold.

## 7. Accessibility checklist

- [x] Chart `role="img"` + one-line `aria-label` summary; innards `aria-hidden`.
- [x] Real `<table>` fallback (native semantics) is the keyboard + SR source of truth.
- [x] Disclosure toggle: keyboard-operable, `aria-expanded` + `aria-controls` (inherited from
      `ChartFigure`).
- [x] Colour never the sole signal — one bar colour; categories read from label + rank + length.
- [x] axe-clean (WCAG 2.2 AA) **light and dark**, with the chart rendered.
