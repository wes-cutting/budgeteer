# Contributing

This kit assumes a **human + AI-agent pair**. The authoritative rules live in
[`docs/`](docs/) — this page is the short front door and points at them. **If your
intended approach conflicts with a doc, stop and reconcile it there first; don't diverge
silently.**

## Start here

1. Read the process spine: [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md).
2. Skim the doc map: [`docs/README.md`](docs/README.md).
3. Agent operating guide: [`CLAUDE.md`](CLAUDE.md).
4. **New project?** Run discovery first with
   [`templates/DISCOVERY-GUIDE.md`](templates/DISCOVERY-GUIDE.md) → capture it in
   `docs/01_INTAKE.md`. Discovery names the first spike.

## How we work (the short version)

- **Reality before paper.** Spike an unproven assumption before writing the spec/ADR that
  depends on it. Spike code is throwaway; its findings aren't.
- **Vertical, not horizontal.** Every increment is a usable slice through data → API → UI.
- **Front-load risk; validate value.** Do the most uncertain work first.
- **Decided ≠ validated.** Honor the document-status ladder
  ([`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) §4).
- **Challenge the plan before executing it** — name the riskiest assumptions and sequencing
  risks; propose a spike if warranted. The full human/agent contract is §9.

## Before you open a PR

- **Definition of Done:** verify every box in
  [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) §2. The
  [PR template](.github/PULL_REQUEST_TEMPLATE.md) mirrors it.
- **The gate is green:** `types → lint → format → unit + integration → e2e (incl. a11y) →
  build`, with **no failing or skipped tests**
  ([`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md)). CI runs the same gate
  ([`.github/workflows/gate.yml`](.github/workflows/gate.yml)).
- **Docs in the same change:** a change to data shape, interface, or architecture updates
  the matching doc in the same commit. ADRs are append-only — supersede, don't edit.
- **Security from commit zero:** no secrets or confidential data committed/logged; tests
  use synthetic fixtures ([`docs/SECURITY.md`](docs/SECURITY.md)).

## Commits & branches

- **Conventional Commits:** `feat:` · `fix:` · `docs:` · `chore:` · `refactor:` · `test:`.
- **Trunk-based** with short-lived branches off the default branch. If you're on the
  default branch, branch first. Keep each commit gate-green.
