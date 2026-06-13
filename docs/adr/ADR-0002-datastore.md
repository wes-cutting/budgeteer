<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike/slice validates the assumptions.
-->

# ADR-0002: Datastore — PostgreSQL via a thin typed access layer (Kysely)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Proposed                                                           |
| Date          | 2026-06-13                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | Access-layer **seam** validated by [`SPIKE-02`](../spikes/02-stack-feasibility.md); Postgres wiring to be confirmed in the Foundation slice |

## Context

Per [`ADR-0001`](ADR-0001-stack.md), Budgeteer is a TypeScript client–server app. The
datastore must: store **integer-cents money exactly** ([`ADR-0003`](ADR-0003-money-integer-minor-units.md));
enforce the **split invariant** atomically (allocations sum to the transaction amount);
support a **thin, typed, transparent** access layer (kit pure-core/impure-shell — not a heavy
ORM hiding SQL); and leave a path to **owner/household scoping** for the future multi-household
direction **without** building multi-tenancy in V1. SPIKE-02 validated the **repository-port
seam** (pure core depends on an interface; an adapter implements it).

## Decision

We will use **PostgreSQL**, accessed through **Kysely** (a typed SQL query builder) over
`node-postgres` (`pg`):

- **Money columns are `BIGINT`** integer cents (ADR-0003); no floating/decimal types for
  amounts.
- **Repository adapters** in the impure shell implement the domain's repository **ports**
  (proven in SPIKE-02); the domain core never imports `pg`/Kysely.
- **Atomic writes:** a transaction and its allocations are written in a single DB
  transaction; the split invariant is asserted in the domain core *and* guardable by a DB
  constraint/check.
- **Schema migrations** are versioned (Kysely migrations or a standalone migrator) and live
  in the repo; **no real data** in the repo — dev/test use **synthetic fixtures**
  (`SECURITY.md`, spine §8).
- **Future multi-household:** tenant-scoped tables get a `household_id` (owner-scoping) and
  later Postgres **row-level security** — *designed toward, not implemented in V1*
  (default-deny when it lands).

## Consequences

### Positive
- Mature, integer-exact, transactional; scales cleanly to the multi-tenant future (RLS).
- **Typed SQL** keeps the data-access seam thin and visible (no ORM magic), satisfying
  strong-typing/no-escape-hatches.
- DB transactions enforce the split invariant atomically.

### Negative / cost
- Requires a **running Postgres** in dev and CI (Docker) — more ops than SQLite/local files.

### Neutral
- The query-builder choice (Kysely vs. Drizzle vs. Prisma) is **replaceable behind the
  repository port**; Kysely chosen for transparent typed SQL. Could start dev on SQLite, but
  Postgres is chosen to match prod and the multi-tenant future and avoid a later migration.

## Alternatives considered

### SQLite (single-file, local)
Simplest ops, great for single-user — but the multi-household future wants Postgres; chose
Postgres now to avoid a disruptive later migration.

### Prisma (ORM)
Popular and productive, but heavier and hides SQL; Kysely keeps queries explicit and types
strong, fitting the thin-access-layer principle. (Drizzle is a close, acceptable alternative
— either works behind the port.)

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
