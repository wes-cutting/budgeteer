---
id: DOC-WAYS-OF-WORKING
type: process
status: Accepted
---
# 00 — Ways of Working

| Field   | Value                                                          |
| ------- | ------------------------------------------------------------- |
| Status  | Accepted                                                      |
| Owner   | DrewskiLabs                                                   |
| Purpose | The process spine for every project built from this baseline. |

This document is **stack-agnostic** and **project-agnostic**. It encodes *how* we
build, not *what* any given application is. If a project's plan conflicts with this
document, **stop and reconcile it here first** — don't diverge silently.

---

## 1. Why this exists (the lessons, in one place)

These principles were distilled from a prior project that reached a complete, fully
tested, gate-green state and was still scrapped — because the **process** produced a
polished system around unvalidated assumptions. The five failures we never want to
repeat:

1. **Built horizontally** (a whole back end, then a whole UI) → there was no usable
   product for a long stretch, and no early feedback. The first warning sign was reaching
   for a feature and finding it had no UI at all.
2. **Specced before observing reality** → specs/ADRs were "Accepted" on assumptions the
   real data/integration later contradicted (e.g. a legacy source whose actual shape
   differed from what the spec described).
3. **Saved the riskiest work for last** → the genuine unknown (does the external data
   load and reconcile? does the integration behave?) ran dead last, after everything was
   built on top of it.
4. **Never tested the value hypothesis** → when the central bet was finally exercised, it
   delivered nothing usable; the premise it rested on had never been checked.
5. **Documentation created false certainty** → "Accepted/Shipped" status made paper
   decisions feel verified when they weren't.

Principles 1–5 in §2 are the direct fix for each of these five. Two further principles
(usable at every step; secure from commit zero) add the guardrails the same episode taught
— including the data-in-the-repo lesson recorded in [`ORIGIN.md`](../ORIGIN.md).

---

## 2. Core principles

1. **Reality before paper.** Look at the real data, the real API, the real constraint
   *before* writing the spec or ADR that depends on it. (Fix for #2.)
2. **Vertical, not horizontal.** Every increment is a thin slice through all layers
   (data → API → UI) that a human can *use*. No "back-end phase / UI phase." (Fix for #1.)
3. **Front-load risk.** Do the most uncertain, most assumption-laden work first, as a
   throwaway spike. (Fix for #3.)
4. **Validate the value, not just the build.** Prove the core hypothesis ("if we do X,
   the user gets Y") with a spike before building the machinery around it. (Fix for #4.)
5. **Decided ≠ validated.** Document status must distinguish a decision on paper from one
   checked against reality. (Fix for #5.)
6. **Usable at every step.** "Is it usable / demoable yet?" is a first-class check on
   every increment, not an end-phase activity.
7. **Secure from commit zero.** Secrets and confidential data handling are set up in the
   scaffold, before any real data can touch the repo.

---

## 3. The lifecycle: Spike → Spec → Slice → Review

Every capability moves through these stages. Small/low-risk capabilities can compress
stages, but never skip the spike when an assumption is unproven (see §11 for how to
right-size).

```
            ┌──────────┐   ┌────────┐   ┌──────────────┐   ┌────────┐
  unknown → │  SPIKE   │ → │  SPEC  │ → │ VERTICAL     │ → │ REVIEW │ → done
            │ (prove)  │   │(decide)│   │ SLICE (build)│   │(verify)│
            └──────────┘   └────────┘   └──────────────┘   └────────┘
```

1. **Spike** — time-boxed, throwaway investigation that answers a specific question
   against reality (data, library, feasibility, UX). Output: a
   [Spike Report](../templates/SPIKE-REPORT-TEMPLATE.md), not production code.
2. **Spec** — only *after* the spike de-risks it. Produce/update the PRD, domain/data/API
   specs, the **UX spec**, and any ADRs. Status starts at `Proposed`.
3. **Vertical slice** — build data → API → UI for the capability behind the gate
   (typecheck/lint/format/tests/build, as the project's stack defines them). The slice is
   **usable** when done.
4. **Review** — confirm acceptance criteria *and* that reality matched the spec. Promote
   doc status to `Validated`/`Accepted`. Capture anything surprising as a follow-up spike.

---

## 4. Document status semantics

Every spec and ADR carries a `Status`. **Never mark something `Accepted` on an
assumption that hasn't been checked against reality.**

| Status        | Meaning                                                              |
| ------------- | ------------------------------------------------------------------- |
| `Draft`       | Being written; not ready to act on.                                 |
| `Proposed`    | A decision/plan on paper. **Not yet validated against reality.**    |
| `Validated`   | A spike or prototype has confirmed the key assumptions hold.        |
| `Accepted`    | Validated **and** adopted. Safe to build large amounts on top of.   |
| `Implemented` | Built and passing the gate.                                         |
| `Superseded`  | Replaced by a later decision (ADRs are append-only — supersede, don't edit). |

Rule of thumb: the amount of code you may build on a document scales with its status.
`Proposed` supports a spike or one slice; `Accepted` supports a phase.

### Frontmatter (machine-readable identity)

Every doc under `docs/` carries a lightweight YAML frontmatter block, not only the prose
meta-table above (the `templates/` scaffolds do **not** yet — see `K47`):

```yaml
---
id: <stable-typed-id>       # e.g. FEAT-<roadmap-id>, ADR-0003, SPIKE-07, a status-report date+slug
type: <doc-type>            # feature-spec · ux-spec · spike · status-report · adr · standard · index · …
status: <ladder value>      # the status ladder above
roadmap-item: <id>          # cross-links to the roadmap's stable id (ROADMAP-TEMPLATE.md §3)
supersedes: <id>            # ADRs/specs only — append-only, never edit a superseded doc
---
```

This is what turns "which roadmap item is this report?" from hand-work into something
*generated*: a docs map, an artifact crosswalk, and a gate check can all be built **from**
the frontmatter instead of hand-authored and left to rot (closes the doc-index half of
**Summary Drift**, §10). Keep the frontmatter minimal and the prose meta-table primary —
this nudges the kit from *prose-first* toward *tooling-checked*, not the other way round;
don't let the schema grow past what a gate check actually needs.

This is exactly the pattern implemented here: `scripts/check-docs.ts` (`npm run
docs:check`) validates every doc's frontmatter and regenerates the crosswalk
([`reviews/2026-07-12-roadmap-artifact-crosswalk.md`](reviews/2026-07-12-roadmap-artifact-crosswalk.md))
from it, wired into the gate so a missing/dangling `roadmap-item` or a stale crosswalk fails
loudly (K30) — the reference implementation for any project porting this pattern.

#### Stable typed ids (K30 Part B)

Every doc's `id` is **stable**: it names the doc, not its location, so a file can be renamed
without every reference to it cascading. The `type` determines the prefix, one per kind of
doc — an id therefore announces what it is:

| Prefix | Doc types | Example |
| ------ | --------- | ------- |
| `ADR-` | `adr` | `ADR-0003` |
| `SPIKE-` | `spike` | `SPIKE-07` |
| `FEAT-` | `feature-spec` | `FEAT-011`, `FEAT-UX12a` (one roadmap item split across sibling specs — the repo's existing `FEAT-014a`/`FEAT-014b` convention) |
| `UX-` | `ux-spec` | `UX-reconcile` (UX specs never had an id of their own; they cite their feature's) |
| `SR-` | `status-report` | `SR-2026-08-03-bud-s97-doc-ids-links` (date + slug) |
| `REV-` | `audit` · `initiative` · `working-note` · `generated` | `REV-2026-06-15-repo-review` |
| `DOC-` | the core docs — `process` · `intake` · `prd` · `roadmap` · `reference` · `standard` · `index` · `template` · `feedback-log` | `DOC-ARCHITECTURE`, `DOC-ROADMAP` |

`docs:check` fails on a missing, malformed, duplicated, or type-mismatched id, and on a doc
with no frontmatter at all. Note that `DOC-ROADMAP` is the id of the roadmap **whatever it is called**: it was
`03_ROADMAP-v2.md` when the scheme landed and is `03_ROADMAP.md` since the `BUD-S94` cutover
(2026-08-03). The id did not move when the file did — which is the entire point, and is what made
that rename a contained change rather than a cascade.

#### Link integrity — what "resolves" means, and the one exception

`docs:check` resolves **every** link in `docs/**` and in the repo-root docs that point into
it. Two rules, and the second is the one this project had to settle deliberately:

1. **Doc→doc links are strict, everywhere, with no exception.** Every `.md` in this repo
   exists; a link to one that doesn't is always rot. This includes ADRs — append-only
   protects the *decision*, not a link path that was wrong the day it was written.
2. **Doc→code links are strict only in docs that describe the current system** (the core
   docs, feature specs, UX specs). In **dated records** — status reports, spike reports,
   reviews, ADRs — a link to a path *outside* `docs/` is allowed to have moved, because code
   moves underneath them and **editing a 2026-06-22 snapshot to chase a later refactor
   falsifies the record**. The alternative stances both fail: rewriting snapshots destroys
   the history the snapshots exist to keep, and leaving them red means the gate can never be
   green, which is how a gate gets ignored. This exception is never silent — `docs:check`
   prints the count and every offending path on each run, so it stays a visible, bounded
   list rather than a hole.

A trailing `:227` (as in `api.ts:227`) is this repo's **line-reference** convention — prose,
not part of a filename. It is stripped before the file is checked, so the file itself still
has to exist.

**When a doc is renamed, dated records get their pointer retargeted, never their prose rewritten.**
Rule 1 is strict everywhere, so a rename breaks inbound links inside snapshots too — and the two
rules only *appear* to collide. In a dated record the **visible link text is the record; the target
is navigation.** Retargeting the pointer while leaving the text alone —

```markdown
[`03_ROADMAP-v2.md`](../03_ROADMAP-v2.md)   →   [`03_ROADMAP-v2.md`](../03_ROADMAP.md)
```

— preserves what the snapshot said *and* keeps the pointer reaching the same document; unlinking
would destroy a working path to a live doc and preserve nothing. So: change what is inside the
parentheses, leave the link text, the surrounding prose, and any fenced blocks exactly as written. (Applied at the `BUD-S94` cutover,
2026-08-03: 7 links in 5 dated records retargeted, no prose touched.)

**One hazard no link checker can catch:** if a retired file's *name is reused* by a different
document — as `03_ROADMAP.md` was — then every old reference still resolves, silently, to different
content. Links being green proves nothing here. The only defense is prose: the new occupant, and the
history that describes the old one, must both say plainly which file a pre-cutover reference means.

**Which states apply to which artifact** (not every status fits every doc):

| Artifact | States it uses |
| -------- | -------------- |
| Specs & models — PRD, domain, data, API, UX, NFR | `Draft → Proposed → Validated → Accepted`, then kept current in place |
| Feature specs | the above **plus** `Implemented` (built and passing the gate — the buildable unit) |
| ADRs | `Proposed → Validated → Accepted`, then `Superseded` (append-only; never edited) |
| Spikes · Roadmap · Status reports · Intake | their own short lifecycles (`Open`/`Done` · `Living` · `Snapshot` · `Draft`/`Proposed`) |

---

## 5. Vertical slices

A slice is the unit of progress. It is **not** "a layer."

**Definition of Ready (before starting a slice)**
- The capability has a spec and a **UX spec** (flows + screen states), at least
  `Proposed`.
- Any unproven assumption it depends on has been spiked.
- Acceptance criteria are written and map to tests.

**Definition of Done (before calling a slice complete)**
- Data → API → UI all present; the capability is **usable in the running app**.
- Gate green: typecheck/types, lint, format, the docs check (§4 — frontmatter, stable ids, link
  integrity), unit + integration tests, end-to-end for the journey, build — per the project's
  stack. No skipped/failing tests.
- Acceptance criteria met and tested; UX states (empty/loading/error/success) handled.
- Accessibility check on any new UI.
- Docs updated **in the same change**; doc status promoted as warranted.
- Inputs validated at the boundary; secrets never logged/committed.

(Projects extend this with their stack-specific checklist in `ENGINEERING_STANDARDS.md`.)

---

## 6. Spikes — when and how

**A spike is mandatory when** a decision rests on something you haven't directly
observed: an external/legacy data source, a third-party API/library's real behavior, a
performance assumption, or whether a feature delivers the intended value.

Rules:
- **Time-boxed** (state the box up front, e.g. half a day) and **throwaway** — spike code
  is not promoted to production; its *findings* are.
- Produces a [Spike Report](../templates/SPIKE-REPORT-TEMPLATE.md) that explicitly says
  what it **confirmed**, what it **invalidated**, and the **recommended decision**.
- The first spike of any data-driven project is a **data-profiling spike** against the
  real source. The first spike of any product bet is a **value-hypothesis spike**.

> Most painful integrations are a short, honest look at the real input away from being
> avoided. The spike is the cheapest insurance we have.

---

## 7. Sequencing a project

Order work by **uncertainty and value-at-risk**, not by comfort or layer:

1. **Foundation slice** — a reusable, vertically-complete base (e.g. user/auth across
   data → API → UI) so there's a usable shell to build into.
2. **Riskiest assumption spikes** — data, integrations, value hypothesis. Resolve the
   unknowns that could invalidate the whole plan *before* building on them.
3. **Domain slices** — vertical, prioritized by value, each usable on its own.
4. **Hardening** — performance budgets, observability, dependency/security gates, once
   there's real data and real usage to measure against. Record these as
   non-functional requirements and an operational-readiness checklist at `docs/07_NFR.md`,
   created from [`../templates/NFR-TEMPLATE.md`](../templates/NFR-TEMPLATE.md).

For multi-track projects, run independent tracks in parallel (e.g. a *foundation* track
and a *data-extraction-to-clean-seed* track) and merge them in a later track (*domain
features on the foundation, seeded by the clean data*).

Capture the **actual** ordered plan — the backlog of spikes and slices with their gating
and status — as a living roadmap at `docs/03_ROADMAP.md`, created from
[`../templates/ROADMAP-TEMPLATE.md`](../templates/ROADMAP-TEMPLATE.md). This section is
the model; the roadmap is the project's plan of record, re-sequenced as spikes change what
we know.

---

## 8. Security & data from day zero

- The scaffold ships a `.gitignore` that excludes secrets and **local/confidential data
  files** *before* any such file exists. Real data never enters the repo.
- Tests use **synthetic fixtures**, never real confidential data.
- Validate all external input at the boundary; never log or commit secrets/tokens.
- Authn/authz is default-deny; recovery flows are enumeration-safe by default; follow the
  baseline `SECURITY.md`.

---

## 9. Working with the AI agent

This baseline assumes a human + AI-agent pair. To avoid the failure mode where the agent
executes a flawed plan flawlessly:

- **Start with discovery.** On a new project the agent's first move is the intake
  conversation — guided by [`../templates/DISCOVERY-GUIDE.md`](../templates/DISCOVERY-GUIDE.md),
  captured in [`01_INTAKE.md`](01_INTAKE.md) — which surfaces the problem, the core bet,
  and the riskiest assumptions, and **names the first spike** before any spec is written.
- **The agent challenges the plan before executing.** Before a phase, it names the
  riskiest assumptions, the sequencing risks, and anything being decided ahead of
  validation — and proposes a spike if warranted.
- **The human reviews planning docs early**, at the start of each phase, not just the
  output. (Reviewing the plan is what catches "no UI is being built" immediately.)
- **"Is it usable yet?"** is asked at every increment by both parties.
- **Surprises become spikes**, not silent workarounds.
- **Close out each block with a Definition-of-Done snapshot.** At the end of every executed
  block — a spike, a vertical slice, or a phase — write a dated
  [status report](../templates/STATUS-REPORT-TEMPLATE.md) whose **outline is the Definition
  of Done** (§5): report each check (vertical & usable · gate-green · acceptance criteria &
  UX states · accessibility · input-validation & secrets · docs-in-the-same-change) as
  ✅/⚠/❌ **with evidence**, then the test-count delta and a one-line Conventional-Commit
  summary. Anything not done stays visible (⚠ + reason + owner) so a snapshot never
  overstates "done." This is what makes hand-offs between sessions/context windows clean and
  honest — and it doubles as the per-block review record.
- **One slice per session — stop at the slice boundary and report.** A session builds **exactly
  one** roadmap item, then writes its status report and **stops for review**, even when the next
  item is obvious, unblocked, and the agent has plenty of context left. Finishing early is not a
  reason to start the next one. The point is that the human sees each slice while it is still
  cheap to redirect: a session that lands five slices has made four decisions nobody reviewed,
  and unwinding the first one now means unwinding all five. If a slice turns out to be trivial,
  the right move is to report it and let the human say "keep going" — not to assume it.
  *(Learned 2026-08-01: a kickoff prompt that listed `BUD-S81`→`BUD-S85` "in a sensible order"
  was read as authorization to build all five, including a breaking API-path change, in one
  unreviewed run.)*
- **A kickoff prompt names ONE next item.** It may mention what is likely to follow, as
  context — but it must say plainly that the session ends after the named item. Sequencing
  several items into one prompt is how the rule above gets broken by accident.
- **End each milestone handoff-ready, with the next session's kickoff prompt.** When a
  roadmap item reaches `Done`, the project must be resumable cold: gate green, docs updated,
  the status report's **Resume here** current. Close that report with a **copy-pasteable
  "Next-session kickoff prompt"** — the exact text to paste into a fresh context window to
  start the next item (it specializes the generic *Resume* prompt in
  [`KICKOFF-PROMPT.md`](../KICKOFF-PROMPT.md): names the next item, its risks, and any new
  setup). The newest status report is then both the handoff record and the launch pad — a new
  session reads it and nothing else to get going.
- Keep the practices that worked: pure-core/impure-shell (so logic is testable without
  I/O), pass/fail gates, gate-green-per-slice, and resumable status reports for clean
  hand-offs between sessions/context windows.

---

## 10. Anti-patterns (named, so we catch them)

- **The Horizontal Build** — finishing a whole layer before the next. (Build slices.)
- **Spec-Ahead-of-Reality** — an `Accepted` decision about data/integrations nobody has
  looked at. (Spike first; status `Proposed` until validated.)
- **Risk-Last** — leaving the scariest unknown for the end. (Front-load it.)
- **False-Certainty Docs** — rigor and formatting mistaken for correctness. (Status
  honesty.)
- **Data-in-the-Repo** — confidential/real data committed because guardrails came late.
  (Scaffold the `.gitignore` first.)
- **Build-Without-Use** — large surface with no one having used it. (Usable every step.)

---

## 11. Scaling the process up and down

The process scales to the **risk and reach** of the work. Match the ceremony to the
uncertainty and the blast radius — applying it uniformly is a mistake in both directions:
under-applied on risky work is how the prior project failed; over-applied on a throwaway
script is how a process gets abandoned. Right-size **deliberately**, and say which path
you're on.

### Never skip (whatever the size)

These are load-bearing — they're what the lessons cost us, and they hold for a one-line fix
as much as for a phase:

- **Spike before building on an assumption you haven't checked against reality** (§6).
- **Every increment is a vertical, usable slice** — never a horizontal layer (§5).
- **Gate-green before done:** no failing or skipped tests (§5,
  [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md)).
- **Secrets/confidential data never committed or logged; external input validated at the
  boundary** (§8, [`SECURITY.md`](SECURITY.md)).
- **Status honesty** — never `Accepted` on an unchecked assumption (§4).

### Scale to fit

The kit is sized for a **focused product or app** — the bold row below. Lighter work
compresses; heavier work adds to it. Find the row you're nearest and adjust from there:

| Project shape (example) | Process & docs it warrants | vs. this kit |
| ----------------------- | -------------------------- | ------------ |
| Trivial fix or refactor — a rename, a dependency bump, a copy change | a Conventional Commit; gate-green; no spec (touch a doc only if a shape changed) | lighter |
| One throwaway question — "can library X read this file?" | a single spike report; no PRD, no slice; time-box it and record confirmed/invalidated | lighter |
| A one-screen tool, or a CLI/service with no user-facing surface | one feature note + tests; the feature spec *is* the UX spec (or none for a CLI) — still cover empty/loading/error/success on any UI | lighter |
| **A focused product or app** — a handful of journeys, one datastore, one team (e.g. an internal invoicing tool, a booking app, an import-reconcile-and-dashboard utility) | **the full kit as written: intake → first spikes → PRD → roadmap → a feature spec + UX spec per capability → `ADR-0001/0002` + a few cross-cutting ADRs → vertical slices → status reports** | **as written** |
| Multi-tenant SaaS, or an external/legacy integration at the core (money, auth, RBAC) | the kit **plus** a tenancy/isolation ADR with property tests, a security/threat-model pass, and performance budgets asserted on realistic volumes | heavier |
| Many teams or parallel tracks, several services, regulated/PII data, or high availability | the above **plus** a dedicated NFR/SLO doc, observability + on-call runbooks, a cross-track integration/contract plan, and a formal security/compliance review | heavier |

Whichever row you're on, the **Never skip** rules above still apply.

### The fast path (small, low-risk)

A one-paragraph feature note (what · acceptance criteria · UX states) → build the vertical
slice → gate → done. Skip the separate UX spec, the PRD, and ADRs **until** a trigger below
appears.

### Scale back up when any of these appear

Re-add the full spike → spec → UX spec → ADR ceremony the moment the work touches:

- **Money, auth, or multi-tenant / owner-scoped data** — correctness and isolation are
  never "small."
- **An external/legacy data source or third-party integration** — spike it (§6).
- **A performance or scale assumption** — measure against realistic volumes.
- **Anything expensive to reverse** (data representation, API style, tenancy) — write an ADR.
- **A user-facing surface with real states** — write the UX spec; its absence is the exact
  failure this kit was built to prevent.

> One line: **match the ceremony to the uncertainty and the blast radius — when unsure,
> spike.**
