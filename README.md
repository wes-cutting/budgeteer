# Budgeteer

**Envelope budgeting that's reconciled to the penny.** Enter each transaction **once** at the
account level, then **split-allocate** it across budget envelopes — instead of keeping account
balances and a budget on separate, never-reconciled surfaces (the spreadsheet trap this project
replaces).

The core guarantee: a transaction's allocations always sum exactly to its amount, and account &
envelope balances are **derived** from that ledger — so the books are penny-exact by construction,
not by hand.

> **Status:** V1 in progress (single-user, local-first). The domain is built and gate-green; the
> analysis area, hardening, and multi-user are still ahead. See
> [`docs/03_ROADMAP.md`](docs/03_ROADMAP.md) for the live plan.

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

# 2. configure (optional in dev — sensible defaults are built in)
cp .env.example .env        # repo-root .env is auto-loaded (API: dotenv · web: Vite envDir)

# 3. run the two dev servers (separate terminals)
npm run dev --workspace apps/api    # API  → http://localhost:3001
npm run dev --workspace apps/web    # web  → http://localhost:5173
```

Open **http://localhost:5173**. The web app talks to the API at `http://localhost:3001`; the API
allows the dev origin via CORS out of the box.

## Configuration

Config is read from the environment (and the auto-loaded repo-root `.env`) and validated at
startup — the app fails loudly on invalid config. See [`.env.example`](.env.example).

| Variable | Where | Default | Purpose |
| -------- | ----- | ------- | ------- |
| `PORT` | api | `3001` | API listen port |
| `DATABASE_URL` | api | _unset_ → in-process PGlite | Set to a Postgres URL in production |
| `CORS_ORIGINS` | api | dev origins | Comma-separated **allowlist** of browser origins (never `*`) |
| `VITE_API_BASE_URL` | web | `http://localhost:3001` | Base URL the browser uses to reach the API |

## Scripts (from the repo root)

| Command | What it does |
| ------- | ------------ |
| `npm run typecheck` | `tsc --noEmit` across all workspaces |
| `npm run lint` | ESLint (flat config; `@typescript-eslint` + `react-hooks`), zero-warning gate |
| `npm test` | Run the full Vitest suite once (unit + integration + web component) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright browser e2e — boots the real API + web, drives Chromium |
| `npm run format` | Prettier check (`format:write` to fix) |
| `npm run build --workspace apps/web` | Production build of the web app |

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
- **Designed toward multi-tenant** — every row carries a `household_id`; V1 runs a single implicit
  household with **no authentication yet** (local single-user). Auth/isolation is a post-V1 epic.

## Documentation

The [`docs/`](docs/) tree is the source of truth — start here:

- [`CLAUDE.md`](CLAUDE.md) · [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) — how this project is built.
- [`docs/02_PRD.md`](docs/02_PRD.md) — what it is and why.
- [`docs/03_ROADMAP.md`](docs/03_ROADMAP.md) — the living plan of record.
- [`docs/04_DOMAIN_MODEL.md`](docs/04_DOMAIN_MODEL.md) · [`docs/05_DATA_MODEL.md`](docs/05_DATA_MODEL.md) · [`docs/06_API_CONTRACT.md`](docs/06_API_CONTRACT.md) — the model & interface.
- [`docs/adr/`](docs/adr/) — architecture decisions · [`docs/features/`](docs/features/) · [`docs/ux/`](docs/ux/) — per-capability specs.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — workflow and conventions.

## License

[MIT](LICENSE).
