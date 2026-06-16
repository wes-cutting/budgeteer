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
| Last updated  | 2026-06-15     |
| Sources       | [`01_INTAKE.md`](01_INTAKE.md) · [`02_PRD.md`](02_PRD.md) · [`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md) · [`spikes/04-transfer-modeling.md`](spikes/04-transfer-modeling.md) · [`reviews/2026-06-15-repo-review.md`](reviews/2026-06-15-repo-review.md) · [`status-reports/2026-06-15-eh1.md`](status-reports/2026-06-15-eh1.md) · [`status-reports/2026-06-15-eh2.md`](status-reports/2026-06-15-eh2.md) · [`status-reports/2026-06-15-eh3.md`](status-reports/2026-06-15-eh3.md) · [`status-reports/2026-06-15-eh4.md`](status-reports/2026-06-15-eh4.md) · [`status-reports/2026-06-15-eh5.md`](status-reports/2026-06-15-eh5.md) · [`status-reports/2026-06-15-eh6.md`](status-reports/2026-06-15-eh6.md) |

**Current focus:** **`EH6` repo hygiene — ✅ `Done` (gate-green); the engineering-health track
(`EH1`–`EH6`) is now complete.** Removed the absorbed throwaway spike code
`spikes/04-transfer-modeling/` — confirmed inert first (no importer, not an npm workspace,
`vitest.workspace.ts`/`eslint` already excluded `spikes/`); its findings live on in `ADR-0004` + the
shipped `#7a`/`#7b` slices + the kept [spike report](spikes/04-transfer-modeling.md). Recorded the two
review notes as **accepted, no behavior change**: (a) `bigint`→`Number()` is exact up to ~`2^53` cents
(≈ $90T — beyond any V1 balance), documented on the `Cents` type and in `05_DATA_MODEL`; (b) the
domain's `normalizeName` (collapses internal whitespace) is a strict **superset** of the DB unique key
`lower(btrim(name))`, and they agree because the service stores the normalized name — documented in
`naming.ts` and `05_DATA_MODEL`. **125 Vitest + 1 e2e** unchanged; lint + typecheck + format + web build
green. **Next up — the analysis area (`#11`–`#14`)**, starting with **`#11` spend-by-envelope-over-time**
(monthly/annual rollups) on the cleaned base; **then** hardening (`#15`–`#16`, which expands EH5 into
full browser-e2e journeys + a11y). Prior blocks: **`EH5` browser e2e — ✅ Done**, 125 + 1 e2e; **`EH4`
ESLint-in-the-gate — ✅ Done**, 125 tests.

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
| [`ADR-0004`](adr/ADR-0004-transfer-modeling.md) — **transfer modeling** (account legs + envelope-transfer rows) | ✅ done | **`Accepted`** (2026-06-14); **`Validated`** by [SPIKE-04](spikes/04-transfer-modeling.md); (A) realized in `#7a`, (B) in `#7b`. |
| [`ADR-0001`](adr/ADR-0001-stack.md) — stack (TS · React+Vite · Fastify) | ✅ done | **`Validated`** by [SPIKE-02](spikes/02-stack-feasibility.md); awaiting owner nod → `Accepted`. |
| [`ADR-0002`](adr/ADR-0002-datastore.md) — datastore (Postgres · Kysely) | ✅ done | **`Validated`** — schema + queries run on PGlite (Postgres-in-WASM) with 12 passing API tests; prod node-postgres path wired, confirm at deploy. |
| [`04_DOMAIN_MODEL`](04_DOMAIN_MODEL.md) · [`05_DATA_MODEL`](05_DATA_MODEL.md) | ✅ realized | **`Accepted`** — implemented + tested in the foundation slice. |
| [accounts](features/accounts.md) · [envelopes](features/envelopes.md) specs · [foundation UX](ux/foundation.md) · [`06_API_CONTRACT`](06_API_CONTRACT.md) | ✅ built | FEAT-001/002 **`Implemented`**; UX `Accepted`; API contract documented. |

> **Security, day-zero (not deferred):** the Foundation slice sets the `.gitignore` to
> exclude confidential financial data **before** any such data can exist, and all tests use
> **synthetic fixtures** ([SECURITY.md](SECURITY.md), spine §8). This is a guardrail, not a
> hardening item.

## 4. The plan

Ordered by **Risk × Value**, top = next. `Gated by` names what must land first.

> **Numbering:** the `#` column is each item's **stable id**, counting from the top of the
> plan — Foundation = `#1`, SPIKE-02 = `#2`, so the **domain slices run `#3`+**. The PRD's
> *Slice 1* / *Slice 2* are `#3` / `#4`; from `#5` on, items are referred to by their `#`.
> (So "archive an envelope" = `#6` = the 4th domain slice built.) Status-report files are
> numbered separately by report sequence (`#01`, `#02`, …).

### Foundation

| # | Item | Kind | Value | Risk | Gated by | Status | Links (will produce) |
| - | ---- | ---- | ----- | ---- | -------- | ------ | -------------------- |
| 1 | **Foundation** — app shell + Postgres store + domain core + **account CRUD** (open with a starting balance, held *unallocated*) + **envelope CRUD** (create/rename). *Usable: set up your real accounts & envelopes and see balances.* Sets the **day-zero `.gitignore` + synthetic fixtures** guardrail. | slice | High | Med | ✅ SPIKE-02 · ADR-0001/0002/0003 | **✅ Done** | Built & gate-green (31 tests + HTTP smoke); [status report](status-reports/2026-06-13-foundation-slice.md) |

### Spikes (risk retirement)

| # | Item | Kind | Value | Risk | Answers (the question) | Status | Spike report |
| - | ---- | ---- | ----- | ---- | ---------------------- | ------ | ------------ |
| 0 | Split-allocation UX | spike | High | High | Is enter-once-then-split lower-friction than the sheet, esp. the many-way splits? | **Done** | [SPIKE-01](spikes/01-split-allocation-ux.md) — *Confirmed* |
| 2 | **Technical feasibility / stack** | spike | High | High | Can the TS stack deliver **integer-minor-unit money** + the **exact split invariant** (the prior float failure)? | **Done** | [SPIKE-02](spikes/02-stack-feasibility.md) — *Confirmed* (strict typecheck + 8/8 tests); produced `ADR-0001`/`ADR-0002` |
| 4 | **Transfer modeling** (gates `#7`) | spike | High | High | How to model **account↔account** *and* **envelope↔envelope** moves without breaking the split invariant? | **Done** | [SPIKE-04](spikes/04-transfer-modeling.md) — *Confirmed* (strict typecheck + 8/8 tests); recommends additive two-primitive model → `ADR-0004` |

### Domain slices

| # | Item | Kind | Value | Risk | Gated by | Status | Notes |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ----- |
| 3 | **Slice 1 — core enter→allocate loop** — enter deposit/withdrawal → allocate in **Single** (one-tap) or **Split** (multi-row, live `Allocated/Remaining`, use-remaining) + **partial allocation** (save now, "needs allocation" surface) → balances reconcile, invariant holds | slice | High | Med | #1 | **✅ Done** | Built & gate-green (44 tests + HTTP smoke); [feature](features/transactions.md)·[UX](ux/transactions.md); felt-friction caveat now exercised in-app |
| 4 | **Slice 2 — accelerators** — **templates/presets** (primary, **fixed-amount** lines) · keyboard-first row entry · distribute-remainder | slice | High | Med | #3 | **✅ Done** | Built & gate-green (55 tests + HTTP smoke); [feature](features/templates.md)·[UX](ux/templates.md) |
| 5 | **Edit a past split** (preserve the sum invariant) | slice | High | Med | #3 | **✅ Done** | Built & gate-green (57 tests + HTTP smoke); reuses editor + `PUT allocations`; [feature](features/edit-split.md)·[UX](ux/edit-split.md) |
| 6 | **Archive an envelope** (soft-delete; history preserved) | slice | Med | Low | #1 | **✅ Done** | Built & gate-green (62 tests + HTTP smoke); archive/unarchive + picker filtering; [feature](features/archive-envelope.md)·[UX](ux/archive-envelope.md) |
| 7a | **Transfer** (account↔account, **double-entry**) | slice | Med | High | #3 · ✅ SPIKE-04 | **✅ Done** | Built & gate-green (73 tests + HTTP smoke); `transfers` parent + `kind:'transfer'` legs, exempt from needs-allocation; [ADR-0004](adr/ADR-0004-transfer-modeling.md)·[feature](features/transfers.md)·[UX](ux/transfers.md) |
| 7b | **Reallocation** (envelope↔envelope) | slice | Med | Med | #3 · ✅ SPIKE-04 · 7a | **✅ Done** | Built & gate-green (82 tests + HTTP smoke); `envelope_transfers` table + two-source `v_envelope_balances`; into-archived blocked, drain/negative allowed; [ADR-0004](adr/ADR-0004-transfer-modeling.md)·[feature](features/transfers.md)·[UX](ux/transfers.md) |
| 8 | **Refunds** (negative allocation within a split) | slice | Med | Med | #3 | **✅ Done** | Built & gate-green (93 tests + HTTP smoke); per-row **Refund** toggle, signed-total invariant (no schema change); [feature](features/refunds.md)·[UX](ux/refunds.md). Resolved the "negative rows?" open Q |
| 9 | **Recurring transactions** | slice | Med | Low | #3 | **✅ Done** | Built & gate-green (106 tests + HTTP smoke); rule + split + schedule, idempotent **Post due** generator; [feature](features/recurring.md)·[UX](ux/recurring.md) |
| 10 | **Reconcile to bank** (manual balance compare) | slice | Med | Low | #1 | **✅ Done** | Built & gate-green (120 tests + HTTP smoke); plain compare + recorded history; resolved the cleared-vs-compare open Q (plain compare); [feature](features/reconcile.md)·[UX](ux/reconcile.md) |
| 11 | **Analysis — spend by envelope over time** (monthly/annual rollups) | slice | Med | Low | real data from #3 | Planned | Replaces the `18 Monthly` tab, generated not hand-keyed |
| 12 | **Analysis — budget vs. actual** | slice | Med | Med | envelope **monthly targets** capability | Planned | Needs per-envelope targets (open Q) |
| 13 | **Analysis — cash-flow forecast** (pay-period projection) | slice | Med | Med | #3 · #9 | Planned | Most modeling-heavy; the `Budget` tab's forward look |
| 14 | **Analysis — debt & credit trends** (payoff % · utilization) | slice | Med | Med | cards-as-accounts + debt modeling | Planned | Larger area — likely spawns its own feature specs |

### Engineering health (from the [2026-06-15 review](reviews/2026-06-15-repo-review.md))

Cross-cutting cleanups, **sequenced before the analysis area** (`#11`): analysis adds more web
money-formatting + read services, so the dedup/extraction is cheapest now. Do **EH1 → EH6 in
order**, then `#11`+. No live bugs — these are coverage + drift-prevention.

| # | Item | Kind | Pri | Status | Notes |
| - | ---- | ---- | --- | ------ | ----- |
| EH1 | **Share the domain in the web** — import money/format/date from `@budgeteer/domain`; delete the `format.ts` reimpl + `fakeApi` date mirror | refactor | P1 | **✅ Done** | Added `tryParseMoney` (single `DECIMAL_RE` home) + moved `splitEvenly` to domain; widened `formatMoney`; web declares the dep + imports it; kept only the `$`-display `formatCents` (presentation). 121 tests; Vite dev+build consume the workspace TS. [status report](status-reports/2026-06-15-eh1.md) |
| EH2 | **Extract API service plumbing** — shared `dates` util + generic `groupBy`; move `DEFAULT_HOUSEHOLD_ID` out of `db/migrate.ts` into a constants/config module | refactor | P2 | **✅ Done** | New `util/dates.ts` + `util/groupBy.ts` + top-level `constants.ts`; date converters deduped (5→1, dropped a dead `todayStr`), Map-by-parent loop replaced (×4 incl. transfer legs), household const decoupled from the migrator (9 importers). No behavior change; 121 tests. [status report](status-reports/2026-06-15-eh2.md) |
| EH3 | **Map DB unique-violation → 409** + typed route params | fix | P2 | **✅ Done** | New `services/dbErrors.ts` (`isUniqueViolation`/`asDuplicateName`) maps SQLSTATE `23505` → `DuplicateNameError` (→409) at the service layer; wraps the 6 name-writing methods. All 12 `req.params as {…}` casts → Fastify route generics. 125 tests (+4, incl. real-PGlite violation). [status report](status-reports/2026-06-15-eh3.md) |
| EH4 | **Add ESLint to the gate** (`@typescript-eslint` + `react-hooks`); remove now-dead `eslint-disable` comments | tooling | P3 | **✅ Done** | ESLint 9 flat config + `npm run lint` (zero-warning gate); caught & fixed a real rules-of-hooks error (`useRemaining`→`fillRemaining`); disables now meaningful + made consistent. 125 tests. [status report](status-reports/2026-06-15-eh4.md) |
| EH5 | **Browser e2e (Playwright)** — minimal now (dashboard loads vs. real API + 1 journey); **full journeys land in `#16`** | hardening | P1 | **✅ Done** | Playwright (Chromium-only) drives the real web app vs. the real API: dashboard loads (the CORS-class check) + one journey (account → envelope → deposit allocated → derived envelope balance). New `test:e2e` gate step, kept out of `npm test`. 125 Vitest + **1 e2e**. [status report](status-reports/2026-06-15-eh5.md) |
| EH6 | **Repo hygiene** — discard the absorbed `spikes/04-transfer-modeling/`; record accepted notes (bigint→Number; normalize-vs-btrim) | chore | P3 | **✅ Done** | Removed the throwaway spike code (no importer; not a workspace; tooling already excluded `spikes/`); findings persist in `ADR-0004` + `#7a`/`#7b` + the [spike report](spikes/04-transfer-modeling.md). Two notes recorded as accepted (no behavior change): bigint→`Number()` exact to ~$90T in `money.ts`/`05_DATA_MODEL`; `normalizeName` ⊃ DB `lower(btrim())` in `naming.ts`/`05_DATA_MODEL`. No test-count change (125 + 1 e2e). [status report](status-reports/2026-06-15-eh6.md) |

### Hardening

| # | Item | Kind | Value | Risk | Trigger (when) | Status | Links |
| - | ---- | ---- | ----- | ---- | -------------- | ------ | ----- |
| 15 | **Backup / export** of the local store | hardening | Med | Med | real daily data exists | Planned | `07_NFR` |
| 16 | **a11y pass** (WCAG 2.2 AA) + perf/NFR budgets + **full browser-e2e journeys** ([EH5](reviews/2026-06-15-repo-review.md)) + **ESLint in CI** ([EH4](reviews/2026-06-15-repo-review.md)) | hardening | Med | Low | UI surfaces exist | Planned | `07_NFR` *(a11y is also per-slice in the DoD; this is a consolidated pass; e2e/eslint started early as EH5/EH4)* |

### Deferred — post-V1

| # | Item | Kind | Why deferred | Status |
| - | ---- | ---- | ------------ | ------ |
| 17 | **SPIKE-03 — data-profiling:** does the 12-yr `Budget.xlsx` reconcile/extract cleanly from its in-cell formula strings? | spike | History migration is out of V1; this is the proper spike for the extraction that "got too messy" | Deferred |
| 18 | **Historical import** | slice | Gated by SPIKE-03 | Deferred |
| 19 | **Multi-user / household scoping** (auth · owner/household isolation) | epic | Future direction; a §11 scale-up trigger → full ceremony (tenancy ADR + threat model + property tests). **Absorbs the review's "no authentication" finding** ([2026-06-15 review](reviews/2026-06-15-repo-review.md)) | Deferred |
| 20 | **CSV/statement import**, later **live bank API** | slice | Manual is V1; each needs its own integration spike | Deferred |

## 5. Re-sequencing log

| Date | Change | Trigger | Effect on the plan |
| ---- | ------ | ------- | ------------------ |
| 2026-06-13 | History migration (→ #17/#18) and bank integration (→ #20) **deferred to post-V1** | Discovery forks A & B: **fresh start + manual** | Retired the two heaviest risks; V1 starts at the value/UX bet instead of a data-extraction slog |
| 2026-06-13 | **Templates** elevated to the primary accelerator (#4); **partial allocation** folded into the core loop (#3); **transfers/refunds/recurring/edit-split/archive** added as slices (#5–#9, mapped to A1.7/A1.5/A5.3 of the sheet) | [SPIKE-01](spikes/01-split-allocation-ux.md) confirmed the model + surfaced these | Shaped the domain-slice backlog; flagged transfers (double-entry) & edit-split (invariant) as the careful ones |
| 2026-06-13 | Added **SPIKE-02** (feasibility) ahead of the foundation | Stack still unchosen; SPIKE-01 was a *paper* test, didn't probe the build | `ADR-0001`/`0002` now gate the foundation slice |
| 2026-06-13 | **SPIKE-02 Done**; stack chosen (TS · React+Vite · Fastify · Postgres); `ADR-0001` `Validated`, `ADR-0002` `Proposed`, `ADR-0003` `Accepted` | [SPIKE-02](spikes/02-stack-feasibility.md) confirmed integer-money + split invariant exact (8/8 tests) | **Foundation slice → `Ready`**; no further pre-build spike needed |
| 2026-06-13 | **Foundation slice Done** (gate-green); `ADR-0002` → `Validated`; domain/data model → `Accepted`; FEAT-001/002 → `Implemented`; `06_API_CONTRACT` written; `ADR-0001` → `Accepted` | Built data→API→UI with 31 passing tests + HTTP smoke | **Slice 1** (core enter→allocate loop) is now unblocked & next |
| 2026-06-13 | **Slice 1 Done** (gate-green); FEAT-003 `Implemented`; UX `Accepted`; transaction/allocation endpoints added to `06_API_CONTRACT` | Built enter→split-allocate across domain→API→UI (44 tests + HTTP smoke); SPIKE-01 felt-friction caveat exercised in-app | **Next: Slice 2** (accelerators — templates) |
| 2026-06-13 | **Slice 2 Done** (gate-green); FEAT-004 `Implemented`; templates tables in `05_DATA_MODEL`; template endpoints in `06_API_CONTRACT`; template lines = **fixed amounts** (PRD open Q resolved) | Built templates + distribute/keyboard accelerators (55 tests + HTTP smoke); smoke caught & fixed a content-type/error-status bug | **Next: edit-a-past-split (#5), archive (#6)** |
| 2026-06-13 | **Slice #5 Done** (gate-green); FEAT-005 `Implemented`; **no new API** (reused `PUT /transactions/:id/allocations`) | Made register transactions editable via the AllocationEditor (57 tests + HTTP smoke) | **Next: archive an envelope (#6)** |
| 2026-06-13 | **`#6` Done** (gate-green); FEAT-006 `Implemented`; archive/unarchive endpoints in `06_API_CONTRACT` (**no schema change** — `archived_at` existed since the Foundation) | Archive/unarchive + picker filtering + Dashboard Archived section (62 tests + HTTP smoke) | **Next: transfers `#7`** (consider a modeling spike), then analysis |
| 2026-06-14 | **SPIKE-04 Done** (modeling); confirmed an **additive two-primitive** transfer model (account-transfer legs + `envelope_transfers` table); owner confirmed transfers must cover **envelope↔envelope** too | [SPIKE-04](spikes/04-transfer-modeling.md): both movements proven exact + orthogonal, split model untouched (8/8 tests) | **`#7` Ready** → recommend split into **`#7a` account-transfer** then **`#7b` envelope-reallocation**; produces `ADR-0004`. *Pending owner nod on the split + negative-envelope-balance Q before building.* |
| 2026-06-14 | Owner confirmed: **split `#7` into `#7a`/`#7b`**; **negative envelope balances allowed**. **`#7a` Done** (gate-green); `ADR-0004` `Accepted`; FEAT-007 `Implemented`; `transfers` table + `transactions.transfer_id`/kind-check in `05_DATA_MODEL`; `POST /transfers` in `06_API_CONTRACT` | Built account-transfer across domain→API→UI (73 tests + HTTP smoke) | **Next: `#7b`** (envelope reallocation — the second ADR-0004 primitive), then refunds `#8` |
| 2026-06-14 | **`#7b` Done** (gate-green) — completes `#7`/ADR-0004; `envelope_transfers` table + **two-source** `v_envelope_balances` in `05_DATA_MODEL`; `POST /envelope-transfers` in `06_API_CONTRACT`; EnvelopeTransfer entity in `04_DOMAIN_MODEL` | Built envelope-reallocation across domain→API→UI (82 tests + HTTP smoke); orthogonal to accounts, split model untouched | **Next: refunds `#8`**, recurring `#9`, reconcile `#10`, then analysis (`#11`–`#14`) |
| 2026-06-14 | Owner confirmed #8 scope: **mixed-sign rows within a split** via a per-row **Refund** toggle. **`#8` Done** (gate-green); FEAT-008 `Implemented`; **no schema change** (split invariant already governs the signed total); allocation inputs gain `refund` in `06_API_CONTRACT`; PRD §9 negative-rows Q **resolved** | Found the heart invariant already admits mixed signs — only the boundary blocked it; opened it + added the editor toggle (93 tests + HTTP smoke) | **Next: recurring `#9`**, reconcile `#10`, then analysis (`#11`–`#14`) |
| 2026-06-14 | Owner confirmed #9 scope: **weekly/biweekly/monthly**, explicit **Post due**, rule **carries its own split**. **`#9` Done** (gate-green); FEAT-009 `Implemented`; `recurring_transactions` + `recurring_lines` tables + `transactions.recurring_id` in `05_DATA_MODEL`; recurring endpoints in `06_API_CONTRACT`; RecurringTransaction entity in `04_DOMAIN_MODEL` | Built rule + idempotent generator across domain→API→UI (106 tests + HTTP smoke); pure schedule core with monthly anchor-day clamp | **Next: reconcile `#10`**, then analysis (`#11`–`#14`) |
| 2026-06-15 | Owner confirmed #10 scope: **plain compare + recorded history** (not a cleared/statement workflow); on mismatch **show the difference** (no auto-adjustment). **`#10` Done** (gate-green); FEAT-010 `Implemented`; `reconciliations` table in `05_DATA_MODEL`; reconcile endpoints in `06_API_CONTRACT`; Reconciliation entity in `04_DOMAIN_MODEL`; PRD §9 reconcile Q **resolved** | Built record+compare across domain→API→UI (120 tests + HTTP smoke); a recorded compare, no ledger/balance effect | **Next: the analysis area (`#11`–`#14`)** |
| 2026-06-15 | **CORS + .env fix** (not a roadmap slice): the browser app couldn't reach the API (no CORS headers → "Failed to fetch"); added `@fastify/cors` allowlist (`CORS_ORIGINS`) + repo-root `.env` auto-load (dotenv / Vite `envDir`) | Found via running the app at `localhost:5173`; the browser→API path was never exercised by curl/inject smokes | Hardening follow-up: add **browser e2e** (would have caught this) |
| 2026-06-15 | **Repo-wide review** captured ([reviews/2026-06-15-repo-review.md](reviews/2026-06-15-repo-review.md)); added **Engineering-health items `EH1`–`EH6`**, sequenced **before the analysis area** | No live bugs; themes = browser-path coverage gap + duplication drift | New order: **EH1→EH6 → analysis `#11`–`#14` → hardening `#15`–`#16`** (full e2e/a11y); no-auth folds into `#19` |
| 2026-06-15 | **`EH1` Done** (gate-green); web now imports money/date from `@budgeteer/domain`. Added `tryParseMoney` (single `DECIMAL_RE` home) + moved `splitEvenly` to domain; widened `formatMoney(value: number)`; `apps/web` declares the dep; `fakeApi` uses `dueOccurrences`/`anchorDayOf`. Refined the review's "delete format.ts": kept `formatCents` (the `$`/locale **display** formatter) as a presentation concern | The duplicated penny-exact parse regex (`MONEY_RE ≡ DECIMAL_RE`) + `splitEvenly` + the date mirror were a second source of truth; analysis (`#11`+) would build more atop it | **Next: `EH2`** (extract API service plumbing). 121 tests (+1 net) |
| 2026-06-15 | **`EH2` Done** (gate-green); API service plumbing extracted. New `util/dates.ts` (`todayStr`/`toISO`/`toDateStr`), `util/groupBy.ts` (generic, order-preserving), and top-level `constants.ts` for `DEFAULT_HOUSEHOLD_ID` (moved out of `db/migrate.ts`). Deduped the date converters (5→1, removed a dead `todayStr`), the bucket-by-parent loop (×4), and the household-constant↔migration coupling (9 importers) | Repeated service plumbing flagged by the review; analysis (`#11`+) adds more read services that would re-copy it | **Next: `EH3`** (map DB unique→409 + typed route params). 121 tests (no behavior change) |
| 2026-06-15 | **`EH3` Done** (gate-green); DB unique-violation now → 409 (was 500). New `services/dbErrors.ts` (`isUniqueViolation`/`asDuplicateName`) maps SQLSTATE `23505` → `DuplicateNameError` at the **service** layer (boundary rule: HTTP stays datastore-agnostic); wraps account/envelope/template create + rename/update. All 12 `req.params as {…}` casts replaced with Fastify route generics (`IdParams`/`AccountIdParams`) | The DB index is the real name guard (in-app check intercepts every *constructible* dup, so the index only fires under concurrency — and its failure was unhandled); casts were the last typed-assertion escape hatch | **Next: `EH4`** (ESLint in the gate). 125 tests (+4; backstop proven against real PGlite) |
| 2026-06-15 | **`EH4` Done** (gate-green); ESLint 9 flat config added (`@typescript-eslint` recommended + `react-hooks`) with `npm run lint` as a **zero-warning gate**; README gate list + commands updated. Caught & fixed a real rules-of-hooks error (non-hook helper `useRemaining` → `fillRemaining`); made the mount-load `exhaustive-deps` suppressions consistent across all 5 sites | No linter ran before, so the react-hooks rules were unenforced and the existing `eslint-disable` comments were inert | **Next: `EH5`** (minimal browser e2e — Playwright). 125 tests (no behavior change; one rename) |
| 2026-06-15 | **`EH5` Done** (gate-green); first **real browser→API** test layer. Added Playwright (Chromium-only): `playwright.config.ts` boots the real API + web (web on `:5173` to match the CORS allowlist) and Chromium drives one spec — dashboard-loads-vs-real-API + the account→envelope→deposit-allocated→derived-balance journey. New `npm run test:e2e` step (kept out of `npm test`); e2e TS folded into `typecheck`; ESLint/`.gitignore`/`.prettierignore` updated for the new surface | The CORS bug shipped because the three existing layers (domain unit · API `inject` · jsdom fake-API) never exercise a real browser→API round-trip ([2026-06-15 review](reviews/2026-06-15-repo-review.md) EH5 · [KIT_FEEDBACK](KIT_FEEDBACK.md) K3) | **Next: `EH6`** (repo hygiene — discard the absorbed transfer-modeling spike; record accepted notes). **125 Vitest + 1 e2e** |
| 2026-06-15 | **`EH6` Done** (gate-green) — **completes the engineering-health track `EH1`–`EH6`**. Discarded the absorbed throwaway spike code `spikes/04-transfer-modeling/` (verified inert: no importer, not a workspace, `vitest.workspace.ts`/`eslint` already exclude `spikes/`); ticked the spike report's own discard follow-up. Recorded two accepted notes (no behavior change): `bigint`→`Number()` exact to ~`2^53` cents (≈$90T) on the `Cents` type + `05_DATA_MODEL`; `normalizeName` ⊃ DB `lower(btrim())` in `naming.ts` + `05_DATA_MODEL` | Kit rule: spike code is throwaway once its findings are absorbed (here into `ADR-0004` + `#7a`/`#7b` + the kept report); the two notes were "accepted as-is" in the [2026-06-15 review](reviews/2026-06-15-repo-review.md) (EH6) and needed a durable home | **Next: the analysis area (`#11`–`#14`)**, starting with `#11` spend-by-envelope-over-time. **125 Vitest + 1 e2e** (no test-count change) |

## 6. Done / shipped

| # | Item | Shipped | Notes |
| - | ---- | ---- | ----- |
| 10 | **`#10`** — reconcile to bank (manual compare) | 2026-06-15 | Plain compare + recorded history · `reconciliations` table · no balance effect; [FEAT-010](features/reconcile.md); 120 tests + HTTP smoke |
| 9 | **`#9`** — recurring transactions | 2026-06-14 | Rule + split + schedule (weekly/biweekly/monthly) · idempotent **Post due** · `recurring_id` on generated txns; [FEAT-009](features/recurring.md); 106 tests + HTTP smoke |
| 8 | **`#8`** — refunds (refund rows within a split) | 2026-06-14 | Per-row **Refund** toggle · signed-total invariant · no schema change; [FEAT-008](features/refunds.md); 93 tests + HTTP smoke |
| 7b | **`#7b`** — envelope↔envelope reallocation | 2026-06-14 | `envelope_transfers` table · two-source `v_envelope_balances` · into-archived blocked/drain+negative allowed; [ADR-0004](adr/ADR-0004-transfer-modeling.md); 82 tests + HTTP smoke |
| 7a | **`#7a`** — account↔account transfer (double-entry) | 2026-06-14 | `transfers` parent + `kind:'transfer'` legs · balances conserved · exempt from needs-allocation; [ADR-0004](adr/ADR-0004-transfer-modeling.md); 73 tests + HTTP smoke |
| 6 | **`#6`** — archive an envelope (soft-delete) | 2026-06-13 | Archive/unarchive · pickers hide archived · history preserved; 62 tests + HTTP smoke |
| 5 | **Slice #5** — edit a past split (from the register) | 2026-06-13 | Reuses the editor + `PUT allocations`; 57 tests + HTTP smoke |
| 4 | **Slice 2** — allocation templates + accelerators | 2026-06-13 | Apply/save templates · distribute-remaining · keyboard-first; 55 tests + HTTP smoke |
| 3 | **Slice 1** — transactions & split allocation, data→API→UI | 2026-06-13 | Single/Split/partial · needs-allocation · allocate-later; 44 tests + HTTP smoke |
| 1 | **Foundation slice** — accounts + envelopes, data→API→UI | 2026-06-13 | Gate-green: 31 tests (domain/API/web), web build, HTTP smoke; usable app shell |
| 2 | SPIKE-02 — stack feasibility | 2026-06-13 | Proved integer-money + split invariant exact in TS (8/8); produced `ADR-0001`/`0002`/`0003` |
| 0 | SPIKE-01 — split-allocation UX | 2026-06-13 | De-risked the core bet (paper); reshaped the plan (see §5) |
