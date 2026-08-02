---
type: adr
id: ADR-0008
status: Accepted
---
<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Extends ADR-0001 (stack) and ADR-0002 (datastore).
Proposed 2026-07-29 → Accepted 2026-08-01, once BUD-S81/S82 built and ran the thing.
Refinements recorded while still Proposed (the /api prefix in Decision §1, PGlite as a dev
dependency in §2) came from that validation, not from a later re-think — the ADR was not yet
Accepted, so it was still the live decision record. Anything changing from here supersedes.
-->

# ADR-0008: Containerized production runtime — a single ARM64 image on Postgres, built in CI, pulled by the hub

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | **Accepted** (2026-08-01) — both halves validated                   |
| Date          | 2026-07-29                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | Runtime half: [`SPIKE-12`](../spikes/12-postgres-production-validation.md) (real PostgreSQL 16 aarch64: migrate-on-boot · reads · aggregate money math · writes · `23505→409` all green, zero code change). Image/build half: **`BUD-S81`/`BUD-S82`, 2026-08-01** — an 82 MB ARM64 image builds and runs, with `scripts/validate-deploy.sh` green on **24 checks** against real PostgreSQL 16 (arm64). Building it also **falsified this ADR's original one-origin routing assumption** — see Decision §1. |
| Extends       | [`ADR-0001`](ADR-0001-stack.md) (stack) · [`ADR-0002`](ADR-0002-datastore.md) (Postgres/Kysely) |
| Context       | [Hub deployment-readiness initiative](../reviews/2026-07-27-hub-deployment-readiness-initiative.md) (`BUD-E14`) |

## Context

`BUD-E14` makes budgeteer deployable as a self-hosted service on **labs-hub** — a portable
Raspberry Pi 5 (**ARM64**) running Docker/Compose on a home/van LAN, **no public internet**
(behind Starlink CGNAT). The hub's decided pattern for custom apps: **build the image in CI →
publish to GHCR (ARM64) → the Pi pulls it**, with a **PostgreSQL container** for stateful
services. budgeteer must fit that shape without redesigning the app.

Today the app is a two-workspace monorepo: a Fastify API (`apps/api`) and a Vite/React SPA
(`apps/web`) that talks to the API over `VITE_API_BASE_URL`. There is **no Dockerfile**. The
Postgres access path is wired (`DATABASE_URL` → `pg`) and now **proven** (SPIKE-12); config is
validated at startup (`config.ts`) and extensible.

The hard external constraint is **not** in this ADR: serving on the LAN requires the `#19` /
`BUD-E13` authentication epic first (default-deny at the resource level). This ADR decides the
*runtime shape*; it does **not** authorize `HOST=0.0.0.0` — that waits on `BUD-E13`.

## Decision

**Package budgeteer as a single multi-stage OCI image, built for `linux/arm64` in GitHub
Actions, published to GHCR, and run by the hub against a hub-supplied PostgreSQL 16 container.**

1. **One image, not two.** A multi-stage Dockerfile builds the web (`vite build` → static
   assets) and the API, and the **Fastify process serves the built static assets** alongside the
   API (via `@fastify/static`, a new runtime dep). Rationale: one container to pull/run/observe on
   a single-household LAN box, **one origin** (which collapses the CORS surface to same-origin),
   and no nginx sidecar to maintain. (Separate `api` + `web` images stay a documented alternative
   if the web ever needs independent scaling — it does not for this target.)

   **The API is namespaced under `/api` (added by `BUD-S81`, from what building it found).** One
   origin means the SPA's client routes and the API's paths share a URL space, and **seven of them
   collided exactly**: `/accounts`, `/envelopes`, `/templates`, `/recurring`, `/users`, and the
   `/accounts/:id` and `/envelopes/:id` forms. A browser refresh or bookmark on the Accounts page
   was answered by the account-list endpoint — JSON where the app should be. Route *ordering*
   cannot separate them (the paths are identical), so the namespaces are separated instead. The
   prefix applies in **every** environment, not only the container, so dev, tests, and production
   exercise one contract. Static assets and unmatched non-`/api` GETs fall through to the SPA
   shell; anything under `/api/` never does.
2. **Postgres backend, migrate-on-boot.** Runs against the hub's **PostgreSQL 16+** via
   `DATABASE_URL` (ADR-0002); `migrateToLatest` applies forward-only migrations on startup
   (proven in SPIKE-12). PGlite stays the dev/test default only — and `BUD-S81` made that literal
   by moving it to a **devDependency**, so it is absent from the production image (−26 MB, a third
   of the image). `DATABASE_URL` is therefore **required** when `APP_ENV=production` and startup
   fails loudly without it: there is no in-process store to fall back to, and silently serving a
   household's ledger from one that empties on restart would be far worse than a crash.
3. **Config via validated env (extend, don't rebuild).** The production profile sets
   `DATABASE_URL`, `HOST` (`0.0.0.0` **only once `BUD-E13` ships**), `CORS_ORIGINS` (same-origin
   → may be empty/self), `PORT`, `LOG_LEVEL`, plus the `BUD-E13` auth secrets. Secrets come from
   the environment, never the repo (SECURITY.md). Invalid config fails loudly at boot.
4. **Built in CI, pulled — never built on the Pi.** A GitHub Actions job builds the ARM64 image
   and pushes it to `ghcr.io/wes-cutting/budgeteer:<tag>` on release/tag (`BUD-S84`); the hub
   pulls by tag/digest.
5. **Readiness, not just liveness.** `/health` is extended to check DB reachability so the hub's
   healthcheck reflects a *ready* service, not merely a listening process (`BUD-S82`).
6. **State lives in Postgres; the app image is stateless.** No app-owned volume — the Postgres
   container owns the data-root volume. Backup/restore stays **CLI-only** (no HTTP import — SEC3);
   at-rest encryption is decided with labs-hub SPIKE-03 (`BUD-S85`).

## Consequences

### Positive
- One artifact, one origin, one process to run on the Pi — minimal ops for a LAN appliance.
- Reuses the proven Postgres path and validated config; the app code is essentially unchanged.
- The deploy contract (initiative §5) becomes concrete and stable for the hub to consume.

### Negative / cost
- A new runtime dep (`@fastify/static`) and static-serving wiring (SPA fallback to `index.html`
  for client routes).
- **The one-origin choice forced a breaking path change**: every API path moved under `/api`
  (see Decision §1). This is the real cost of a single image — it was paid once, mechanically
  (the client's base URL, the published contract, and every test's paths), but a second consumer
  would have had to be migrated too. Two images would have avoided it at the price of a second
  container and a cross-origin CORS surface.
- The SPA bundle is served **unauthenticated** — it must be, or the login page could never load.
  It is build output with no household data in it, and every byte of ledger data still comes from a
  gated `/api` call, but it does mean the app's existence and shape are visible to anything that can
  reach the port.
- CI must cross-build ARM64 (QEMU or an ARM runner) — slower builds; a new supply-chain surface
  (GHCR auth, image provenance).
- Single image couples web and API release cadence (acceptable for one first-party client).

### Neutral
- `VITE_API_BASE_URL` becomes same-origin (relative) in the container build; the dev split is
  unchanged.

## Alternatives considered

- **Two images (api + web/nginx).** The initiative's other option. More faithful to a scale-out
  topology but adds a second container, a cross-origin CORS config, and an nginx config to own —
  cost with no benefit for a single-household LAN box. Kept as the documented fallback.
- **Build on the Pi.** Rejected by the hub pattern (slow, non-reproducible, couples deploy to a
  toolchain on the node).
- **SQLite/PGlite file in prod.** Rejected: ADR-0002 chose Postgres for the multi-household
  future and the hub supplies a Postgres container; PGlite stays dev/test only.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
