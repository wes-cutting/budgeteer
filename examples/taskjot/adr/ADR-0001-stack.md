# ADR-0001: Stack — local-first TypeScript + SQLite

> **Example** — a filled [`ADR-TEMPLATE`](../../../docs/adr/ADR-TEMPLATE.md) for *TaskJot*.
> The specific stack here is **illustrative** — the kit itself is stack-agnostic. See
> [`examples/README.md`](../../README.md).

| Field         | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Status        | Accepted                                               |
| Date          | 2026-06-11                                             |
| Deciders      | A. Maker                                               |
| Validated by  | A 30-min feasibility check (compressed per §11 — low-risk stack) |

## Context

TaskJot is single-user, local-first, tiny-data, and must feel instant on capture
([`../02_PRD.md`](../02_PRD.md)). The value bet — not the technology — was the real risk,
and it's already retired by [`SPIKE-01`](../spikes/01-quick-capture-value.md). The stack
choice is therefore low-risk; we right-size accordingly (a quick feasibility check, not a
full spike).

## Decision

We will build TaskJot as a small **TypeScript** app with a single-file **SQLite** local
store and a minimal web UI. Domain logic (a `Task` and its state transitions) stays pure;
SQLite access lives only in the data-access layer, per
[`../../../docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md). (Datastore detail would
normally be its own `ADR-0002`; folded in here because it's trivial at this scale.)

## Consequences

### Positive
- Pure domain core is testable with zero infrastructure (the kit's pure-core/impure-shell
  pattern).
- Local SQLite means no network, no accounts — matches the local-first, no-PII constraint.

### Negative / cost
- No multi-device sync and no backup until an export feature is added (tracked for the NFR
  / hardening phase).

### Neutral
- Single-file store keeps ops near-zero now; would need revisiting if TaskJot ever became
  multi-user (it would then trigger the §11 "scale up" path).

## Alternatives considered

### Plain-text / JSON file
Simplest possible, but querying and the "complete clears from active list" behavior get
awkward; SQLite is barely more setup for far better data handling.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
