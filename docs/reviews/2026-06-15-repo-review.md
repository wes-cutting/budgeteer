<!--
CODE REVIEW — a point-in-time, repo-wide review against the project standards
(ARCHITECTURE · ENGINEERING_STANDARDS · SECURITY · TESTING_STRATEGY). Findings are tracked as
"Engineering health" items EH1–EH6 in docs/03_ROADMAP.md §4, sequenced there.
-->

# Repo-wide code review — Budgeteer

| Field   | Value                                                        |
| ------- | ----------------------------------------------------------- |
| Date    | 2026-06-15                                                  |
| Scope   | Whole repo at `#10` complete (HEAD `fix: CORS + .env`)      |
| Author  | Wesley Cutting + agent                                      |
| Verdict | **Healthy.** No live bugs. Themes: a browser-path test gap + duplication drifting toward two sources of truth. |

## Verdict

The codebase is disciplined and the correctness-critical parts are strong: **120 tests, no
skips**, strict `tsc` across all three workspaces, **no `any`/`@ts-` escape hatches**, no
`TODO`/`FIXME`, no stray `console.*`. No money/invariant errors, data-corruption paths, or
broken authorization within the V1 single-household model were found. The actionable risks are
**test coverage** (the browser→API path) and **drift from duplication**, not current
incorrectness.

## Strengths (keep)

- **Pure-core / impure-shell** is real: `packages/domain` has zero I/O; services own all DB
  access; presentation is thin (ARCHITECTURE §3).
- **Money is integer cents end-to-end** (ADR-0003), branded `Cents`, parsed/validated only at the
  boundary, no floats. The split invariant (`validateAllocations`) is defined on the signed total
  and well tested (incl. mixed-sign refunds).
- **Boundary validation** on every route (zod shape + domain validators); consistent
  `{ error: { message } }` envelope; 4xx preserved, 500s never leak internals.
- **Household-scoped queries** throughout; multi-row writes are **atomic** (`db.transaction()`);
  each API test gets a fresh PGlite (isolation).
- Docs move in lockstep with code (specs/ADRs/models per slice).

## Findings

| ID | Pri | Finding | Where | Recommendation |
| -- | --- | ------- | ----- | -------------- |
| EH1 | P1 | **Money/date logic duplicated; web is a second source of truth.** `apps/web/src/format.ts` reimplements `parseMoney`/`formatMoney`/`sumMoney` as `parseCents`/`formatCents`/`centsToInput`; `apps/web/src/test/fakeApi.ts` re-mirrors recurring date math. Web never imports `@budgeteer/domain`. `DECIMAL_RE` (domain) ≡ `MONEY_RE` (web) today but maintained apart → drift risk against the "penny-exact" promise. | `apps/web/src/format.ts`, `apps/web/src/test/fakeApi.ts`, `packages/domain` | Make the domain package Vite-consumable (build/exports) and import money/format/date from it in web; delete the reimplementations. (The tracked "domain-share-with-web" carry.) |
| EH5 | P1 | **No browser/e2e coverage — already bit us.** The CORS bug shipped because nothing exercised a real browser→API round-trip (HTTP smokes use curl/inject; component tests use a fake API). | (test harness) | Stand up a minimal Playwright e2e (load dashboard against the real API + one journey) **now**; expand to full journeys + a11y in hardening (#16). |
| EH2 | P2 | **Repeated service plumbing.** `toDateStr`/`toISO` re-defined in 7 services; the "fetch children → group into a `Map` by parent id → attach" pattern in 3 (`transaction`/`template`/`recurring`); `DEFAULT_HOUSEHOLD_ID` imported from `db/migrate.ts` by all 8 services (constant coupled to the migration module). | `apps/api/src/services/*`, `apps/api/src/db/migrate.ts` | Extract a `dates.ts`, a generic `groupBy`, and move the household constant to a `constants`/config module. |
| EH3 | P2 | **DB unique-violation not mapped to 409 (+ untyped route params).** Name uniqueness is checked in-app then backstopped by the DB unique index; if that index rejects (concurrent dup, or any path skipping the app check) the Postgres error surfaces as **500**, not 409. Near-zero at single-user V1, but the real guard's failure is unhandled. Routes also cast `req.params as { id: string }` (only typed-assertion escape hatch). | `apps/api/src/services/*`, `apps/api/src/http/server.ts` | Add an error shim mapping unique violations → `DuplicateNameError` (→409); adopt Fastify route param generics / a small parse. |
| EH4 | P3 | **ESLint not configured, yet dead `eslint-disable` comments exist.** Web components carry `// eslint-disable-next-line react-hooks/exhaustive-deps` but no linter runs — the suppressions are inert and the react-hooks rules aren't enforced. | `apps/web/src/*`, repo root | Wire up `@typescript-eslint` + `eslint-plugin-react-hooks`; add `lint` to the gate; the existing suppressions become meaningful (or get removed). |
| EH6 | P3 | **Repo hygiene + accepted notes.** `spikes/04-transfer-modeling/` is still committed (kit: discard once findings absorbed). Accepted as-is: `bigint`→`Number()` loses precision above ~2^53 cents (≈$90T — non-issue); `normalizeName` collapses internal whitespace while the DB index uses `lower(btrim(...))` (agree in practice — the service stores the normalized name). | `spikes/04-transfer-modeling/`, `packages/domain/src/{money,naming}.ts` | Remove the absorbed spike; leave the two notes documented as accepted (no action). |
| — | P3 | **No authentication.** V1 is a single implicit household; anyone reaching `:3001` has full read/write. CORS is origin control, not auth. **Documented V1 stance** — captured by the deferred multi-household epic. | (whole API) | No new item — folds into roadmap **#19 (multi-user / household scoping)**. |

## Recommended order

A short **engineering-health paydown before the analysis area**, because analysis (#11–#14) adds
more web components (money formatting) and more read services — building on the duplicated/
un-extracted code makes the cleanup strictly bigger later. Then the planned features, then a
hardening pass that the review expands.

1. **EH1** — share the domain in the web (money/format/date). *(First: analysis UI formats money.)*
2. **EH2** — extract API service plumbing (`dates`, `groupBy`, household constant).
3. **EH3** — map DB unique → 409 + typed route params.
4. **EH4** — add ESLint to the gate (+ remove dead disables).
5. **EH5 (min)** — minimal browser e2e (dashboard loads vs. real API + one journey). *(Front-load the CORS-class risk.)*
6. **EH6** — discard the absorbed spike; record the accepted notes.
7. → **Analysis `#11`–`#14`** on the cleaned base.
8. → **Hardening `#15`–`#16`**, expanded: **EH5 (full)** browser-e2e journeys + a11y/WCAG + perf/NFR.
9. **#19** (multi-household) absorbs the no-auth item — post-V1.
