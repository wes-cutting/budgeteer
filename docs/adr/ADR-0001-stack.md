<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. Stay Proposed until a spike validates the assumptions.
-->

# ADR-0001: Stack — TypeScript client–server web app (React + Fastify + Postgres)

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Status        | Accepted                                                           |
| Date          | 2026-06-13                                                         |
| Deciders      | Wesley Cutting + agent                                             |
| Validated by  | [`SPIKE-02`](../spikes/02-stack-feasibility.md) (strict typecheck + 8/8 tests) |

## Context

Budgeteer is a **client–server web app** in **TypeScript** (both chosen by the product
owner during roadmap kickoff — multi-device now and a path to the future multi-household
direction). The value/UX bet is retired ([`SPIKE-01`](../spikes/01-split-allocation-ux.md)),
and the money-representation risk is decided ([`ADR-0003`](ADR-0003-money-integer-minor-units.md))
and now demonstrated ([`SPIKE-02`](../spikes/02-stack-feasibility.md)). The kit requires the
stack be chosen in this ADR *after* a feasibility spike — which has run.

Forces: a highly interactive **split-allocation editor**; **integer-exact** money; a
**pure-core/impure-shell** boundary (kit `ARCHITECTURE.md`); **strong typing, no escape
hatches** (kit `ENGINEERING_STANDARDS.md`); confidential financial data kept out of the repo
(`SECURITY.md`); and room to grow owner/household scoping later **without** building
multi-tenancy now.

## Decision

We will build Budgeteer as a **TypeScript** application, strict mode end-to-end:

- **Frontend:** **React + Vite** — for the interactive split editor; large ecosystem; fast dev loop.
- **Backend:** **Node + Fastify** — a typed HTTP/JSON API; lightweight and fast, with schema
  validation at the boundary (validate all external input loudly).
- **Domain core:** a **framework-agnostic, pure TypeScript** module (money, envelopes,
  transactions, split-allocation, invariants) with **zero I/O** — exactly the shape proven in
  SPIKE-02 (branded `Cents`, split helpers, repository ports). Reused server-side; types may
  be shared with the client.
- **Boundaries:** Fastify routes + repository **adapters** are the only I/O; the domain
  depends on **repository ports**, not on Postgres. Presentation (React) never touches the
  datastore.
- **Datastore:** **PostgreSQL** via a thin typed access layer — detail in
  [`ADR-0002`](ADR-0002-datastore.md).
- **Gate:** strict `tsc`, lint, format, unit + integration tests (Vitest and/or `node:test`),
  e2e for the named PRD journeys, build — no skipped/failing tests
  (`TESTING_STRATEGY.md`).

## Consequences

### Positive
- **End-to-end static types** with a single language across client, server, and the shared
  domain core.
- **Pure core is testable with zero infrastructure** — demonstrated by SPIKE-02 (8/8 tests,
  no DB, no server).
- React fits the editor; Fastify keeps the API lean and typed; the API/SPA split keeps a
  **clean pure-core/impure-shell boundary** and leaves room for future clients (multi-household).

### Negative / cost
- Client–server means **real infrastructure now**: a server, a deploy target, secrets
  management, and a Postgres instance in dev/CI (more moving parts than a local-first app).
- A CI **gate** must be stood up early.

### Neutral
- React/Fastify are mainstream and **replaceable behind the pure core** — the domain doesn't
  depend on either, so an edge can change without a rewrite.

## Alternatives considered

### Local-first web app / native desktop (no server)
Simpler and more private day-one, but the owner chose client–server to **grow into**
multi-household rather than migrate later. Rejected on that explicit product direction.

### Svelte/SvelteKit or SolidJS instead of React
Viable and in places simpler. React chosen for ecosystem depth and familiarity; because the
domain core is framework-agnostic, revisiting the view layer is low-cost.

### Next.js full-stack (instead of a separate Fastify API)
Reasonable, but a separate typed API keeps a sharper pure-core/impure-shell seam and a
reusable API for future clients. Could be revisited if a unified app proves simpler.

### NestJS instead of Fastify
More built-in structure/DI but heavier; Fastify keeps V1 lean while staying typed.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
