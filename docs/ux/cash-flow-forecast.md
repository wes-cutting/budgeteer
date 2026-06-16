<!--
UX SPEC — #13: analysis, cash-flow forecast. A new Forecast view: pick an account, set a horizon,
toggle expected spend; read the summary (ending / min / first-negative) + a running-balance table.
Pairs with FEAT-013.
-->

# UX Spec — Analysis: cash-flow forecast

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | Accepted                                                       |
| Feature      | FEAT-013 ([feature spec](../features/cash-flow-forecast.md))   |
| Owner        | Wesley Cutting                                                 |
| Last updated | 2026-06-16                                                     |

## 1. User & job

The user wants the spreadsheet's forward look: _"given what's in my account now and what's coming
(paychecks, bills, and my usual spending), will I make it to the next paycheck without going
negative — and what's the lowest I'll get?"_ They open Forecast, pick the account they spend from,
and read a projected running balance plus a plain-language summary.

## 2. Entry point & navigation

A **Forecast** button in the Dashboard header (alongside Needs allocation / Templates / Recurring /
Analysis / Budget). It opens a full-page view with a **← Dashboard** back button. Distinct from
**Analysis** (FEAT-011, spend-over-time) and **Budget** (FEAT-012, this-month plan-vs-actual):
Forecast is the **forward** projection. It is **per-account** (an account picker), since recurring
rules and balances are account-scoped.

## 3. Primary flow

1. Dashboard → **Forecast**. The first account loads at the default 90-day horizon, with **expected
   spend on**.
2. The **summary** reads the headline answers: ending balance, the **lowest** projected balance and
   its date, and — if it dips below zero — the **first date it goes negative** (a warning).
3. The **running-balance table** lists each upcoming event (date · what it is · ± amount · balance
   after), in date order.
4. The user **switches account**, **changes the horizon** (30 / 60 / 90 days), or **toggles expected
   spend** off to see the firm bills-only floor; the projection reloads.

## 4. Screens & states

| Screen / view | Purpose                                  | Key elements                                                                                                                                                       |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forecast      | Projected account cash balance over time | **Account picker** · **Horizon** control (30/60/90) · **Include expected spend** toggle · **summary** (ending · min + date · first-negative) · a **running-balance table** · **← Dashboard** |

States:

- **Loading** — "Projecting…" (`role="status"`).
- **Empty / flat** — no upcoming events in the horizon: the summary shows the (unchanged) current
  balance and "No upcoming activity in the next N days."
- **Success** — the summary + table; the first-negative warning appears only when the projection dips
  below zero.
- **Error** — `role="alert"` with the server message.

## 5. Wireframe / layout

```
ANALYSIS — CASH-FLOW FORECAST                                   [ ← Dashboard ]
Account: [ Checking ▾ ]   Horizon: [ 30 ] [ 60 ] [•90•] days   [✓] Include expected spend

  Starting balance (today, 2026-06-16):  $1,240.00
  Projected on 2026-09-14 (90 days):     $9,517.34
  Lowest point:                          $1,207.84  on 2026-06-19
  ⚠ Goes negative:                       never

Projected balance after each upcoming event
| Date       | Event                        |     Amount |   Balance |
|------------|------------------------------|-----------:|----------:|
| 2026-06-19 | Paycheck                     |  +$2,100.00| $3,307.84 |
| 2026-06-20 | Electric                     |    −$120.00| $3,187.84 |
| 2026-06-…  | Expected discretionary spend |     −$X.XX | $…        |
| 2026-07-01 | Rent                         |  −$1,500.00| $1,570.00 |
| …          | …                            |        …   | …         |
```

(When **first-negative** is a real date, the ⚠ line names it and the offending row's balance reads
`-$…` as text. Even-daily "Expected discretionary spend" rows interleave with the scheduled ones.)

## 6. Interactions & inputs

- **Account picker** — a native `<select>` of the household's (non-archived) accounts; changing it
  reloads the projection for that account.
- **Horizon** — 30 / 60 / 90-day choices (default **90**); changing reloads. (Backed by
  `horizonDays`, capped server-side `[7,365]`.)
- **Include expected spend** — a checkbox (default **on**). Off → scheduled-only (the firm floor);
  on → scheduled + the netted discretionary residual from targets. A short note explains expected
  spend is estimated from monthly targets and assumed paid from this account.
- The table is **read-only**; no per-row drill-down in V1. Amounts right-aligned; deposits and
  withdrawals are distinguished by **sign/text** (`+`/`−`), not colour alone.

## 7. Content & copy

- Heading **"Analysis — cash-flow forecast"**; controls **"Account" / "Horizon" / "Include expected
  spend"**; summary labels **"Starting balance (today, `<date>`)" / "Projected on `<endDate>`
  (`<N>` days)" / "Lowest point" / "Goes negative"**; the negative value reads **"never"** or the
  **date**; table `<caption>` **"Projected balance after each upcoming event"**; column headers
  **"Date" / "Event" / "Amount" / "Balance"**; the expected-spend note **"Expected spend is estimated
  from your monthly targets (net of scheduled bills) and assumed paid from this account."**;
  empty/loading/error copy as in §4.

## 8. Accessibility

A single `<table>` with a `<caption>`; `<th scope="col">` headers, dates as `<th scope="row">`.
The account picker, horizon control, and toggle are labelled native controls. The summary is real
text (not a chart-only readout); the **first-negative / lowest-point** warning is conveyed in
**words and sign**, never colour alone, and announced via `role="status"`. Loading/empty are
`role="status"`; errors `role="alert"`. Respects `prefers-reduced-motion` (no animated drawing of any
balance line). (App-wide visual-contrast styling is the consolidated `#16` a11y/NFR pass; this slice
covers the per-view semantic a11y.)

## 9. Acceptance criteria (UX)

- **Given** an account, **when** I open Forecast, **then** I see a starting balance, a projected
  ending balance, the lowest projected point with its date, and whether/when it goes negative, plus a
  dated running-balance table.
- **Given** the projection dips below zero, **then** a clear text warning names the **first-negative
  date**.
- **Given** I toggle **expected spend off**, **then** the projection reloads showing scheduled bills
  only, and the ending/lowest balance is **no lower** than with it on.
- **Given** I change the **horizon** or **account**, **then** the projection reloads accordingly.

## 10. Out of scope / later

Multi-account / total-cash forecast; per-envelope→account attribution; envelope-balance forecasting;
the conservative month-start spread as a UI option; what-if scenario editing; a graphical balance
line beyond the table; CSV export.
