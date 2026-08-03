---
id: REV-2026-07-27-hub-deployment-readiness-initiative
type: initiative
status: Accepted
---
<!--
RECONCILED with the live roadmap 2026-07-29 (budgeteer side): accepted by the owner and spawned
as epic BUD-E14 (fronts B–F = BUD-S81–S85) with the runtime shape recorded in ADR-0008. Front A
is BUD-E13, confirmed to build as the FULL multi-user epic (not a compressed single-household
gate) and now the active exposure blocker. Reality check: this brief framed "#19 already exists
here" — corrected on the roadmap side to "BUD-E13 is a named epic but UNBUILT (zero auth code)",
so it is the largest remaining piece, not a fold-in. Front C's production Postgres path is proven
by SPIKE-12 (real PostgreSQL 16 aarch64, zero code change). Only §9's deploy-contract remains open.
-->
<!-- Original front-matter note (labs-hub authorship) preserved below. -->
<!--
Hub deployment-readiness initiative — the objective of making budgeteer deployable as a
self-hosted service on the "labs-hub" portable hub (a sibling project). Authored from the
labs-hub side after a read-only analysis of this repo; PROPOSED, pending the budgeteer
owner's agreement and reconciliation with the live roadmap. This is the brief; it spawns
roadmap items (§9). The load-bearing prerequisite (#19 authentication) already exists here —
this initiative sequences it as the deploy blocker, it does not redefine it.
-->

# Hub deployment-readiness — objective & fronts

| Field   | Value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | Accepted (2026-07-29) — spawned as `BUD-E14`; runtime shape in `ADR-0008`  |
| Owner   | Wesley Cutting                                                           |
| Date    | 2026-07-27                                                               |
| Trigger | `labs-hub` selected budgeteer as its first custom app (labs-hub LH-S3)   |
| Scope   | What budgeteer must do to be **deployable + safe** on the hub — not a redesign |

## 1. Objective

Make budgeteer **deployable as a self-hosted container service on the labs-hub** — a portable
Raspberry Pi 5 (ARM64) hub running Docker/Compose on a home/van LAN — so the household can
reach and use budgeteer from other devices on that network, **without ever exposing the
financial ledger unauthenticated.**

> One line: *ship the auth that makes network exposure safe, package the app as an ARM64
> image with a Postgres backend, and publish a deploy contract the hub can consume unchanged.*

## 2. The target platform (labs-hub)

labs-hub deploys each service as a **container defined in tracked Compose**, with state on a
**data-root**, a **`/health`** endpoint, launcher **labels**, and **LAN-only** reach (no
public internet; behind Starlink CGNAT). For *custom* apps it has decided the pattern:
**build the image in CI → publish to a registry (GHCR, ARM64) → the Pi pulls it**, plus a
**PostgreSQL container** for stateful services. budgeteer must fit that shape.

## 3. The gating constraint — authentication before LAN exposure

budgeteer today has **no authentication**: the API binds loopback by default, and its own docs
state that binding `0.0.0.0` "exposes read+write of the whole ledger with zero auth" and is
**the documented trigger to pull `#19` forward** (`EH11`, `SEC3`, `SECURITY.md` §3). Deploying
on the hub means serving on the LAN — i.e. exactly that exposure.

**Therefore `#19` (the authentication / household-scoping epic) is the hard prerequisite.**
The hub will **not** deploy budgeteer until default-deny auth, checked at the resource level,
is in place. This initiative does not re-specify `#19`; it elevates it to *the* blocker and
sequences the rest behind it.

## 4. Readiness fronts (each → a roadmap item)

| # | Front | What it means | Notes |
| - | ----- | ------------- | ----- |
| A | **Authentication (`#19`)** — **blocker** | Default-deny auth at the resource level; a login the household uses; `/export` and all read/write behind it | Already an epic here; folds in `SEC3`. Everything else waits on this for *exposure*, though B–F can proceed in parallel. |
| B | **Containerization** | A multi-stage **Dockerfile**: build the web (`vite build` → static) and run the API (Fastify); serve the web (nginx sidecar or Fastify static). Must build for **ARM64**. | New. No Dockerfile exists today. |
| C | **Production datastore** | Run against real **PostgreSQL** (`DATABASE_URL`), not PGlite; migrations apply on boot | `ADR-0002` already allows Postgres; `EH9` gave a forward-only migrator. The hub supplies a Postgres **container**. |
| D | **Production config & the deploy contract** | Validated env for prod: `HOST=0.0.0.0` (**only once A ships**), `CORS_ORIGINS` = the deployed web origin, `VITE_API_BASE_URL`, secrets via env (never committed). Publish the contract in §5. | Config already validated at startup — extend, don't rebuild. |
| E | **CI image publishing** | GitHub Actions builds the ARM64 image and pushes it to **GHCR** on release/tag | New CI job; the hub pulls by tag/digest. |
| F | **Data-at-rest & backup** | Financial data will live on a **physically stealable** node → encryption + tested backup/restore | Aligns with labs-hub **SPIKE-03**. budgeteer already has **CLI** backup/restore; keep restore **CLI-only** (no HTTP import — `SEC3`). |

## 5. The deploy contract (the handoff to labs-hub)

**PUBLISHED — [`docs/DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md)** (BUD-S83, 2026-08-01), with a
worked reference deployment at [`deploy/compose.yaml`](../../deploy/compose.yaml) and an executable
proof at `scripts/validate-deploy.sh`. That document supersedes the sketch below and is what LH-S3
consumes; §8 there makes it a coordinated-change surface.

How the sketch resolved, where it differs:

- **Image:** `ghcr.io/wes-cutting/budgeteer:<tag>` (ARM64, ~82 MB) — the **single**-image option, not two.
- **Ports:** `3001` only — the SPA, the API, and health all come from one process on one origin.
- **Env (required):** `APP_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`. `HOST=0.0.0.0` and
  `CORS_ORIGINS=""` are image defaults, not things the hub must set; `VITE_API_BASE_URL` is
  **build-time**, not runtime, so it is not part of the hub's env at all.
- **Volumes:** none for the app — confirmed; the Postgres container owns the only volume.
- **Health:** `GET /api/health` → `200 {"status":"ok","db":"ok"}`, `503` when the database is
  unreachable. The DB-reachability extension landed (BUD-S82).
- **Dependencies:** PostgreSQL 16+; migrates on startup. Confirmed.
- **New, and not anticipated here:** every API path now lives under **`/api`** (the SPA's client
  routes collided with the API's paths on a shared origin — ADR-0008 §1), and **TLS vs the `Secure`
  session cookie** is a decision the hub must make before going live (contract §5).

## 6. Definition of "deployment-ready"

- [ ] **A/`#19`:** default-deny auth in place → serving on the LAN is safe.
- [ ] **B:** an **ARM64 image builds** (multi-stage) and runs.
- [ ] **C:** runs against **PostgreSQL** with migrations applied on boot; `/health` green (incl. DB).
- [ ] **D:** prod config validated; the **§5 deploy contract is published** and stable.
- [ ] **E:** the image is **pulled from GHCR**, not built on the Pi.
- [ ] **F:** backup/restore is tested; at-rest encryption decided (with labs-hub SPIKE-03).

When A–E are checked, labs-hub LH-S3 can deploy budgeteer unchanged.

## 7. Sequencing & the cross-project dependency

1. **`#19` authentication** — first; it is the exposure blocker.
2. **B–E** (containerize · Postgres · prod config · CI image) — can largely proceed in parallel with A; **exposure** waits on A.
3. **F** (encryption/backup) — with labs-hub SPIKE-03.
4. **labs-hub LH-S3** consumes the §5 contract. *(labs-hub currently marks LH-S3 `Blocked` on this initiative.)*

## 8. Non-goals

- **Not** multi-tenant SaaS or a hosted/public service — single household, LAN-only, self-hosted.
- **Not** public-internet exposure (the hub is LAN-only behind CGNAT).
- **No** change to the domain model, money representation, or the V1 feature set.
- **No** HTTP restore/import endpoint (`SEC3`) — restore stays CLI-only.

## 9. Outputs / next steps

- [x] Owner review; reconcile with the live roadmap — done 2026-07-29 (A = `BUD-E13`, full epic; corrected the "#19 already exists" framing to "named but unbuilt").
- [x] Spawn roadmap items for **B–F** — `BUD-E14` epic: `BUD-S81` (B) · `BUD-S82` (C) · `BUD-S83` (D) · `BUD-S84` (E) · `BUD-S85` (F), sized in [`03_ROADMAP-v2.md`](../03_ROADMAP-v2.md) §3.
- [x] **ADR** for the containerized production runtime — [`ADR-0008`](../adr/ADR-0008-containerized-production-runtime.md) (single ARM64 image · Postgres · GHCR), extending `ADR-0001/0002`; runtime half validated by [`SPIKE-12`](../spikes/12-postgres-production-validation.md).
- [x] Finalize and publish the **§5 deploy contract**; hand it to labs-hub LH-S3 (`BUD-S83`) —
      done 2026-08-01: [`docs/DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) + [`deploy/compose.yaml`](../../deploy/compose.yaml).
