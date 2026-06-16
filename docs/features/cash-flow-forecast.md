<!--
FEATURE SPEC — #13: analysis, cash-flow forecast (per-account, event-stepped). The analysis area's
one PROJECTING slice (vs. #11/#12 which only aggregate). De-risked by SPIKE-05. Pairs with
docs/ux/cash-flow-forecast.md.
-->

# Feature Spec — Analysis: cash-flow forecast

| Field        | Value                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature ID   | FEAT-013                                                                                                                                                                                                                                                                                                |
| Status       | Implemented                                                                                                                                                                                                                                                                                            |
| Owner        | Wesley Cutting                                                                                                                                                                                                                                                                                          |
| Last updated | 2026-06-16                                                                                                                                                                                                                                                                                             |
| Related      | [SPIKE-05](../spikes/05-cashflow-forecast.md) (de-risk) · [Recurring](recurring.md) (FEAT-009) · [Budget vs. actual](budget-vs-actual.md) (FEAT-012, the targets) · [Accounts](accounts.md) (FEAT-001) · [UX](../ux/cash-flow-forecast.md) · [Domain](../04_DOMAIN_MODEL.md) · [API](../06_API_CONTRACT.md) · PRD §6 (journey 9) |

## 1. Summary

For a chosen account, **project its cash balance forward** day-by-day over a horizon (default 90
days) and answer the spreadsheet's forward question — _"will I make it to the next paycheck, or go
negative?"_ The projection starts from the account's **derived current balance**
(`v_account_balances`) and applies **future dated events**: the account's **scheduled recurring
rules** (FEAT-009 — the firm, concrete core) and, as a toggle, **expected discretionary spend**
derived from the monthly **targets** (FEAT-012). It surfaces the running balance at each event plus
the headline answers — **ending balance**, **minimum balance + its date**, and the **first date the
balance goes negative**. This is the analysis area's only **projecting** slice; `#11`/`#12` aggregate
existing data, this one looks forward. De-risked by [SPIKE-05](../spikes/05-cashflow-forecast.md).

## 2. Scope

- **In scope** — a **per-account** cash-balance projection over a caller-set **horizon** (default 90
  days, capped); **event-stepped** (a running-balance point per future dated event, conservative
  same-day ordering); **scheduled** recurring rules as the firm core; an **`+expected spend`
  toggle** (default **on**) that folds monthly targets in as expected discretionary spend, **netted**
  so already-scheduled/already-spent money is not double-counted; the derived **ending / minimum /
  first-negative** summary.
- **Out of scope** — multi-account or total-cash forecast (V1 is one account); a per-envelope→account
  attribution of discretionary spend (V1 attributes household discretionary to the forecast account —
  §4); **envelope-balance** forecasting; alternate spreading strategies in the UI (even-daily only in
  V1; month-start is proven but deferred); what-if / scenario editing; charts beyond the running-balance
  table/line; debt-payoff projection (that is `#14`).

## 3. User stories

| ID   | Story                                                                                                                            | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-1 | As the user, I want to see my account's projected balance over the coming weeks so I know whether I'll make it to my next paycheck. | Must     |
| US-2 | As the user, I want to know the **lowest** my balance is projected to reach (and when) so I can spot a cash crunch early.            | Must     |
| US-3 | As the user, I want to be warned if the projection goes **negative**, with the date it first does.                                 | Must     |
| US-4 | As the user, I want to toggle whether expected discretionary spend (from my targets) is included, so I can see the firm bills-only floor vs. the fuller picture. | Should   |
| US-5 | As the user, I want to choose how far ahead to look (e.g. 30 / 60 / 90 days) so I can plan over the period I care about.            | Should   |

## 4. Acceptance criteria

- **Given** an account with derived balance `$1,240.00` and a biweekly `$2,100` paycheck + monthly
  `$1,500` rent + `$120` electric, **then** the forecast lists each **future** occurrence with the
  **running balance after it**, in date order, over the horizon, and reports the **ending balance**,
  the **minimum balance + its date**, and **first-negative = none**.
- **Given** a thin account (`$200`) with rent `−$1,500` due before the next paycheck, **then**
  `firstNegativeDate` is **the rent date** and `minBalanceCents` is the post-rent low (`−$1,300`).
- **Given** the `+expected` toggle is **on** and an envelope's monthly target is **fully covered** by
  a scheduled withdrawal (e.g. Rent $1,500 target with a scheduled $1,500 rent) or by already-posted
  actual spend this month, **then** that envelope contributes **$0** expected spend (no
  double-counting); only the **uncovered discretionary residual** (`max(0, target − actual −
  scheduled)`) is projected.
- **Given** the `+expected` toggle is **off**, **then** only scheduled events are projected (the firm
  floor); turning it **on** can only **lower** the ending/minimum balance, never raise it.
- **Given** a recurring occurrence that is **past-due but unposted** (cursor ≤ today), **then** it is
  **excluded** from the forecast (the projection plots only `date > today`; past-due remains the
  Recurring view's `dueCount` concern), so the starting point equals the derived balance exactly.
- **Given** `horizonDays` outside `[7, 365]` or non-integer → `400`; **given** an `accountId` that is
  missing / not in the household → `404`.
- All money is **integer cents**; the even-daily spread of a month's residual sums back **exactly**
  (no rounding drift).

## 5. Edge cases & error handling

| Scenario                                              | Expected behavior                                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No recurring rules on the account, toggle off         | A flat projection: one "point" is the start; ending = starting; min = starting; first-negative = none. Empty-ish but valid (the view shows the flat line). |
| Account already negative today                        | `firstNegativeDate` = the **start date**; min ≤ starting balance. Truthful, not clamped.                                                                   |
| Same-day deposit **and** withdrawal                   | Applied **most-negative-first** (conservative), so the intraday min is the honest "could I bounce?" floor.                                                  |
| Scheduled bill falls **just outside** the horizon     | Its target leaks as a small expected residual in the clipped tail month (prorated). Documented; acceptable for a budget projection (SPIKE-05 §3 caveat).    |
| Current (partial) month                               | Expected residual = `target − actualThisMonth − scheduledRemaining` (the genuine remaining budget; **not** prorated). Future-tail months are prorated by day fraction. |
| Long-dormant rule (cursor far in the past)            | Engine enumerates from the cursor but the forecast filters to `date > today`; bounded by the engine's catch-up cap.                                         |
| Discretionary residual but no account link            | V1 attributes the household discretionary residual to the **forecast account** (assumption: this account pays the budget) — surfaced in copy; the scheduled-only floor never depends on it. |

## 6. Data changes

**None — no new table or view.** Like FEAT-011, the forecast is a **read-only derivation** over data
that already exists: `v_account_balances` (starting balance), `recurring_transactions` +
`recurring_lines` (scheduled events, FEAT-009), `envelope_targets` (FEAT-012), and the current-month
outflow aggregate over `allocations ⋈ transactions` (the same basis as FEAT-012's "actual"). This is
the **key difference from `#12`**, which added a store. Money stays **integer cents** end to end
(summed/derived in SQL, narrowed at the read boundary, projected by a pure domain function). No ADR:
the target-folding is a **definition** (how expected spend is netted + spread), not an effective-dated
or irreversible data decision — same call as FEAT-011/FEAT-012.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):

- `GET /analysis/cash-flow-forecast?accountId=<uuid>&horizonDays=90&includeExpected=true` → `200 { forecast }`.

```
CashFlowForecast = {
  accountId: string;
  accountName: string;
  startDate: string;             // today, "YYYY-MM-DD"
  endDate: string;               // start + horizonDays
  horizonDays: number;
  includeExpected: boolean;
  startingBalanceCents: number;  // derived current balance (v_account_balances)
  points: ForecastPoint[];       // date-ascending; running balance AFTER each event
  endingBalanceCents: number;
  minBalanceCents: number;       // lowest running balance over the horizon (incl. the start)
  minBalanceDate: string;        // "YYYY-MM-DD"
  firstNegativeDate: string | null; // first date balance < 0, or null
}
ForecastPoint = {
  date: string;                  // "YYYY-MM-DD"
  deltaCents: number;            // signed cash effect of the event
  balanceCents: number;          // running balance after applying it
  kind: "scheduled" | "expected";
  label: string;                 // "Paycheck" / "Rent" / "Expected discretionary spend"
}
```

**The forecast model (the modeling decision, proven by [SPIKE-05](../spikes/05-cashflow-forecast.md)).**
A **pure domain function** `cashFlowForecast(startingBalanceCents, today, rules, targets,
actualThisMonth, opts)` builds the series; the `analysisService` read feeds it I/O. (1) **Scheduled
events**: each account rule via the recurring engine (`dueOccurrences` fed the **horizon** as its
bound), filtered to `date > today`, contributing `±magnitude`. (2) **Expected spend** (when
`includeExpected`): per month, `Σ over target envelopes max(0, target − actualThisMonth −
scheduledThisMonth)` (current month un-prorated; future-tail prorated), spread **even-daily**, as
negative deltas. Events are sorted by `(date asc, delta asc)` and accumulated from the starting
balance. Defaults: `horizonDays=90` (capped `[7,365]`), `includeExpected=true`.

UI: a new **Forecast** view (Dashboard button) with an **account picker**, a **horizon** control, an
**`include expected spend`** toggle, the **summary** (ending / min+date / first-negative), and a
**running-balance table** — see [UX](../ux/cash-flow-forecast.md).

## 8. Dependencies

Reuses the `@budgeteer/domain` **recurring engine** (`dueOccurrences`/`anchorDayOf`, FEAT-009 —
**unchanged**, just fed a future bound; proven by SPIKE-05); `v_account_balances` (the derived
starting balance); the FEAT-012 outflow-spend basis for current-month actuals; the API's
zod-at-boundary + `{ error: { message } }` envelope + `bigint`→`Number` read convention (ADR-0003);
the web `formatCents`/`formatMoney` (EH1) and `util/dates`. **The projection math is a pure domain
function** (`packages/domain/src/forecast.ts`) — no I/O, unit-tested in isolation; the
`analysisService.cashFlowForecast` read assembles the inputs; the view is thin. CORS already allows
`GET` (no new write verbs — read-only slice).

## 9. Security, privacy & accessibility

Household-scoped server-side: the account is verified in the household (→ `404`), and rules / targets
/ actuals are all scoped on `household_id`. Inputs validated at the boundary: `accountId` a required
string, `horizonDays` an integer in `[7,365]` (→ `400`), `includeExpected` a boolean. Read-only —
no writes, no balance-view change; tests use synthetic fixtures (no real data). The view is a real
`<table>` (caption, `scope`'d headers, deposits/withdrawals distinguished by **text**, not colour);
the summary states ending / minimum / first-negative in words; the **negative / first-negative
warning is text** (not colour alone) with `role="status"`; controls (account picker, horizon, toggle)
are labelled native inputs; loading/empty are `role="status"`, errors `role="alert"`. (WCAG 2.2 AA;
the app-wide visual-contrast pass remains the consolidated `#16` a11y/NFR pass.)

## 10. Test plan

- **Unit (domain, the projection core):** the running-balance walk (ending, **min + date**,
  **first-negative**); conservative same-day ordering (out-before-in); scheduled-event generation
  fed a future horizon (strictly-future filter); the **anti-double-count** residual (fully-scheduled /
  already-spent → `$0`); current-month-vs-future-tail proration; even-daily spread **cent-exact**;
  `+expected` only lowers the balance; horizon clamp.
- **Integration (API/PGlite):** real rules + targets + actuals → the forecast shape and the headline
  numbers; `includeExpected` on/off; default horizon; validation (`horizonDays` out of range → `400`,
  missing account → `404`); cent-exactness; household scoping.
- **Component (web):** summary + table render (ending / min / first-negative; scheduled vs. expected
  rows); toggle expected on/off reloads; horizon change reloads; account picker; empty (flat) state;
  load error.
- **e2e (Playwright):** the journey is extended with a **Forecast step** — open Forecast for the
  seeded account, assert the projected balance and the summary render against the **real API**.

## 11. Open questions

| Question                                                                              | Owner  | Status                                                                                                                                            |
| ------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~What is forecast — account cash, envelope balances, or both?~~                      | Wesley | **resolved: per-account cash** (the "will I go negative before payday?" question); envelope-balance forecast deferred                              |
| ~~Inputs — scheduled-only, or scheduled + expected spend from targets?~~              | Wesley | **resolved: both** — scheduled is the firm core; expected spend is a toggle (default on), netted to avoid double-counting (SPIKE-05)               |
| ~~Horizon & grain?~~                                                                  | Wesley | **resolved: event-stepped running balance, 90-day default** (caller-set, capped `[7,365]`)                                                         |
| ~~How to place a monthly target on a dated timeline without double-counting?~~        | Wesley | **resolved (SPIKE-05): residual = max(0, target − actual − scheduled), spread even-daily**; current month un-prorated, future-tail prorated        |
| Multi-account / total-cash forecast?                                                  | Wesley | open (V1 is one account; deposits/rules are account-scoped, so per-account is the firm unit)                                                       |
| Per-envelope→account attribution of discretionary spend?                              | Wesley | open (V1 attributes household discretionary to the forecast account; the scheduled-only toggle is the assumption-free floor)                       |
| Expose the conservative **month-start** spread (vs. even-daily) in the UI?            | Wesley | open (proven in SPIKE-05; even-daily is the V1 default, month-start deferred)                                                                      |
