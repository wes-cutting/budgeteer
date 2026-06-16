<!--
UX SPEC — #11: analysis, spend by envelope over time. A new Analysis view with a grain toggle
(Monthly / Annual) and an envelope × period grid of net flow. Pairs with FEAT-011.
-->

# UX Spec — Analysis: spend by envelope over time

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-011 ([feature spec](../features/analysis-envelope-spend.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-15                                     |

## 1. User & job

The user wants the at-a-glance view the spreadsheet's "18 Monthly" tab gave them — *how did each
envelope move, month by month* — but **generated** from the transactions they already entered,
not hand-keyed. They open Analysis, read the grid, and toggle to an annual view for the big picture.

## 2. Entry point & navigation

An **Analysis** button in the Dashboard header (alongside Needs allocation / Templates /
Recurring). It opens a full-page view with a **← Dashboard** back button. No per-account entry —
the rollup is household-wide.

## 3. Primary flow

1. Dashboard → **Analysis**.
2. The **monthly** grid loads: envelopes down the side, months across the top, net flow in each
   cell, a **Total** column on the right and a **totals row** at the bottom.
3. The user reads spending (negative cells) and funding (positive cells); the totals foot the grid.
4. The user flips the **grain toggle** to **Annual** → the columns collapse to years; the same
   cells re-aggregate.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Analysis | Spend/flow by envelope over time | **Grain toggle** (Monthly / Annual) · a **grid table** (envelope rows × period columns, net-flow cells) · **Total** column · **totals footer** row · **← Dashboard** |

States:
- **Loading** — "Loading…" (`role="status"`).
- **Empty** — "No spending to analyze yet — enter and allocate some transactions first."
- **Success** — the grid; negative cells read as `-$…`, positive as `$…`.
- **Error** — `role="alert"` with the server message.

## 5. Wireframe / layout

```
ANALYSIS                                                        [ ← Dashboard ]
Grain:  (•) Monthly   ( ) Annual

| Envelope           | 2026-03 | 2026-04 |   Total |
|--------------------|--------:|--------:|--------:|
| Groceries          | -$60.00 | -$80.00 |-$140.00 |
| Rent               |   $0.00 |   $0.00 |   $0.00 |
| Vacation (archived)| $200.00 | $200.00 | $400.00 |
|--------------------|--------:|--------:|--------:|
| Total              | $140.00 | $120.00 | $260.00 |
```

(Annual grain: the period columns become `2026`, `2027`, … with the same row/Total/footer shape.)

## 6. Interactions & inputs

- **Grain toggle** — Monthly / Annual radio group; switching reloads the grid for that grain.
- The grid is **read-only** — no editing, no drill-down in V1 (cells are not links).
- Numbers are **right-aligned**; the **Total** column and **totals** row are visually distinct
  (bold / a top border) but still plain text.

## 7. Content & copy

- Heading **"Analysis — spend by envelope"**; toggle label **"Grain"** with **"Monthly"** /
  **"Annual"**; the table `<caption>` **"Net flow by envelope over time (positive = funded,
  negative = spent)"**; **"Total"** for the row/column totals; archived rows append **"
  (archived)"** to the name; empty copy as in §4.

## 8. Accessibility

A single `<table>` with a `<caption>`; period columns are `<th scope="col">`, envelope names are
`<th scope="row">`, the totals row sits in `<tfoot>`. Sign is text (`-$…`), never color alone. The
grain toggle is a labeled radio group, keyboard-operable. Loading/empty are `role="status"`;
errors `role="alert"`. Numeric cells use right alignment for scanability without relying on it for
meaning.

## 9. Acceptance criteria (UX)

- **Given** allocation history, **when** I open Analysis, **then** I see a grid of envelopes ×
  months with net-flow cells and footed totals.
- **Given** the grid, **when** I switch to **Annual**, **then** the columns become years and the
  cells re-aggregate.
- **Given** no allocations, **then** I see the empty-state message, not an empty grid.

## 10. Out of scope / later

Date-range filtering; gap-filling the month axis; per-cell drill-down to the underlying
transactions; charts/sparklines; CSV export; budget-vs-actual overlay (#12).
