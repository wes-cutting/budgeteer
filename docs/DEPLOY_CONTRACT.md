---
id: DOC-DEPLOY-CONTRACT
type: reference
status: Implemented
---
<!--
DEPLOY CONTRACT — the stable interface labs-hub (LH-S3) consumes to run budgeteer.
Finalizes §5 of the 2026-07-27 hub deployment-readiness initiative (BUD-S83).
Runtime shape: ADR-0008. Auth: ADR-0009. Change policy in §8 — this file is a promise
to another project, so breaking any of it is a coordinated change, not a refactor.
-->

# Deploy contract — budgeteer on labs-hub

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | Implemented — validated by `scripts/validate-deploy.sh` against PostgreSQL 16 (arm64) |
| Owner        | Wesley Cutting                                                            |
| Consumer     | labs-hub `LH-S3`                                                          |
| Last updated | 2026-08-02                                                                |
| Decisions    | [`ADR-0008`](adr/ADR-0008-containerized-production-runtime.md) (runtime) · [`ADR-0009`](adr/ADR-0009-authentication-household-scoping.md) (auth) |

> budgeteer is a **single-household, LAN-only** self-hosted service. Not multi-tenant, not
> public-internet (initiative §8). A reference `docker compose` file lives at
> [`deploy/compose.yaml`](../deploy/compose.yaml) — that file *is* the worked example of everything
> below. Its sibling [`deploy/compose.demo.yaml`](../deploy/compose.demo.yaml) is the **demo
> instance** (§10): the same image, a separate box, synthetic data only.

## 1. Image

| | |
| --- | --- |
| Registry | `ghcr.io/wes-cutting/budgeteer` — **public**, so the hub pulls anonymously (no PAT, no `docker login`) |
| Tags | a release tag (e.g. `v0.3.0`); pull by tag or digest |
| Platform | `linux/arm64` (Raspberry Pi 5) |
| Size | **81.8 MB compressed** (what the Pi downloads) · ~400 MB uncompressed on disk |
| Base | `node:22-bookworm-slim` |
| User | runs as the non-root `node` user |
| Build | GitHub Actions → GHCR. **Never built on the Pi** (ADR-0008 §4) |
| Provenance | signed SLSA v1 attestation, pushed to the registry; verify before deploying (below) |

**Current release — `v0.2.0`, the image labs-hub runs** (2026-08-02):

| | |
| --- | --- |
| Digest | `sha256:0535855c75e2bd71500923c3f623cc639f1eefea08d4d31cb785ebdeac93283f` |
| Tags | `0.2.0` · `0.2` · `latest` — all three point at that digest |
| Source | commit `bda57af` (tag `v0.2.0`), built by [`publish-image.yml`](../.github/workflows/publish-image.yml) [run 30763372012](https://github.com/wes-cutting/budgeteer/actions/runs/30763372012) |
| Carries | `BUD-S91` (sign-in error meets AA in dark mode), `BUD-S92` (first admin from the browser), `BUD-S93` (the demo stack — config/docs only) |
| Consumed by | labs-hub `LH-S3-demo` — `deploy/compose.budgeteer-demo.yml`, pinned by the digest above |

> **`v0.1.0`'s recorded digest was stale, and this is the argument for pinning.** This file used
> to name `sha256:ef0883…` as v0.1.0's digest. The tag was published **twice** (runs 30733049897
> and 30752973009), and `0.1.0` now resolves to `sha256:3154633…` instead. Nothing announced that;
> a deploy tracking the *tag* would have silently changed underneath itself. Pin the digest.

**Pin by digest, not by tag.** A tag can be repointed; a digest cannot. The compose file defaults to
`:latest` for convenience, but a real deploy should pin:

```sh
docker pull ghcr.io/wes-cutting/budgeteer@sha256:ef088340334264d6ceb818e356de11224278c62c3d09626e70fd266161e71da2
gh attestation verify oci://ghcr.io/wes-cutting/budgeteer@sha256:ef0883… --owner wes-cutting
```

The attestation names the workflow and the source commit that produced the image, so the hub can
check *what built this* rather than trusting the tag (ADR-0008 names the registry as a new
supply-chain surface).

> **Verifying `v0.1.0`'s provenance:** the attestation records the pre-rewrite SHA `1f478ab`, which
> is no longer reachable from `main`. On 2026-08-02 the commit *messages* of four commits in that
> range were rewritten (a stray `git commit -am "…"` wrapper), which re-hashed everything from
> `db8d3d7` forward; `1f478ab` became `a5f2380`. **The trees are byte-identical** — same source, new
> SHA — so the attestation still attests to this image's real source, it just names a commit id the
> repository has retired. Later releases will not have this mismatch.

**One image serves both halves.** The Fastify process serves the API *and* the built SPA, so there
is one container, one port, one origin — no web container, no nginx sidecar.

## 2. Ports

| Port | Purpose |
| ---- | ------- |
| `3001` | everything — the SPA, the API, and `/api/health`. Configurable via `PORT`. |

Nothing else is exposed. The database port is **not** published: the app reaches Postgres over the
internal compose network, so no LAN device can open a Postgres connection to the ledger.

## 3. Environment

**Required** — the container fails to start, loudly, without these:

| Variable | Value | Why it is required |
| -------- | ----- | ------------------ |
| `APP_ENV` | `production` | Selects the production profile (which enforces the two below). |
| `DATABASE_URL` | `postgres://budgeteer:<pw>@db:5432/budgeteer` | PGlite is not in the production image; there is no fallback store, and quietly serving the ledger from an ephemeral one would lose every write on restart. |
| `SESSION_SECRET` | ≥ 16 chars; `openssl rand -base64 48` | Signs the session cookie. Unsigned sessions are forgeable. |

**Optional** — with the defaults the image already sets:

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `HOST` | `0.0.0.0` | Safe as of BUD-E13: auth is default-deny at the resource level. |
| `PORT` | `3001` | |
| `WEB_STATIC_ROOT` | `/app/apps/web/dist` | Where the SPA is served from. Startup fails if it holds no `index.html`. |
| `CORS_ORIGINS` | `""` | Correctly empty — one origin means no cross-origin caller to allowlist. Never `*`. |
| `LOG_LEVEL` | `info` | |
| `SESSION_COOKIE_SECURE` | on in production | **See §5 — the one thing to decide before going live.** |

Secrets come from the environment and are never baked into the image or committed (SECURITY.md §1).

## 4. Dependencies & state

- **PostgreSQL 16+**, reachable at `DATABASE_URL`. The app runs its own forward-only migrations on
  startup — no migration step to orchestrate.
- Start ordering: wait for Postgres to accept queries (`pg_isready`), not merely for the container
  to exist, or the app races the database's own start-up. The reference compose uses
  `depends_on: condition: service_healthy`.
- **The app image is stateless and owns no volume.** All state is in Postgres, so the database
  volume is the single thing to back up (BUD-S85) and the single thing to encrypt at rest.

## 5. TLS and the session cookie — decide this before going live

The session cookie is marked `Secure` in production by default, and **browsers discard a `Secure`
cookie that arrives over plain HTTP.** A hub serving budgeteer over `http://` on the LAN will
therefore appear to accept a login and then bounce straight back to the login page, with nothing
obviously wrong in the logs. Two supported shapes:

1. **Terminate TLS at a hub reverse proxy (recommended).** Change nothing here.
2. **Plain HTTP on a trusted LAN.** Set `SESSION_COOKIE_SECURE=false`. The session token then
   crosses the network in the clear and is readable by anything on that network — including a
   compromised device the household does not think of as a computer. The server logs a warning at
   every startup while this is in force.

There is no third option where plain HTTP and `Secure` both work.

## 6. Health

`GET /api/health` — **readiness, not liveness**:

- `200 {"status":"ok","db":"ok"}` — the process is up *and* the database answers.
- `503 {"status":"degraded","db":"unreachable"}` — the database did not respond within 2 s.

Public (no session needed) and detail-free. The image also declares its own `HEALTHCHECK` against
this endpoint, so `docker ps` reports honest health without hub-side configuration.

## 7. First run & operations

The image ships the operational CLIs; run them with `docker compose exec app …`:

| Command | Purpose |
| ------- | ------- |
| `node apps/api/dist/cli/create-admin.js` | Create the first admin (reads `ADMIN_USERNAME`/`ADMIN_PASSWORD` from the environment, so the password stays out of shell history). |
| `node apps/api/dist/cli/reset-password.js` | Reset a password; **revokes that user's sessions**. |
| `node apps/api/dist/cli/disable-user.js` | Disable an account; revokes its sessions. |
| `node apps/api/dist/db/restore.js <file>` | Restore a backup. **CLI-only by design — there is no HTTP import** (SEC3). |

**The normal route needs no CLI at all (BUD-S92).** Open a freshly deployed box in a browser and it
routes you to **`/setup`**, which creates the first admin, signs you in, and lands you on the
dashboard. The screen goes inert the moment a user exists (`/setup` → `/login`), and the endpoint
behind it stays a one-shot: `POST /api/auth/setup` answers `409` from then on. A new deployment can
therefore be handed to a non-technical user.

The CLI above is the **recovery** path — when nobody can sign in, or when the box is not reachable by
browser. It is not being retired.

Showing the app to someone without exposing the household's ledger is a **separate instance**, not a
mode of this one — see [§10](#10-the-demo-instance-bud-s93).

Backups are taken with `GET /api/export` (authenticated) or `pg_dump` against the database volume.

### Restoring — what to know

Both points are asserted by `scripts/validate-deploy.sh`, so this runbook cannot drift from the
behaviour:

1. **Accounts survive the reset-then-restore flow; the backup does not carry them.** These are two
   separate facts and both matter. `reset` empties the ledger only — it leaves `households`, `users`
   and `sessions` untouched — so the people who could sign in before a restore can still sign in
   after it, with no `create-admin` step in between. But `GET /api/export` contains the **ledger
   only**: restoring a backup into a *different* box does not bring the accounts along, and that box
   needs `create-admin` (or first-run setup) before anyone can reach the restored data.
   *(Until `BUD-S90` this was a trap: reset truncated `households` with `CASCADE`, which took `users`
   with it, so every restore — even in place — locked the household out of its own ledger.)*
2. **The backup file must be readable by the container's non-root user.** The app runs as `node`,
   and `docker cp` preserves the host file's permissions — a `600` file copied in is unreadable, and
   the restore fails with `EACCES`. `chmod 644` the backup before copying it in.

## 8. Data at rest — OPEN, owned jointly with labs-hub SPIKE-03

The hub is a portable Raspberry Pi: a **physically stealable node** carrying a household's complete
financial history. Whoever holds the SD card holds the ledger. Nothing in this repo encrypts it —
budgeteer's own posture is only that state is confined to one place.

**What budgeteer guarantees, which is what makes encryption tractable:** every byte of state lives in
the single Postgres volume (§4). The app image is stateless, writes nothing to disk, and holds no
cache — so encrypting that one volume encrypts everything. The candidate approaches (full-disk/LUKS
on the data-root, an encrypted filesystem under the volume, or Postgres-level encryption) are all hub
concerns, and none of them require an application change.

**This is not decided.** It is the one part of `BUD-S85` that cannot be settled from inside this repo,
because the mechanism, the key custody, and the unlock-on-boot story belong to labs-hub SPIKE-03.
Until that lands, a deployed hub should be treated as **unencrypted at rest** — which is a reason to
keep the Pi physically secure, and to keep backups (which are equally unencrypted) off the device.

## 9. Change policy

This file is a promise to another project. Anything in §1–§7 changing — a required variable, a port,
the health contract, the image name — is a **coordinated change with labs-hub**, announced before it
ships, not a refactor. The API paths under `/api` follow
[`06_API_CONTRACT.md`](06_API_CONTRACT.md) §5.

§10 below is **not** part of that promise: the demo instance is a local showcase tool, not something
the hub consumes, and it can change freely.

## 10. The demo instance (`BUD-S93`)

A showcase box you can hand to someone, screenshot, or demo live — **with the household's real
ledger nowhere near it**. It is a *second container off the same image and tag* as the real
deployment, not a mode inside it.

| | |
| --- | --- |
| Stack | [`deploy/compose.demo.yaml`](../deploy/compose.demo.yaml) — project **`budgeteer-demo`**, pinned in the file |
| Driver | [`scripts/demo-instance.sh`](../scripts/demo-instance.sh) |
| URL | `http://<host>:3010` (override with `BUDGETEER_DEMO_PORT`) |
| Sign in | **`demo` / `demo-budgeteer`** — published on purpose; see *The credential* below |
| Data | strictly synthetic, from `seed:demo` ([`seedDemo.ts`](../apps/api/src/db/seedDemo.ts)) — every payee, amount, and account name invented |

```bash
./scripts/demo-instance.sh up        # start it, ensure the credential, load the demo data
./scripts/demo-instance.sh refresh   # re-pristine it between showings
./scripts/demo-instance.sh status    # URL, credential, health
./scripts/demo-instance.sh down      # stop it (--purge also drops the database volume)
```

`init` (implied by the rest) generates `deploy/.env.demo` with a database password and a
`SESSION_SECRET` of its own. That file is gitignored (`.env.*`) and **must never be committed**; the
compose file has no fallback for either value and fails loudly, by name, without them.

### What it does not share with the real deployment

Isolation here is structural, not conventional — a demo box that could reach the household's data
would defeat the entire point:

- **Its own compose project**, pinned as `name: budgeteer-demo` *inside the file*. Without that, a
  stack started as `docker compose -f deploy/compose.demo.yaml up` would take its project name from
  the parent directory (`deploy`) — the same name a primary stack started that way would get, and the
  two would then share containers and volumes.
- **Its own volume** (`budgeteer-demo-db`), on its own network, so `down --volumes` can only ever drop
  the demo database.
- **`DATABASE_URL` hard-wired** to its own `db` service — deliberately not read from the environment,
  so an operator with the production values exported cannot aim the demo container at the real
  database.
- **Its own `SESSION_SECRET`**, under a distinct variable name (`DEMO_SESSION_SECRET`), so the demo
  box cannot inherit the real signing key by accident.

### Seeding — why it needs a repo checkout

`seedDemo` is **not in the production image**. [`apps/api/scripts/build.ts`](../apps/api/scripts/build.ts)
ships the server and the operational CLIs only, which is exactly what keeps demo data *absent* from a
real deployment rather than merely guarded — and the reason this is a second container instead of an
in-app demo mode. The cost of that choice: **the demo box cannot seed itself.** The seed runs from a
repo checkout against the demo database over a loopback-published port
(`127.0.0.1:5434`, `BUDGETEER_DEMO_DB_PORT`).

That port is the one deliberate deviation from §2's "the database port is never published". It is
bound to `127.0.0.1`, so it is reachable from the seeding machine and from nothing else on the LAN,
and the database behind it holds invented data. Everything except reseeding — start, stop, reset,
restore the credential — works with no toolchain, because those CLIs *are* in the image.

The other deviation is `SESSION_COOKIE_SECURE`, which defaults to **`false`** here and `true` in
production (§5). A demo is served over plain `http://` to a laptop or a phone, and a browser discards
a `Secure` cookie that arrives over HTTP — the viewer would sign in and bounce straight back to the
login page. The exposure that trade-off normally turns on is a session token on a box holding nothing
real. Set `BUDGETEER_DEMO_COOKIE_SECURE=true` if you put the demo behind TLS.

### The credential

`demo` / `demo-budgeteer`, written down here and in the script rather than generated per run. A
showing that starts by reading a fresh password off a terminal is not a box you can hand to someone.
This is **not a secret exception**: the account guards a throwaway database of invented figures, on
its own `SESSION_SECRET`, and the real deployment shares nothing with it. The generated values in
`deploy/.env.demo` *are* secrets and stay out of the repo.

Alternatively, `down --purge` leaves a box nobody has claimed: bring it back up without seeding and
the browser routes the next visitor to `/setup` (§7) to create their own account.

### Re-pristining between showings

`refresh` empties the ledger, reloads the synthetic dataset, and restores the published password —
which also **revokes any live session**, so the last viewer is signed out. It is the answer to the two
ways a showing leaves the box dirty: data someone entered, and a password someone changed.

The ledger reset runs *inside* the container and preserves `households`, `users` and `sessions`
(BUD-S90, §7), which is why the demo account survives a refresh instead of having to be recreated. For
a box that is dirty in some way `refresh` does not cover, `down --purge && up` rebuilds it from
nothing.

### What pins all of the above (`BUD-S96`)

Everything in this section is asserted by [`scripts/validate-demo.sh`](../scripts/validate-demo.sh),
so the runbook cannot drift from the behaviour — the same relationship
[`validate-deploy.sh`](../scripts/validate-deploy.sh) has to §5 and §7. **47 checks**: the published
credential, the seeded shape, default-deny while anonymous, both deviations above, and `refresh`
re-pristining a *deliberately dirtied* box — stray data gone, the changed password restored, the
previous viewer's session revoked — then `down --purge` leaving nothing.

The isolation claims under *What it does not share* are asserted **statically**, from
`docker compose config` with a hostile environment exported and no container started: an exported
`DATABASE_URL` cannot redirect the demo box, an exported `SESSION_SECRET` cannot become its signing
key, and the project name still resolves to `budgeteer-demo` rather than the parent directory. Each
was verified to fail against the corresponding injected defect, so none of them is vacuously green.

```bash
./scripts/validate-demo.sh        # own project on :3098/:5435 — never touches a box on :3010
```

It needs a container runtime, so — like `validate-deploy.sh` — it is **a local tool, not a gate
step**, and it must never run alongside the e2e suite or the deploy harness.
