---
type: reference
status: Accepted
---
<!--
DATA MODEL — copy of templates/DATA-MODEL-TEMPLATE.md, filled for Budgeteer. The PHYSICAL
model realizing 04_DOMAIN_MODEL.md in PostgreSQL (per ADR-0002). Keep in sync with
migrations in the same change. Money = BIGINT integer cents (ADR-0003).
-->

# Data Model — Budgeteer

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | Accepted                                |
| Owner        | Wesley Cutting                          |
| Datastore    | PostgreSQL (per [`ADR-0002`](adr/ADR-0002-datastore.md)) |
| Last updated | 2026-07-03 (EH9 versioned migrator · EH14 idempotency index) |

## 1. Overview

Direct mapping of [`04_DOMAIN_MODEL`](04_DOMAIN_MODEL.md) to **15 tables** (the foundation's five — households, accounts, envelopes,
transactions, allocations — grown by the later slices; the full list is §2). Money is **`BIGINT`
integer cents** (ADR-0003) — never `numeric`/`float`. Balances are **derived** (not stored):
served by SQL aggregates (`v_account_balances`, `v_envelope_balances` views) over indexed
foreign keys; data volume is small (fresh start), so no materialization in V1.
`v_envelope_balances` is **two-source** — allocations plus net envelope-transfer flow (ADR-0004). Every
top-level row carries `household_id` to design toward multi-household, with a **single
seeded household** in V1 (no auth/RLS yet).

> **Two accepted conventions** (review [2026-06-15](reviews/2026-06-15-repo-review.md), EH6 — documented, no change):
>
> - **`bigint` cents narrow to a JS `number` at the read boundary.** Columns are `BIGINT`, but the
>   API returns amounts as JS `number` (`Number(row.amount_cents)`). JS represents integers exactly
>   only to `2^53−1` cents (**≈ $90 trillion**) — well beyond any V1 balance, so the narrowing is
>   exact in practice. Amounts past that ceiling are out of V1 scope (would need `bigint`
>   end-to-end). See the `Cents` type in `packages/domain/src/money.ts`.
> - **Name uniqueness: the domain normalizer is a strict superset of the DB key.** The unique index
>   is `lower(btrim(name))` (case-fold + trim ends); the domain's `normalizeName` *also* collapses
>   internal whitespace. Because the service persists the **normalized** name, the value the index
>   sees is already collapsed, so the in-app guard and the DB key agree in practice. See
>   `packages/domain/src/naming.ts` and [status-reports/2026-06-15-eh3.md](status-reports/2026-06-15-eh3.md).

## 2. Tables

### households
- **Purpose:** future ownership/isolation boundary. V1 seeds exactly one row.

| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| name | text | no | e.g. "Default household" |
| created_at | timestamptz | no | default `now()` |

### accounts → `Account`
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| name | text | no | trimmed, non-empty (`check (length(btrim(name)) > 0)`) |
| kind | text | no | `check (kind in ('checking','savings','credit','loan','cash','other'))` (named `accounts_kind_chk`; `'loan'` added FEAT-014b) |
| created_at | timestamptz | no | default `now()` |
| archived_at | timestamptz | yes | null = active |
- **Keys/Indexes:** PK `id`; **unique** `(household_id, lower(btrim(name)))`; index `(household_id)`.

### envelopes → `Envelope`
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| name | text | no | trimmed, non-empty (check as above) |
| kind | text | no | `check (kind in ('standard','sinking_fund'))`, default `'standard'` |
| created_at | timestamptz | no | default `now()` |
| archived_at | timestamptz | yes | null = active; archived ⇒ no new allocations (enforced in app/core) |
- **Keys/Indexes:** PK `id`; **unique** `(household_id, lower(btrim(name)))`; index `(household_id)`.

### transfers → `Transfer` (FEAT-007, ADR-0004)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| occurred_on | date | no | the transfer date |
| memo | text | yes | free text |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(household_id)`. Parents exactly **two** `kind='transfer'`
  transaction legs (the pair is created atomically; see below).

### transactions → `Transaction`
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), restrict (denormalized for scoping/queries) |
| account_id | uuid | no | FK → accounts(id), **restrict** (archive, don't delete, accounts with history) |
| amount_cents | bigint | no | signed integer cents (ADR-0003); `+`=deposit, `−`=withdrawal |
| kind | text | no | `check (kind in ('opening','normal','transfer'))` (named `transactions_kind_chk`) |
| occurred_on | date | no | the transaction date (weekly grain not required) |
| payee | text | yes | free text |
| memo | text | yes | free text |
| transfer_id | uuid | yes | FK → transfers(id), **cascade**; set iff `kind='transfer'` (ADR-0004) |
| recurring_id | uuid | yes | FK → recurring_transactions(id), **set null**; set if generated by a rule (FEAT-009) |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(account_id)`; index `(transfer_id)`; index `(recurring_id)`;
  index `(household_id)`; partial unique `(account_id) where kind = 'opening'` (**at most one opening txn per account**);
  partial unique `(recurring_id, occurred_on) where recurring_id is not null` (**at most one generated
  txn per rule per occurrence date** — makes post-due idempotency structural under concurrent
  post-due calls; EH14, migration `0002`; the service treats the violation as "already posted").
- **Constraints:** `check (kind <> 'normal' or amount_cents <> 0)` (normal txns are non-zero).

### allocations → `Allocation`
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| transaction_id | uuid | no | FK → transactions(id), **cascade** (deleting a txn removes its splits) |
| envelope_id | uuid | no | FK → envelopes(id), **restrict** (can't delete an envelope with history — archive) |
| amount_cents | bigint | no | signed integer cents; same sign as its transaction |
- **Keys/Indexes:** PK `id`; index `(transaction_id)`; index `(envelope_id)`.

### envelope_transfers → `EnvelopeTransfer` (FEAT-007 #7b, ADR-0004 B)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| from_envelope_id | uuid | no | FK → envelopes(id), **restrict** |
| to_envelope_id | uuid | no | FK → envelopes(id), **restrict** |
| amount_cents | bigint | no | positive magnitude (`check (amount_cents > 0)`) |
| occurred_on | date | no | the reallocation date |
| memo | text | yes | free text |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(from_envelope_id)`; index `(to_envelope_id)`.
- **Constraints:** `check (from_envelope_id <> to_envelope_id)` (`envelope_transfer_distinct`).
  No account movement; archived-destination rejection is enforced in the app/core (the
  destination must be non-archived; the source may be archived).

### templates → `Template` (FEAT-004)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| name | text | no | trimmed, non-empty |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; **unique** `(household_id, lower(btrim(name)))`.

### template_lines → a template's fixed-amount lines
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| template_id | uuid | no | FK → templates(id), **cascade** |
| envelope_id | uuid | no | FK → envelopes(id), **restrict** |
| amount_cents | bigint | no | positive magnitude (`check (amount_cents > 0)`) |
| position | integer | no | line order |
- **Keys/Indexes:** PK `id`; index `(template_id)`.

### recurring_transactions → `RecurringTransaction` (FEAT-009)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| account_id | uuid | no | FK → accounts(id), **restrict** |
| direction | text | no | `check (direction in ('deposit','withdrawal'))` |
| amount_cents | bigint | no | positive magnitude (`check (amount_cents > 0)`) |
| payee | text | yes | free text |
| memo | text | yes | free text |
| frequency | text | no | `check (frequency in ('weekly','biweekly','monthly'))` |
| anchor_on | date | no | first occurrence; its day-of-month anchors monthly stepping |
| next_occurrence_on | date | no | the cursor (advanced by Post due; starts at `anchor_on`) |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(household_id)`.

### recurring_lines → a rule's split
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| recurring_id | uuid | no | FK → recurring_transactions(id), **cascade** |
| envelope_id | uuid | no | FK → envelopes(id), **restrict** |
| amount_cents | bigint | no | positive magnitude (`check (amount_cents > 0)`) |
| refund | boolean | no | default `false`; a refund line opposes the direction (FEAT-008) |
| position | integer | no | line order |
- **Keys/Indexes:** PK `id`; index `(recurring_id)`.

### reconciliations → `Reconciliation` (FEAT-010)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| account_id | uuid | no | FK → accounts(id), **restrict** |
| statement_balance_cents | bigint | no | the real bank balance entered (signed; ADR-0003) |
| derived_balance_cents | bigint | no | **snapshot** of the derived balance at reconcile time |
| reconciled_on | date | no | the reconciliation date |
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(account_id)`. `difference = statement − derived` is
  **derived**, never stored. A record only — no transaction, no balance effect.

### envelope_targets → `EnvelopeTarget` (FEAT-012)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| envelope_id | uuid | no | FK → envelopes(id), **restrict**; **unique** (one target per envelope) |
| monthly_target_cents | bigint | no | positive magnitude (`check (monthly_target_cents > 0)`); the recurring monthly budget |
| created_at | timestamptz | no | default `now()` |
| updated_at | timestamptz | no | default `now()`; set on update (mutable **config**, not a ledger row) |
- **Keys/Indexes:** PK `id`; **unique** `(envelope_id)`; index `(household_id)`.
- **Semantics:** **no row = no target.** A single **recurring** monthly amount per envelope (not
  effective-dated — FEAT-012 §11). Set/replaced via `PUT /envelopes/:id/target`, removed via
  `DELETE`. The **actual** side (spend) is **derived**, never stored (see §5).

### credit_limits → `CreditLimit` (FEAT-014a)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| account_id | uuid | no | FK → accounts(id), **restrict**; **unique** (one limit per account) |
| credit_limit_cents | bigint | no | positive magnitude (`check (credit_limit_cents > 0)`); the card's credit limit |
| created_at | timestamptz | no | default `now()` |
| updated_at | timestamptz | no | default `now()`; set on update (mutable **config**, not a ledger row) |
- **Keys/Indexes:** PK `id`; **unique** `(account_id)`; index `(household_id)`.
- **Semantics:** **no row = no limit.** The reference number for credit **utilization** (owed/limit).
  Set/replaced via `PUT /accounts/:id/credit-limit`, removed via `DELETE`. Only meaningful for
  `kind='credit'` accounts — enforced at the **service** boundary (a limit on a non-credit account →
  `400`), not as a DB constraint. The **owed** side (= −derived balance) and utilization are
  **derived**, never stored (see §5). Installment-loan payoff (original principal) is the sibling
  store below (FEAT-014b).

### loan_principals → `LoanPrincipal` (FEAT-014b)
| Field | Type | Null | Notes |
| ----- | ---- | ---- | ----- |
| id | uuid | no | PK |
| household_id | uuid | no | FK → households(id), **restrict** |
| account_id | uuid | no | FK → accounts(id), **restrict**; **unique** (one principal per account) |
| original_principal_cents | bigint | no | positive magnitude (`check (original_principal_cents > 0)`); the loan's original principal |
| created_at | timestamptz | no | default `now()` |
| updated_at | timestamptz | no | default `now()`; set on update (mutable **config**, not a ledger row) |
- **Keys/Indexes:** PK `id`; **unique** `(account_id)`; index `(household_id)`.
- **Semantics:** **no row = no principal.** The reference number for debt **payoff** (`1 − owed/original`).
  Set/replaced via `PUT /accounts/:id/original-principal`, removed via `DELETE`. Only meaningful for
  `kind='loan'` accounts — enforced at the **service** boundary (a principal on a non-loan account →
  `400`), not as a DB constraint. The **owed** side (= −derived balance), payoff, and paid-down are
  **derived**, never stored (see §5). Mirrors `credit_limits` (FEAT-014a).

## 3. Relationships & integrity

- `accounts/envelopes/transactions.household_id → households` — **restrict** (the single V1
  household is never deleted).
- `transactions.account_id → accounts` — **restrict** (preserve ledger history; archive accounts).
- `allocations.transaction_id → transactions` — **cascade** (a transaction owns its splits).
- `allocations.envelope_id → envelopes` — **restrict** (envelopes are archived, not deleted).
- `transactions.transfer_id → transfers` — **cascade** (a transfer owns its two legs; deleting
  the parent removes both). A transfer's two `kind='transfer'` legs (`−X` / `+X`) are inserted
  **atomically** in one DB transaction, so they always sum to zero (ADR-0004).
- `envelope_transfers.{from_envelope_id,to_envelope_id} → envelopes` — **restrict** (envelopes
  are archived, not deleted). An envelope transfer touches **no** account; it changes only the
  derived envelope balances (`v_envelope_balances`), source `−X` / destination `+X` (ADR-0004 B).
- `recurring_lines.recurring_id → recurring_transactions` — **cascade** (a rule owns its lines);
  `recurring_lines.envelope_id → envelopes` — **restrict**. `transactions.recurring_id →
  recurring_transactions` — **set null** (deleting a rule keeps the transactions it generated;
  FEAT-009). Post due writes a rule's due occurrences + advances `next_occurrence_on` **atomically
  per rule**, so it is idempotent (re-running posts nothing already posted).
- `template_lines.template_id → templates` — **cascade** (a template owns its lines);
  `template_lines.envelope_id → envelopes` — **restrict**.
- **Split invariant** (`0 ≤ |Σ allocations| ≤ |txn.amount|`, matching sign): enforced in the
  **domain core** and written **atomically** (a transaction + its allocations in one DB
  transaction). A DB-level trigger/constraint as defense-in-depth is deferred to hardening;
  app-layer enforcement in a single transaction is the V1 guarantee.

## 4. Migrations

**Versioned, forward-only migrations via Kysely `Migrator`** (EH9, 2026-07-03). The registry is
in-code ([`apps/api/src/db/migrate.ts`](../apps/api/src/db/migrate.ts) → numbered files in
[`apps/api/src/db/migrations/`](../apps/api/src/db/migrations/)); executed names are recorded in
the Kysely-managed `kysely_migration` table, and `migrateToLatest` runs at every startup
(seed/reset/test helpers included). Postgres DDL is transactional, so a failing batch rolls back
whole — startup fails loudly rather than running on a half-migrated store.

- **`0001-baseline`** — the foundation's single idempotent migration function, frozen verbatim the
  day the migrator was adopted (every statement `if not exists` / drop-then-add, no plpgsql). The
  idempotence is what lets a pre-migrator store adopt the migrator: re-running the baseline against
  an existing schema is a no-op that records it as executed. Its growth history is the blockquote
  below.
- **`0002-recurring-occurrence-idempotency`** — EH14's partial unique index (see `transactions`
  in §2). If a store already contains double-posted occurrences the index build fails loudly,
  naming the duplicated `(recurring_id, occurred_on)` — resolve those ledger rows by hand; a
  migration never deletes financial data on its own.

**Rules:** a schema change is a **new numbered file** (`0003-…`) — committed migrations are frozen,
never edited. Migrations are **forward-only** (no `down`; disposable PGlite dev stores make
rollback-by-recreate cheap). A schema change ships with this doc and the code in the **same
change**. The default-household seed row is **not** a migration — it re-runs at every startup from
`migrateToLatest` itself, because `db:reset`'s PostgreSQL path truncates `households` but not
`kysely_migration`. The two derived-balance views `v_account_balances` and `v_envelope_balances`
are (re)created with `create or replace view` in the baseline; a future view **column-type** change
needs an explicit `drop view` + recreate in its migration (`create or replace` can't do it).

> **Baseline growth history — ADR-0004 evolution (transfers):** the forward migration adds the `transfers` table, the
> nullable `transactions.transfer_id` FK, and evolves the `kind` check to allow `'transfer'`
> (dropping the foundation's inline check, adding the named `transactions_kind_chk`). It is
> idempotent (no plpgsql) so the dev/test PGlite path keeps doubling as the migrator;
> `v_account_balances` needs **no** change (it already sums all kinds). **`#7b`** adds the
> `envelope_transfers` table and rebuilds `v_envelope_balances` as the **two-source** view
> (`Σ allocations + Σ incoming − Σ outgoing`) via `create or replace`. **`#9`** adds the
> `recurring_transactions` + `recurring_lines` tables and the nullable `transactions.recurring_id`
> FK (idempotent `add column if not exists`); balance views are unchanged (generated rows are
> ordinary transactions/allocations). **`#10`** adds the `reconciliations` table (a recorded
> compare; no transaction, no balance/view change). **`#11`** (analysis, spend-by-envelope; FEAT-011)
> adds **nothing** — it is a **read-only aggregate query** over `allocations ⋈ transactions ⋈
> envelopes` (net signed allocation flow per envelope, bucketed by `to_char(transactions.occurred_on,
> 'YYYY-MM' | 'YYYY')`, household-scoped), so there is **no table, no view, and no migration**.
> Reallocations (`envelope_transfers`) are deliberately **not** read by this query; archived envelopes
> are included. **`#12`** (analysis, budget-vs-actual; FEAT-012) adds **one** table —
> `envelope_targets` (idempotent `create table if not exists` + a unique index on `envelope_id`) — the
> per-envelope recurring monthly budget. The **actual** half adds **no** schema: it is a read-only
> aggregate of **outflow** spend (`−Σ allocations on transactions with `amount_cents < 0``, bucketed
> by `to_char(occurred_on,'YYYY-MM')`), a **sibling** of the FEAT-011 query. No balance view changes
> (targets do not affect derived balances). Migrator stays idempotent so the dev/test PGlite path
> keeps doubling as it. **`#14a`** (analysis, credit utilization; FEAT-014a) adds **one** table —
> `credit_limits` (idempotent `create table if not exists` + a unique index on `account_id`) — the
> per-credit-account credit limit. The **owed/utilization** half adds **no** schema: it is a
> read-only aggregate of the derived balance (`owed = −v_account_balances.balance_cents`) plus a
> per-account monthly net-flow query (`sum(amount_cents)` bucketed by `to_char(occurred_on,'YYYY-MM')`,
> cumulated into the period-end balance for the trend). No balance-view change (a limit does not affect
> derived balances). Migrator stays idempotent. **`#14b`** (analysis, debt payoff; FEAT-014b) adds the
> new `kind='loan'` account type — the accounts `kind` check is **evolved** idempotently (drop the
> foundation's inline `accounts_kind_check`, add a named `accounts_kind_chk` allowing the 6th kind;
> existing rows all satisfy the wider set) — and **one** table, `loan_principals` (idempotent
> `create table if not exists` + a unique index on `account_id`), the per-loan original principal. The
> **payoff** half adds **no** schema: it is the same read as `#14a` (owed = −balance + a per-account
> monthly net-flow trend) against the stored original. No balance-view change. Migrator stays idempotent.
> **`R9`** (analysis, net worth over time; FEAT-R9) adds **no** schema at all — it is a read-only
> aggregate of **all** transactions (`sum(amount_cents)` bucketed by `to_char(occurred_on,'YYYY-MM'|'YYYY')`
> and account `kind`), cumulated into a period-end Assets / Liabilities / Net trend. Net worth = `Σ` of
> all signed account balances; liabilities (`kind ∈ {credit, loan}`) sum in negative, so `net = assets +
> liabilities` and transfer legs cancel across accounts. No new table, no balance-view change; the same
> pattern as FEAT-011.

## 5. Seed / fixtures

- A **synthetic** seed in code ([`apps/api/src/db/seed.ts`](../apps/api/src/db/seed.ts), reviewable):
  one `households` row, **4 sample accounts** (checking · savings · credit · loan), **22 envelopes**
  (16 standard + 6 sinking funds), **3 months of transactions** with full allocations, plus 8 envelope
  targets, a credit limit, a loan principal, and 2 recurring rules — enough to populate every view.
  All names and amounts are invented and non-sensitive.
- **No real/confidential data** is ever committed; tests build fixtures in code
  (`SECURITY.md`, spine §8). The repo's `.gitignore` excludes real data files and `.env`.
