---
type: spike
id: SPIKE-12
roadmap-item: [BUD-S82, SPIKE-12]
status: Done
---
<!--
SPIKE REPORT — reality-before-paper validation of the wired production Postgres path
(ADR-0002) ahead of the hub deployment-readiness ADR (ADR-0008). Data is STRICTLY SYNTHETIC
(`npm run seed:demo`), so figures are shown in full — there is no real ledger to redact.
De-risks Front C of the 2026-07-27 hub deployment-readiness initiative.
-->

# SPIKE-12 — Postgres production-runtime validation

| Field   | Value                                                                 |
| ------- | --------------------------------------------------------------------- |
| Status  | Done                                                                   |
| Date    | 2026-07-29                                                             |
| Owner   | Wesley Cutting + agent                                                 |
| Question | Does the wired `DATABASE_URL` Postgres path (ADR-0002) actually run — migrations, reads, aggregate money math, writes, and error-mapping — against a real PostgreSQL 16, with no `pg`-vs-PGlite divergence? |
| De-risks | Front C of the [hub deployment-readiness initiative](../reviews/2026-07-27-hub-deployment-readiness-initiative.md); `BUD-S82`; ADR-0002 status; informs [ADR-0008](../adr/ADR-0008-containerized-production-runtime.md) |

## 1. Why

The app ships with a Postgres access path already wired ([`db/connection.ts`](../../apps/api/src/db/connection.ts):
`pg` + `PostgresDialect` when `DATABASE_URL` is set) and migrate-on-boot
([`index.ts`](../../apps/api/src/index.ts)), but the real ledger lives in a gitignored **PGlite**
store and the Postgres path had, per the repo, **never been exercised against a real Postgres**.
PGlite is Postgres-in-WASM but not identical — [`util/dates.ts`](../../apps/api/src/util/dates.ts)
already notes `pg` returns `Date` where PGlite returns a string, and `node-postgres` returns
`BIGINT` as a **string** by default, which is a live risk for the integer-cents money columns
(ADR-0003). "Decided ≠ validated": prove it before the deployment ADR depends on it.

## 2. Setup

- **Runtime:** colima (the host's container runtime; Docker Desktop absent) → Docker daemon.
- **DB:** `postgres:16` container → **PostgreSQL 16.14 on `aarch64`** (matches the Raspberry Pi 5
  target arch), host port `5433` (`5432` is taken by colima's own forwarding).
- **Data:** `npm run seed:demo` with `DATABASE_URL` set — 4 accounts · 22 envelopes · ~6 months
  of dated synthetic history · targets · credit limit · loan principal · biweekly paycheck + 7
  bill rules · 3 templates. Strictly synthetic (SECURITY.md).
- **App:** `npm run start` with `DATABASE_URL=postgres://…@127.0.0.1:5433/budgeteer`,
  `HOST=127.0.0.1`. `.env`'s `PGLITE_DIR` is correctly ignored when `DATABASE_URL` is set.

## 3. Findings — all green, zero code changes

| # | Check | Result |
| - | ----- | ------ |
| 1 | **Migrate-on-boot** | `migrateToLatest` applied both migrations against real PG; 17 tables created; `kysely_migration` records `0001-baseline` + `0002-recurring-occurrence-idempotency`. |
| 2 | **`/health`** | `GET /health → 200 {"status":"ok"}`. **Gap confirmed:** it does **not** check DB reachability — a true readiness probe must (Front C/`BUD-S82`). |
| 3 | **Reads + money via the `pg` BIGINT path** | `GET /accounts` returns `balanceCents` as **numbers** identical to raw SQL (`-172664`, `-1320000`, `870000`, `249180`). The BIGINT-as-string trap is already handled in the service layer (`Number()` conversion) — **no money bug**. |
| 4 | **Aggregate bigint math** | `GET /analysis/net-worth?grain=month` returns correct **signed** monthly assets/liabilities/net over the synthetic history — summation across BIGINT columns survives the driver. |
| 5 | **Transactional write** | `POST /envelopes → 201` — writes commit through the `pg` dialect. |
| 6 | **Dialect-specific error mapping** | Duplicate name → `409` with the standard envelope. The `dbErrors.ts` `SQLSTATE 23505 → DuplicateNameError` shim (BUD-S24) fires on **real** `pg`, not only PGlite. |

## 4. Answer

**Yes — the wired production Postgres path works end-to-end against PostgreSQL 16 (aarch64) with
zero code changes.** No `pg`-vs-PGlite divergence surfaced in migrations, money handling, aggregate
math, writes, or error mapping. The one actionable gap is `/health` (liveness only, not readiness).

## 5. What this unblocks / next

- **ADR-0002** → `Proposed` → **`Validated`** (this spike is the "prod path confirmed" event the
  ADR index already anticipated).
- **[ADR-0008](../adr/ADR-0008-containerized-production-runtime.md)** — the containerized-runtime
  decision can be written on a proven base.
- **`BUD-S82`** carries one concrete task from finding #2: extend `/health` to check DB reachability.
- **Not covered here (own stories):** the `#19`/`BUD-E13` auth epic (the exposure blocker — nothing
  in this spike touches auth), the Dockerfile (`BUD-S81`), GHCR publish (`BUD-S84`), and
  export→restore round-trip *on Postgres* (the CLI restore is proven on PGlite under
  [SPIKE-09](09-restore-roundtrip.md); re-proving it on `pg` belongs to `BUD-S85`).

## 6. Teardown

Ephemeral: `docker rm -f budgeteer-pg-spike`. The container and colima VM are throwaway; nothing
persisted to the repo. Synthetic data only — no gitignored ledger touched.
