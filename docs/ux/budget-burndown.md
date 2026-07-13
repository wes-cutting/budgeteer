---
type: ux-spec
roadmap-item: BUD-S56
status: Accepted
---
<!--
UX SPEC — UX11: budget burn-down. A NEW Insights view: WITHIN-MONTH pace (spent ÷ target) vs. the
elapsed-time pace, as a Gauge (chart + data-table fallback), on the UX4 design system. Pairs with
FEAT-UX11. Contract: ADR-0007.
-->

# UX Spec — Insights: budget burn-down

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------- |
| Status       | Accepted                                                       |
| Feature      | FEAT-UX11 ([feature spec](../features/budget-burndown.md))    |
| Owner        | Wesley Cutting                                                 |
| Last updated | 2026-07-01                                                     |

## 1. User & job

The user wants to answer "**am I on pace this month?**" — *before* the month ends, so they can
course-correct. Budget vs. actual only tells them **after** ("did I stay within budget?"). The
burn-down compares **how much of the budget is spent** against **how much of the month has elapsed**,
so "I'm 50% through the month but 80% through Groceries" reads as a clear *over pace* — an early
warning, not a post-mortem.

## 2. Entry point & navigation

A new **"Burn-down"** tab in the Insights sub-nav, after **Budget** (its within-month companion)
(`/insights/burndown`, deep-linkable per UX3). A self-contained page with its own `<h1>` ("Insights —
budget burn-down").

## 3. Primary flow

1. Open **Insights → Burn-down** → the **Month** picker (default: current month) and the **Scope**
   picker (default: **All budgeted envelopes**) set what's paced, then the **verdict**, the **gauge**,
   and the **data table** load.
2. The user reads the **verdict** sentence (on track / over pace / over budget) and the **gauge**: the
   filled bar is budget consumed; the marker is "pace today" (where they'd be if spending evenly). Bar
   past the marker = ahead of pace.
3. To pace one envelope, the user picks it from **Scope**; the gauge + verdict re-render for that
   budget. Changing **Month** re-loads and resets scope to "All budgeted envelopes".
4. A keyboard or screen-reader user hears the gauge's one-line **summary** (scope, % of budget spent,
   the dollar figures, % of month elapsed, the verdict word), then navigates the **table** (native
   semantics) for every envelope's target · spent · % of budget · pace — or toggles it closed.

## 4. Screens & states

- **Loading** — `role="status"` "Loading…".
- **Error** — `role="alert"` with the failure message.
- **Empty** — no envelope has a target set: "No budgets set for {month} — set a monthly target in
  Insights — budget vs. actual, then come back to pace it." **No gauge, no scope picker.**
- **Populated** — a **verdict** sentence + the gauge (`role="img"` + summary) above the data table
  (Envelope · Monthly target · Spent · % of budget · Pace, + an "All budgeted envelopes" footer).

## 5. The chart, as a screen element

- A `<figure>`: a **caption** ("Budget burn-down — {scope}, {month}"), the **SVG** (a `Gauge` — a
  horizontal track with the consumed fill + a "pace today" threshold marker), a **"Hide/Show data
  table"** toggle, then the **table**. The toggle defaults to *shown*.
- **Accessible name** = a one-line summary, e.g. *"Groceries: 80.0% of the $200.00 budget spent
  ($160.00) with 50.0% of 2026-07 elapsed — over pace."* Decorative innards are hidden.
- **Colour is never the sole signal.** The on-track/over-pace/over-budget state is carried by:
  - **position** — the consumed fill relative to the "pace today" marker (bar past marker = over pace);
  - **text** — a **verdict sentence** above the gauge ("Over pace — you're spending faster than the
    month is elapsing."), the gauge's `valueLabel` ("80.0% of budget", "— over budget" past 100%), and
    the summary;
  - **table** — a **Pace** column stating "on track" / "over pace" / "over budget" in words per row.
  The single `--chart-1` token carries no state on its own.
- Past 100% (spent over the whole target) the gauge shows its **over-cap** and the value label appends
  "— over budget"; the pace marker still sits at the elapsed fraction.

## 6. Visual / motion

- On the **UX4 token sheet** + the shared `Insights.module.css` (controls, table styling, the new
  `.verdict` line — weight, not colour, for emphasis). Desktop-first; the SVG scales fluidly.
- **No animation**; the disclosure toggles with `hidden` (never opacity on text), so the WCAG contrast
  gate and `prefers-reduced-motion` both hold.

## 7. Accessibility checklist

- [x] Gauge `role="img"` + one-line `aria-label` summary (incl. the verdict word); innards `aria-hidden`.
- [x] Real `<table>` fallback (native semantics) is the keyboard + SR source of truth — exact figures
      + a text **Pace** column, so the state never rests on the gauge alone.
- [x] Disclosure toggle: keyboard-operable, `aria-expanded` + `aria-controls` (inherited from
      `ChartFigure`).
- [x] Colour never the sole signal — verdict text + marker position + the table's Pace column all
      encode the state independently of colour.
- [x] axe-clean (WCAG 2.2 AA) **light and dark**, with the gauge rendered.
