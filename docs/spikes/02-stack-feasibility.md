---
type: spike
id: SPIKE-02
roadmap-item: SPIKE-02
status: Done
---
<!--
SPIKE REPORT — the deliverable; the code is disposable (lives at
spikes/02-stack-feasibility/, gitignored deps). See docs/00_WAYS_OF_WORKING.md §6.
-->

# SPIKE-02: Can the candidate TypeScript stack deliver exact integer money + the split invariant?

| Field      | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Status     | Done                                                                           |
| Type       | Technical / feasibility                                                        |
| Owner      | Wesley Cutting                                                                  |
| Time-box   | One session (~1–2 h) — honored                                                  |
| Date       | 2026-06-13                                                                      |
| Blocks     | [`ADR-0001`](../adr/ADR-0001-stack.md) · [`ADR-0002`](../adr/ADR-0002-datastore.md) · Foundation slice |

## 1. The question

The platform (**client–server web app**) and language (**TypeScript**) are chosen. The
remaining feasibility risk is **not** the well-trodden plumbing (React↔API↔Postgres) — it is
the project's *documented prior failure*: **can integer-minor-unit money and the exact
split-allocation invariant ([`ADR-0003`](../adr/ADR-0003-money-integer-minor-units.md)) be
implemented cleanly and exactly in TypeScript**, including the SPIKE-01 split behaviours
(percentage paycheck template, last-row-remainder, partial allocation)?

## 2. Method

A **throwaway** TypeScript package (`spikes/02-stack-feasibility/`, disposable — *not* the
V1 app) implementing the risky core only:

- `money.ts` — `Cents` (branded integer) · `parseMoney`/`formatMoney` (boundary-only) ·
  `splitEvenly` · `splitByWeights` (largest-remainder) · `lastRowRemainder`.
- `allocation.ts` — `Transaction`/`Allocation`, `unallocated`/`isFullyAllocated`,
  `validateAllocations`, and a **`TransactionRepository` port** (pure-core/impure-shell seam).
- `feasibility.test.ts` — `node:test` runtime assertions of exactness.

Verified under **strict** `tsc --noEmit` and executed via `tsx`. **Deliberately not built:**
the Fastify API, the Postgres/Kysely wiring, and the React editor UI — standard integrations
asserted (not proven) here; the split editor's *felt friction* is closed by slice 1 (the
SPIKE-01 caveat), not this spike.

## 3. Findings

Real output:

```
=== tsc --noEmit (strict) ===
TYPECHECK: PASS
=== node --test (via tsx) ===
# tests 8
# pass 8
# fail 0
# duration_ms 92.586959
```

Concretely proven exact (no floating point in any stored/returned amount):

- **Boundary round-trips:** `"3200.00"→320000→"3200.00"`, `"0.07"→7`, `"-31.25"→-3125`. The
  classic trap `0.10 + 0.20` equals `0.30` **exactly** (integer cents).
- **Invalid input fails loudly:** `"12.345"`, `"1,234.00"`, `"abc"`, `"$5"`, `""` all rejected;
  non-integer cents rejected.
- **Even split, odd cents:** `splitEvenly(100¢, 3) = [34,33,33]`, sum `= 100`; a negative
  (withdrawal) split sums exactly too, parts within 1¢.
- **Weighted paycheck:** a 12-envelope percentage template over `$3,200.00` sums to the cent;
  a remainder-heavy `100¢ / [1,1,1]` sums to `100`.
- **Last-row-remainder:** a `−$214.00` store run with two known rows yields `−$14.00` and
  sums exactly to the total.
- **Partial allocation is first-class:** a paycheck allocated `$2,000` of `$3,200` reports
  `unallocated = $1,200` (the "needs allocation" surface) and `isFullyAllocated = false`;
  finishing with the remainder yields exactly `0` unallocated.
- **Over-allocation rejected; sign rules hold.**
- **Repository port** (impure-shell seam) type-checks and round-trips via an in-memory
  adapter — confirming the **pure-core/impure-shell** boundary works with these types and a
  Postgres adapter can drop in later.

### Confirmed
- Integer-minor-unit money + the exact split invariant are **clean, strict-typed, and exact
  in TypeScript.** The prior float failure is retired in the chosen language. → Promotes
  `ADR-0001` to `Validated`; the pure money/allocation core is reusable as the domain seed.
- The **pure-core/impure-shell** architecture (kit `ARCHITECTURE.md`) is natural here: zero
  I/O in the core, repository ports at the edge (as SPIKE-01-of-the-build evidence).

### Invalidated
- Nothing was invalidated. The candidate stack holds; no pivot needed.

### Surprises / unknowns uncovered
- None material. The largest-remainder split + branded `Cents` type are small enough to lift
  almost verbatim into the foundation's domain core (the *findings* carry over; the spike
  code itself is still thrown away per the kit).

## 4. Recommendation / decision

- **Adopt the stack** (see [`ADR-0001`](../adr/ADR-0001-stack.md)): TypeScript end-to-end ·
  **React + Vite** frontend · **Node + Fastify** API · pure framework-agnostic domain core ·
  **PostgreSQL** via a thin typed access layer ([`ADR-0002`](../adr/ADR-0002-datastore.md)).
- **No follow-up spike** needed before the Foundation slice. Residual, low-risk items are
  *integration* work confirmed during the foundation, not open questions: Postgres/Kysely
  wiring, Fastify route plumbing, and the React editor's felt-friction (slice 1).

## 5. Impact on the plan

- **Specs/ADRs:** `ADR-0001` → `Validated` (pending the human's nod to `Accepted`);
  `ADR-0002` → `Proposed` (Postgres/Kysely seam validated; wiring confirmed in foundation).
  `ADR-0003` already `Accepted` and now demonstrated.
- **Scope/sequencing:** unchanged — the **Foundation slice** is now `Ready` to start
  (Definition of Ready met: ADRs in place, money core proven).

## 6. Follow-ups

- [ ] Promote `ADR-0001` to `Accepted` on the human's confirmation of the specific frameworks.
- [ ] Build the **Foundation** slice (app shell + Postgres + account/envelope CRUD), porting
      the *findings* (branded `Cents`, split helpers, repository ports) into the real domain
      core; set up the **day-zero `.gitignore` + synthetic fixtures** guardrail.
- [ ] Confirm Postgres/Kysely wiring in the foundation → promote `ADR-0002` to `Validated`.
- [ ] Discard `spikes/02-stack-feasibility/` once its findings are absorbed (throwaway).
