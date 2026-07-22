<!--
ROADMAP TEMPLATE — copy to docs/03_ROADMAP.md. The living plan of record: the ordered
backlog of spikes and vertical slices, sequenced by uncertainty and value (NOT by layer).
It is maintained continuously — update statuses as work lands and re-sequence when a spike
changes what we know. Pairs with status reports (point-in-time snapshots). Sequencing
model: docs/00_WAYS_OF_WORKING.md §7.

K29/K31: this is the LEAN LIVING PLAN only — the append-only re-sequencing log and the
done/shipped ledger live in the sibling docs/03_ROADMAP-HISTORY.md (from
ROADMAP-HISTORY-TEMPLATE.md), so this doc never bloats under its own history.
-->

# Roadmap — <Project>

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Status        | Living                                 |
| Owner         | <name>                                 |
| Last updated  | <YYYY-MM-DD>                           |
| History       | [`03_ROADMAP-HISTORY.md`](03_ROADMAP-HISTORY.md) — re-sequencing log + done/shipped ledger |
| Sources       | [`01_INTAKE.md`](../docs/01_INTAKE.md) · [`02_PRD.md`](../templates/PRD-TEMPLATE.md) |

**Current focus:** one line a cold reader (or agent) can resume from — the slice or spike
in flight right now and what "done" looks like for it.

---

## 1. How to use this roadmap

- **The plan of record, kept live.** This is *the* ordered list of what we build next and
  why. Update item statuses as work lands; re-sequence (and log it in the sibling
  [history doc](03_ROADMAP-HISTORY.md)) when a spike changes what we know. A point-in-time
  snapshot for hand-offs is the
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
| `Deferred` | Consciously pushed later (say why in the history doc). |
| `Dropped` | Cut from scope (say why in the history doc). |

## 2. Sequencing model

The default order (from [§7](../docs/00_WAYS_OF_WORKING.md)) — adapt, but justify deviations:

1. **Foundation slice** — a vertically-complete base (e.g. auth + app shell across data →
   API → UI) so there's a usable shell to build into.
2. **Riskiest-assumption spikes** — data, integrations, the value hypothesis. Retire the
   unknowns that could invalidate the whole plan *before* building on them.
3. **Domain slices** — vertical, prioritized by value, each usable on its own.
4. **Hardening** — performance budgets, observability, security/dependency gates, once
   there's real data and usage to measure against.

## 3. The id scheme — a stable handle, not a position

Every plan item gets a typed, stable id: **`PROJ-E##`** (Epic) → **`PROJ-S##`** (Story) →
**`PROJ-T##`** (Task) — replace `PROJ` with a short project prefix. Three rules keep it
stable for the life of the project (K29 — a long-lived roadmap that skips this accretes a
parallel id family per review, and ids that name their *origin* instead of their place in
the plan):

- **The id is a handle, not a position.** Re-sequencing, inserting, or splitting an item
  never renames it — order lives in the table's row order and the `Status` column, never
  in the id.
- **One counter per type, never restarted.** A new Epic is always the next `E##`, even
  across separate reviews/initiatives — an id names what it *is*, not which review coined
  it.
- **Hierarchy via a `Parent` column, not a dotted id.** A Story records its parent Epic (and
  a Task its parent Story) in a `Parent` column — never encode it in the id itself (e.g.
  `E1.S2`), which re-encodes position and breaks the moment things move.

Small/single-track projects can skip Epics and go straight to `PROJ-S##`/`PROJ-T##` — add
the Epic layer only when work is big enough to need it. Spikes keep their own stable
`SPIKE-##` series ([`00_WAYS_OF_WORKING.md`](../docs/00_WAYS_OF_WORKING.md) §6), separate
from this scheme.

## 4. Tracks (optional)

For multi-track projects, run independent tracks in parallel and merge them later (e.g. a
*foundation* track and a *data-extraction → clean-seed* track, merged into *domain
features on the foundation, seeded by the clean data*). Drop this section for single-track
projects.

| Track | Purpose | Status |
| ----- | ------- | ------ |
| <T1: foundation> | … | … |
| <T2: …>          | … | … |

## 5. The plan

The ordered backlog. **Top = next.** Group under the phase headings; keep each row to one
spike or one slice.

> Value / Risk are `High`/`Med`/`Low`. The next item should be the highest **Risk × Value**
> not yet retired. `Gated by` names the spike that must land first (if any).

### Foundation

| Id | Item | Kind | Value | Risk | Gated by | Status | Links (spec · UX · spike) |
| -- | ---- | ---- | ----- | ---- | -------- | ------ | ------------------------- |
| PROJ-S1 | <foundation slice> | slice | High | … | — | Planned | … |

### Spikes (risk retirement)

| Id | Item | Kind | Value | Risk | Answers (the question) | Status | Spike report |
| -- | ---- | ---- | ----- | ---- | ---------------------- | ------ | ------------ |
| SPIKE-01 | <value-hypothesis / data-profiling spike> | spike | High | High | <one falsifiable question> | Planned | `spikes/01-<slug>.md` |

### Domain slices

| Id | Parent | Item | Kind | Value | Risk | Gated by | Status | Links (spec · UX) |
| -- | ------ | ---- | ---- | ----- | ---- | -------- | ------ | ----------------- |
| PROJ-S2 | PROJ-E1 | <slice> | slice | … | … | SPIKE-01 | Planned | `features/<slug>.md` · `ux/<slug>.md` |

> `Parent` names the Epic a Story rolls up into (blank if the project skips Epics). An
> Epic-sized body of work (several related Stories) gets its own `PROJ-E##` row here or in
> a short preamble naming what it groups — the Epic itself isn't a build item.

### Hardening

| Id | Item | Kind | Value | Risk | Trigger (when) | Status | Links |
| -- | ---- | ---- | ----- | ---- | --------------- | ------ | ----- |
| PROJ-S3 | <perf budgets / observability / SCA gate> | hardening | … | … | <real data/usage exists> | Planned | NFR doc (`07_NFR.md`) |

## 6. History

The **re-sequencing log** (why the order changed) and the **done/shipped ledger**
(completed items, newest first) are append-only and live in the sibling
[`03_ROADMAP-HISTORY.md`](03_ROADMAP-HISTORY.md), from
[`ROADMAP-HISTORY-TEMPLATE.md`](ROADMAP-HISTORY-TEMPLATE.md) — kept separate so this living
plan never bloats under its own history. Append an entry there whenever a spike, surprise,
or new constraint moves, defers, or drops an item, and whenever an item ships.
