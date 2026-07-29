---
type: adr
id: ADR-0008
status: Proposed
---
<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike/slice validates the assumptions.
The Postgres-runtime half is already validated (SPIKE-12); the image/build half is validated
when BUD-S81 lands. Extends ADR-0001 (stack) and ADR-0002 (datastore).
-->

# ADR-0008: Containerized production runtime — a single ARM64 image on Postgres, built in CI, pulled by the hub

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Proposed                                                           |
| Date          | 2026-07-29                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | Runtime half: [`SPIKE-12`](../spikes/12-postgres-production-validation.md) (real PostgreSQL 16 aarch64: migrate-on-boot · reads · aggregate money math · writes · `23505→409` all green, zero code change). Image/build half: **to be validated by `BUD-S81`** (an ARM64 image that builds and runs). |
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
2. **Postgres backend, migrate-on-boot.** Runs against the hub's **PostgreSQL 16+** via
   `DATABASE_URL` (ADR-0002); `migrateToLatest` applies forward-only migrations on startup
   (proven in SPIKE-12). PGlite stays the dev/test default only.
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
  for client routes; the API keeps its literal paths, so route order matters).
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
