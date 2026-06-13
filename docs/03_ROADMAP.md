<!--
ROADMAP — copy of templates/ROADMAP-TEMPLATE.md, filled for Budgeteer. The living plan of
record: spikes + vertical slices ordered by uncertainty × value (NOT by layer). Update
statuses as work lands; re-sequence (and log it, §5) when a spike changes what we know.
Sequencing model: docs/00_WAYS_OF_WORKING.md §7.
-->

# Roadmap — Budgeteer

| Field         | Value          |
| ------------- | -------------- |
| Status        | Living         |
| Owner         | Wesley Cutting |
| Last updated  | 2026-06-13     |
| Sources       | [`01_INTAKE.md`](01_INTAKE.md) · [`02_PRD.md`](02_PRD.md) · [`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md) |

**Current focus:** **Foundation slice — `In progress`.** `ADR-0001` **Accepted**; design
landed and `Proposed` ([domain](04_DOMAIN_MODEL.md) · [data](05_DATA_MODEL.md) ·
[accounts](features/accounts.md) · [envelopes](features/envelopes.md) ·
[UX](ux/foundation.md)). **Next: implement the vertical slice** — scaffold → domain core
(ported from SPIKE-02) → Postgres/Kysely migrations + repo → Fastify API → React UI → e2e,
gate-green. *(Dev/test run Postgres in-process via **PGlite** so it runs without a DB server;
`node-postgres` in prod — both behind the same Kysely dialect.)*

---

## 1. How to use this roadmap

The plan of record, kept live. **Top = next.** Budgeteer is a **focused product/app** (the
full-kit row in [§11](00_WAYS_OF_WORKING.md)), so it runs the full chain — but every *build*
item below is a **vertical, usable slice** that passes the gate before it's `Done`; there
are no "layer" items. Item statuses track *delivery*; the `Proposed/Validated/Accepted`
ladder tracks *documents* — don't conflate them.

**Item status vocabulary:** `Planned` · `Ready` · `In progress` · `Done` · `Deferred` · `Dropped`.

## 2. Sequencing model

Adapted from [§7](00_WAYS_OF_WORKING.md), justified by what discovery + SPIKE-01 already
retired:

1. **Decisions & feasibility first.** The value/UX bet is de-risked (SPIKE-01); the
   *unretired* risk is the **unchosen stack** + unproven technical feasibility. So a tight
   **feasibility spike (SPIKE-02)** runs before the foundation, producing the stack ADRs.
2. **Foundation slice** — a usable shell (accounts + envelopes you can create) to build the
   core loop into. Security guardrails are set here, day-zero (see note).
3. **Domain slices, validated heart first** — the core enter→allocate loop (closes the
   SPIKE-01 felt-friction caveat), then the accelerators that make the paycheck painless,
   then the further capabilities.
4. **Analysis**, once the core loop produces real data to analyze.
5. **Hardening**, once there's real data/usage to measure against.

**Specs & ADRs produced as gating work** (written *with* the slice that needs them, per the
[doc map](README.md)):

| Artifact | When | Note |
| -------- | ---- | ---- |
| [`ADR-0003`](adr/ADR-0003-money-integer-minor-units.md) — money = **integer minor units** | ✅ done | **`Accepted`** (2026-06-13); demonstrated exact by SPIKE-02. |
| [`ADR-0001`](adr/ADR-0001-stack.md) — stack (TS · React+Vite · Fastify) | ✅ done | **`Validated`** by [SPIKE-02](spikes/02-stack-feasibility.md); awaiting owner nod → `Accepted`. |
| [`ADR-0002`](adr/ADR-0002-datastore.md) — datastore (Postgres · Kysely) | ✅ drafted | **`Proposed`** — access-layer seam validated by SPIKE-02; Postgres wiring confirmed in the foundation. |
| [`04_DOMAIN_MODEL`](04_DOMAIN_MODEL.md) · [`05_DATA_MODEL`](05_DATA_MODEL.md) | ✅ drafted | **`Proposed`** — full entity set (account · envelope · transaction · split-allocation) + Postgres schema; opening-balance modeled as an opening transaction; balances derived. |
| [accounts](features/accounts.md) · [envelopes](features/envelopes.md) specs + [foundation UX](ux/foundation.md) | ✅ drafted | **`Proposed`** — Definition of Ready met for the Foundation slice. |

> **Security, day-zero (not deferred):** the Foundation slice sets the `.gitignore` to
> exclude confidential financial data **before** any such data can exist, and all tests use
> **synthetic fixtures** ([SECURITY.md](SECURITY.md), spine §8). This is a guardrail, not a
> hardening item.

## 4. The plan

Ordered by **Risk × Value**, top = next. `Gated by` names what must land first.

### Foundation

| # | Item | Kind | Value | Risk | Gated by | Status | Links (will produce) |
| - | ---- | ---- | ----- | ---- | -------- | ------ | -------------------- |
| 1 | **Foundation** — app shell + Postgres store + domain core + **account CRUD** (open with a starting balance, held *unallocated*) + **envelope CRUD** (create/rename). *Usable: set up your real accounts & envelopes and see balances.* Sets the **day-zero `.gitignore` + synthetic fixtures** guardrail. | slice | High | Med | ✅ SPIKE-02 · ADR-0001/0002/0003 | **In progress** | Design ✅ [domain](04_DOMAIN_MODEL.md)·[data](05_DATA_MODEL.md)·[accounts](features/accounts.md)·[envelopes](features/envelopes.md)·[UX](ux/foundation.md); code next |

### Spikes (risk retirement)

| # | Item | Kind | Value | Risk | Answers (the question) | Status | Spike report |
| - | ---- | ---- | ----- | ---- | ---------------------- | ------ | ------------ |
| 0 | Split-allocation UX | spike | High | High | Is enter-once-then-split lower-friction than the sheet, esp. the many-way splits? | **Done** | [SPIKE-01](spikes/01-split-allocation-ux.md) — *Confirmed* |
| 2 | **Technical feasibility / stack** | spike | High | High | Can the TS stack deliver **integer-minor-unit money** + the **exact split invariant** (the prior float failure)? | **Done** | [SPIKE-02](spikes/02-stack-feasibility.md) — *Confirmed* (strict typecheck + 8/8 tests); produced `ADR-0001`/`ADR-0002` |

### Domain slices

| # | Item | Kind | Value | Risk | Gated by | Status | Notes |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ----- |
| 3 | **Slice 1 — core enter→allocate loop** — enter deposit/withdrawal → allocate in **Single** (one-tap) or **Split** (multi-row, live `Allocated/Remaining`, last-row=remainder) + **partial allocation** (save now, "needs allocation" surface) → balances reconcile, invariant holds | slice | High | Med | #1 | Planned | The validated heart; **closes the SPIKE-01 felt-friction caveat** when usable |
| 4 | **Slice 2 — accelerators** — **templates/presets** (primary) · keyboard-first row entry · distribute-remainder | slice | High | Med | #3 | Planned | What turns the paycheck split from tolerable → good |
| 5 | **Edit a past split** (preserve the sum invariant) | slice | High | Med | #3 | Planned | Correctness — you *will* mis-split; high value, sequence early |
| 6 | **Archive an envelope** (soft-delete; history preserved) | slice | Med | Low | #1 | Planned | Sinking-fund lifecycle; mirrors the sheet's `Archive*` pattern |
| 7 | **Transfers** (account↔account, **double-entry**) | slice | Med | High | #3 | Planned | Modeling risk — may need a small modeling spike (SPIKE-04) before building |
| 8 | **Refunds** (negative allocation within a split) | slice | Med | Med | #3 | Planned | Resolves the "negative allocation rows?" open question |
| 9 | **Recurring transactions** | slice | Med | Low | #3 | Planned | Generator over the txn model |
| 10 | **Reconcile to bank** (manual balance compare) | slice | Med | Low | #1 | Planned | Open Q: cleared/statement concept vs. plain compare |
| 11 | **Analysis — spend by envelope over time** (monthly/annual rollups) | slice | Med | Low | real data from #3 | Planned | Replaces the `18 Monthly` tab, generated not hand-keyed |
| 12 | **Analysis — budget vs. actual** | slice | Med | Med | envelope **monthly targets** capability | Planned | Needs per-envelope targets (open Q) |
| 13 | **Analysis — cash-flow forecast** (pay-period projection) | slice | Med | Med | #3 · #9 | Planned | Most modeling-heavy; the `Budget` tab's forward look |
| 14 | **Analysis — debt & credit trends** (payoff % · utilization) | slice | Med | Med | cards-as-accounts + debt modeling | Planned | Larger area — likely spawns its own feature specs |

### Hardening

| # | Item | Kind | Value | Risk | Trigger (when) | Status | Links |
| - | ---- | ---- | ----- | ---- | -------------- | ------ | ----- |
| 15 | **Backup / export** of the local store | hardening | Med | Med | real daily data exists | Planned | `07_NFR` |
| 16 | **a11y pass** (WCAG 2.2 AA) + perf/NFR budgets | hardening | Med | Low | UI surfaces exist | Planned | `07_NFR` *(a11y is also per-slice in the DoD; this is a consolidated pass)* |

### Deferred — post-V1

| # | Item | Kind | Why deferred | Status |
| - | ---- | ---- | ------------ | ------ |
| 17 | **SPIKE-03 — data-profiling:** does the 12-yr `Budget.xlsx` reconcile/extract cleanly from its in-cell formula strings? | spike | History migration is out of V1; this is the proper spike for the extraction that "got too messy" | Deferred |
| 18 | **Historical import** | slice | Gated by SPIKE-03 | Deferred |
| 19 | **Multi-user / household scoping** (auth · owner/household isolation) | epic | Future direction; a §11 scale-up trigger → full ceremony (tenancy ADR + threat model + property tests) | Deferred |
| 20 | **CSV/statement import**, later **live bank API** | slice | Manual is V1; each needs its own integration spike | Deferred |

## 5. Re-sequencing log

| Date | Change | Trigger | Effect on the plan |
| ---- | ------ | ------- | ------------------ |
| 2026-06-13 | History migration (→ #17/#18) and bank integration (→ #20) **deferred to post-V1** | Discovery forks A & B: **fresh start + manual** | Retired the two heaviest risks; V1 starts at the value/UX bet instead of a data-extraction slog |
| 2026-06-13 | **Templates** elevated to the primary accelerator (#4); **partial allocation** folded into the core loop (#3); **transfers/refunds/recurring/edit-split/archive** added as slices (#5–#9, mapped to A1.7/A1.5/A5.3 of the sheet) | [SPIKE-01](spikes/01-split-allocation-ux.md) confirmed the model + surfaced these | Shaped the domain-slice backlog; flagged transfers (double-entry) & edit-split (invariant) as the careful ones |
| 2026-06-13 | Added **SPIKE-02** (feasibility) ahead of the foundation | Stack still unchosen; SPIKE-01 was a *paper* test, didn't probe the build | `ADR-0001`/`0002` now gate the foundation slice |
| 2026-06-13 | **SPIKE-02 Done**; stack chosen (TS · React+Vite · Fastify · Postgres); `ADR-0001` `Validated`, `ADR-0002` `Proposed`, `ADR-0003` `Accepted` | [SPIKE-02](spikes/02-stack-feasibility.md) confirmed integer-money + split invariant exact (8/8 tests) | **Foundation slice → `Ready`**; no further pre-build spike needed |

## 6. Done / shipped

| # | Item | Shipped | Notes |
| - | ---- | ------- | ----- |
| 2 | SPIKE-02 — stack feasibility | 2026-06-13 | Proved integer-money + split invariant exact in TS (8/8); produced `ADR-0001`/`0002`/`0003` |
| 0 | SPIKE-01 — split-allocation UX | 2026-06-13 | De-risked the core bet (paper); reshaped the plan (see §5) |
