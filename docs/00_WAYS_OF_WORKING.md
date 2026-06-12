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
- Gate green: typecheck/types, lint, format, unit + integration tests, end-to-end for the
  journey, build — per the project's stack. No skipped/failing tests.
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
