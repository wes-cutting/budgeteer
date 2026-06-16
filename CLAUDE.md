# CLAUDE.md

This file orients contributors and AI agents working in a project built from this
baseline. The authoritative detail lives in [`docs/`](docs/).

## Source of truth

The documents in [`docs/`](docs/) are authoritative. **If your intended approach
conflicts with a doc, STOP and flag it** rather than diverging silently. Start with:

- [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) — the process spine (read first)
- [`docs/README.md`](docs/README.md) — the documentation map
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) · [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) · [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/adr/`](docs/adr/) — decisions (including this project's **stack**, per `ADR-0001`)

**Starting a new project?** Run discovery first.
[`templates/DISCOVERY-GUIDE.md`](templates/DISCOVERY-GUIDE.md) is your intake-conversation
playbook; capture it in [`docs/01_INTAKE.md`](docs/01_INTAKE.md) **before** any PRD or spec.
Discovery names the first spike.

## How we work (non-negotiable process)

- **Reality before paper.** Spike unproven assumptions (data, integrations, value) before
  writing the spec/ADR that depends on them. Spike code is throwaway; its findings aren't.
- **Vertical, not horizontal.** Every increment is a usable slice through data → API → UI.
  Never build a whole layer in isolation.
- **Front-load risk; validate value.** Do the most uncertain work first; prove the core
  hypothesis before building around it.
- **Decided ≠ validated.** Honor the document-status ladder
  ([`00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) §4); don't `Accept` on paper.
- **Usable at every step.** Ask "is it usable yet?" each increment.
- **Challenge the plan.** Before a phase, name the riskiest assumptions and sequencing
  risks; propose a spike if warranted. Don't execute a flawed plan flawlessly.
- **Right-size the ceremony.** Match process weight to the work's risk and reach
  ([`00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) §11): compress for small/low-risk
  slices, scale back up for money/auth/multi-tenant data, integrations, or anything
  expensive to reverse. The non-negotiables (spike unproven assumptions, vertical slices,
  gate-green, secrets out of the repo) never flex.

## Non-negotiable engineering rules

- **Boundaries:** I/O lives only in the adapter/data layer; domain + libraries are pure
  (no framework, no I/O); presentation is thin and never touches the datastore directly.
- **Validate all external input at the boundary**; invalid input fails loudly.
- **Strong typing; avoid escape hatches** (`any` and equivalents).
- **Authorization is default-deny, checked at the resource level.**
- **Secrets/confidential data are never committed or logged**; tests use synthetic
  fixtures.
- **Accessibility:** WCAG 2.2 AA on user-facing surfaces; respect `prefers-reduced-motion`.

## Recommended patterns (opt-in)

Adopt when the domain calls for it (see
[`ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) §4), recording the choice in an
ADR: integer-minor-unit money, derive-don't-store computed state, tenant/owner scoping,
pure-core/impure-shell, reconcilable idempotent imports, a consistent error envelope.

## Testing & Definition of Done

- Test layers and the gate: [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md).
  **A failing or skipped test blocks completion.**
- Before declaring anything done, verify the Definition of Done in
  [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) §2.
- **Close out each block with a DoD-shaped snapshot.** At the end of every spike, vertical
  slice, or phase, write a dated [status report](templates/STATUS-REPORT-TEMPLATE.md) whose
  **outline is the Definition of Done** — each check ✅/⚠/❌ **with evidence**, plus the
  test-count delta and a one-line Conventional-Commit summary; deferred checks stay visible
  (⚠ + reason + owner) so it never overstates "done." Right-size it: a trivial docs/config
  tweak gets a commit line, not a full report. See
  [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) §9.
- **Make every Roadmap milestone handoff-ready.** When a Roadmap item reaches `Done`, leave
  the project ready to resume in a fresh context window: gate green, docs updated, the status
  report's **Resume here** current — and **end that report with a copy-pasteable
  "Next-session kickoff prompt"** (the exact prompt to start the next session on the next
  item). The newest status report is therefore both the handoff and the launch pad; a fresh
  session should need nothing more than to read it.

## Documentation discipline

Any change to data shape, interfaces, or architecture updates the corresponding doc **in
the same change**. New features start from [`templates/`](templates/). ADRs are
append-only — **supersede, don't edit**.

## Commits & workflow

- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Trunk-based with short-lived branches; **commit/push only when asked**. If on the
  default branch, branch first.

## Stack

The stack (language, framework, datastore, exact tooling commands) is **chosen per
project** in `docs/adr/` and listed in the project's top-level README. This baseline is
stack-agnostic by design.
