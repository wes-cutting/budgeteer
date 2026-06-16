<!--
FEATURE SPEC — #14a: analysis, credit utilization (owed vs. credit limit · per-account + roll-up).
The FIRST half of the roadmap's "debt & credit trends" (#14), split per the owner: utilization now,
installment-loan PAYOFF-% deferred to #14b. ADDS the per-credit-account CREDIT LIMIT store Budgeteer
lacked, and derives owed/utilization (+ a monthly trend) from existing balances. Pairs with
docs/ux/credit-utilization.md.
-->

# Feature Spec — Analysis: credit utilization

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-014a                              |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-16                             |
| Related      | [Budget vs. actual](budget-vs-actual.md) (FEAT-012) · [Spend-by-envelope](analysis-envelope-spend.md) (FEAT-011) · [Accounts](accounts.md) (FEAT-001) · [UX](../ux/credit-utilization.md) · [Domain](../04_DOMAIN_MODEL.md) · [Data](../05_DATA_MODEL.md) · [API](../06_API_CONTRACT.md) · Roadmap #14 |

## 1. Summary

For every **credit** account, show how much is **owed** against its **credit limit** — the
**utilization** ratio (`owed ÷ limit`) lenders and budgeters watch — plus a **month-by-month
utilization trend** and a **portfolio roll-up** across all cards. "Owed" already exists as derived
data (a credit account's balance is ≤ 0 when in debt, so `owed = −balance`); the missing half was the
**limit** — Budgeteer did not store a credit limit anywhere. This slice adds that per-account store
(one positive amount per card, set/cleared inline) and the utilization derivation.

This is the **first half of the roadmap's `#14` "debt & credit trends."** The owner split it
(as `#7` was split): **utilization now (`#14a`)**, **installment-debt payoff-% later (`#14b`)**.
Utilization maps cleanly onto the existing `kind='credit'` account and needs exactly one new
reversible number; payoff-% needs an original-principal / loan model (there is no `kind='loan'`) and
is the meatier follow-up the roadmap flagged as "likely spawns its own feature specs."

## 2. Scope

- **In scope** — a per-credit-account **credit limit** (a single positive amount; not effective-dated)
  set/cleared **inline**; **current utilization** per credit account (`owed ÷ limit`, as `owedCents`,
  `availableCents`, `utilizationBps`); a **monthly utilization trend** (cumulative owed per period);
  a **portfolio roll-up** (`Σ owed ÷ Σ limit` over cards with a limit); archived credit accounts shown
  only when they still carry a limit or a non-zero balance.
- **Out of scope** — **debt payoff-%** for installment loans (original principal / amortization) →
  **`#14b`**; **effective-dated** limits (the trend applies the current limit throughout — owner
  decision §11); per-statement-cycle grain (month grain, reusing FEAT-011's bucketing); interest /
  APR / minimum-payment modeling; charts/sparklines (text tables in V1; the visual pass is `#16`);
  a `kind='loan'` account type.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to record a credit card's limit so I can track how much of it I'm using. | Must |
| US-2 | As the user, I want to see, per card, how much I owe vs. its limit and the utilization %, so I know if I'm running high. | Must |
| US-3 | As the user, I want utilization shown over time so I can see whether I'm trending up or paying down. | Should |
| US-4 | As the user, I want an overall utilization across all my cards so I see my total credit health at a glance. | Should |
| US-5 | As the user, I want being over the limit to read clearly (above 100%), not hidden or capped. | Should |

## 4. Acceptance criteria

- **Given** a card owing `$1,500.00` (a negative balance) with a limit of `$5,000.00`, **then** its
  row shows **owed `$1,500.00`**, **available `$3,500.00`**, and **utilization `30.0%`** (`owed ÷
  limit`, as text — not colour/bar alone).
- **Given** a card owing `$6,000.00` with a `$5,000.00` limit, **then** utilization reads
  **`120.0% over limit`** (not clamped) and **available `-$1,000.00`**.
- **Given** a card with a **credit balance** (overpaid, e.g. balance `+$200`), **then** owed reads as
  a credit (`$200.00 credit`) and utilization is **`0.0%`** (floored, never negative).
- **Given** a card with **no limit set**, **then** its row still shows owed (and a trend) but
  utilization reads **`— (set a limit)`**, and the card is **excluded** from the portfolio roll-up.
- **Given** monthly card activity, **then** the **trend** shows, per month, the **cumulative** owed
  balance through that month and its utilization; the **final** trend point equals the current owed
  (the trend reconciles to the derived balance).
- **Given** cards with limits, **then** the **roll-up** = `Σ owed (floored at 0 per card) ÷ Σ limit`
  over those cards; cards without a limit do not contribute.
- **Setting** a limit (PUT) **replaces** any existing one; **clearing** (DELETE) removes it and is
  **idempotent**. A limit ≤ 0 / unparseable → `400`; a limit on a **non-credit** account → `400`; a
  limit on a missing account → `404`.
- **Only** `kind='credit'` accounts appear in the report; other kinds are excluded.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Card with no debt (balance 0 / positive) | owed ≤ 0; utilization `0.0%`; available ≥ limit. Truthful, not hidden. |
| Over the limit (owed > limit) | utilization > 100% (e.g. `120.0% over limit`); available negative. Not clamped. |
| Overpayment (credit balance) | owed negative (`$… credit`); utilization floored at `0.0%` (never negative). |
| No limit set | `limitCents`/`availableCents`/`utilizationBps` are `null`; the UI shows an empty input + `— (set a limit)`; excluded from the roll-up. |
| Limit on a checking/savings/cash/other account | Rejected at the boundary → `400` ("A credit limit applies only to credit accounts."). |
| No credit accounts at all | Empty report (`accounts: []`, totals `0`, aggregate `null`); the UI shows guidance to add a credit account. |
| Archived credit account, dormant (no limit, settled balance) | Omitted. Archived **with** a limit or a non-zero balance ⇒ shown, flagged "(archived)". |
| Limit with leading/trailing space or `$` | Parsed at the boundary (`parseMoney`); unparseable → `400`. |

## 6. Data changes

**One new table** — [`credit_limits`](../05_DATA_MODEL.md) (FEAT-014a): `id`, `household_id`,
`account_id` (**unique** — one limit per account), `credit_limit_cents` (`BIGINT`, `> 0`),
`created_at`, `updated_at`. **No row = no limit.** Mutable config (not a ledger row), so it carries
`updated_at`. Ships with an **idempotent** migration (`create table if not exists` + unique index) in
`db/migrate.ts`, so the dev/test PGlite path keeps doubling as the migrator. Money stays **integer
cents** end to end. This is a **reversible per-account config field** — a **definition in this spec,
not an ADR** (a reversible, non-effective-dated number; owner decision §11). The **owed / utilization
/ trend / roll-up** add **no** schema: they are read-only aggregates over the existing derived balance
and `transactions`.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):

- `GET /analysis/credit-utilization` → `200 { report }`.
- `PUT /accounts/:id/credit-limit` `{ amount: string }` → `200 { creditLimit }` (set/replace).
- `DELETE /accounts/:id/credit-limit` → `204` (clear; idempotent).

```
CreditUtilizationReport = {
  accounts: CreditAccountUtilization[]; // credit accounts, by name
  totalOwedCents: number;               // Σ owed (floored at 0/account) over cards WITH a limit
  totalLimitCents: number;              // Σ limit over cards WITH a limit
  utilizationBps: number | null;        // totalOwed/totalLimit in bps; null when no limited cards
}
CreditAccountUtilization = {
  accountId: string; accountName: string; archived: boolean;
  limitCents: number | null;            // null = no limit set
  owedCents: number;                     // −balance (positive = debt; ≤ 0 = credit balance)
  availableCents: number | null;         // limit − owed; null when no limit
  utilizationBps: number | null;         // owed/limit in basis points; null when no limit
  trend: UtilizationPoint[];             // ascending; one point per period with activity
}
UtilizationPoint = { period: "YYYY-MM"; owedCents: number; utilizationBps: number | null }
CreditLimitView = { accountId: string; creditLimitCents: number }
```

**The "owed" & "utilization" definitions (the modeling decisions).** **Owed = −balance** — a credit
account's derived balance (`v_account_balances`) is ≤ 0 when in debt, so the liability reading flips
the sign (the **stored** ledger sign is unchanged; only the analysis read interprets it). **Utilization
= `round(max(0, owed) / limit × 10000)`** in integer **basis points** (`3000` = 30.0%) — the numerator
**floored at 0** (overpayment ⇒ 0%) but the result **not clamped** above `10000` (over-limit is
meaningful). **Available = `limit − owed`** (signed). The **trend** cumulates each month's net flow
(`Σ transactions.amount_cents` bucketed by `to_char(occurred_on,'YYYY-MM')`) into the period-end owed
balance and its utilization, applying the **current** limit to every period (limits are not
effective-dated in V1). The **roll-up** sums per-card `max(0, owed)` and `limit` over cards with a
limit. The math is a **pure domain function** (`creditUtilization` in `@budgeteer/domain`); the read
service (`analysisService.creditUtilization`) only gathers the I/O and feeds it.

UI: a new **Credit** view (Dashboard button) with a roll-up summary, a per-account table whose limit
column is an inline editor, and per-account trend tables — see [UX](../ux/credit-utilization.md).

## 8. Dependencies

Real balances/transactions from FEAT-001/003; `kind='credit'` accounts (allowed since the Foundation
schema). Reuses the API's `parseMoney`/positive-magnitude boundary parse, the `{ error: { message } }`
envelope + zod-at-boundary house style, the `bigint`→`Number` read convention (ADR-0003 /
[05_DATA_MODEL](../05_DATA_MODEL.md) §1), the FEAT-011 `to_char` monthly bucketing, and the web
`formatCents`/`formatMoney` (EH1) + a new `formatBps` display helper. The CORS allow-methods allowlist
(`PUT`/`DELETE` already declared, FEAT-012) covers the new write verbs. The credit-limit store mirrors
`envelope_targets` (FEAT-012): set/clear, idempotent migration, household-scoped, `> 0`.

> **Spike?** No. Like FEAT-011/FEAT-012 this **aggregates existing data + one stored number** — no
> forward projection (that was FEAT-013, the area's one genuine unknown), no external source. The one
> piece of new logic — a **cumulative** balance per period (vs. FEAT-011's per-period net flow) — is a
> known technique, proven by unit tests, not a spike-level unknown.

## 9. Security, privacy & accessibility

Household-scoped server-side (limits carry `household_id`; the read is scoped on the account). Inputs
validated at the boundary: the limit is a positive-magnitude `parseMoney` (→ `400`), the account is
verified to exist in the household (→ `404`) **and** to be `kind='credit'` (→ `400`). Read/compare is
otherwise read-only; tests use synthetic fixtures (no real data). Each view table is a real `<table>`
with a `<caption>` and `scope`'d headers; the roll-up is a `<dl role="status">`; each limit input is
labelled (`Credit limit for <account>`); **every ratio is shown as TEXT** (a percentage, `over limit`,
`— (set a limit)`) — never colour or a bar alone; loading/empty/error are `role="status"`/`role="alert"`.
(WCAG 2.2 AA; the app-wide visual-contrast pass remains part of the consolidated `#16` a11y/NFR pass.)

## 10. Test plan

- **Unit (domain, 10):** `utilizationBps` (ratio in bps, floor at 0, no top clamp, null/non-positive
  limit); `creditUtilization` (owed = −balance + available; trend cumulation; a payment lowers owed;
  roll-up floors per-account owed and only counts limited cards; null aggregate / empty input; a
  no-limit account still reports owed + a trend with null utilization).
- **Integration (API, 10):** owed/utilization/available; portfolio roll-up over limited cards;
  over-limit (> 100%, negative available); credit balance (0% floored); the monthly trend cumulates &
  reconciles to current owed; only credit accounts reported; a no-limit card; set/replace/clear
  (idempotent) + limit on a non-credit account rejected; validation (bad amount → `400`, missing
  account → `404`); empty report.
- **Component (web, 4):** setting a limit inline reveals owed/available/utilization + a trend; over-limit
  reads "over limit" as text; empty state (no credit accounts); load error.
- **e2e (Playwright):** the single journey is extended with a **credit-utilization step** — add a
  credit account owing money, set its limit via the inline editor (a real cross-origin **PUT**
  /accounts/:id/credit-limit), and assert the derived `30.0%` renders against the real API.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~What does `#14` "debt & credit trends" cover in V1?~~ | Wesley | **resolved: split** — utilization now (`#14a`), payoff-% later (`#14b`) |
| ~~Per-account, or a portfolio roll-up?~~ | Wesley | **resolved: both** — per-account is the unit, plus an aggregate roll-up |
| ~~How is the credit limit stored?~~ | Wesley | **resolved: a separate `credit_limits` config table** (mirrors `envelope_targets`; a reversible definition, no ADR) |
| ~~Credit-account balance sign convention?~~ | Wesley | **resolved: owed = −balance** at the analysis layer (stored ledger sign unchanged) |
| Effective-dated limits (historical limit per period)? | Wesley | open (V1: current limit applied throughout the trend) |
| Statement-cycle grain instead of calendar month? | Wesley | open (V1: month, reusing FEAT-011 bucketing) |
| Interest / APR / minimum-payment modeling? | Wesley | open (later; out of the trends slice) |
