# examples/

**A worked, filled walkthrough of the doc chain — illustrative, NOT part of the baseline.**

These are *filled* versions of the kit's templates for one tiny toy project, so a reader
(human or agent) can see the whole chain instantiated once instead of staring at blank
templates. They are **stack-neutral docs only** — no runnable code ships here. Don't build
this; read it for shape, then start your own project from [`../templates/`](../templates/).

## The example: TaskJot

A minimal, keyboard-first **personal task list**. It's deliberately a *small, low-risk*
project — which makes it a good demonstration of **right-sizing the process**
([`../docs/00_WAYS_OF_WORKING.md`](../docs/00_WAYS_OF_WORKING.md) §11): it still does the
non-negotiables (a spike for the one real bet, vertical slices, gate-green) but compresses
where ceremony would be overkill, and says so.

## Read in this order

| Step | File | Instantiates |
| ---- | ---- | ------------ |
| 1 | [`taskjot/01_INTAKE.md`](taskjot/01_INTAKE.md) | [`docs/01_INTAKE.md`](../docs/01_INTAKE.md) (via [`DISCOVERY-GUIDE`](../templates/DISCOVERY-GUIDE.md)) |
| 2 | [`taskjot/spikes/01-quick-capture-value.md`](taskjot/spikes/01-quick-capture-value.md) | [`SPIKE-REPORT-TEMPLATE`](../templates/SPIKE-REPORT-TEMPLATE.md) |
| 3 | [`taskjot/02_PRD.md`](taskjot/02_PRD.md) | [`PRD-TEMPLATE`](../templates/PRD-TEMPLATE.md) |
| 4 | [`taskjot/03_ROADMAP.md`](taskjot/03_ROADMAP.md) | [`ROADMAP-TEMPLATE`](../templates/ROADMAP-TEMPLATE.md) |
| 5 | [`taskjot/adr/ADR-0001-stack.md`](taskjot/adr/ADR-0001-stack.md) | [`ADR-TEMPLATE`](../docs/adr/ADR-TEMPLATE.md) |
| 6 | [`taskjot/features/capture-task.md`](taskjot/features/capture-task.md) | [`FEATURE-SPEC-TEMPLATE`](../templates/FEATURE-SPEC-TEMPLATE.md) |
| 7 | [`taskjot/ux/capture-task.md`](taskjot/ux/capture-task.md) | [`UX-SPEC-TEMPLATE`](../templates/UX-SPEC-TEMPLATE.md) |

## The thing to notice

The **spike changed the plan**. The intake assumed a global quick-capture hotkey was the
differentiator; the spike found inline capture was enough and that *one-key complete*
mattered just as much — so the roadmap re-sequenced. That loop (reality invalidating a
paper assumption *before* it was built on) is the entire point of the kit.
