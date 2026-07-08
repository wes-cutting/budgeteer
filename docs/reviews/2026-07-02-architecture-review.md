<!--
CODE REVIEW — a point-in-time, repo-wide architecture review against the project standards
(ARCHITECTURE · ENGINEERING_STANDARDS · SECURITY · TESTING_STRATEGY), taken at the completion
of the UX Uplift (UX1–UX15). Findings are tracked as "Engineering health" items EH7–EH14 in
docs/03_ROADMAP.md §4; sequencing is the owner's call.
-->

# Architecture review — Budgeteer (post-UX-Uplift)

| Field   | Value                                                        |
| ------- | ------------------------------------------------------------ |
| Date    | 2026-07-02                                                    |
| Scope   | Whole repo at UX Uplift complete (HEAD `a824c0b`, UX15)       |
| Author  | Wesley Cutting + agent                                        |
| Verdict | **Healthy — the architecture is real, not aspirational.** No live money/invariant bugs found. Themes: **time handled as pure data but *obtained* impurely** (one finding is the root cause of the carried red test), **operational readiness lagging feature completeness** (restore, migrations, network exposure), and **two boundary rules held by convention only**. |

## Verdict

The boundaries the docs claim are the boundaries the code has. `packages/domain` is genuinely pure
(no framework, no I/O, `today` passed in as a parameter); services own all datastore access inside
`db.transaction()` where writes are multi-row; routes validate at the boundary (zod + domain
validators, typed route params), return one error envelope, and never leak 5xx internals; money is
branded integer cents end-to-end with a single parse regex shared through `@budgeteer/domain`
(EH1's fix has held). **366 Vitest + 94 e2e**, strict `tsc`, zero-warning ESLint, axe light+dark
down to 320px, measured perf budgets, a 120 KB bundle ceiling actively defended. All six findings
from the [2026-06-15 review](2026-06-15-repo-review.md) were closed and stayed closed.

What this review adds is the architect's next-horizon list: the places where the codebase's own
stated premises have quietly expired (the "replace me when the schema evolves" migrator; the
"anyone reaching :3001" acceptance now that the API binds every interface), plus the one impurity
that is actively costing gate-green today (the wall clock reached from inside services).

## Strengths (keep)

- **Pure-core / impure-shell held under pressure.** 15 slices of UX Uplift added zero I/O to the
  domain; new logic (`assessBurndown`) landed as a pure function with `today` injected — the
  convention self-propagates.
- **Derive-don't-store is systemic:** balances are views (`v_account_balances`,
  `v_envelope_balances`), analysis is pure functions over rows, onboarding state is derived from
  emptiness. Nothing to reconcile because nothing is duplicated.
- **The compose-existing-reads discipline** (UX5→UX11 shipped six surfaces with no new endpoint)
  kept the API small and the contract stable.
- **The gate is real:** typecheck · lint · format · unit · e2e (incl. a11y light+dark at 320px) ·
  build · SCA, with measured perf budgets and a bundle budget that has already vetoed dependencies.
- **Docs move with code** — this review found the docs *accurate*, which is rarer than finding the
  code healthy.

## Findings

| ID | Pri | Finding | Where | Recommendation |
| -- | --- | ------- | ----- | -------------- |
| EH7 | P1 | **The wall clock is reached for inside services — and it's why the gate carries a red test.** `todayStr()`/`currentMonthRange()` call `new Date()` and are invoked *inside* `recurringService.list/create/postDue` and the register's default window (`routes/transactions.ts`). ARCHITECTURE §1/§2 names the clock as I/O that is "passed in, not reached for." The domain layer does this right (`dueOccurrences`/`assessBurndown` take `today` as a parameter); the service layer doesn't, so `recurring.test.ts`'s post-due case can only pin "today" via relative-date fixtures against the real calendar — and it currently **fails on `main`** (expects 4, gets 1; carried since UX12). TESTING_STRATEGY: a failing test blocks completion — this is the review's only standing rule violation. | `apps/api/src/util/dates.ts`, `services/recurringService.ts`, `http/routes/transactions.ts` | Inject a clock: `buildServer(db, { now?: () => Date })` threaded to the service factories (default = real clock). Tests pass a fixed date and the recurring fixtures become absolute. This **retires the carry properly** instead of re-patching the fixture, and it's the shape `postDue` needs anyway when it ever runs on a schedule. |
| EH8 | P2 | **"Today" and "this month" are UTC-derived on both server and client — every default shifts a day/month early for a user west of UTC.** `todayStr()` (server) and eight web components' `new Date().toISOString().slice(0, 7 or 10)` derive calendar dates in UTC. For a US-timezone household, from ~5–8 PM local onward: the quick-add default date is tomorrow, the cockpit/Insights "this month" is next month on the month's last evening, burndown's "pace today" overshoots, and the register's default window is the wrong month. Dates are correctly *modeled* as calendar strings; the *derivation* of the current one ignores where the user is. A budgeting app's `occurred_on` is user-local by intent. | `apps/api/src/util/dates.ts`, `apps/web/src/{Cockpit,BudgetVsActualView,BudgetBurndownView,SpendingTrendsView,SpendingBreakdownView,EnvelopesList,AddTransactionForm,RecurringView,AccountRegister}.tsx` | Decide the timezone policy and record it in `04_DOMAIN_MODEL` (a short ADR if contested). Simplest consistent rule: **the client derives calendar dates in local time** (`toLocaleDateString("en-CA")` or equivalent) **and the server never derives "today" for user-facing defaults** — reads take the date/month from the caller (most already do; the register's default window and recurring `dueCount` are the exceptions, and EH7's injected clock is the seam to fix them through). |
| EH9 | P2 | **The single idempotent migration has outgrown its own premise.** `migrate.ts`'s header says "a versioned migrator replaces this when the schema starts to evolve" — it has evolved: two generations of `kind`-check constraints are dropped-and-re-added by name on every boot, and two defensive `add column if not exists` patches cover pre-ADR-0004/FEAT-009 databases. Every future change must reason about *all* historical DB shapes at once, there is no record of what ran where, and `CREATE OR REPLACE VIEW` can't handle a view's column-type change. Risk is dormant while stores are disposable PGlite, but it lands exactly when `DATABASE_URL` points at real data — and `#15b` (restore) needs a schema *version* to validate a snapshot against. | `apps/api/src/db/migrate.ts` | Adopt Kysely's built-in `Migrator` (dated migration files + a migrations table) **before the first real-Postgres deployment or `#15b`, whichever comes first**. Freeze today's `migrateToLatest` as migration `0001-baseline`; new changes become append-only files. Update `05_DATA_MODEL` in the same change. |
| EH10 | P2 | **The backup has never been restored — so it is not yet a backup.** Export (`#15a`) is done and even doubles as the health probe, but `07_NFR` §3 names it the *only* recovery path for a corrupted store while §7's "Restore (import) proven" box is unchecked, and `#15b` sits Deferred. An export that has never round-tripped is untested recovery: an FK-order bug, a cents-as-`Number` edge, or a schema drift would be discovered *during the emergency*. The owner tabled `#15b` on 2026-06-17 — this is a deliberate re-raise now that the feature roadmap it yielded to (analysis + UX Uplift) is complete and real daily data is accumulating in `PGLITE_DIR`. | `apps/api/src/services/backupService.ts`, [`07_NFR`](../07_NFR.md) §3/§7, roadmap `#15b` | Run the `#15b` spike (FK insert order, ID collisions, partial failure, version check — the questions are already written in the roadmap row), then ship even a **CLI-only restore into a fresh store** with a gate test proving `export → restore → export` is equivalent. UI can wait; the *proof* can't. Owner's call on sequencing, but this is the highest-value hardening item open. |
| EH11 | P2 | **The API binds `0.0.0.0` with no auth — the household ledger is readable/writable by any device on the local network.** The 2026-06-15 review accepted "no authentication" as the V1 stance, premised on "anyone reaching `:3001`" — but `index.ts` hardcodes `host: "0.0.0.0"`, which makes that set "everyone on the Wi-Fi," not "this machine." CORS is a browser courtesy; `curl` ignores it. SECURITY.md's default-deny spirit says the *reachable surface* should be as small as the auth story is. | `apps/api/src/index.ts` | Add `HOST` to the validated config, **default `127.0.0.1`**; document that multi-device use requires setting it explicitly (and that doing so is the trigger to pull `#19` forward). One line of exposure removed now; the auth epic stays where the roadmap put it. |
| EH12 | P3 | **The web trusts API responses through one unchecked cast, and the DTO shapes are hand-duplicated.** `request<T>` ends in `return data as T` — the single point where server/client drift becomes silent `undefined`s in the UI instead of a loud boundary failure. And the view types are maintained twice: `AccountView`/`EnvelopeView`/`TransactionView`/… exist in both `apps/api/src/services/*` and `apps/web/src/api.ts`, kept aligned only by `06_API_CONTRACT` and care. This is EH1's lesson (two sources of truth drift) one layer up, at the DTO seam. | `apps/web/src/api.ts:430`, `apps/api/src/services/*` view interfaces | Two independent steps, either alone worthwhile: **(1)** share the view types — export them from the api workspace via a types-only entry (or a small `packages/contract`) and import them in `api.ts`, deleting the duplicates (zero runtime cost, zero bundle cost); **(2)** decide the client-boundary stance — either add a light runtime check on reads (measure against the ~2.7 KB bundle headroom first) or record "client trusts the typed contract" explicitly in `06_API_CONTRACT`. |
| EH13 | P3 | **The boundary rules are held by convention, not tooling.** ARCHITECTURE §2: "prefer enforcing these with lint rules / module-boundary tooling so they can't quietly erode." ESLint exists now (EH4) but is syntactic only — nothing fails the gate if `packages/domain` imports `fastify`, `apps/web` imports `kysely`, or a route module imports the datastore around its service. Every past erosion (EH1's web reimplementations) happened exactly where no tool was watching. | `eslint.config.js` | Add per-zone `no-restricted-imports` overrides: domain bans `fastify`/`kysely`/`pg`/`react`/`node:*`; web bans `kysely`/`pg`; `http/routes/**` bans `../db/*` (services only). ~20 lines of config; the erosion path now fails the gate instead of a future review. |
| EH14 | P3 | **`postDue`'s idempotency is behavioural, not structural.** The claim holds because the cursor advances in the same transaction as the inserts — but two concurrent `postDue` calls (two tabs today; a scheduler + a tab later) can both read the old cursor and double-post every due occurrence. Near-zero at single-user V1; becomes real the moment posting is automated or multi-device (`#19`). | `apps/api/src/services/recurringService.ts`, `db/migrate.ts` | Make the invariant structural: a `unique (recurring_id, occurred_on)` index on generated transactions (partial: `where recurring_id is not null`), with the existing `dbErrors` shim treating the violation as "already posted, skip." Cheap now (EH9's first new migration file), load-bearing later. No urgency — bundle with EH9 or the first recurring-area change. |

### Watch items (no action, keep visible)

- **Insights fan-out:** Trends issues up to 12 sequential `getBudgetVsActual` calls; the cockpit
  fans out 5 reads. Invisible on localhost; the first thing a real network will surface. When it
  hurts, a month-*range* variant of that read is the fix — don't build it speculatively.
- **`perf.test.ts` lives in the unit gate** and occasionally trips under machine load (noted across
  status reports). If flakes recur, move perf assertions to a separate non-blocking lane rather
  than loosening budgets.
- **Bundle headroom is ~2.7 KB** under the 120 KB ceiling — effectively "no new dependencies."
  Fine as a forcing function; revisit the ceiling only with an ADR.
- **`@budgeteer/domain` ships raw TS** (`main: ./src/index.ts`) — correct while consumers are this
  monorepo's bundler/tsx; becomes a build step only if it's ever consumed externally.
- **The forecast e2e's flaky `getByLabel("Account")` collision** — already tracked; fold into the
  EH7 cleanup slice since both touch the same test hygiene.

## Recommended order

Right-sized sequencing (owner's call — only EH7 is urgent on the project's own rules):

1. **EH7 (+ the forecast-e2e flake)** — inject the clock, make the recurring fixtures absolute,
   get the gate *fully* green. Small slice, immediate payoff, unblocks trusting `npm test` again.
2. **EH11** — the `HOST` config default. Near-zero cost, closes the widest live exposure.
3. **EH8** — decide + document the timezone policy, fix the client date derivations (the server
   side rides on EH7's seam). User-visible correctness for evening/US users.
4. **EH10** — the `#15b` restore spike → minimal proven restore. Highest-value open hardening.
5. **EH9 (+ EH14)** — versioned migrator, baseline migration, uniqueness guard as its first child.
   Must land before real Postgres or restore, so it naturally slots beside EH10.
6. **EH12, EH13** — opportunistic: share the DTO types, add the boundary lint. Each is an
   afternoon; both convert convention into tooling.
