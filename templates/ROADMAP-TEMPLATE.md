<!--
ROADMAP TEMPLATE — copy to docs/03_ROADMAP.md. The living plan of record: the ordered
backlog of spikes and vertical slices, sequenced by uncertainty and value (NOT by layer).
It is maintained continuously — update statuses as work lands and re-sequence when a spike
changes what we know. Pairs with status reports (point-in-time snapshots). Sequencing
model: docs/00_WAYS_OF_WORKING.md §7.
-->

# Roadmap — <Project>

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Status        | Living                                 |
| Owner         | <name>                                 |
| Last updated  | <YYYY-MM-DD>                           |
| Sources       | [`01_INTAKE.md`](../docs/01_INTAKE.md) · [`02_PRD.md`](../templates/PRD-TEMPLATE.md) |

**Current focus:** one line a cold reader (or agent) can resume from — the slice or spike
in flight right now and what "done" looks like for it.

---

## 1. How to use this roadmap

- **The plan of record, kept live.** This is *the* ordered list of what we build next and
  why. Update item statuses as work lands; re-sequence (and log it, §5) when a spike
  changes what we know. A point-in-time snapshot for hand-offs is the
  [Status Report](../templates/STATUS-REPORT-TEMPLATE.md) — different artifact, different
  job.
- **Ordered by uncertainty and value, not by layer.** The top of the plan is the next
  thing to do. Sequence so the riskiest, highest-value work is retired first (front-load
  risk; validate value — [§7](../docs/00_WAYS_OF_WORKING.md)).
- **Every build item is a vertical slice.** Each slice is usable end-to-end (data → API →
  UI) and passes the gate before it's `Done`. There are no "layer" items here.
- **Item status ≠ document status.** The statuses below (`Planned`/`In progress`/…) track
  *delivery*. The `Proposed`/`Validated`/`Accepted` ladder in
  [§4](../docs/00_WAYS_OF_WORKING.md) tracks *documents* (specs/ADRs). Don't conflate them.

**Item status vocabulary:**

| Status | Meaning |
| ------ | ------- |
| `Planned` | On the plan; not yet ready to start. |
| `Ready` | Definition of Ready met (spec + UX spec at least `Proposed`; gating spike done). |
| `In progress` | Being built now. |
| `Done` | Gate-green and usable; Definition of Done met. |
| `Deferred` | Consciously pushed later (say why in §5). |
| `Dropped` | Cut from scope (say why in §5). |

## 2. Sequencing model

The default order (from [§7](../docs/00_WAYS_OF_WORKING.md)) — adapt, but justify deviations:

1. **Foundation slice** — a vertically-complete base (e.g. auth + app shell across data →
   API → UI) so there's a usable shell to build into.
2. **Riskiest-assumption spikes** — data, integrations, the value hypothesis. Retire the
   unknowns that could invalidate the whole plan *before* building on them.
3. **Domain slices** — vertical, prioritized by value, each usable on its own.
4. **Hardening** — performance budgets, observability, security/dependency gates, once
   there's real data and usage to measure against.

## 3. Tracks (optional)

For multi-track projects, run independent tracks in parallel and merge them later (e.g. a
*foundation* track and a *data-extraction → clean-seed* track, merged into *domain
features on the foundation, seeded by the clean data*). Drop this section for single-track
projects.

| Track | Purpose | Status |
| ----- | ------- | ------ |
| <T1: foundation> | … | … |
| <T2: …>          | … | … |

## 4. The plan

The ordered backlog. **Top = next.** Group under the phase headings; keep each row to one
spike or one slice.

> Value / Risk are `High`/`Med`/`Low`. The next item should be the highest **Risk × Value**
> not yet retired. `Gated by` names the spike that must land first (if any).

### Foundation

| # | Item | Kind | Value | Risk | Gated by | Status | Links (spec · UX · spike) |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ------------------------- |
| 1 | <foundation slice> | slice | High | … | — | Planned | … |

### Spikes (risk retirement)

| # | Item | Kind | Value | Risk | Answers (the question) | Status | Spike report |
| - | ---- | ---- | ----- | ---- | ---------------------- | ------ | ------------ |
| 2 | <value-hypothesis / data-profiling spike> | spike | High | High | <one falsifiable question> | Planned | `spikes/<id>-<slug>.md` |

### Domain slices

| # | Item | Kind | Value | Risk | Gated by | Status | Links (spec · UX) |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ----------------- |
| 3 | <slice> | slice | … | … | <spike #> | Planned | `features/<slug>.md` · `ux/<slug>.md` |

### Hardening

| # | Item | Kind | Value | Risk | Trigger (when) | Status | Links |
| - | ---- | ---- | ----- | ---- | -------------- | ------ | ----- |
| n | <perf budgets / observability / SCA gate> | hardening | … | … | <real data/usage exists> | Planned | NFR doc (`07_NFR.md`) |

## 5. Re-sequencing log

Why the order changed — this is where *decided ≠ validated* shows its work. Append an entry
whenever a spike, surprise, or new constraint moves, defers, or drops an item.

| Date | Change | Trigger (spike / surprise) | Effect on the plan |
| ---- | ------ | -------------------------- | ------------------ |
| <YYYY-MM-DD> | … | `spikes/<id>-<slug>.md` | … |

## 6. Done / shipped

Completed items, newest first — the running record of usable increments.

| # | Item | Shipped | Notes |
| - | ---- | ------- | ----- |
| … | …    | <YYYY-MM-DD> | … |
