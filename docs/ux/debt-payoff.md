<!--
UX SPEC — #14b: analysis, debt payoff. A new Payoff view with a portfolio roll-up, a per-loan-account
table (original principal set/cleared INLINE · owed · paid down · payoff), and per-loan payoff-over-time
trend tables. The installment-debt sibling of the Credit view (#14a). Pairs with FEAT-014b.
-->

# UX Spec — Analysis: debt payoff

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-014b ([feature spec](../features/debt-payoff.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-16                                     |

## 1. User & job

The user wants to see how far they've paid down their loans — how much of each loan's original amount
is gone, whether it's trending toward zero, and their overall debt-payoff progress. They open Payoff,
record each loan's original principal once, and read owed / paid down / payoff per loan, a trend per
loan, and an overall roll-up.

## 2. Entry point & navigation

A **Payoff** button in the Dashboard header (alongside Needs allocation / Templates / Recurring /
Analysis / Budget / Forecast / Credit). It opens a full-page view with a **← Dashboard** back button
and covers **only `kind='loan'` accounts**. The installment-debt sibling of the **Credit** view
(FEAT-014a, revolving credit vs. a limit).

## 3. Primary flow

1. Create the loan as a **`kind='loan'`** account (the Dashboard "Add account" form now offers it),
   opened with the amount owed as a negative starting balance.
2. Dashboard → **Payoff**. The report loads (all loan accounts).
3. A **roll-up summary** shows total original, total still owed, total paid down, and overall payoff
   (across loans that have an original principal).
4. The **per-loan table** lists each loan with its **original principal** (an inline input), **owed**,
   **paid down**, and **payoff**.
5. The user **types a principal** into a loan's input and presses **Save** (or Enter) — it persists and
   owed/paid-down/payoff recompute. A **Clear** button removes a principal.
6. Below the table, a **payoff-over-time** table per loan shows owed and payoff each month.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Payoff | Paid-down vs. original per loan, with a trend and roll-up | **Roll-up** (`<dl>`: total original · total owed · total paid down · overall payoff) · a **table** (loan rows; columns: Original principal [inline input + **Save** / **Clear**], Owed, Paid down, Payoff) · per-loan **trend tables** (Month · Owed · Payoff) · **← Dashboard** |

States:

- **Loading** — "Loading…" (`role="status"`).
- **Empty** — "No loan accounts yet — add an account with the _loan_ kind, then set its original
  principal to track payoff."
- **Success** — the roll-up + table(s); payoff reads `25.0%`, `100.0%` (settled), `0.0%` (new), or
  `— (set an original principal)`; owed reads "$… overpaid" / "$0.00 (paid off)" at the edges.
- **Error** — `role="alert"` with the server message (load failures and save/clear failures).

## 5. Wireframe / layout

```
ANALYSIS — DEBT PAYOFF                                          [ ← Dashboard ]

Total original (across loans with a principal): $30,000.00
Total still owed:                               $20,000.00
Total paid down:                                $10,000.00
Overall payoff:                                 33.3%

Each loan account: how much of its original principal is paid down (payoff = 1 − owed ÷ original)
| Account      | Original principal           |       Owed | Paid down |  Payoff |
|--------------|------------------------------|-----------:|----------:|--------:|
| Car loan     | [ 10000.00 ] [Save] [Clear]  |  $5,000.00 | $5,000.00 |  50.0%  |
| Student loan | [ 20000.00 ] [Save] [Clear]  | $15,000.00 | $5,000.00 |  25.0%  |

Payoff over time — Car loan
| Month   |       Owed | Payoff |
|---------|-----------:|--------|
| 2026-01 | $10,000.00 |  0.0%  |
| 2026-02 |  $8,000.00 | 20.0%  |
| 2026-03 |  $5,000.00 | 50.0%  |
```

## 6. Interactions & inputs

- **Original-principal input** — one per row, a small decimal field (`Original principal for <account>`).
  **Save** (submit / Enter) persists a positive amount; **Clear** (shown only when a principal exists)
  removes it. Inputs disable while saving. A principal on a non-loan account can't arise here (the view
  lists only loan accounts), but the server still rejects it (→ `400`) defensively.
- The **Owed**, **Paid down**, and **Payoff** columns are **read-only**, right-aligned. Owed is text: a
  debt amount, "$… overpaid" when overpaid, or "$0.00 (paid off)". Payoff is text: a percentage, or
  `— (set an original principal)` when no principal.
- The **roll-up** is a labelled description list (`role="status"`), not a table.
- The **trend tables** (one per loan with activity) are read-only; no drill-down to transactions in V1.

## 7. Content & copy

- Heading **"Analysis — debt payoff"**; roll-up labels **"Total original (across loans with a
  principal)" / "Total still owed" / "Total paid down" / "Overall payoff"**; the main table `<caption>`
  **"Each loan account: how much of its original principal is paid down (payoff = 1 − owed ÷
  original)"**; column headers **"Account" / "Original principal" / "Owed" / "Paid down" / "Payoff"**;
  archived rows append **" (archived)"**; the no-principal payoff marker **"— (set an original
  principal)"**; owed edge markers **"$… overpaid"** / **"$0.00 (paid off)"**; trend caption **"Payoff
  over time — `<account>`"** with headers **"Month" / "Owed" / "Payoff"**; buttons **"Save"** /
  **"Clear"**; empty/loading/error copy as in §4.

## 8. Accessibility

Real `<table>`s with `<caption>`s; column headers are `<th scope="col">`, account names / months are
`<th scope="row">`. The roll-up is a `<dl role="status">`. Each principal input has a visible/`aria-label`
association (`Original principal for <account>`) inside a labelled `<form>` so Save/Enter submit works
with the keyboard. **Every ratio is conveyed as text** — the percentage, "overpaid", "paid off",
`— (set an original principal)` — never colour or a bar alone. Loading/empty are `role="status"`; errors
`role="alert"`. (App-wide visual-contrast styling is the consolidated `#16` a11y/NFR pass; this slice
covers the per-view semantic a11y.)

## 9. Acceptance criteria (UX)

- **Given** loan accounts, **when** I open Payoff, **then** I see a roll-up and a row per loan with an
  editable original principal, owed, paid down, and payoff.
- **Given** a loan, **when** I type a principal and Save, **then** it persists and owed/paid-down/payoff
  recompute; **when** I Clear it, **then** payoff shows "— (set an original principal)".
- **Given** a settled loan, **then** payoff reads "100.0%" and owed reads "$0.00 (paid off)".
- **Given** loan activity, **then** a per-loan trend table shows owed and payoff each month.
- **Given** no loan accounts, **then** I see guidance to add one (with the loan kind).

## 10. Out of scope / later

Effective-dated / refinance-aware original principal; interest / APR / amortization-schedule / payoff-
date projection; minimum-payment modeling; charts/sparklines; per-cell drill-down to transactions; CSV
export; re-kinding an existing account to `loan`.
