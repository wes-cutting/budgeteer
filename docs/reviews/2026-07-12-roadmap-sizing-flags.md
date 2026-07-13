<!--
Roadmap sizing flags — Follow-up A of the 2026-07-12 restructure initiative.
ADVISORY ONLY. Nothing here is applied: no id, status, or grouping in 03_ROADMAP-v2.md
changes as a result of this doc. It is the input to a LATER re-grain decision the owner
makes deliberately. References use the new BUD-* ids (see 03_ROADMAP-v2.md §2 crosswalk).
-->

# Roadmap sizing flags (re-grain candidates)

| Field   | Value          |
| ------- | -------------- |
| Status  | Advisory (flags only — not applied) |
| Owner   | Wesley Cutting |
| Date    | 2026-07-12     |
| Parent  | [2026-07-12 restructure initiative](2026-07-12-roadmap-restructure-initiative.md) (Follow-up A) |
| Scope   | [`03_ROADMAP-v2.md`](../03_ROADMAP-v2.md) — where the *original* grain was wrong |

## What this is

The restructure fixed the **id scheme**; it deliberately kept every item's **grain**
faithful (a slice stays a slice). This pass reviews that grain and flags the mismatches —
Epic-sized work that shipped as one "slice", multi-concern bundles that should split, and
"stories" that aren't deliverable work. **Each flag is a recommendation, not a change.**
Re-sizing is a separate, owner-approved step; until then v2 stands as-is.

Confidence = how sure the grain is wrong. Live? = whether it has a present consequence
(an open decision or a cleanup) vs. purely retrospective tidiness.

## 1. Stories that are Epic-sized → promote to an Epic with child stories

| Item | Was | Issue | Recommended re-grain | Confidence | Live? |
| ---- | --- | ----- | -------------------- | ---------- | ----- |
| `BUD-S61` | S7 | Pay-period planning bundles a **built derived-only V1** and a **deferred `§8` bill↔paycheck assignment store** — two clearly different deliverables, and the second is a **live open decision** (the FEAT-S7 §5 ratify/veto). | Epic **"Pay-period planning"** → story *derived-only planner* (Done) + story *assignment store* (Deferred, = the open decision). | High | **Yes** — surfaces the open decision as a first-class deferred story instead of a footnote inside a Done item. |
| `BUD-S80` | #20 | Statement import bundles the **file-import half (Done)** with the **live bank-API half**, which the note itself says "stays deferred and will need its own spike." | Epic **"Statement import"** → story *file import* (Done) + story *live bank-API integration* (Deferred, spike-gated). | High | Partly — the deferred half is real future scope, currently invisible. |
| `BUD-S1` | #1 | The Foundation "slice" bundled app-shell + Postgres store + domain core + **account CRUD** + **envelope CRUD** + the day-zero gitignore/fixtures guardrail — an Epic's worth of bootstrap in one row. | Epic **"Foundation"** → stories *app shell*, *datastore + migrator*, *domain core*, *account CRUD*, *envelope CRUD*. | Med | No — shipped clean as one bootstrap; splitting is retrospective clarity. |
| `BUD-S79` | #18 | 12-yr history import was a multi-session ETL + schema-map authoring + envelope-wrap + restore/verify — Epic-grained, not a single slice. | Epic **"Historical import"** → stories *extraction/ETL*, *schema map*, *wrap + restore + verify*. | Med | No — done; retrospective. |

## 2. Over-bundled story (multiple unrelated concerns) → split

| Item | Was | Issue | Recommended re-grain | Confidence | Live? |
| ---- | --- | ----- | -------------------- | ---------- | ----- |
| `BUD-S78` | #16 | One story fuses **three unrelated hardening concerns**: the a11y (axe) pass, the perf-budget harness, and the CI-gate wiring. The opposite failure from over-splitting. | Split into `a11y pass` · `perf budgets` · `CI wiring` (three stories, or one story + two tasks). | High | No — done; but the model would read honestly. |

## 3. "Stories" that aren't deliverable work → reclassify

| Item | Was | Issue | Recommended re-grain | Confidence | Live? |
| ---- | --- | ----- | -------------------- | ---------- | ----- |
| `BUD-S77` | #15b | Restore/import was Deferred, **then actually delivered elsewhere** — under `BUD-S31` (EH10, "prove restore"). It is a redundant, superseded story. | Mark **Dropped — superseded by `BUD-S31`** (keep the row for traceability, drop the story status). | High | **Yes** — a genuine redundancy; leaving it as a live Deferred story misrepresents the plan. |
| `BUD-S38` | SEC3 | "Unauthenticated API" **folds into `BUD-E13`** — it is a cross-reference to the deferred epic, not standalone work. | Demote to a **finding noted under `BUD-E13`**, not a story. | Med | No. |
| `BUD-S37` | SEC2 | "Dev-tool advisories" is explicitly **Informational (no action)** — a finding, not a deliverable. | Demote to a **security-findings note**, not a story. | Med | No. |
| `BUD-S43` | R10 | "API watch mode" was **already present — no work done**. A no-op recorded as a story. | Fold into a note (or a Done task with a "no work" flag); not a peer story. | Low | No. |

## 4. Large epics with natural sub-structure → optional sub-grouping

| Item | Issue | Recommendation | Confidence |
| ---- | ----- | -------------- | ---------- |
| `BUD-E8` (UX Uplift) | 13 stories + 4 tasks under one epic. The initiative had explicit **Phases 0–4** (Foundation · Shell · Cockpit · Insights · Polish) — the sub-structure already exists as metadata. | Group the stories by phase (sub-headings, or sub-epics if the scheme grows one) so a 17-item epic stays navigable. | Med |
| `BUD-E10` (UX Redesign) | Already grouped **track (S63–S70)** vs **post-track polish (S71–S75)** — fine. Minor: several post-track items (`BUD-S72` chart x-axis, `BUD-S74` manage formatting) are **task-grained** polish. | Optional: model the tiny polish items as tasks rather than peer stories. | Low |

## 5. Sibling-split stories (informational — no action)

`BUD-S6`/`BUD-S7` (was #7a/#7b, transfers) and `BUD-S18`/`BUD-S19` (was #14a/#14b,
credit/debt) were each split from a **single original parent** (#7 "Transfers", #14 "Debt &
credit trends"). As sibling stories they're correctly grained; the split just means each
parent was a small **Epic-let**. If §1's promotions happen, these are the template for how a
parent item becomes an epic with sibling stories. No change recommended on its own.

## Validated — correctly sized (no change)

- **`BUD-S57` → `BUD-T1`–`T4`** (UX12's four threads as tasks) — the exemplar of the right
  Epic→Story→Task grain; the restructure already models it correctly.
- **`BUD-E3` (Analysis)** — the original filed the whole analysis area as peer "Domain
  slices"; promoting it to an Epic was itself a re-grain fix, already done in v2.
- **`BUD-E13` (Multi-user)** — a deferred Epic with no stories yet: correct.

## Summary — recommended priority if/when re-sizing runs

1. **`BUD-S77`** — mark Dropped/superseded by `BUD-S31` (removes a false live item). *Cleanup, do first.*
2. **`BUD-S61` → Epic** — promotes the live FEAT-S7 §5 assignment-store decision to a visible deferred story. *Highest planning value.*
3. **`BUD-S80` → Epic** — surfaces the deferred live-bank-API scope.
4. **`BUD-S78`** — split the a11y/perf/CI bundle.
5. **`BUD-S37`/`BUD-S38`/`BUD-S43`** — reclassify non-deliverables as notes.
6. **`BUD-S1`, `BUD-S79` → Epics** and **`BUD-E8` phase grouping** — retrospective clarity, lowest urgency.

Nothing above is applied. The next step, when the owner chooses, is to approve a subset and
run the re-grain against `03_ROADMAP-v2.md` (which will mint new `BUD-E*`/`BUD-S*` ids for
any promotions — stable-handle rule: existing ids never renumber).
