<!--
Roadmap restructure initiative — objective + ID-scheme convention agreed 2026-07-12.
First item of the V1/Alpha documentation improvement cycle. This is the brief; the
deliverable is a new transitional roadmap file (see §6). Append-only in spirit: if the
convention changes, supersede rather than silently edit.
-->

# Roadmap restructure — objective & ID convention

| Field         | Value          |
| ------------- | -------------- |
| Status        | Agreed (drafting) |
| Owner         | Wesley Cutting |
| Date          | 2026-07-12     |
| Trigger       | V1 → Alpha review + UAT; documentation improvement cycle, critique #1 |
| Scope         | The Roadmap only, this pass (see §5) |

## 1. The problem

[`03_ROADMAP.md`](../03_ROADMAP.md) grew organically to 514 lines and accreted **eight
parallel ID families**, each minted by whatever review or initiative spawned the work:

| Family | Meaning | Approx. count |
| ------ | ------- | ------------- |
| `#3`–`#16`, then `#17`–`#21` | V1 domain slices — *then reused* for the much-later data-import work | ~20 |
| `SPIKE-01`–`SPIKE-11` | spikes (this family was already consistent) | 11 |
| `EH1`–`EH14` | engineering health — **two unrelated review waves** (2026-06-15, 2026-07-02) share one counter | 14 |
| `R1`–`R15` | **overloaded**: UX polish *and* developer-experience *and* e2e foundation under one letter | 15 |
| `UX1`–`UX15` (+`UX12a–d`) | UX Uplift | ~19 |
| `UXR1`–`UXR13` | UX Redesign | 13 |
| `S7`–`S9` | sheet-parity features | 3 |
| `K3`–`K28` | kit-feedback items that leaked into the roadmap | ~6 |

Pathologies that follow:

1. **An ID names its *origin*, not its *place in the plan*.** You must know the tribal
   meaning of each prefix to read the plan.
2. **Collisions and overloads.** `R` means three different things. `#N` spans both original
   V1 slices and 2026 import work with no grouping. Counters restart per review, so `EH10`
   is not "the 10th health item" — it is the 10th across two disjoint reviews.
3. **No Epic → Story hierarchy.** UX Uplift (15 items), UX Redesign (13 items), and the
   12-year import were each Epic-sized bodies of work flattened into peer IDs. Sub-structure
   exists only ad-hoc (`UX12a–d`); nothing rolls up.
4. **Roadmap ↔ status-report sync is prose, not a key.** The "current focus" is a ~70-line
   narrative; status reports reference these ad-hoc IDs. There is no shared ticket a row and
   a report both key off, so "what is the status of X?" is answered by reading paragraphs.

## 2. Objective (this pass)

Produce a **new, transitional roadmap file** that faithfully re-expresses every real item in
`03_ROADMAP.md` under **one unified ID scheme with an Epic → Story → Task hierarchy**. Same
content, same history, same statuses — reorganized so the plan and its status reports can
eventually share one ticket vocabulary.

## 3. Decisions (owner, 2026-07-12)

1. **Adopt, don't invent.** Use the recognized **Epic → Story → Task** model.
2. **Transitional, not permanent.** The new file lives *beside* `03_ROADMAP.md` for now;
   cutover (the new file replaces the old) comes later, over subsequent sessions. Two
   permanent roadmaps would recreate the sync problem we are killing.
3. **Roadmap-only scope this pass.** Re-ID the roadmap; back-referencing status reports and
   spike files to the new IDs is a later step in the transition.
4. **Faithful fidelity.** Re-express today's items as-is — do **not** re-litigate what was
   done or re-size the work here. Where the *old grain* was wrong (an Epic masquerading as a
   slice, etc.), **capture a flag for a follow-up pass** rather than acting on it.

## 4. The ID convention

- **Type-tagged, project-prefixed, one counter per type that never restarts:**
  `BUD-E##` (Epic), `BUD-S##` (Story), `BUD-T##` (Task).
  Example: Epic `BUD-E4` "UX Uplift" contains Stories `BUD-S31`…`BUD-S45`.
- **The number is a stable handle, not a position.** Identity is divorced from sequence:
  re-ordering the plan never renames anything. (The old scheme restarted counters per
  review — that is why `EH10` does not mean "10th".) Order lives in the document layout and
  the status column, never in the ID.
- **Hierarchy is carried two ways at once:** the ID's type tag says *what* an item is at a
  glance; a `Parent` column plus physical grouping-by-Epic says *where it rolls up*. No
  dotted `E1.S2.T3` — that re-encodes position into the ID and reintroduces the rename
  problem.
- **Spikes keep `SPIKE-##`** (already consistent), but each links to the Epic/Story it
  de-risks rather than floating.

## 5. Provisional Epic decomposition

Faithful grouping of the existing families (final map is produced in the draft):

- **Foundation & stack** — SPIKE-01/02 + the Foundation slice
- **Core budgeting domain** — `#3`–`#16` V1 slices + hardening
- **Engineering health** — `EH1`–`EH14` (the two review waves become Stories under one Epic)
- **Security hardening** — the 2026-07-06 security review (`SEC1`–`SEC3`)
- **UX Uplift** — `UX1`–`UX15`, with `UX12a–d` as the first genuine Tasks
- **UX Redesign** — `UXR1`–`UXR13`
- **Sheet parity** — `S7`–`S9`
- **Data & history import** — `#17`/`#18`, `#20`/`#21`, SPIKE-03/11
- **Developer experience** — the `R10`–`R15` cluster
- **Deferred: multi-user / household** — `#19`

## 6. Deliverable & follow-ups

- **Deliverable (this pass):** `docs/03_ROADMAP-v2.md` — the restructured roadmap, parallel
  to the original.
- **Follow-up A (done 2026-07-12):** the sizing critique — flag items whose old grain was
  wrong (Epic-as-slice, over-split stories) for re-sizing. Produced:
  [2026-07-12 roadmap sizing flags](2026-07-12-roadmap-sizing-flags.md) (advisory; nothing
  applied — awaits an owner-approved re-grain).
- **Follow-up B (done 2026-07-12, transitional form):** back-reference status reports and
  spike files to the new IDs. Produced an additive index —
  [2026-07-12 artifact crosswalk](2026-07-12-roadmap-artifact-crosswalk.md) (all 158
  artifacts ↔ their `BUD-*` id, both directions). **Upgraded 2026-07-12 to be generated from
  doc frontmatter** (K30 Part A — every artifact now carries `type`/`roadmap-item`/`status`;
  the crosswalk regenerates from that, supplement retired). Filename/id renames stay a
  **cutover** task (Follow-up C).
- **Follow-up C:** at cutover, `03_ROADMAP-v2.md` replaces `03_ROADMAP.md`.
- **Out of scope / relocate:** the `K##` kit-feedback items do not belong in the roadmap;
  their home is [`../KIT_FEEDBACK.md`](../KIT_FEEDBACK.md). They are omitted from the new
  roadmap.

## 7. Kit lesson

The starter kit's [`ROADMAP-TEMPLATE.md`](../../templates/ROADMAP-TEMPLATE.md) should ship
with this Epic → Story → Task convention and the stable-handle ID rule baked in, so no future
project rolls its own parallel prefixes. Captured as **K29** in the kit-feedback backlog
([`../KIT_FEEDBACK.md`](../KIT_FEEDBACK.md)).
