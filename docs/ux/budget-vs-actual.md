---
type: ux-spec
roadmap-item: BUD-S16
status: Accepted
---
<!--
UX SPEC — #12: analysis, budget vs. actual. A new Budget view with a month picker and a table
(envelope · monthly target · spent · remaining) where the target is set/cleared INLINE. Pairs with
FEAT-012.
-->

# UX Spec — Analysis: budget vs. actual

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-012 ([feature spec](../features/budget-vs-actual.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-16                                     |

## 1. User & job

The user wants to plan what they intend to spend per envelope each month, then see how the month is
actually going against that plan — the spreadsheet's "Budget" comparison, but driven by the
transactions they already entered. They open Budget, set a monthly target on each envelope, and read
target vs. spent vs. remaining for the month they're reviewing.

## 2. Entry point & navigation

A **Budget** button in the Dashboard header (alongside Needs allocation / Templates / Recurring /
Analysis). It opens a full-page view with a **← Dashboard** back button and a **month picker**. The
view is household-wide (no per-account entry). Distinct from **Analysis** (FEAT-011), which is the
spend-over-time grid; Budget is the single-month plan-vs-actual.

## 3. Primary flow

1. Dashboard → **Budget**. The current month loads.
2. The table lists every active envelope with its **monthly target** (an inline input), the
   **spent** so far this month, and the **remaining** budget.
3. The user **types a target** into an envelope's input and presses **Save** (or Enter) — it
   persists and the remaining recomputes. A **Clear** button removes a target.
4. The user **changes the month** to review a different month; the table reloads for that month.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Budget | Monthly target vs. actual spend per envelope | **Month picker** · a **table** (envelope rows; columns: Monthly target [inline input + **Save** / **Clear**], Spent, Remaining) · **totals footer** · **← Dashboard** |

States:

- **Loading** — "Loading…" (`role="status"`).
- **Empty** — "No envelopes to budget yet — add envelopes, then set a monthly target on each."
- **Success** — the table; remaining reads `-$…` when over budget, `—` when no target is set.
- **Error** — `role="alert"` with the server message (load failures and save/clear failures).

## 5. Wireframe / layout

```
ANALYSIS — BUDGET VS. ACTUAL                                    [ ← Dashboard ]
Month: [ 2026-06 ▾ ]
Monthly target vs. actual spend for 2026-06 (remaining = target − spent; negative = over budget)

| Envelope  | Monthly target            |    Spent | Remaining |
|-----------|---------------------------|---------:|----------:|
| Dining    | [ 100.00 ] [Save] [Clear] | $150.00  |  -$50.00  |
| Fun       | [        ] [Save]         |  $45.00  |     —     |
| Groceries | [ 400.00 ] [Save] [Clear] | $360.00  |   $40.00  |
|-----------|---------------------------|---------:|----------:|
| Total     |                  $500.00  | $555.00  |  -$10.00  |
```

(Groceries was funded `+$500` that month, but **Spent** shows only the `$360` outflow — funding is
not spend.)

## 6. Interactions & inputs

- **Month picker** — a native `month` input (`YYYY-MM`); changing it reloads the table. Capped at
  the current month (`max`).
- **Target input** — one per row, a small decimal field (`Monthly target for <envelope>`). **Save**
  (submit / Enter) persists a positive amount; **Clear** (shown only when a target exists) removes
  it. Inputs disable while saving.
- The **Spent** and **Remaining** columns are **read-only**, right-aligned; the **totals** row is
  visually distinct (bold / a top border) but plain text.
- No drill-down to underlying transactions in V1 (cells are not links).

## 7. Content & copy

- Heading **"Analysis — budget vs. actual"**; the picker label **"Month"**; the table `<caption>`
  **"Monthly target vs. actual spend for `<month>` (remaining = target − spent; negative = over
  budget)"**; column headers **"Envelope" / "Monthly target" / "Spent" / "Remaining"**; **"Total"**
  for the footer; archived rows append **" (archived)"**; remaining shows **"—"** when no target;
  buttons **"Save"** / **"Clear"**; empty/loading/error copy as in §4.

## 8. Accessibility

A single `<table>` with a `<caption>`; column headers are `<th scope="col">`, envelope names are
`<th scope="row">`, the totals row sits in `<tfoot>`. Each target input has a visible/`aria-label`
association (`Monthly target for <envelope>`) inside a labelled `<form>` so Save/Enter submit works
with the keyboard. Negative remaining is conveyed as text (`-$…`), never colour alone; the
no-target marker is the em-dash. The month picker is a labelled native control. Loading/empty are
`role="status"`; errors `role="alert"`. (App-wide visual-contrast styling is the consolidated #16
a11y/NFR pass; this slice covers the per-view semantic a11y.)

## 9. Acceptance criteria (UX)

- **Given** envelopes, **when** I open Budget, **then** I see a row per active envelope with an
  editable monthly target, the spent this month, and the remaining budget, footed by totals.
- **Given** an envelope, **when** I type a target and Save, **then** it persists and the remaining
  recomputes; **when** I Clear it, **then** the remaining shows `—`.
- **Given** an envelope I funded but did not spend from this month, **then** Spent shows `$0.00` and
  the full target remains.
- **Given** I change the month, **then** the table reloads for that month.

## 10. Out of scope / later

Per-month / effective-dated targets; rollover of unspent budget; multi-month variance trends and
charts; per-cell drill-down to transactions; CSV export; percentage / category-group targets.
