<!--
SPIKE REPORT — the deliverable; the code was disposable (a single tsx script run against
in-memory PGlite, deleted after this report). See docs/00_WAYS_OF_WORKING.md §6.
-->

# SPIKE-09: Does the backup export round-trip? (FK order, ID collisions, snapshot-vs-schema versioning)

| Field    | Value                                                                             |
| -------- | --------------------------------------------------------------------------------- |
| Status   | Done                                                                              |
| Type     | Technical / hardening                                                             |
| Owner    | Wesley Cutting + agent                                                            |
| Time-box | One session (~1 h) — honored                                                      |
| Date     | 2026-07-03                                                                        |
| Blocks   | `EH10` / roadmap `#15b` (minimal CLI restore + equivalence gate test)             |

## 1. The question

`07_NFR` names the export (`GET /export`, FEAT-015a) as **the only recovery path** for the
local store, but no snapshot has ever been restored — while real data accumulates in
`PGLITE_DIR`. Single falsifiable question: **can a `BudgeteerBackup` JSON file be inserted
into a fresh store such that re-exporting produces a byte-identical snapshot** — and what do
FK ordering, the seeded default household, and schema versioning demand of the restore code?

## 2. Method

A throwaway tsx script (run in `apps/api`, deleted): create in-memory PGlite store **A**
(`createDb()` + `migrateToLatest`), insert at least one row into **every one of the 15
tables** exercising **every FK edge** (transfer legs sharing a `transfer_id`, a
recurring-generated transaction carrying `recurring_id`, allocations, template/recurring
lines, an archived account with `archived_at`, credit limit + loan principal). Then:
`snapshot(A)` → `JSON.parse(JSON.stringify(...))` (the exact file form the CLI will read) →
prototype restore into fresh store **B** → `snapshot(B)` → compare the two snapshots as
pretty-printed JSON with `exportedAt` nulled.

## 3. Findings

**Verdict: the round-trip is exactly equivalent** (`jsonA === jsonB`, byte-identical). The
three open questions resolve as follows.

### F1 — FK insert order: the backup's key order is NOT safe; an explicit order is

`tables` lists `transactions` before `recurring_transactions`, but
`transactions.recurring_id` references the rules table — iterating the file's natural key
order violates FKs. A correct topological order (parents strictly before children):

```
households → accounts, envelopes → transfers, recurring_transactions, templates
→ transactions → allocations, template_lines, recurring_lines,
  envelope_transfers, reconciliations, envelope_targets, credit_limits, loan_principals
```

Proven by the script. The restore service must own this order as a constant; it must not
derive it from the file.

### F2 — ID collisions: exactly one, by construction — the seeded default household

Every store that has run `migrateToLatest` contains the seeded default-household row
(`DEFAULT_HOUSEHOLD_ID`, `on conflict do nothing` at every startup), and every v1 backup
contains that same row (the snapshot exports `where id = DEFAULT_HOUSEHOLD_ID`). So restoring
into even a *fresh* store collides on `households.id` — deterministically, and only there.

Resolution proven in the script: **upsert the household row**
(`on conflict (id) do update set name, created_at`) so the exported row's values (not the
seed's fresh `created_at`) win — required for exact equivalence. All other tables insert
plainly, keeping their original UUIDs (no re-keying; `gen_random_uuid()` defaults are
column defaults, not sequences — nothing to advance).

Beyond that seeded row, collisions mean the store is **not empty** — and merging two ledgers
is not restore. Decision: **restore refuses any store with user data** (any row in the other
14 tables, or any `households` row besides the untouched seed). Recovery flow: `db:reset`
(or point `PGLITE_DIR` at a fresh directory), start once / migrate, restore. The tool stays
non-destructive — it never deletes rows (same policy as migration `0002`).

### F3 — Versioning: the store knows its schema version now (EH9); the snapshot should carry it

Since EH9, `kysely_migration` records exactly which schema the store is at — that is the
version a restore validates against. But the v1 snapshot doesn't record which schema *it*
was exported from. Decision (additive, not a breaking format change — `version` stays `1`):

- **Export adds `schema: { migrations: string[] }`** — the executed migration names at
  export time, read from `kysely_migration`.
- **Restore** (after running `migrateToLatest`, so the store is at the running code's
  latest): if the backup lists a migration the store doesn't have, **refuse loudly** —
  the file is from a newer app; upgrade first. If the store has *more* migrations than
  the backup, proceed — migrations are forward-only and additive (EH9), so newer schema
  accepts older data; any violation of a newer constraint (e.g. `0002`'s partial unique
  index over historical double-posts) fails the transaction loudly and names the conflict,
  consistent with EH14's never-delete-financial-data policy.
- **Pre-EH10 backups (no `schema` field)** — the owner's real accumulated files — restore
  with a printed warning that no schema check is possible. Refusing them would orphan the
  very files this item exists to protect.

### F4 (incidental) — date/timestamp fidelity holds, with one surprise

`date` columns come back from the driver as **JS `Date` objects at UTC midnight** (the
schema's `DateOnly` read-type says `string`; services already normalize via `toDateStr`),
so the *file* carries `"2026-01-01T00:00:00.000Z"` for calendar dates. PG's date-literal
parsing takes the date part verbatim (no timezone shift), so they re-insert exactly.
`timestamptz` values truncate to JS millisecond precision **at export time** — equivalence
is therefore defined at the export representation (ms), which is what the recovery path
preserves. Cents (normalized to `number`), booleans, and `null`s round-trip exactly.

## 4. What this de-risks / what the slice builds

The slice (same session): `restoreService` (zod-validated envelope; empty-store +
household-id + schema checks; one transaction — partial failure restores nothing) · a
`db:restore <file>` CLI modeled on `reset.ts` · `schema.migrations` added to the export ·
the **`export → restore → export` equivalence gate test** (populated via the real HTTP API,
not raw inserts) plus refusal-path tests. UI restore stays out of scope (EH10: "UI can
wait; the proof can't").

**Deliberately not built:** merge/partial restore, cross-household import, backup
encryption, restore-over-HTTP (all out of scope for a local single-household recovery tool).
