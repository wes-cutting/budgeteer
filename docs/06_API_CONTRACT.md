<!--
API CONTRACT — copy of templates/API-CONTRACT-TEMPLATE.md, filled for Budgeteer's HTTP API
(apps/api, Fastify per ADR-0001). Kept in sync with the implementation in the same change.
-->

# API Contract — Budgeteer

| Field        | Value                          |
| ------------ | ------------------------------ |
| Status       | Implemented (through R7)       |
| Owner        | Wesley Cutting                 |
| Style        | HTTP / JSON (REST-ish)         |
| Last updated | 2026-06-21                     |

## 1. Conventions

- **Base URL / port:** `http://localhost:3001` in dev (configurable via `PORT`).
- **Format:** JSON request/response; `content-type: application/json`. Money crosses the
  wire as **integer cents** (`balanceCents`) on output, and as a **decimal string**
  (`startingBalance`, e.g. `"2140.00"`) on input — parsed to integer cents at the boundary
  (ADR-0003). All input is validated at the boundary (zod shape + domain rules); invalid
  input fails loudly with `400`.
- **Versioning:** unversioned in V1 (single client). A `/v1` prefix will be introduced
  before any second consumer (change policy §5).
- **CORS:** the browser app calls this API **cross-origin** (web on `:5173`, API on `:3001`),
  so the API sends CORS headers via `@fastify/cors`. The allowed origins are an **allowlist**
  (env `CORS_ORIGINS`, comma-separated; defaults to the Vite dev origins) — **never `*`**
  (SECURITY.md). Without this, browsers block every response with "Failed to fetch". The
  **allowed methods** are declared explicitly (`GET,HEAD,POST,PUT,PATCH,DELETE`): `@fastify/cors`
  otherwise defaults the preflight to `GET,HEAD,POST`, which silently blocks every cross-origin
  `PUT`/`PATCH`/`DELETE` in the browser (fixed with FEAT-012, which added the first browser write
  verbs that weren't covered by the prior POST-only e2e).
- **Authz:** **none yet** — V1 is a single implicit household (`DEFAULT_HOUSEHOLD_ID`). When
  multi-household lands it becomes **default-deny, household-scoped at the resource level**
  (ADR-0002, SECURITY.md). Every resource already carries `householdId` server-side.

## 2. Error envelope

Every non-2xx response uses one shape:

```json
{ "error": { "message": "<human-readable>" } }
```

| HTTP | Meaning | Example message |
| ---- | ------- | --------------- |
| 400 | Validation failed (bad body, name, kind, or amount) | "Enter an amount like 1234.56." |
| 404 | Resource not found (in this household) | "Account not found." |
| 409 | Name conflict (case-insensitive, per household) | "An account with that name already exists." |
| 500 | Unexpected error (details logged, never leaked) | "Something went wrong." |

> **Planned (hardening):** add a stable `code` (`VALIDATION_ERROR`/`CONFLICT`/…) and a
> `correlationId` to the envelope. Deferred from the foundation deliberately (right-sized).

The error handler **preserves the original 4xx status** (e.g. a malformed/empty JSON body is a
`400`, not a masked `500`); only genuinely unexpected errors become `500` and are logged.

## 3. Resources / operations

### `GET /health`
- **Output:** `200 { "status": "ok" }`. Liveness only.

### `GET /accounts`
- **Output:** `200 { "accounts": AccountView[] }`, ordered by creation.
- `AccountView = { id, name, kind, balanceCents, archivedAt }`; `kind ∈ {checking, savings, credit, cash, other}`; `balanceCents` is the **derived** account balance.

### `POST /accounts`
- **Purpose:** create an account (FEAT-001) + its **opening transaction** (the starting balance), atomically.
- **Input:** `{ name: string, kind: AccountKind, startingBalance?: string = "0" }`.
- **Output:** `201 { "account": AccountView }` (`balanceCents` = the opening balance).
- **Errors:** `400` (empty name, unknown kind, unparseable amount); `409` (duplicate name).

### `PATCH /accounts/:id`
- **Purpose:** rename an account.
- **Input:** `{ name: string }`. **Output:** `200 { "account": AccountView }`.
- **Errors:** `400` (empty name); `404` (no such account); `409` (duplicate name).

### `POST /accounts/:id/archive` · `POST /accounts/:id/unarchive` (R7)
- **Purpose:** soft-delete / restore an account (history + balance preserved).
- **Output:** `200 { "account": AccountView }` (`archivedAt` set / `null`); `404` if missing.
- `GET /accounts` returns **all** accounts (active + archived) with `archivedAt`. Archived
  accounts remain fully viewable (register, transactions, delete still work) — only **new**
  transfers into/out of them are rejected `400` (the existing transfer-create guard).

### `GET /envelopes`
- **Output:** `200 { "envelopes": EnvelopeView[] }`.
- `EnvelopeView = { id, name, kind, balanceCents, archivedAt }`; `kind ∈ {standard, sinking_fund}`; `balanceCents` **derived** from allocations **plus net envelope-transfer flow** (ADR-0004 B).

### `POST /envelopes`
- **Purpose:** create an envelope (FEAT-002).
- **Input:** `{ name: string, kind?: EnvelopeKind = "standard" }`. **Output:** `201 { "envelope": EnvelopeView }`.
- **Errors:** `400` (empty name, unknown kind); `409` (duplicate name).

### `PATCH /envelopes/:id`
- **Purpose:** rename an envelope. **Input:** `{ name: string }`. **Output:** `200 { "envelope": EnvelopeView }`.
- **Errors:** `400`; `404`; `409`.

### `POST /envelopes/:id/archive` · `POST /envelopes/:id/unarchive` (FEAT-006)
- **Purpose:** soft-delete / restore an envelope (history + balance preserved).
- **Output:** `200 { "envelope": EnvelopeView }` (`archivedAt` set / `null`); `404` if missing.
- `GET /envelopes` returns **all** envelopes (active + archived) with `archivedAt`; allocating
  to an **archived** envelope is rejected `400` (the `assertEnvelopesUsable` guard).

### `GET /envelopes/:id/ledger` (R15)
- **Purpose:** per-envelope allocation list — all allocations that contributed to the envelope's
  balance, newest-first. Read-only; no schema change (derives from `allocations ⋈ transactions ⋈ accounts`).
- **Output:** `200 { "rows": EnvelopeLedgerRow[] }`.
- `EnvelopeLedgerRow = { allocationId, transactionId, occurredOn: "YYYY-MM-DD", payee: string|null, memo: string|null, transactionKind: "opening"|"normal"|"transfer", accountId, accountName, amountCents: number }`.
  `amountCents` is **signed**: positive = funded into the envelope (deposit/opening), negative = spent from it (withdrawal). Order: `occurred_on DESC, created_at DESC`.
- **Scope:** household-scoped via `transactions.household_id`; includes `kind='opening'` and `kind='transfer'` rows; excludes `envelope_transfers` (reallocations are a separate concept).
- **Errors:** `404` if the envelope id is missing or belongs to a different household.

### Transactions & allocation (FEAT-003)

`TransactionView = { id, accountId, accountName, kind: "opening"|"normal"|"transfer",
amountCents (signed), occurredOn, payee, memo, allocations: AllocationView[], allocatedCents,
unallocatedCents, transferId, transferCounterpartName }`;
`AllocationView = { id, envelopeId, envelopeName, amountCents (signed) }`. **Amounts are entered
as positive magnitudes**; the server applies the sign from the transaction's direction. An
allocation input may set **`refund: boolean`** (default `false`, FEAT-008) — a refund row is
stored **opposite** the transaction's direction. The split invariant is on the **signed total**
(`0 ≤ |Σ allocations| ≤ |amount|`, total in the txn's direction; rows may be mixed sign;
net-flip/over-allocation rejected) and is enforced atomically.
`transferId`/`transferCounterpartName` are set **iff** `kind = "transfer"` (the other account's
name, for the register label — FEAT-007). Transfer legs are **excluded** from needs-allocation.
`recurringId` is set if the transaction was generated by a recurring rule (FEAT-009).

- **`POST /accounts/:accountId/transactions`** — create a transaction + its allocations.
  Input: `{ kind: "deposit"|"withdrawal", amount: string, occurredOn?: "YYYY-MM-DD",
  payee?, memo?, allocations?: [{ envelopeId, amount, refund? }] }`. → `201 { transaction }`.
  Errors: `400` (amount ≤ 0, bad date, over-allocation, net direction-flip, unknown/archived envelope); `404` (account).
- **`GET /accounts/:accountId/transactions`** — the account register (newest-first).
  Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive date window over `occurredOn`); **defaults to
  the current calendar month** when omitted (R8). `opening` rows are **always** included regardless
  of the window, so the register keeps its balance anchor. Payee/memo search is **client-side** over
  the windowed rows. → `200 { transactions: TransactionView[] }`; `400` if `from`/`to` is not
  `YYYY-MM-DD`; `404` if the account is missing.
- **`PUT /transactions/:id/allocations`** — replace a transaction's allocations (allocate-later
  **and edit a past split**, FEAT-005). Input: `{ allocations: [{ envelopeId, amount, refund? }] }`. →
  `200 { transaction }`. Errors: `400` (over-allocation, net direction-flip, unknown/archived envelope); `404` (transaction).
- **`GET /transactions/needs-allocation`** — household-wide transactions with a non-zero
  unallocated remainder (includes opening balances). → `200 { transactions: TransactionView[] }`.

### Transfers (FEAT-007 · account↔account double-entry, ADR-0004)

`TransferView = { id, occurredOn, memo, amountCents (positive magnitude), from: TransferLegView,
to: TransferLegView }`; `TransferLegView = { transactionId, accountId, accountName, amountCents
(signed) }`. A transfer is **two linked `kind:"transfer"` transactions** (`−X` source, `+X`
destination) sharing a `transferId`; account balances re-derive automatically and the legs are
**not** in needs-allocation.

- **`POST /transfers`** — create a transfer. Input: `{ fromAccountId, toAccountId,
  amount: string, occurredOn?: "YYYY-MM-DD", memo? }`. → `201 { transfer }`.
  Errors: `400` (amount ≤ 0, same account, archived account, bad date); `404` (account missing).

### Envelope reallocation (FEAT-007 #7b · envelope↔envelope, ADR-0004 B)

`EnvelopeTransferView = { id, occurredOn, memo, amountCents (positive magnitude),
from: { envelopeId, envelopeName }, to: { envelopeId, envelopeName } }`. A reallocation moves
budgeted money between two envelopes with **no** account movement; envelope balances re-derive
(`EnvelopeView.balanceCents` = `Σ allocations + Σ incoming − Σ outgoing` reallocations).

- **`POST /envelope-transfers`** — create a reallocation. Input: `{ fromEnvelopeId, toEnvelopeId,
  amount: string, occurredOn?: "YYYY-MM-DD", memo? }`. → `201 { envelopeTransfer }`.
  Errors: `400` (amount ≤ 0, same envelope, **archived destination**, bad date); `404` (envelope
  missing). Draining **from** an archived envelope is allowed; envelopes may go **negative**.

### Reconcile to bank (FEAT-010)

`ReconciliationView = { id, accountId, statementBalanceCents, derivedBalanceCents (snapshot),
differenceCents (= statement − derived), matched, reconciledOn }`. A recorded **compare** — it
creates no transaction and changes no balance; the difference is **derived**, never stored.

- **`POST /accounts/:accountId/reconciliations`** `{ statementBalance: string, reconciledOn?:
  "YYYY-MM-DD" }` → `201 { reconciliation }`. `statementBalance` may be **negative** (credit
  accounts) — parsed with `parseMoney`, not a positive-magnitude. Errors: `400` (unparseable
  amount, bad date); `404` (account missing).
- **`GET /accounts/:accountId/reconciliations`** → `200 { reconciliations: ReconciliationView[] }`
  (newest first); `404` if the account is missing.

### Recurring transactions (FEAT-009)

`RecurringView = { id, accountId, accountName, direction, amountCents (positive magnitude),
payee, memo, frequency: "weekly"|"biweekly"|"monthly", anchorOn, nextOccurrenceOn, dueCount,
lines: RecurringLineView[] }`; `RecurringLineView = { id, envelopeId, envelopeName, amountCents
(positive), refund }`. `dueCount` = occurrences on/before today not yet posted.

- **`GET /recurring`** → `200 { recurring: RecurringView[] }`.
- **`POST /recurring`** `{ accountId, kind: "deposit"|"withdrawal", amount: string, payee?, memo?,
  frequency, anchorOn: "YYYY-MM-DD", lines: [{ envelopeId, amount, refund? }] }` → `201 { recurring }`.
  Errors: `400` (amount ≤ 0, bad frequency/date, no lines, over-allocated/net-flipped split);
  `404` (account missing).
- **`DELETE /recurring/:id`** → `204` (lines cascade; generated transactions are **kept**,
  `recurring_id` nulled); `404` if missing.
- **`POST /recurring/post-due`** (bodyless) → `200 { result: { posted, rules: [{ recurringId,
  posted, error? }] } }`. Generates every due occurrence up to today and advances each rule's
  cursor — **idempotent**; a rule whose split is now invalid (e.g. an archived envelope) is
  reported in `rules[].error` and skipped without blocking the others.

### Allocation templates (FEAT-004)

`TemplateView = { id, name, lines: TemplateLineView[] }`;
`TemplateLineView = { id, envelopeId, envelopeName, amountCents }`. Lines are **fixed positive
magnitudes**; **applying a template is client-side** (it pre-fills the allocation editor).
Template names are unique per household (case-insensitive).

- **`GET /templates`** → `200 { templates: TemplateView[] }`.
- **`POST /templates`** `{ name, lines: [{ envelopeId, amount }] }` → `201 { template }`.
  Errors: `400` (empty name, no lines, amount ≤ 0, unknown/archived envelope); `409` (duplicate name).
- **`PUT /templates/:id`** `{ name, lines }` → `200 { template }` (replaces name + lines).
  Errors: `400`; `404`; `409`.
- **`DELETE /templates/:id`** → `204` (cascade-deletes its lines); `404` if missing. A bodyless
  request needs no `content-type`; an empty `application/json` body is tolerated.

### Analysis: spend by envelope over time (FEAT-011)

`EnvelopeSpendRollup = { grain: "month"|"year", periods: string[], rows: EnvelopeSpendRow[],
periodTotals: number[], grandTotal: number }`;
`EnvelopeSpendRow = { envelopeId, envelopeName, archived, amounts: number[], total }`. A **generated**
rollup (the "18 Monthly" replacement): each cell is the **net signed allocation flow** for an
envelope in a period — `Σ allocation.amountCents` for the envelope's allocations whose **transaction**
fell in the period (`+` = funded, `−` = spent; signed cents). `periods` is **ascending** (`"YYYY-MM"`
for month grain, `"YYYY"` for year), and a row's `amounts[]` and the top-level `periodTotals[]` are
**aligned to `periods`** by index (0-filled). Envelope↔envelope **reallocations are excluded** (real
transaction flow only); **archived** envelopes are **included** (flagged); only envelopes/periods with
activity appear. Read-only — no new table or view (a derived aggregate query, [05_DATA_MODEL](05_DATA_MODEL.md) §4).

- **`GET /analysis/envelope-spend?grain=month|year`** (default `month`) → `200 { rollup }`.
  Errors: `400` (grain not `month`/`year`). Household-scoped server-side.

### Analysis: budget vs. actual (FEAT-012)

`BudgetVsActualReport = { month: "YYYY-MM", rows: BudgetVsActualRow[], totalTargetCents,
totalSpentCents, totalRemainingCents }`;
`BudgetVsActualRow = { envelopeId, envelopeName, archived, targetCents: number|null,
spentCents, remainingCents: number|null }`. For one month, each envelope's **monthly target** (the
budget) vs. its **actual spend** (the **outflow only**), with `remaining = target − spent`. "Actual
spend" is **net spend on withdrawal transactions** — `−Σ allocation.amountCents` over allocations
whose transaction has `amount_cents < 0`, bucketed by `to_char(occurred_on,'YYYY-MM')`: this
**excludes funding deposits** and **nets refund rows** (FEAT-008) down. `targetCents`/`remainingCents`
are `null` when no target is set. Rows cover every **active** envelope plus any **archived** one with
a target or spend that month, ordered by name. Targets are stored (`envelope_targets`); the actual is
a derived aggregate — no balance-view change. Household-scoped server-side.

- **`GET /analysis/budget-vs-actual?month=YYYY-MM`** (default = the current month) → `200 { report }`.
  Errors: `400` (month not `YYYY-MM`).
- **`PUT /envelopes/:id/target`** `{ amount: string }` → `200 { target }` where
  `EnvelopeTargetView = { envelopeId, monthlyTargetCents }`. Sets/replaces the recurring monthly
  target (a **positive** magnitude). Errors: `400` (amount ≤ 0 / unparseable); `404` (envelope missing).
- **`DELETE /envelopes/:id/target`** → `204`. Clears the target; **idempotent** (clearing an absent
  target is a no-op). `404` if the envelope is missing. A bodyless request needs no `content-type`.

### Analysis: cash-flow forecast (FEAT-013)

`CashFlowForecast = { accountId, accountName, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD",
horizonDays, includeExpected, startingBalanceCents, points: ForecastPoint[], endingBalanceCents,
minBalanceCents, minBalanceDate, firstNegativeDate: string|null }`;
`ForecastPoint = { date: "YYYY-MM-DD", deltaCents, balanceCents, kind: "scheduled"|"expected", label }`.
A **projection** (the analysis area's only forward-looking read — `#11`/`#12` aggregate, this one
projects): starting from the account's **derived balance** (`v_account_balances`), apply each
**future dated event** (`date > today`, `≤ endDate`) and record the **running balance after it**.
Events: (1) the account's **scheduled recurring rules** (FEAT-009) via the recurring engine fed the
horizon as its bound — `±magnitude`; and, when `includeExpected`, (2) **expected discretionary
spend** from monthly **targets** (FEAT-012) — per month `Σ max(0, target − actualThisMonth −
scheduledThisMonth)` (current month un-prorated, future-tail prorated), spread **even-daily** as
negative deltas, attributed to the forecast account. The netting prevents **double-counting**
bills/actuals (proven by [SPIKE-05](spikes/05-cashflow-forecast.md)). Events are sorted
`(date asc, delta asc)` — conservative same-day order. `minBalanceCents`/`minBalanceDate` and
`firstNegativeDate` are derived over the series (including the starting point). The projection math is
a **pure domain function** (`cashFlowForecast`); the service feeds it I/O. **Read-only — no new table
or view.** Money is **integer cents**. Household-scoped server-side.

- **`GET /analysis/cash-flow-forecast?accountId=<uuid>&horizonDays=90&includeExpected=true`** →
  `200 { forecast }`. `horizonDays` defaults to **90**, capped `[7, 365]`; `includeExpected` defaults
  to **true**. Errors: `400` (`horizonDays` non-integer / out of range); `404` (account missing / not
  in the household).

### Analysis: credit utilization (FEAT-014a)

`CreditUtilizationReport = { accounts: CreditAccountUtilization[], totalOwedCents, totalLimitCents,
utilizationBps: number|null }`;
`CreditAccountUtilization = { accountId, accountName, archived, limitCents: number|null, owedCents,
availableCents: number|null, utilizationBps: number|null, trend: UtilizationPoint[] }`;
`UtilizationPoint = { period: "YYYY-MM", owedCents, utilizationBps: number|null }`. For every
**credit** account (`kind='credit'`): how much is **owed** against its **credit limit**. "Owed" is
the derived balance interpreted as a liability — a credit account's balance (`v_account_balances`)
is ≤ 0 when in debt, so **`owedCents = −balanceCents`** (positive = debt; ≤ 0 = a credit balance).
**Utilization** is reported in integer **basis points** (`round(max(0, owed) / limit × 10000)`;
`3000` = 30.0%) — the numerator floored at 0 (overpayment reads 0%), the top **not** clamped
(over-limit > 10000 is meaningful). `availableCents = limit − owed`. The **trend** cumulates each
month's net flow into the period-end owed balance and its utilization (the current limit applied to
every period — limits are **not** effective-dated in V1). The **roll-up** sums `owed` (floored at 0
per account) and `limit` over accounts **with** a limit; accounts without a limit appear with `null`
utilization and are excluded from the roll-up. Credit accounts are shown when active, or (archived)
only if they still carry a limit or a non-zero balance; ordered by name. The math is a **pure domain
function** (`creditUtilization`); the service feeds it I/O. The only new table is `credit_limits`
(the stored limit); owed/utilization are **derived**. Money is **integer cents**. Household-scoped
server-side.

- **`GET /analysis/credit-utilization`** → `200 { report }`. (No query params.)
- **`PUT /accounts/:id/credit-limit`** `{ amount: string }` → `200 { creditLimit }` where
  `CreditLimitView = { accountId, creditLimitCents }`. Sets/replaces the credit limit (a **positive**
  magnitude). Errors: `400` (amount ≤ 0 / unparseable, **or** the account is not `kind='credit'`);
  `404` (account missing / not in the household).
- **`DELETE /accounts/:id/credit-limit`** → `204`. Clears the limit; **idempotent** (clearing an
  absent limit is a no-op). Errors: `400` (account not `kind='credit'`); `404` (account missing). A
  bodyless request needs no `content-type`.

### Analysis: debt payoff (FEAT-014b)

`DebtPayoffReport = { accounts: LoanAccountPayoff[], totalOriginalCents, totalOwedCents,
totalPaidDownCents, payoffBps: number|null }`;
`LoanAccountPayoff = { accountId, accountName, archived, originalPrincipalCents: number|null, owedCents,
paidDownCents: number|null, payoffBps: number|null, trend: PayoffPoint[] }`;
`PayoffPoint = { period: "YYYY-MM", owedCents, payoffBps: number|null }`. For every **loan** account
(`kind='loan'`): how much of its **original principal** has been paid down. "Owed" is the derived
balance interpreted as a liability — `owedCents = −balanceCents` (a loan carries debt as a negative
balance; the stored sign is unchanged, only the read flips it). **Payoff** is reported in integer
**basis points** (`round((1 − owed/original) × 10000)`; `2500` = 25.0%) — **truthful, not clamped**:
0% at origination (owed = original), 100% settled (owed = 0), > 100% if overpaid, < 0% if owing more
than the original. `paidDownCents = original − owed`. The **trend** cumulates each month's net flow into
the period-end owed and its payoff (the current original applied to every period — not effective-dated
in V1). The **roll-up** is `Σ(original − owed) ÷ Σ original` over loans **with** an original principal;
loans without one appear with `null` payoff and are excluded from the roll-up. Loan accounts are shown
when active, or (archived) only if they still carry a principal or a non-zero balance; ordered by name.
The math is a **pure domain function** (`debtPayoff`); the service feeds it I/O. The only new table is
`loan_principals` (the stored original); owed/payoff are **derived**. Money is **integer cents**.
Household-scoped server-side.

- **`GET /analysis/debt-payoff`** → `200 { report }`. (No query params.)
- **`PUT /accounts/:id/original-principal`** `{ amount: string }` → `200 { loanPrincipal }` where
  `LoanPrincipalView = { accountId, originalPrincipalCents }`. Sets/replaces the original principal (a
  **positive** magnitude). Errors: `400` (amount ≤ 0 / unparseable, **or** the account is not
  `kind='loan'`); `404` (account missing / not in the household).
- **`DELETE /accounts/:id/original-principal`** → `204`. Clears the original principal; **idempotent**.
  Errors: `400` (account not `kind='loan'`); `404` (account missing). A bodyless request needs no
  `content-type`.

> **Account kinds:** `POST /accounts` accepts `kind ∈ {checking, savings, credit, loan, cash, other}`
> — `'loan'` was added by FEAT-014b (the installment-debt account type that carries an original
> principal for payoff). There is no edit-kind endpoint in V1, so a loan is created as `kind='loan'`.

### Analysis: net worth over time (FEAT-R9)

`NetWorthReport = { grain: "month"|"year", trend: NetWorthPoint[], assetsCents, liabilitiesCents,
netCents }`; `NetWorthPoint = { period: "YYYY-MM"|"YYYY", assetsCents, liabilitiesCents, netCents }`.
The account-level "how am I doing overall?" aggregate. Net worth is **`Σ` of all account balances**
(signed): every account's balance is signed (ADR-0003), and a **liability** account (`kind ∈
{credit, loan}`) carries its debt as a **negative** balance — the same `owed = −balance` convention
as FEAT-014a/b — so net falls out as **`assetsCents + liabilitiesCents`** with `liabilitiesCents ≤ 0`
normally. The decomposition is **by account kind** (stable over time), not by sign. Account↔account
**transfer legs net to zero** across the two accounts, so they neither move net worth nor
double-count; envelope reallocations never touch accounts and are irrelevant. The **trend** cumulates
each period's net flow (`sum(amount_cents)` over **all** transactions, grouped by `to_char(occurred_on,
fmt)` and account `kind`) into the period-end balances — one point per period **with activity**
(between them net worth carries forward). `assetsCents/liabilitiesCents/netCents` at the top are the
current totals (= the final trend point, or 0 when there is no activity). The math is a **pure domain
function** (`netWorthOverTime`); the service feeds it I/O. **No new table** (read-only aggregate, same
pattern as FEAT-011). Money is **integer cents**. Household-scoped server-side.

- **`GET /analysis/net-worth?grain=month|year`** (default `month`) → `200 { report }`. A malformed
  `grain` → `400`.

### Backup / export (FEAT-015a)

Delivers a complete JSON snapshot of the household's data as a downloadable file. The
response body is **never logged** (financial data). Cents are integers (`number`, not
string). Timestamps are ISO-8601 strings. The two derived views (`v_account_balances`,
`v_envelope_balances`) are excluded — they are recomputed from the raw tables.

```
BudgeteerBackup = {
  version:     1,
  exportedAt:  string,   // ISO-8601 timestamp of the export
  householdId: string,   // uuid of the exported household
  tables: {
    households, accounts, envelopes, transfers, envelope_transfers,
    transactions, allocations, templates, template_lines,
    recurring_transactions, recurring_lines, reconciliations,
    envelope_targets, credit_limits, loan_principals
  }  // each is an array of raw table rows (cents as number, dates as ISO strings)
}
```

- **`GET /export`** → `200` with `Content-Disposition: attachment; filename="budgeteer-backup-YYYY-MM-DD.json"` and `Content-Type: application/json`. The response body is the `BudgeteerBackup` object (pretty-printed JSON). No query params. No request body. This is a simple anchor link in the web app — no `fetch` needed; browser navigation triggers the download via `Content-Disposition`.

> **Security:** the backup contains the user's complete financial history. Do not commit a
> real backup to the repo (`.gitignore` already excludes data files). Tests use synthetic
> fixtures only. The endpoint has no auth in V1 — auth-gating is part of roadmap `#19`.

## 4. Internal contracts (non-network)

- **Domain core** (`@budgeteer/domain`, pure, no I/O): `parseMoney`/`formatMoney`/`sumMoney`
  (integer cents), `validateAccountName`/`validateEnvelopeName`, `validateAllocations`
  (the split invariant), `accountBalance`/`envelopeBalance` (derived). Reused by the API;
  unit-tested in isolation.
- **Repository seam** (impure shell): services depend on the Kysely `DB` schema; the
  domain never imports the datastore (pure-core/impure-shell, ARCHITECTURE.md).

## 5. Change policy

V1 is unversioned and single-consumer; treat the shapes above as stable for the web app.
Introduce `/v1` and additive-only changes once a second consumer (or multi-household)
arrives; breaking changes get a new version. (Transaction/allocation endpoints landed with
Slice 1; documented above.)
