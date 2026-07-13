---
type: ux-spec
roadmap-item: BUD-S18
status: Accepted
---
<!--
UX SPEC — #14a: analysis, credit utilization. A new Credit view with a portfolio roll-up, a
per-credit-account table (limit set/cleared INLINE · owed · available · utilization), and per-account
utilization-over-time trend tables. Pairs with FEAT-014a.
-->

# UX Spec — Analysis: credit utilization

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-014a ([feature spec](../features/credit-utilization.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-16                                     |

## 1. User & job

The user wants to know how heavily they're leaning on their credit cards — how much is owed against
each card's limit (utilization), whether it's trending up or paying down, and their overall credit
health across cards. They open Credit, record each card's limit once, and read owed / available /
utilization per card, a trend per card, and an overall roll-up.

## 2. Entry point & navigation

A **Credit** button in the Dashboard header (alongside Needs allocation / Templates / Recurring /
Analysis / Budget / Forecast). It opens a full-page view with a **← Dashboard** back button. The view
is household-wide and covers **only `kind='credit'` accounts**. Distinct from **Forecast** (FEAT-013,
per-account cash projection) and **Budget** (FEAT-012, envelope plan-vs-actual).

## 3. Primary flow

1. Dashboard → **Credit**. The report loads (all credit accounts).
2. A **roll-up summary** shows total owed, total credit limit, and overall utilization (across cards
   that have a limit).
3. The **per-account table** lists each credit account with its **credit limit** (an inline input),
   **owed**, **available**, and **utilization**.
4. The user **types a limit** into a card's input and presses **Save** (or Enter) — it persists and
   owed/available/utilization recompute. A **Clear** button removes a limit.
5. Below the table, a **utilization-over-time** table per card shows owed and utilization each month.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Credit | Owed vs. limit per credit account, with a trend and roll-up | **Roll-up** (`<dl>`: total owed · total limit · overall utilization) · a **table** (account rows; columns: Credit limit [inline input + **Save** / **Clear**], Owed, Available, Utilization) · per-account **trend tables** (Month · Owed · Utilization) · **← Dashboard** |

States:

- **Loading** — "Loading…" (`role="status"`).
- **Empty** — "No credit accounts yet — add an account with the _credit_ kind, then set its credit
  limit to track utilization."
- **Success** — the roll-up + table(s); utilization reads `30.0%`, `120.0% over limit` (over the
  limit), or `— (set a limit)` (no limit); owed reads `$… credit` when overpaid.
- **Error** — `role="alert"` with the server message (load failures and save/clear failures).

## 5. Wireframe / layout

```
ANALYSIS — CREDIT UTILIZATION                                   [ ← Dashboard ]

Total owed (across cards with a limit): $2,000.00
Total credit limit:                     $10,000.00
Overall utilization:                    20.0%

Each credit account: amount owed vs. its limit (utilization = owed ÷ limit; over 100% = over limit)
| Account | Credit limit                |      Owed |  Available | Utilization        |
|---------|-----------------------------|----------:|-----------:|--------------------|
| Amex    | [ 5000.00 ] [Save] [Clear]  |   $500.00 |  $4,500.00 | 10.0%              |
| Store   | [          ] [Save]         |   $200.00 |        —   | — (set a limit)    |
| Visa    | [ 5000.00 ] [Save] [Clear]  | $1,500.00 |  $3,500.00 | 30.0%              |

Utilization over time — Visa
| Month   |      Owed | Utilization |
|---------|----------:|-------------|
| 2026-01 |   $500.00 | 10.0%       |
| 2026-02 | $1,200.00 | 24.0%       |
| 2026-03 | $1,500.00 | 30.0%       |
```

## 6. Interactions & inputs

- **Limit input** — one per row, a small decimal field (`Credit limit for <account>`). **Save**
  (submit / Enter) persists a positive amount; **Clear** (shown only when a limit exists) removes it.
  Inputs disable while saving. A limit on a non-credit account can't arise here (the view lists only
  credit accounts), but the server still rejects it (→ `400`) defensively.
- The **Owed**, **Available**, and **Utilization** columns are **read-only**, right-aligned. Owed is
  text: a debt amount, `$… credit` when overpaid, or `$0.00`. Utilization is text: a percentage, with
  `over limit` appended past 100%, or `— (set a limit)` when no limit.
- The **roll-up** is a labelled description list (`role="status"`), not a table.
- The **trend tables** (one per card with activity) are read-only; no drill-down to transactions in V1.

## 7. Content & copy

- Heading **"Analysis — credit utilization"**; roll-up labels **"Total owed (across cards with a
  limit)" / "Total credit limit" / "Overall utilization"**; the main table `<caption>` **"Each credit
  account: amount owed vs. its limit (utilization = owed ÷ limit; over 100% = over limit)"**; column
  headers **"Account" / "Credit limit" / "Owed" / "Available" / "Utilization"**; archived rows append
  **" (archived)"**; the no-limit utilization marker **"— (set a limit)"**; over-limit suffix
  **" over limit"**; the credit-balance owed marker **"$… credit"**; trend caption **"Utilization
  over time — `<account>`"** with headers **"Month" / "Owed" / "Utilization"**; buttons **"Save"** /
  **"Clear"**; empty/loading/error copy as in §4.

## 8. Accessibility

Real `<table>`s with `<caption>`s; column headers are `<th scope="col">`, account names / months are
`<th scope="row">`. The roll-up is a `<dl role="status">`. Each limit input has a visible/`aria-label`
association (`Credit limit for <account>`) inside a labelled `<form>` so Save/Enter submit works with
the keyboard. **Every ratio is conveyed as text** — the percentage, `over limit`, `— (set a limit)`,
and `$… credit` — never colour or a bar alone (so the view is readable without colour and to screen
readers). Loading/empty are `role="status"`; errors `role="alert"`. (App-wide visual-contrast styling
is the consolidated `#16` a11y/NFR pass; this slice covers the per-view semantic a11y.)

## 9. Acceptance criteria (UX)

- **Given** credit accounts, **when** I open Credit, **then** I see a roll-up and a row per credit
  account with an editable limit, owed, available, and utilization.
- **Given** a card, **when** I type a limit and Save, **then** it persists and
  owed/available/utilization recompute; **when** I Clear it, **then** utilization shows
  "— (set a limit)".
- **Given** a card over its limit, **then** utilization reads above 100% with "over limit" (text).
- **Given** card activity, **then** a per-card trend table shows owed and utilization each month.
- **Given** no credit accounts, **then** I see guidance to add one.

## 10. Out of scope / later

Debt payoff-% for installment loans (`#14b`); effective-dated limits; statement-cycle grain;
interest/APR/minimum-payment; charts/sparklines; per-cell drill-down to transactions; CSV export.
