---
id: SR-2026-07-29-bud-s86-principal-seam
type: status-report
roadmap-item: BUD-S86
---
<!--
STATUS REPORT — BUD-S86 (Principal seam refactor). The FIRST build slice of BUD-E13 (auth /
household scoping), the exposure blocker for the BUD-E14 hub deployment. Behaviour-preserving
refactor: services are now built PER REQUEST bound to a `Scope`, replacing the once-at-boot
container and removing `DEFAULT_HOUSEHOLD_ID` from the request path. Ships with a hardcoded
BOOTSTRAP scope so the app behaves identically to the pre-auth version — BUD-S87 swaps that one
line for the session-derived principal. No new deps, no behaviour change. Decision: ADR-0009 §2.
-->

# Status Report — 2026-07-29 (BUD-S86 — Principal seam refactor)

| Field  | Value                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                   |
| Date   | 2026-07-29                                                                                 |
| Author | Claude (with the owner)                                                                    |
| Scope  | BUD-S86 built + `Done`; first slice of BUD-E13 (auth), de-risked by SPIKE-13, per ADR-0009 |

**Resume here:** **BUD-S86 is `Done` — the invasive, every-route refactor of the auth epic is
landed and the gate is fully green (434 Vitest + 121 e2e, typecheck + lint).** Services are now
constructed **per request** by [`makeServices(db, scope)`](../../apps/api/src/services/container.ts),
bound to a [`Scope`](../../apps/api/src/services/scope.ts) `{ householdId }`; each of the 13
container services filters by `scope.householdId` and **`DEFAULT_HOUSEHOLD_ID` is gone from the
request path** (it survives only as the seed/bootstrap constant + the one clearly-marked
`BOOTSTRAP_SCOPE` in [`server.ts`](../../apps/api/src/http/server.ts)). An `onRequest` hook sets
`req.services`; the 9 route plugins read `req.services.*`. Because the scope is a hardcoded bootstrap
(the single seeded household), **behaviour is byte-for-byte identical** to the pre-auth app.
**Next: BUD-S87 (Auth core + login)** — it replaces the one `BOOTSTRAP_SCOPE` line with a
session-derived principal + an auth `preHandler`; handlers and services are **not** touched again.

## What changed

- **New** [`services/scope.ts`](../../apps/api/src/services/scope.ts) — `Scope { householdId }` (the
  per-request authz scope; `userId`/`role` join it in BUD-S87).
- **New** [`services/container.ts`](../../apps/api/src/services/container.ts) — the `Services`
  interface (moved out of `routes/shared.ts`) + `makeServices(db, scope)`.
- **13 services** now take `(db, scope)` and filter by `scope.householdId` (the `HH` local alias
  moved inside each factory; `analysisService`'s module-level `gatherProjectionInputs` helper gained
  a `householdId` parameter). `restoreService` is untouched — it is CLI-only bootstrap and keeps the
  constant.
- **[`server.ts`](../../apps/api/src/http/server.ts)** — the once-built container became an
  `onRequest` hook building `req.services = makeServices(db, BOOTSTRAP_SCOPE)`; route plugins are
  registered with `{ clock }` only.
- **[`routes/shared.ts`](../../apps/api/src/http/routes/shared.ts)** — `req.services` Fastify type
  augmentation; `services` dropped from `RouteOptions`.
- **9 route plugins** — each handler reads its service from `req.services` (bodies otherwise
  unchanged).

## Definition of Done

- ✅ **Builds / typechecks** — `npm run typecheck` green across all workspaces.
- ✅ **Lint** — `npm run lint` (ESLint, zero warnings) green; boundary zones (BUD-S34) hold
  (`req.services` sourced in `http/routes/**`, no direct `db/*`).
- ✅ **Tests green, none skipped** — **434 Vitest + 121 e2e**, all passing (the HTTP-integration
  Vitest layer exercises every refactored route; e2e drives the real browser app end-to-end).
- ✅ **Behaviour preserved** — **zero test-count delta** and no test edits: a pure refactor, so the
  existing regression net *is* the proof. No new tests are the correct outcome.
- ✅ **Boundaries** — I/O stays in services; the scope enters at one chokepoint (the `onRequest`
  hook); a service is now unconstructable without a scope (structural default-deny groundwork).
- ✅ **Docs updated same-change** — ADR-0009 §2 records this decision; roadmap BUD-S86 → `Done`.
- ✅ **Secrets** — none introduced; synthetic fixtures only.
- ⚠ **Real per-request *variation*** — the scope is still the hardcoded `BOOTSTRAP_SCOPE`; it does
  not yet vary by caller. **By design** — that is BUD-S87's single change (owner: bootstrap → session
  principal). No security value is claimed yet: the API remains unauthenticated until BUD-S87.
- ⚠ **Format** — one **pre-existing** warning (`scripts/capture-demo-assets.ts`) unrelated to this
  slice; all files touched here are Prettier-clean. (Owner: fold into a tooling tidy.)

**Test delta:** 434 Vitest + 121 e2e → **434 Vitest + 121 e2e** (unchanged — behaviour-preserving).

**Commit:** `refactor(api): build services per-request bound to a Scope (BUD-S86); DEFAULT_HOUSEHOLD_ID leaves the request path`

## Next-session kickoff prompt

> Build **BUD-S87 (Auth core + login)** — the second slice of BUD-E13, per
> [ADR-0009](../adr/ADR-0009-authentication-household-scoping.md) and validated by
> [SPIKE-13](../spikes/13-auth-seam.md). Migration `0003-auth` (`users` + `sessions`), scrypt KDF,
> `POST /login`+`/logout`, an auth `preHandler` that derives the real principal and **replaces
> `BOOTSTRAP_SCOPE` in `server.ts`** (handlers/services untouched — that is BUD-S86's whole point),
> gate every resource route (401 default-deny), the `create-admin` CLI, and the `/login` web view +
> SPA 401→redirect + logout. End state: login required and you can log in. Keep the gate green
> (434 Vitest + 121 e2e as the floor) and add auth tests. `@fastify/cookie` is the one new dep.
