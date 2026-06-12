# Roadmap — TaskJot

> **Example** — a filled [`ROADMAP-TEMPLATE`](../../templates/ROADMAP-TEMPLATE.md) for
> *TaskJot*. See [`examples/README.md`](../README.md).

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Status        | Living                                 |
| Owner         | A. Maker                               |
| Last updated  | 2026-06-12                             |
| Sources       | [`01_INTAKE.md`](01_INTAKE.md) · [`02_PRD.md`](02_PRD.md) |

**Current focus:** slice 1 — *capture a task* — building the always-focused input + local
persistence. Done when a typed task survives a reload and appears instantly.

---

## 1. How to use this roadmap

The plan of record, kept live. Top = next. This is a *small* project (see §11 right-sizing),
so it runs one real spike and lean specs — but every build item is still a vertical, usable
slice that passes the gate.

## 2. Sequencing model

Foundation → risk-retirement spike (done) → domain slices (capture, complete, list) →
hardening (export/backup, a11y pass).

## 4. The plan

### Foundation

| # | Item | Kind | Value | Risk | Gated by | Status | Links |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ----- |
| 1 | App shell + local store | slice | High | Low | — | In progress | — |

### Spikes (risk retirement)

| # | Item | Kind | Value | Risk | Answers | Status | Spike report |
| - | ---- | ---- | ----- | ---- | ------- | ------ | ------------ |
| 0 | Quick-capture value | spike | High | High | does frictionless capture drive sustained use? | Done | [SPIKE-01](spikes/01-quick-capture-value.md) |

### Domain slices

| # | Item | Kind | Value | Risk | Gated by | Status | Links |
| - | ---- | ---- | ----- | ---- | -------- | ------ | ----- |
| 2 | Capture a task | slice | High | Low | spike 0 | Ready | [feature](features/capture-task.md) · [UX](ux/capture-task.md) |
| 3 | Complete a task (one-key) | slice | High | Low | spike 0 | Planned | _pulled forward by spike 0_ |
| 4 | Review / list filter | slice | Med | Low | — | Planned | — |

### Hardening

| # | Item | Kind | Value | Risk | Trigger | Status | Links |
| - | ---- | ---- | ----- | ---- | ------- | ------ | ----- |
| 5 | Export / backup + a11y pass | hardening | Med | Med | real daily use exists | Planned | NFR doc (`07_NFR.md`) |

## 5. Re-sequencing log

| Date | Change | Trigger | Effect on the plan |
| ---- | ------ | ------- | ------------------ |
| 2026-06-10 | Pulled *complete a task* ahead of list/filter; deferred the global hotkey to "later" | [SPIKE-01](spikes/01-quick-capture-value.md) surprise (one-key complete mattered as much as capture; hotkey barely used) | Slice 3 became "complete"; filtering slid to slice 4; hotkey dropped from v1 |

## 6. Done / shipped

| # | Item | Shipped | Notes |
| - | ---- | ------- | ----- |
| 0 | Quick-capture value spike | 2026-06-10 | De-risked the bet; reshaped the plan |
