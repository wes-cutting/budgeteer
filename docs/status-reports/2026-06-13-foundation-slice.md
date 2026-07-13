---
type: status-report
roadmap-item: BUD-S1
status: Snapshot
---
<!--
STATUS REPORT — point-in-time snapshot for clean hand-offs. Optimized for a cold reader.
-->

# Status Report — 2026-06-13 (#01)

| Field  | Value                                                       |
| ------ | ----------------------------------------------------------- |
| Status | Snapshot                                                    |
| Date   | 2026-06-13                                                  |
| Author | Wesley Cutting + agent                                      |
| Scope  | From project kickoff through the **Foundation** slice (Done) |

**Resume here:** Budgeteer is an envelope-budgeting app whose bet — *enter a transaction
once at the account level, then split-allocate it across envelopes* — was validated on
paper ([SPIKE-01](../spikes/01-split-allocation-ux.md)) and de-risked technically
([SPIKE-02](../spikes/02-stack-feasibility.md): integer-cent money + the split invariant are
exact in TypeScript). The **stack** is set (TS · React+Vite · Fastify · PostgreSQL/Kysely;
ADR-0001/0002/0003). The **Foundation slice is Done and gate-green**: a monorepo with a pure
domain core, a Fastify API over PostgreSQL (PGlite in dev/test), and a React dashboard where
you can create accounts (with an opening-balance transaction) and envelopes, see derived
balances, and rename — with boundary validation and a consistent error envelope. **Next: build
Slice 1 — the core enter→allocate loop** (transactions + split allocation), the validated
heart of the product.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Discovery + PRD + Roadmap | Inverted data-entry model; fresh-start + manual; scope & non-goals | [01_INTAKE](../01_INTAKE.md) · [02_PRD](../02_PRD.md) · [03_ROADMAP](../03_ROADMAP.md) |
| SPIKE-01 (value/UX, paper) | Confirmed enter-once-then-split; templates defuse the paycheck slog; partial allocation first-class | [spike](../spikes/01-split-allocation-ux.md) |
| SPIKE-02 (feasibility) | Integer money + split invariant exact in TS (8/8) | [spike](../spikes/02-stack-feasibility.md) |
| ADR-0001/0002/0003 | Stack `Accepted` · datastore `Validated` · money=integer-cents `Accepted` | [adr/](../adr/) |
| Domain & data model | Account · Envelope · Transaction · split-Allocation; opening-balance = opening txn; balances derived | [04](../04_DOMAIN_MODEL.md) · [05](../05_DATA_MODEL.md) |
| FEAT-001 Accounts, FEAT-002 Envelopes | CRUD (create/list/rename) data→API→UI, `Implemented` | [features/](../features/) · [ux/foundation](../ux/foundation.md) |
| API contract | HTTP/JSON endpoints + error envelope documented | [06_API_CONTRACT](../06_API_CONTRACT.md) |

## 2. Definition of Done — current state (Foundation slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | FEAT-001/002 criteria covered by API + web tests |
| Gate green (types/format/tests/build) | ✅ | `tsc` clean (3 workspaces) · 31 tests pass · web `vite build` ok · prettier clean |
| Lint (ESLint) | ⚠ deferred | Not yet configured — fast-follow (tsc-strict + noUncheckedIndexedAccess carry the load for now) |
| E2E (browser) | ⚠ deferred | Playwright not run (sandbox can't install browsers); HTTP smoke + web component tests cover the journey for now |
| Usable end-to-end (data→API→UI) | ✅ | Server smoke-tested over HTTP (create account/envelope, list, 409) |
| Docs updated in same change | ✅ | 04/05/06 + features + UX + roadmap promoted |
| Security (input/authz/secrets) | ✅ / ⚠ | Input validated at boundary; `.gitignore` keeps real data out; **authz not built** (single implicit household by design — ADR-0002) |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit (domain) | 0 | 15 | +15 |
| Integration (API/PGlite) | 0 | 12 | +12 |
| Component (web/jsdom) | 0 | 4 | +4 |
| Browser E2E | 0 | 0 | deferred |
| **Total** | 0 | **31** | **+31** |

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Playwright browser E2E | Sandbox can't install browsers | Add in CI before "real" use |
| ESLint config | Right-sized out of the first slice | Fast-follow |
| Share `@budgeteer/domain` with the web | Needs a domain build step; web re-derives `formatCents` for now | When convenient |
| Prod PostgreSQL run | Only PGlite exercised here (same SQL/dialect) | Confirm at first deploy → ADR-0002 `Accepted` |
| Throwaway `spikes/02-stack-feasibility/` | Findings absorbed into the domain core | Safe to delete |

## 5. Outstanding & next steps

- **Slice 1 — core enter→allocate loop** (roadmap #3): transaction entry (deposit/withdrawal)
  + Single/Split allocation with live remainder + partial allocation + "needs allocation"
  surface. Write `features/transactions.md` + `ux/` first (Definition of Ready). This closes
  the SPIKE-01 *felt-friction* caveat in the running app.
- Then **Slice 2 — accelerators** (templates first), and `edit-a-past-split` (correctness).

## 6. Commands & gotchas (cold-start)

```sh
npm install            # root; npm workspaces (packages/domain, apps/api, apps/web)
npm run typecheck      # tsc --noEmit across all workspaces
npm test               # vitest workspace: node project (domain+api) + web project (jsdom)
npm run -w @budgeteer/web build     # vite production build
npm run -w @budgeteer/api dev       # start API on PORT (default 3001); PGlite if no DATABASE_URL
npm run -w @budgeteer/web dev       # start the web app (Vite); set VITE_API_BASE_URL to the API
```

- **Datastore:** no `DATABASE_URL` → in-process **PGlite** (real Postgres in WASM, zero setup);
  set `DATABASE_URL` for real PostgreSQL in prod.
- **kysely pinned to 0.27.6** (root `apps/api`): `kysely-pglite`'s toolchain pins it; don't
  bump without deduping (two copies cause TS type-identity clashes).
- **Money is integer cents everywhere** (ADR-0003); parse/format only at the HTTP/UI boundary.
- `spikes/**` is excluded from vitest (it runs on `node:test`, not vitest).
