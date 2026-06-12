# Architecture

| Field   | Value                                                       |
| ------- | ---------------------------------------------------------- |
| Status  | Accepted (boundaries) · stack TBD per project              |
| Owner   | DrewskiLabs                                                |
| Purpose | The structural boundaries every project keeps, independent of stack. |

The **stack is chosen per project** in `adr/ADR-0001-stack.md` (and `ADR-0002-datastore.md`
etc.) after a feasibility/UX spike. This document defines the boundaries the stack plugs
into — they hold whether the app is web, mobile, CLI, or service; SQL or NoSQL; one
language or several.

---

## 1. Layered boundaries

Organize code into layers with a **single dependency direction: inward, toward pure
logic.** Outer layers may depend on inner layers; inner layers must not depend on outer.

```
        ┌─────────────────────────────────────────────┐
        │  Presentation / Interface                     │  (UI, CLI, route handlers)
        │  ┌─────────────────────────────────────────┐ │
        │  │  Application / Services                    │ │  (use-cases, orchestration)
        │  │  ┌─────────────────────────────────────┐ │ │
        │  │  │  Domain + pure libraries             │ │ │  (entities, rules, calc — pure)
        │  │  └─────────────────────────────────────┘ │ │
        │  └─────────────────────────────────────────┘ │
        │  Adapters / Data access (I/O lives only here)  │  (DB, network, filesystem, clock)
        └─────────────────────────────────────────────┘
```

- **Domain + pure libraries** — entities, invariants, calculations. **No framework, no
  I/O, no time/randomness reached for directly.** This is where the logic that's worth
  testing lives, and it's testable with zero setup.
- **Application / services** — orchestrate use-cases: call the domain, call adapters.
  This is where authorization and transactions are coordinated.
- **Adapters / data access** — the **only** place that talks to the outside world
  (database, network, filesystem, env, clock). Swappable behind interfaces.
- **Presentation / interface** — thin. Renders state and forwards input. No business
  logic; no direct datastore access.

> The single most valuable rule from experience: **pure core / impure shell.** Keep the
> logic pure and push I/O to the edges — it makes the system testable without infra and
> lets you exercise real logic against real inputs without standing up the whole app.

## 2. Boundary rules (enforce them)

- Only the **data-access layer** imports the datastore client/SDK. Nothing else.
- **Domain and pure libraries import no framework and perform no I/O.**
- **Presentation never reaches the datastore directly** — it goes through services.
- Cross-cutting concerns (auth context, tenancy, logging) are passed *in*, not reached
  for from deep inside pure code.
- Prefer enforcing these with lint rules / module-boundary tooling so they can't quietly
  erode.

## 3. What is decided per project (via ADR)

- Language(s), framework, runtime — `ADR-0001`.
- Datastore and access layer (ORM/driver/none) — `ADR-0002`.
- Any cross-cutting choice that's expensive to reverse (auth model, multi-tenancy,
  money/units representation, API style) — its own ADR.

Record each as an ADR with status per [`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §4
— `Proposed` until a spike validates it, then `Accepted`.

## 4. Configuration & secrets

- All configuration comes from the environment; validate it at startup and fail loudly on
  missing/invalid config.
- Secrets are never hard-coded, logged, or committed (see [`SECURITY.md`](SECURITY.md)).
