<!--
SCHEMA MAP TEMPLATE — copy to a working (likely gitignored, see SECURITY.md) doc when a
bulk import/ETL will be prepared by an agent or person WITHOUT repo access. It's a
self-contained "Rosetta Stone": everything needed to produce data that restores cleanly,
without granting access to the codebase itself. Explicitly subordinate to the real docs
(04_DOMAIN_MODEL.md, 05_DATA_MODEL.md, 06_API_CONTRACT.md) — regenerate it from them, never
hand-author it as a second source of truth. K26.
-->

# Schema Map — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Generated from the real docs — regenerate, don't hand-edit |
| Owner        | <name>                                 |
| Last updated | <YYYY-MM-DD>                           |
| Generated from | `04_DOMAIN_MODEL.md` · `05_DATA_MODEL.md` · `06_API_CONTRACT.md` (at this date) |

> **Why this exists.** The backup/restore path (see `ENGINEERING_STANDARDS.md` §4,
> "reconcilable data imports") is also the bulk-import door: a round-trip-proven restore
> means external data only needs to be **transformed into the backup shape**, not run
> through a parallel importer. This map is what lets an out-of-repo agent target that shape
> without seeing the codebase — treat it as a contract, not documentation.

## 1. Conventions

The load-bearing representational rules a producer must follow (e.g. money as integer
minor units, dates as `YYYY-MM-DD`, id format, required vs. nullable).

## 2. Enums

Every closed set of values a field can take, with the **exact** accepted strings/codes.

| Field | Accepted values | Notes |
| ----- | ---------------- | ----- |
| …     | …                 | …     |

## 3. Entities & aliases

For each entity in the backup shape: its fields, and the **aliases** a real-world source is
likely to use for the same concept (so a producer maps rather than guesses).

### <Entity>
- **Fields:** …
- **Known aliases in source data:** …

## 4. Structural transforms

Shape differences between the source and the target — splits, merges, derived fields,
reference resolution (e.g. "the source's free-text category must resolve to an existing
entity id, not a new string").

## 5. Do-not-import

Fields or records the target deliberately excludes (e.g. soft-deleted rows, an
already-derived rollup that the target computes itself — see "derive, don't store").

## 6. Import order

The order tables/entities must load in to satisfy foreign-key/reference constraints.

1. …

## 7. Validation checklist

The checks a producer must run **before** handing off data, so a restore either succeeds
cleanly or the producer catches the problem first — not the person running the restore.

- [ ] Every reconcilable invariant holds (e.g. a ledger's rows sum to zero).
- [ ] No dangling references (every foreign key resolves to a real row in this dataset).
- [ ] No enum value outside §2's accepted set.
- [ ] Money/exact-quantity fields are integers in the smallest unit, never floats.
- [ ] Dates match the format in §1.
- [ ] Import order (§6) is satisfiable — no circular dependency.
