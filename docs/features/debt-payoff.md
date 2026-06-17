<!--
FEATURE SPEC — #14b: analysis, debt payoff (paid-down vs. original principal · per-account + roll-up).
The SECOND half of the roadmap's "debt & credit trends" (#14); the installment-debt sibling of #14a
(credit utilization). ADDS the kind='loan' account type + a per-loan ORIGINAL PRINCIPAL store, and
derives payoff-% (+ a monthly trend) from existing balances. Pairs with docs/ux/debt-payoff.md.
-->

# Feature Spec — Analysis: debt payoff

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-014b                              |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-16                             |
| Related      | [Credit utilization](credit-utilization.md) (FEAT-014a) · [Accounts](accounts.md) (FEAT-001) · [UX](../ux/debt-payoff.md) · [Domain](../04_DOMAIN_MODEL.md) · [Data](../05_DATA_MODEL.md) · [API](../06_API_CONTRACT.md) · Roadmap #14 |

## 1. Summary

For every **loan** account, show how much of its **original principal** has been **paid down** —
**payoff % = paid-down ÷ original = 1 − owed/original** — plus a **month-by-month payoff trend** and a
**portfolio roll-up** across all loans. "Owed" already exists as derived data (a loan carries its debt
as a negative balance, so `owed = −balance`); the missing pieces were (a) a **place to record a loan**
— there was no installment-debt account type — and (b) the **original principal**. This slice adds the
new **`kind='loan'`** account type and a per-loan original-principal store (one positive amount per
loan, set/cleared inline), then derives payoff.

This is the **second half of the roadmap's `#14` "debt & credit trends,"** the sibling of `#14a`
(credit utilization). The two are symmetric: a **credit** account has a **limit** → utilization
(`owed/limit`); a **loan** account has an **original principal** → payoff (`1 − owed/original`).

## 2. Scope

- **In scope** — the new **`kind='loan'`** account type; a per-loan **original principal** (a single
  positive amount; not effective-dated) set/cleared **inline**; **current payoff** per loan
  (`owedCents`, `paidDownCents`, `payoffBps`); a **monthly payoff trend** (cumulative owed per period);
  a **portfolio roll-up** (`Σ(original − owed) ÷ Σ original` over loans with a principal); archived loan
  accounts shown only when they still carry a principal or a non-zero balance.
- **Out of scope** — **effective-dated / refinance-aware** original principal (the trend applies the
  current original throughout — owner decision §11); interest / APR / amortization-schedule / payoff-
  date projection (that would be a forward projection like `#13`, not this aggregate); editing an
  existing account's kind (no edit-kind endpoint in V1 — a loan is created as `kind='loan'`); minimum-
  payment modeling; charts/sparklines (text tables in V1; the visual pass is `#16`).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to record a loan and its original amount so I can track how far I've paid it down. | Must |
| US-2 | As the user, I want to see, per loan, how much I still owe and the % paid off, so I know my progress. | Must |
| US-3 | As the user, I want payoff shown over time so I can see the loan trending toward zero. | Should |
| US-4 | As the user, I want an overall payoff across all my loans so I see my total debt progress at a glance. | Should |
| US-5 | As the user, I want a brand-new loan to read 0% and a settled one to read 100%, with overpayment shown honestly. | Should |

## 4. Acceptance criteria

- **Given** a loan with a `$10,000.00` original principal currently owing `$7,500.00` (a negative
  balance), **then** its row shows **owed `$7,500.00`**, **paid down `$2,500.00`**, and **payoff
  `25.0%`** (`1 − owed/original`, as text — not colour/bar alone).
- **Given** a brand-new loan (owed = original), **then** payoff reads **`0.0%`**; **given** a settled
  loan (balance `$0`), **then** payoff reads **`100.0%`**.
- **Given** an **overpaid** loan (balance positive), **then** owed reads as overpaid and payoff reads
  **above 100%** (truthful, not clamped); owing more than the original reads **below 0%**.
- **Given** a loan with **no original principal set**, **then** its row still shows owed (and a trend)
  but payoff reads **`— (set an original principal)`**, and the loan is **excluded** from the roll-up.
- **Given** monthly loan activity, **then** the **trend** shows, per month, the **cumulative** owed
  balance through that month and its payoff; the **final** trend point equals the current owed.
- **Given** loans with originals, **then** the **roll-up** = `Σ(original − owed) ÷ Σ original` over
  those loans; loans without an original do not contribute.
- **Setting** a principal (PUT) **replaces** any existing one; **clearing** (DELETE) removes it and is
  **idempotent**. A principal ≤ 0 / unparseable → `400`; a principal on a **non-loan** account → `400`;
  a principal on a missing account → `404`.
- **Only** `kind='loan'` accounts appear in the report; other kinds are excluded. `POST /accounts`
  accepts `kind='loan'`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Brand-new loan (owed = original) | payoff `0.0%`; paid down `$0.00`. |
| Settled loan (balance 0) | payoff `100.0%`; paid down = original; owed reads "$0.00 (paid off)". |
| Overpayment (balance positive) | owed negative ("$… overpaid"); payoff > 100%; paid down > original. Truthful, not clamped. |
| Owing more than the original (fees / negative amortization) | payoff < 0%. Truthful, not clamped. |
| No original principal set | `originalPrincipalCents`/`paidDownCents`/`payoffBps` are `null`; the UI shows an empty input + `— (set an original principal)`; excluded from the roll-up. |
| Principal on a checking/savings/credit/cash/other account | Rejected at the boundary → `400` ("An original principal applies only to loan accounts."). |
| No loan accounts at all | Empty report (`accounts: []`, totals `0`, aggregate `null`); the UI shows guidance to add a loan account. |
| Archived loan account, dormant (no principal, settled balance) | Omitted. Archived **with** a principal or non-zero balance ⇒ shown, flagged "(archived)". |
| Principal with leading/trailing space or `$` | Parsed at the boundary (`parseMoney`); unparseable → `400`. |

## 6. Data changes

**The new `kind='loan'` account type** — the accounts `kind` check is **evolved** idempotently (drop
the foundation's inline `accounts_kind_check`, add a named `accounts_kind_chk` allowing the 6th kind),
mirroring the FEAT-007 transactions-kind evolution. Existing rows (the original 5 kinds) all satisfy
the wider set, so it is safe. This also touches the domain `ACCOUNT_KINDS` and the web kind list. A
**reversible, additive** enum extension (like envelope `sinking_fund`) — a **definition**, not an ADR.

**One new table** — [`loan_principals`](../05_DATA_MODEL.md) (FEAT-014b): `id`, `household_id`,
`account_id` (**unique** — one per account), `original_principal_cents` (`BIGINT`, `> 0`),
`created_at`, `updated_at`. **No row = no principal.** Mutable config (not a ledger row). Ships with an
**idempotent** migration in `db/migrate.ts`. Money stays **integer cents**. A **reversible,
non-effective-dated** number — a **definition in this spec, not an ADR** (owner decision §11). The
**owed / payoff / paid-down / trend / roll-up** add **no** schema: they are read-only aggregates over
the derived balance and `transactions` (the same read as FEAT-014a).

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):

- `GET /analysis/debt-payoff` → `200 { report }`.
- `PUT /accounts/:id/original-principal` `{ amount: string }` → `200 { loanPrincipal }` (set/replace).
- `DELETE /accounts/:id/original-principal` → `204` (clear; idempotent).
- `POST /accounts` now accepts `kind='loan'`.

```
DebtPayoffReport = {
  accounts: LoanAccountPayoff[];   // loan accounts, by name
  totalOriginalCents: number;      // Σ original over loans WITH a principal
  totalOwedCents: number;          // Σ owed (signed) over loans WITH a principal
  totalPaidDownCents: number;      // totalOriginal − totalOwed
  payoffBps: number | null;        // totalPaidDown/totalOriginal in bps; null when no such loans
}
LoanAccountPayoff = {
  accountId: string; accountName: string; archived: boolean;
  originalPrincipalCents: number | null;  // null = no principal set
  owedCents: number;                       // −balance (positive = owed; ≤ 0 = paid off / overpaid)
  paidDownCents: number | null;            // original − owed; null when no principal
  payoffBps: number | null;                // (1 − owed/original) in bps (truthful); null when no principal
  trend: PayoffPoint[];                    // ascending; one point per period with activity
}
PayoffPoint = { period: "YYYY-MM"; owedCents: number; payoffBps: number | null }
LoanPrincipalView = { accountId: string; originalPrincipalCents: number }
```

**The "owed" & "payoff" definitions (the modeling decisions).** **Owed = −balance** (the same
analysis-layer sign convention as FEAT-014a; the stored ledger sign is unchanged). **Payoff =
`round((1 − owed/original) × 10000)`** in integer **basis points** (`2500` = 25.0%) — **truthful, not
clamped** (0% origination, 100% settled, >100% overpaid, <0% over-owed). **Paid down = `original −
owed`**. The **trend** cumulates each month's net flow (`Σ transactions.amount_cents` bucketed by
`to_char(occurred_on,'YYYY-MM')`) into the period-end owed and its payoff, applying the **current**
original to every period (not effective-dated in V1). The **roll-up** sums `original` and signed `owed`
over loans with a principal. The math is a **pure domain function** (`debtPayoff` in
`@budgeteer/domain`); the read service (`analysisService.debtPayoff`) only gathers the I/O and feeds it
— structurally identical to `creditUtilization`.

UI: a new **Payoff** view (Dashboard button) with a roll-up summary, a per-loan table whose original-
principal column is an inline editor, and per-loan trend tables — see [UX](../ux/debt-payoff.md).

## 8. Dependencies

Real balances/transactions from FEAT-001/003; the new `kind='loan'` accounts. Reuses the API's
`parseMoney`/positive-magnitude boundary parse, the `{ error: { message } }` envelope + zod-at-boundary
house style, the `bigint`→`Number` read convention (ADR-0003), the FEAT-011 `to_char` monthly bucketing
+ FEAT-014a's cumulative-trend logic, and the web `formatCents`/`formatMoney`/`formatBps`. The CORS
allow-methods allowlist (`PUT`/`DELETE`, FEAT-012) covers the new write verbs. The original-principal
store mirrors `credit_limits` (FEAT-014a): set/clear, idempotent migration, household-scoped, `> 0`,
restricted to `kind='loan'`.

> **Spike?** No. Like FEAT-011/012/014a this **aggregates existing data + one stored number** — no
> forward projection (an amortization/payoff-date projection would be one, and is out of scope), no
> external source. The cumulative-trend technique was already proven by FEAT-014a's tests; payoff is a
> one-line formula over it.

## 9. Security, privacy & accessibility

Household-scoped server-side (principals carry `household_id`; the read is scoped on the account).
Inputs validated at the boundary: the principal is a positive-magnitude `parseMoney` (→ `400`), the
account is verified to exist in the household (→ `404`) **and** to be `kind='loan'` (→ `400`). Read is
otherwise read-only; tests use synthetic fixtures (no real data). Each view table is a real `<table>`
with a `<caption>` and `scope`'d headers; the roll-up is a `<dl role="status">`; each principal input is
labelled (`Original principal for <account>`); **every ratio is shown as TEXT** (a percentage,
"overpaid", "paid off", `— (set an original principal)`) — never colour or a bar alone; loading/empty/
error are `role="status"`/`role="alert"`. (WCAG 2.2 AA; the app-wide visual-contrast pass remains part
of the consolidated `#16` a11y/NFR pass.)

## 10. Test plan

- **Unit (domain, 8):** `payoffBps` (1 − owed/original in bps; truthful >100% / <0%; null/non-positive
  original); `debtPayoff` (owed = −balance + paid-down; trend cumulation; roll-up over principalled
  loans; null aggregate / empty input; a no-principal loan still reports owed + a trend with null
  payoff).
- **Integration (API, 10):** owed/payoff/paid-down; brand-new 0% / settled 100%; portfolio roll-up;
  overpayment (> 100%, paid-down beyond original); the monthly trend cumulates & **reconciles to current
  owed**; only loan accounts reported; a no-principal loan; set/replace/clear (idempotent) + principal
  on a non-loan account rejected; validation (bad amount → `400`, missing account → `404`); empty report.
- **Component (web, 4):** setting a principal inline reveals owed/paid-down/payoff + a trend; a settled
  loan reads 100% paid off; empty state (no loan accounts); load error.
- **e2e (Playwright):** the single journey is extended with a **debt-payoff step** — add a `kind='loan'`
  account owing money (exercising the new kind end to end), set its original principal via the inline
  editor (a real cross-origin **PUT** /accounts/:id/original-principal), and assert the derived `25.0%`
  renders against the real API.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~How is a loan modeled (no `kind='loan'` existed)?~~ | Wesley | **resolved: add `kind='loan'`** — symmetric with #14a (credit→limit→utilization, loan→original→payoff); a definition, no ADR |
| ~~Single original principal, or effective-dated?~~ | Wesley | **resolved: single** (a definition here, no ADR; the current original is applied throughout the trend) |
| ~~Per-loan, or a portfolio roll-up?~~ | Wesley | **resolved: both** (per-loan is the unit, plus an aggregate roll-up) — same as #14a |
| Effective-dated / refinance-aware original principal? | Wesley | open (V1: current original applied throughout the trend) |
| Interest / APR / amortization-schedule / payoff-date projection? | Wesley | open (a forward projection like #13; out of this aggregate slice) |
| Let an existing account be re-kinded to `loan`? | Wesley | open (V1: no edit-kind endpoint; create as `kind='loan'`) |
