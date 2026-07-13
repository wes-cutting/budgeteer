---
type: index
---
# Documentation map

This is the authoritative map of the kit's docs: the **numbering scheme**, what each doc
is, whether it's carried as-is or filled in per project, and where each lands. Status
conventions for every doc/ADR are defined in
[`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) §4.

## The numbering scheme (read this first)

- **`00`** — the read-first **process spine**. Carried as-is.
- **`01`–`07`** — the per-project **narrative**, written (mostly) in this order as the
  project takes shape. Each has a template in [`../templates/`](../templates/).
- **Unnumbered** docs (`ARCHITECTURE`, `ENGINEERING_STANDARDS`, `TESTING_STRATEGY`,
  `SECURITY`) are constant **reference** — carried as-is, true on every project.
- **Folders** (`adr/`, `features/`, `ux/`, `spikes/`, `status-reports/`) hold the
  many-per-project artifacts.

The numbers are reserved slots — don't reuse or renumber them per project; just create the
file when its stage arrives.

## The numbered narrative (00–07)

| # | Doc | What it is | Carry vs. fill-in | Template |
| - | --- | ---------- | ----------------- | -------- |
| 00 | [`00_WAYS_OF_WORKING.md`](00_WAYS_OF_WORKING.md) | The process spine: lifecycle, spikes, vertical slices, sequencing, working with the agent. | Carry as-is | — |
| 01 | [`01_INTAKE.md`](01_INTAKE.md) | **First thing filled in:** the captured discovery conversation — problem, users, the core bet, riskiest assumptions, first spike. Pre-PRD. | Fill in | [`DISCOVERY-GUIDE.md`](../templates/DISCOVERY-GUIDE.md) (read, not filled) |
| 02 | `02_PRD.md` | Problem, users, goals, non-goals, journeys, value hypothesis. | Fill in | [`PRD-TEMPLATE.md`](../templates/PRD-TEMPLATE.md) |
| 03 | `03_ROADMAP.md` | The living, ordered backlog of spikes and slices — the **plan of record**, sequenced by uncertainty and value. | Fill in | [`ROADMAP-TEMPLATE.md`](../templates/ROADMAP-TEMPLATE.md) |
| 04 | `04_DOMAIN_MODEL.md` | The conceptual model: entities, invariants, relationships, lifecycles. Storage-neutral. | Fill in | [`DOMAIN-MODEL-TEMPLATE.md`](../templates/DOMAIN-MODEL-TEMPLATE.md) |
| 05 | `05_DATA_MODEL.md` | The physical model realizing the domain in the chosen datastore (per `ADR-0002`). | Fill in | [`DATA-MODEL-TEMPLATE.md`](../templates/DATA-MODEL-TEMPLATE.md) |
| 06 | `06_API_CONTRACT.md` | The interface contract other code depends on (REST/RPC/GraphQL/internal). | Fill in | [`API-CONTRACT-TEMPLATE.md`](../templates/API-CONTRACT-TEMPLATE.md) |
| 07 | `07_NFR.md` | Non-functional & operational readiness: budgets, SLOs, observability, backup/restore. | Fill in | [`NFR-TEMPLATE.md`](../templates/NFR-TEMPLATE.md) |

> Order is the **default**, not a queue to march through. `01_INTAKE` and the first
> spikes always come first; `04`–`07` are written/updated as the slices that need them are
> built (docs and code change together — see below). Small projects compress or skip
> rungs — see [`00_WAYS_OF_WORKING.md` §11](00_WAYS_OF_WORKING.md) for how to right-size.

## Constant reference (unnumbered, carry as-is)

| Doc | What it is |
| --- | ---------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Module boundaries and dependency direction. Stack chosen per-project via an ADR. |
| [`ENGINEERING_STANDARDS.md`](ENGINEERING_STANDARDS.md) | Conventions, the Definition of Done, and opt-in recommended patterns. |
| [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) | Test layers and the gate. |
| [`SECURITY.md`](SECURITY.md) | Secrets, data handling, authn/authz, dependency scanning. |

## Per-project folders

| Folder | Holds | Template |
| ------ | ----- | -------- |
| [`adr/`](adr/) | One ADR per real decision (stack, datastore, cross-cutting). The meta doc explains the format. | [`ADR-TEMPLATE.md`](adr/ADR-TEMPLATE.md) |
| `features/` | One feature spec per feature. | [`FEATURE-SPEC-TEMPLATE.md`](../templates/FEATURE-SPEC-TEMPLATE.md) |
| `ux/` | One UX spec per user-facing capability (flows + screen states). | [`UX-SPEC-TEMPLATE.md`](../templates/UX-SPEC-TEMPLATE.md) |
| `spikes/` | One report per investigation (**these come first**). | [`SPIKE-REPORT-TEMPLATE.md`](../templates/SPIKE-REPORT-TEMPLATE.md) |
| `status-reports/` | Periodic snapshots for clean hand-offs between sessions. | [`STATUS-REPORT-TEMPLATE.md`](../templates/STATUS-REPORT-TEMPLATE.md) |
| [`reviews/`](reviews/) | Point-in-time, repo-wide code reviews; findings tracked as roadmap items. | — |

## Target `docs/` tree (once a project is underway)

```
docs/
├─ README.md                 # this map
├─ 00_WAYS_OF_WORKING.md     # process spine          (carry as-is)
├─ 01_INTAKE.md              # captured discovery      (fill-in · pre-PRD)
├─ 02_PRD.md                 # product requirements    (fill-in)
├─ 03_ROADMAP.md             # plan of record          (fill-in · living)
├─ 04_DOMAIN_MODEL.md        # conceptual model        (fill-in)
├─ 05_DATA_MODEL.md          # physical model          (fill-in)
├─ 06_API_CONTRACT.md        # interface contract      (fill-in)
├─ 07_NFR.md                 # non-functional / ops    (fill-in · hardening)
├─ ARCHITECTURE.md  ENGINEERING_STANDARDS.md  TESTING_STRATEGY.md  SECURITY.md   (carry as-is)
├─ adr/                      # ADR-0000 meta + ADR-0001… one per decision
├─ features/                 # one feature spec per feature
├─ ux/                       # one UX spec per user-facing capability
├─ spikes/                   # one report per investigation (these come first)
└─ status-reports/           # periodic hand-off snapshots
```

## How a project starts

Pair with the agent to run **discovery**, guided by
[`../templates/DISCOVERY-GUIDE.md`](../templates/DISCOVERY-GUIDE.md) (a read-only playbook);
capture it in [`01_INTAKE.md`](01_INTAKE.md). The intake names the first **spike**; the
spike de-risks the bet; *then* the PRD and the rest of the narrative get written.

> Keep docs and code in sync **in the same change**. A change to data shape, interface, or
> architecture updates the corresponding doc in the same commit.
