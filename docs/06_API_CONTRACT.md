<!--
API CONTRACT — copy of templates/API-CONTRACT-TEMPLATE.md, filled for Budgeteer's HTTP API
(apps/api, Fastify per ADR-0001). Kept in sync with the implementation in the same change.
-->

# API Contract — Budgeteer

| Field        | Value                          |
| ------------ | ------------------------------ |
| Status       | Implemented (Foundation slice) |
| Owner        | Wesley Cutting                 |
| Style        | HTTP / JSON (REST-ish)         |
| Last updated | 2026-06-13                     |

## 1. Conventions

- **Base URL / port:** `http://localhost:3001` in dev (configurable via `PORT`).
- **Format:** JSON request/response; `content-type: application/json`. Money crosses the
  wire as **integer cents** (`balanceCents`) on output, and as a **decimal string**
  (`startingBalance`, e.g. `"2140.00"`) on input — parsed to integer cents at the boundary
  (ADR-0003). All input is validated at the boundary (zod shape + domain rules); invalid
  input fails loudly with `400`.
- **Versioning:** unversioned in V1 (single client). A `/v1` prefix will be introduced
  before any second consumer (change policy §5).
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

### `GET /envelopes`
- **Output:** `200 { "envelopes": EnvelopeView[] }`.
- `EnvelopeView = { id, name, kind, balanceCents, archivedAt }`; `kind ∈ {standard, sinking_fund}`; `balanceCents` **derived** from allocations (`0` until Slice 1).

### `POST /envelopes`
- **Purpose:** create an envelope (FEAT-002).
- **Input:** `{ name: string, kind?: EnvelopeKind = "standard" }`. **Output:** `201 { "envelope": EnvelopeView }`.
- **Errors:** `400` (empty name, unknown kind); `409` (duplicate name).

### `PATCH /envelopes/:id`
- **Purpose:** rename an envelope. **Input:** `{ name: string }`. **Output:** `200 { "envelope": EnvelopeView }`.
- **Errors:** `400`; `404`; `409`.

### Transactions & allocation (FEAT-003)

`TransactionView = { id, accountId, accountName, kind: "opening"|"normal", amountCents (signed),
occurredOn, payee, memo, allocations: AllocationView[], allocatedCents, unallocatedCents }`;
`AllocationView = { id, envelopeId, envelopeName, amountCents (signed) }`. **Amounts are entered
as positive magnitudes**; the server applies the sign from the transaction's direction. The
split invariant (`|Σ allocations| ≤ |amount|`, matching sign) is enforced atomically.

- **`POST /accounts/:accountId/transactions`** — create a transaction + its allocations.
  Input: `{ kind: "deposit"|"withdrawal", amount: string, occurredOn?: "YYYY-MM-DD",
  payee?, memo?, allocations?: [{ envelopeId, amount }] }`. → `201 { transaction }`.
  Errors: `400` (amount ≤ 0, bad date, over-allocation, unknown/archived envelope); `404` (account).
- **`GET /accounts/:accountId/transactions`** — the account register (newest-first).
  → `200 { transactions: TransactionView[] }`; `404` if the account is missing.
- **`PUT /transactions/:id/allocations`** — replace a transaction's allocations (allocate-later).
  Input: `{ allocations: [{ envelopeId, amount }] }`. → `200 { transaction }`.
  Errors: `400` (over-allocation, unknown/archived envelope); `404` (transaction).
- **`GET /transactions/needs-allocation`** — household-wide transactions with a non-zero
  unallocated remainder (includes opening balances). → `200 { transactions: TransactionView[] }`.

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
