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
| Last updated | 2026-06-13                              |

## 1. Overview

Direct mapping of [`04_DOMAIN_MODEL`](04_DOMAIN_MODEL.md) to five tables. Money is **`BIGINT`
integer cents** (ADR-0003) — never `numeric`/`float`. Balances are **derived** (not stored):
served by SQL aggregates (`v_account_balances`, `v_envelope_balances` views) over indexed
foreign keys; data volume is small (fresh start), so no materialization in V1.
`v_envelope_balances` is **two-source** — allocations plus net envelope-transfer flow (ADR-0004). Every
top-level row carries `household_id` to design toward multi-household, with a **single
seeded household** in V1 (no auth/RLS yet).

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
| kind | text | no | `check (kind in ('checking','savings','credit','cash','other'))` |
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
| created_at | timestamptz | no | default `now()` |
- **Keys/Indexes:** PK `id`; index `(account_id)`; index `(transfer_id)`; index `(household_id)`;
  partial unique `(account_id) where kind = 'opening'` (**at most one opening txn per account**).
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
- `template_lines.template_id → templates` — **cascade** (a template owns its lines);
  `template_lines.envelope_id → envelopes` — **restrict**.
- **Split invariant** (`0 ≤ |Σ allocations| ≤ |txn.amount|`, matching sign): enforced in the
  **domain core** and written **atomically** (a transaction + its allocations in one DB
  transaction). A DB-level trigger/constraint as defense-in-depth is deferred to hardening;
  app-layer enforcement in a single transaction is the V1 guarantee.

## 4. Migrations

Versioned SQL migrations (Kysely migrator) committed in the repo under
`server/migrations/`. **Rule:** a schema change ships with this doc and the code in the
**same change**. Views `v_account_balances` and `v_envelope_balances` (derived balances) are
created as migrations alongside the tables.

> **ADR-0004 evolution (transfers):** the forward migration adds the `transfers` table, the
> nullable `transactions.transfer_id` FK, and evolves the `kind` check to allow `'transfer'`
> (dropping the foundation's inline check, adding the named `transactions_kind_chk`). It is
> idempotent (no plpgsql) so the dev/test PGlite path keeps doubling as the migrator;
> `v_account_balances` needs **no** change (it already sums all kinds). **`#7b`** adds the
> `envelope_transfers` table and rebuilds `v_envelope_balances` as the **two-source** view
> (`Σ allocations + Σ incoming − Σ outgoing`) via `create or replace`.

## 5. Seed / fixtures

- A **synthetic** seed in code (reviewable): one `households` row, a couple of sample
  accounts, and the **22 envelope names** lifted from `FEATURE_BREAKDOWN.md` (names are
  non-sensitive). Amounts are synthetic.
- **No real/confidential data** is ever committed; tests build fixtures in code
  (`SECURITY.md`, spine §8). The repo's `.gitignore` excludes real data files and `.env`.
