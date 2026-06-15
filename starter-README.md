# Baseline Starter Kit

A **stack-agnostic, project-agnostic** baseline for new application projects. It captures
*how we build* — process, standards, templates — so each new project starts from
hard-won lessons instead of a blank page.

> **The stack is a per-project decision.** This kit deliberately does **not** pick a
> framework, language, or datastore. Each project records its stack in its own
> `ADR-0001` (or equivalent) after a feasibility/UX spike. The kit provides the
> *boundaries and process* the stack plugs into.

## How to use it

> **Fastest start:** copy the prompt in [`KICKOFF-PROMPT.md`](KICKOFF-PROMPT.md) into a
> fresh agent session (with this repo open). It drives the steps below for you — beginning
> with discovery.

1. Copy this kit into a new project's repo (or use it as a template repo).
2. Read [`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) first — it's the spine.
3. **Run discovery with the agent** using
   [`templates/DISCOVERY-GUIDE.md`](templates/DISCOVERY-GUIDE.md); capture it in
   [`docs/01_INTAKE.md`](docs/01_INTAKE.md). This surfaces the problem, the core bet, and
   the riskiest assumptions — and **names the first spike**.
4. Run the **first spikes** (data-profiling and/or value-hypothesis) using
   [`templates/SPIKE-REPORT-TEMPLATE.md`](templates/SPIKE-REPORT-TEMPLATE.md).
5. Only then fill in the PRD and project docs from the templates, picking a stack via an ADR.
6. Build in **vertical slices** (data → API → UI), gate-green each one.

> **New to the kit?** Skim [`examples/taskjot/`](examples/taskjot/01_INTAKE.md) first — a
> filled walkthrough of the whole chain (intake → spike → PRD → roadmap → feature + UX spec)
> for one tiny project.

## The core idea (one line)

**Reality before paper; vertical not horizontal; front-load risk; usable every step;
decided ≠ validated; secure from commit zero.**

## Layout

```
baseline-starter/
├─ README.md                        # this file
├─ CLAUDE.md                        # agent operating guide (stack-agnostic)
├─ KICKOFF-PROMPT.md                # copy-paste prompt to start/resume with an agent
├─ CONTRIBUTING.md                  # front door for contributors (human + agent)
├─ LICENSE                          # MIT
├─ .gitignore                       # secrets + local/confidential data, from day zero
├─ .env.example                     # config keys (copy to .env; never commit real secrets)
├─ .editorconfig                    # consistent whitespace across editors
├─ ORIGIN.md                        # the lessons this kit encodes
├─ .github/
│  ├─ PULL_REQUEST_TEMPLATE.md      # the Definition of Done as a PR checklist
│  └─ workflows/gate.yml            # CI gate skeleton (wire to your stack; fails until configured)
├─ docs/
│  ├─ README.md                     # doc map / reading order
│  ├─ 00_WAYS_OF_WORKING.md         # process spine (the lessons as rules)
│  ├─ 01_INTAKE.md                  # captured discovery (first fill-in, pre-PRD)
│  ├─ ARCHITECTURE.md               # module boundaries (stack chosen per-project)
│  ├─ ENGINEERING_STANDARDS.md      # conventions + Definition of Done + recommended patterns
│  ├─ TESTING_STRATEGY.md           # test layers + the gate
│  ├─ SECURITY.md                   # secrets / data / auth baseline
│  └─ adr/
│     ├─ ADR-0000-record-architecture-decisions.md   # how we use ADRs
│     └─ ADR-TEMPLATE.md
├─ templates/
│  ├─ DISCOVERY-GUIDE.md            # agent's intake-conversation playbook (read, not filled)
│  ├─ SPIKE-REPORT-TEMPLATE.md      # time-boxed investigations
│  ├─ UX-SPEC-TEMPLATE.md           # flows + screen states (forces the UI)
│  ├─ PRD-TEMPLATE.md               # problem / goals / non-goals / journeys
│  ├─ ROADMAP-TEMPLATE.md           # living, ordered slice/spike backlog (plan of record)
│  ├─ FEATURE-SPEC-TEMPLATE.md
│  ├─ DOMAIN-MODEL-TEMPLATE.md
│  ├─ DATA-MODEL-TEMPLATE.md
│  ├─ API-CONTRACT-TEMPLATE.md
│  ├─ NFR-TEMPLATE.md               # non-functional reqs + operational readiness (hardening)
│  └─ STATUS-REPORT-TEMPLATE.md
└─ examples/                        # a filled, illustrative walkthrough (NOT built)
   └─ taskjot/                      # the full doc chain for a tiny toy project
```

> **`examples/`** is a *filled* walkthrough of the doc chain for one toy project
> (TaskJot) — read it to see what "good" looks like, then start from `templates/`. See
> [`examples/README.md`](examples/README.md).

## What's a copy vs. a fill-in

- **Carry as-is** (the baseline): `docs/00_WAYS_OF_WORKING.md`, `ENGINEERING_STANDARDS.md`,
  `TESTING_STRATEGY.md`, `SECURITY.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `.gitignore`,
  `.editorconfig`, `.env.example`, `.github/` (PR template + CI gate skeleton),
  the ADR meta doc, `KICKOFF-PROMPT.md`, and `templates/DISCOVERY-GUIDE.md` (a read-only
  playbook).
  > The scaffolding files (`.github/`, `.env.example`, the gate) are **carried, then
  > wired to your stack** — fill in the real commands/keys; don't change what they enforce.
- **Fill in per project** (from `templates/`): the intake record, PRD, roadmap, feature
  specs, UX specs, domain/data models, API contract, the NFR / operational-readiness doc,
  spikes, status reports, and each stack/decision ADR.

## Origin

Everything here traces to a specific failure or a practice that worked on a prior
project. See [`ORIGIN.md`](ORIGIN.md) for the short version and
[`docs/00_WAYS_OF_WORKING.md`](docs/00_WAYS_OF_WORKING.md) §10 for the named
anti-patterns this kit is designed to prevent.

## Contributing

This kit assumes a human + AI-agent pair. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the
short front door and [`CLAUDE.md`](CLAUDE.md) for the agent operating guide.

## License

[MIT](LICENSE) © DrewskiLabs.
