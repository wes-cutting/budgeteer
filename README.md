# Budgeteer

**Envelope budgeting that's reconciled to the penny.** Enter each transaction **once** at the
account level, then **split-allocate** it across budget envelopes — instead of keeping account
balances and a budget on separate, never-reconciled surfaces (the spreadsheet trap this project
replaces).

The core guarantee: a transaction's allocations always sum exactly to its amount, and account &
envelope balances are **derived** from that ledger — so the books are penny-exact by construction,
not by hand.

> **Status:** V1 in review. The domain, the full Insights area, hardening (a11y/perf budgets, CI
> gate, backup/export), **authentication + user management** (default-deny sessions, roles,
> `BUD-E13`) and a **published ARM64 container image** (`BUD-E14`) are built and gate-green.
> A brand-new install is now usable **from the browser alone** — it routes you to `/setup` to create
> the first admin (`BUD-S92`), and there is a one-command **demo instance** to show it to someone
> without the real ledger being anywhere near it (`BUD-S93`, below). The live plan for the `BUD-*`
> ids is [`docs/03_ROADMAP-v2.md`](docs/03_ROADMAP-v2.md).

---

## What it does

- **Accounts & envelopes** — set up your real accounts (with an opening balance) and budget
  categories; rename and **archive** finished ones (history preserved).
- **Transactions & split allocation** — record a deposit/withdrawal once, then allocate it to one
  envelope (Single) or many (Split, with a live remaining tally). Partial is allowed — anything
  unallocated surfaces in a **Needs-allocation** list.
- **Templates** — save a reusable split (e.g. a paycheck) and apply it in one click.
- **Refunds** — mix a refund row (opposite direction) into a split — e.g. a receipt that's a
  purchase plus a returned item.
- **Transfers** — move money **account ↔ account** (double-entry) or re-budget **envelope ↔
  envelope**, kept orthogonal so neither disturbs the other.
- **Recurring** — define a scheduled transaction (weekly/biweekly/monthly) with its split, then
  **Post due** to generate everything that's come due (idempotent).
- **Reconcile to bank** — compare an account's derived balance to your real bank balance, see the
  difference, and record the reconciliation (with history).
- **Envelope ledger** — click any envelope to drill into every transaction that funded or spent
  from it, newest-first.
- **Insights** — spend by envelope over time, budget vs. actual against monthly targets, a
  per-account cash-flow forecast, credit-card utilization, and installment-loan payoff %.
- **Pay-period planner** — a first-class `/pay-periods` view that lays each paycheck and the bills
  it covers out as two side-by-side ledgers, with per-check headroom, projected payday balance, and
  a running reserve.
- **Backup** — download a complete JSON snapshot of all your data in one click.

The UI is a **grouped sidebar app shell** — **Budget** (Home · Insights), **Ledgers** (Accounts ·
Envelopes · Needs allocation), **Planning** (Templates · Recurring · Pay periods), and
**Administration** (Manage · Users, the latter admin-only) — with a global **Add transaction**
action, a desktop collapse-to-icon rail, and an off-canvas drawer at phone width.

## Tech stack

A TypeScript monorepo (npm workspaces). Stack chosen and recorded in the ADRs:

| Layer | Choice | ADR |
| ----- | ------ | --- |
| Language | TypeScript (strict) | — |
| Web | React + Vite | [ADR-0001](docs/adr/ADR-0001-stack.md) |
| API | Node + Fastify | [ADR-0001](docs/adr/ADR-0001-stack.md) |
| Datastore | PostgreSQL via Kysely; **PGlite** (in-process Postgres) for dev/test | [ADR-0002](docs/adr/ADR-0002-datastore.md) |
| Money | Integer minor units (cents) — no floats | [ADR-0003](docs/adr/ADR-0003-money-integer-minor-units.md) |
| Tests | Vitest (node + jsdom projects) | [TESTING_STRATEGY](docs/TESTING_STRATEGY.md) |

## Repository layout

```
budgeteer/
├─ packages/
│  └─ domain/        # pure domain core — money, allocation invariant, transfers,
│                    # recurring schedule, reconcile. No I/O, no framework.
├─ apps/
│  ├─ api/           # Fastify HTTP API + Kysely data layer (the impure shell)
│  └─ web/           # React + Vite single-page app
├─ docs/             # source of truth: PRD, roadmap, models, ADRs, specs, reviews
├─ deploy/           # the reference container stack, plus the demo instance's
├─ spikes/           # throwaway investigations (reports live in docs/spikes/)
└─ .env.example      # copy to .env at the repo root (auto-loaded)
```

The dependency rule is one-way: **`web → api → domain`**, and the domain depends on nothing.
I/O lives only in the API; the domain and libraries are pure ([ARCHITECTURE](docs/ARCHITECTURE.md)).

## Getting started

**Prerequisites:** Node ≥ 20.11 and npm. No database to install — dev/test run an in-process
PGlite (real Postgres compiled to WASM).

```bash
# 1. install (workspace-aware)
npm install

# 2. configure — the repo-root .env is auto-loaded (API: dotenv · web: Vite envDir)
cp .env.example .env

# 3. persist the dev store — uncomment PGLITE_DIR in .env (see "Dev database" below).
#    Optional for a look around, REQUIRED for `npm run seed` and the `create-admin` CLI.

# 4. run the two dev servers (separate terminals)
npm run dev --workspace apps/api    # API  → http://localhost:3001
npm run dev --workspace apps/web    # web  → http://localhost:5173
```

Open **http://localhost:5173**. The web app talks to the API at `http://localhost:3001`; the API
allows the dev origin via CORS out of the box — and bounces you to `/login`, because there is no
user yet. Create one:

### Create the first user

**Authentication is always on**
([ADR-0009](docs/adr/ADR-0009-authentication-household-scoping.md)) — the API answers `401` to
every request without a session. A brand-new store contains **no user**, so the app routes you to a
first-run setup screen instead of a sign-in page you have no credential for (`BUD-S92`).

**Just open http://localhost:5173.** With no user in the store you land on **`/setup`**: pick a
username and a password (minimum 8 characters), and you are created as an **admin**, signed in, and
dropped on the dashboard. No CLI, no `curl`. An admin adds everyone else from
**Administration → Users** — there is no self-service sign-up, by design
([spec §2.1](docs/features/first-run-setup.md)).

`/setup` goes inert the moment a user exists (it redirects to `/login`), and the endpoint behind it,
`POST /api/auth/setup`, is public **only while zero users exist** and answers `409 Setup is already
complete.` from then on.

<details>
<summary>Creating the first admin without a browser (recovery / headless)</summary>

```bash
# The CLI — needs a persistent store (PGLITE_DIR or DATABASE_URL). From apps/api/:
ADMIN_USERNAME=you ADMIN_PASSWORD='a-long-passphrase' npm run create-admin
```

```bash
# Or the endpoint directly, against a RUNNING API. Unlike the CLI this works on the default
# in-memory store — it is what `/setup` calls for you.
curl -X POST http://localhost:3001/api/auth/setup -H 'content-type: application/json' -d '{"username":"you","password":"a-long-passphrase"}'
```

The CLI stays as the **recovery** path — when nobody can sign in, or the box has no browser on it.

</details>

## Configuration

Config is read from the environment (and the auto-loaded repo-root `.env`) and validated at
startup — the app fails loudly on invalid config. See [`.env.example`](.env.example).

| Variable | Where | Default | Purpose |
| -------- | ----- | ------- | ------- |
| `APP_ENV` | api | `development` | `development` · `test` · `production`. Production **requires** `SESSION_SECRET` and `DATABASE_URL` — startup fails without them |
| `PORT` | api | `3001` | API listen port |
| `HOST` | api | `127.0.0.1` | Interface the API binds. Loopback by default as defense-in-depth, but `0.0.0.0` (LAN) is **safe** since auth landed — default-deny at the resource level closed the old exposure blocker ([`docs/SECURITY.md`](docs/SECURITY.md) §3). The production image binds `0.0.0.0` |
| `LOG_LEVEL` | api | `info` | `fatal` … `trace` \| `silent`. Validated against a closed set, so a typo fails at startup |
| `DATABASE_URL` | api | _unset_ → in-process PGlite | Set to a Postgres URL in production. **Required** there — PGlite is a devDependency and is not in the production image |
| `PGLITE_DIR` | api | _unset_ → in-memory (ephemeral) | Path to a file-based PGlite store; required by `npm run seed` / `seed:demo` / `db:reset` / `db:fresh` / `create-admin`. Ignored when `DATABASE_URL` is set. |
| `SESSION_SECRET` | api | dev/e2e fallback | Signs the session cookie. **Required in production** (min 16 chars; `openssl rand -base64 48`). Never commit it |
| `SESSION_COOKIE_SECURE` | api | on in production, off elsewhere | Marks the session cookie `Secure` (HTTPS only). ⚠ A browser **discards** a `Secure` cookie sent over plain HTTP, so a TLS-less deploy accepts the login and bounces straight back to `/login`. Terminate TLS at a proxy, or set `false` on a LAN you trust |
| `CORS_ORIGINS` | api | dev origins | Comma-separated **allowlist** of browser origins (never `*`) |
| `WEB_STATIC_ROOT` | api | _unset_ → API only | Absolute path to `apps/web/dist`. Set → this process also serves the SPA (the one-image container shape, [ADR-0008](docs/adr/ADR-0008-containerized-production-runtime.md) §1). Startup fails if the path holds no `index.html` |
| `VITE_API_BASE_URL` | web | `http://localhost:3001` | **Origin** the browser uses to reach the API — no path; the client appends `/api` itself. Set **empty** for a same-origin deployment |

## Dev database

By default the API uses an **in-memory** PGlite instance — fast, zero-setup, but ephemeral (data
is lost when the server restarts). To persist data across restarts and populate it with realistic
seed data, point both the API and the seed scripts at the same on-disk store via `PGLITE_DIR`.

**One-time setup** — uncomment this line in your `.env` (the `/data/` directory is already
gitignored):

```
PGLITE_DIR=../../data/budgeteer-dev
```

Then, from the `apps/api/` directory:

```bash
# Populate an empty store with 3 months of realistic data:
#   4 accounts · 22 envelopes · April–June 2026 transactions
#   8 envelope targets · credit limit · loan principal · 2 recurring rules
npm run seed

# Empty the store (irreversible). With PGLITE_DIR it deletes the directory, USER accounts
# included; against DATABASE_URL it empties the ledger only and KEEPS the household + its
# USER logins (so a production restore never locks you out — BUD-S90):
npm run db:reset

# Reset + re-seed in one shot (the usual "start fresh" command):
npm run db:fresh

# Rich, strictly-synthetic DEMO dataset for design/dev — ~6 months of dated history so
# Insights, the pay-period planner, and Templates show real patterns (UXR8). Standalone:
# run into a FRESH store; it refuses a store that already contains data.
npm run db:reset && npm run seed:demo

# Restore a downloaded backup into an EMPTY store (run db:reset first — restore
# refuses a store that already contains data; see docs/06_API_CONTRACT.md):
npm run db:restore -- path/to/budgeteer-backup-YYYY-MM-DD.json
```

**A seeded store has no credential in it.** Seeding fills the ledger and deliberately never creates a
user, and auth is always on — so a fresh `db:fresh` against a PGlite store answers `401` to
everything. Open the app and it walks you through `/setup`; the seed scripts say so when they finish.
See [Create the first user](#create-the-first-user).

`seed` is **idempotent** — it exits quietly if data already exists. Run `db:fresh` if you want
to replace existing data. `seed:demo` is a **separate, deterministic** dev tool (fixed-seed
PRNG); it does not touch the lean `seed` (which the e2e/K24 baseline depends on) and refuses any
non-empty store. See [docs/features/demo-seed.md](docs/features/demo-seed.md).

**Tests are unaffected.** The Vitest suite never reads `PGLITE_DIR`; each test spins up its own
ephemeral in-memory PGlite and tears it down — no `PGLITE_DIR` needed, no cleanup required.

## Demo instance

To show Budgeteer to someone — hand them the app, screenshot it, demo it live — **without the real
ledger being anywhere near it**, run the demo box: a second container off the same image and tag,
with its own database, its own `SESSION_SECRET`, and a lived-in **synthetic** dataset. Needs a
container runtime.

```bash
./scripts/demo-instance.sh up        # http://localhost:3010 — sign in as demo / demo-budgeteer
./scripts/demo-instance.sh refresh   # re-pristine it between showings
./scripts/demo-instance.sh down      # stop it (--purge also drops its database)
```

It shares nothing with a real deployment — its own compose project, its own volume, and a
`DATABASE_URL` hard-wired to its own database rather than read from the environment. The runbook,
including the two places it deliberately differs from the production stack, is
[DEPLOY_CONTRACT §10](docs/DEPLOY_CONTRACT.md).

## Scripts (from the repo root)

| Command | What it does |
| ------- | ------------ |
| `npm run typecheck` | `tsc --noEmit` across all workspaces, plus `tsconfig.e2e.json` (e2e + `playwright.config.ts`) and `tsconfig.tools.json` (`scripts/` + `vitest.workspace.ts`). Every `.ts` in the repo is covered except `spikes/**` — throwaway by definition, with its own per-spike tsconfig |
| `npm run lint` | ESLint (flat config; `@typescript-eslint` + `react-hooks`), zero-warning gate |
| `npm test` | Run the full Vitest suite once (unit + integration + web component) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright browser e2e — boots the real API + web, drives Chromium |
| `npm run format` | Prettier check (`format:write` to fix) |
| `npm run build --workspace apps/web` | Production build of the web app |

Operational CLIs live in `apps/api` and have **no HTTP surface** — run them with
`npm run <cmd> --workspace @budgeteer/api` (all three need a persistent store):

| Command | What it does |
| ------- | ------------ |
| `create-admin` | Create an admin out of band (reads `ADMIN_USERNAME` / `ADMIN_PASSWORD` from the environment so the password stays out of shell history) |
| `reset-password` | Reset a user's password — **revokes their sessions** |
| `disable-user` | Disable an account — revokes its sessions |

The project follows a **gate-green** rule: typecheck, lint, `npm test`, format, `npm run test:e2e`,
and the web build must all pass before any change is considered done
([ENGINEERING_STANDARDS](docs/ENGINEERING_STANDARDS.md)). `npm run test:e2e` is kept out of
`npm test` so the inner Vitest loop stays fast; it runs as its own gate step (and needs Chromium —
`npx playwright install chromium`, one time).

## Testing

Four layers ([TESTING_STRATEGY](docs/TESTING_STRATEGY.md)) — three in Vitest, plus a browser e2e
in Playwright:

- **Domain unit** — the pure core (money exactness, the split invariant, schedules, reconcile).
- **API integration** — real HTTP via Fastify `inject` against a fresh in-process PGlite per test.
- **Web component** — React Testing Library (jsdom) against an in-memory fake API.
- **Browser e2e** — Playwright (Chromium) drives the **real** web app against the **real** API,
  exercising the browser→API seam the other three layers can't (this is the layer that would have
  caught the CORS bug). It boots both servers itself; the web is served from `:5173` because that
  origin is the API's CORS allowlist default.

```bash
npm test                              # the three Vitest layers
npx vitest run --project node         # domain + API only
npx vitest run --project web          # web components only
npm run test:e2e                      # browser e2e (needs Chromium; see Scripts)
```

## Design principles

- **Pure core / impure shell** — domain logic is framework- and I/O-free and unit-testable in
  isolation; all I/O is in the API/data layer.
- **Integer-minor-unit money** — every amount is a signed integer count of cents; parsing and
  formatting happen only at the boundary. No floating point touches the ledger ([ADR-0003](docs/adr/ADR-0003-money-integer-minor-units.md)).
- **Derive, don't store** — account and envelope balances are computed from transactions and
  allocations (SQL views), never cached.
- **Validate at the boundary** — every request is validated (shape + domain rules); invalid input
  fails loudly with a consistent error envelope.
- **Default-deny authentication** — every row carries a `household_id`, and every request is scoped
  to the **principal derived from an opaque, revocable session** rather than to a constant. Nothing
  but `/api/health` and the public auth routes is reachable without one
  ([ADR-0009](docs/adr/ADR-0009-authentication-household-scoping.md)). V1 runs **one household with
  many member users** (roles: admin/member); isolated multi-household is deliberately deferred in
  favour of a container per household.

## Documentation

The [`docs/`](docs/) tree is the source of truth — start here:

- [`CLAUDE.md`](CLAUDE.md) · [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) — how this project is built.
- [`docs/02_PRD.md`](docs/02_PRD.md) — what it is and why.
- [`docs/03_ROADMAP-v2.md`](docs/03_ROADMAP-v2.md) — the living plan of record (`BUD-*` ids), with
  its append-only [history](docs/03_ROADMAP-HISTORY-v2.md). The unsuffixed
  [`03_ROADMAP.md`](docs/03_ROADMAP.md) is **superseded** — kept only so the pre-restructure ids
  cited by older status reports still resolve.
- [`docs/04_DOMAIN_MODEL.md`](docs/04_DOMAIN_MODEL.md) · [`docs/05_DATA_MODEL.md`](docs/05_DATA_MODEL.md) · [`docs/06_API_CONTRACT.md`](docs/06_API_CONTRACT.md) — the model & interface.
- [`docs/adr/`](docs/adr/) — architecture decisions · [`docs/features/`](docs/features/) · [`docs/ux/`](docs/ux/) — per-capability specs.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — workflow and conventions.

## License

[MIT](LICENSE).
