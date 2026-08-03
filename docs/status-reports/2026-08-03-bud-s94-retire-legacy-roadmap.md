---
id: SR-2026-08-03-bud-s94-retire-legacy-roadmap
type: status-report
roadmap-item: BUD-S94
status: Snapshot
---
<!--
STATUS REPORT — BUD-S94, the v2 roadmap cutover: the restructured plan takes the unsuffixed
names and the pre-restructure roadmap is deleted. Docs + tooling; four parts that move together.
Right-sized per §11 (docs housekeeping, no runtime code): no ADR, no UX spec, no feature spec.
One slice, then stop.
-->

# Status Report — 2026-08-03 (`BUD-S94` — retiring the legacy roadmap)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-03 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S94` — the v2 cutover: `03_ROADMAP-v2.md` → `03_ROADMAP.md`, `03_ROADMAP-HISTORY-v2.md` → `03_ROADMAP-HISTORY.md`, the pre-restructure roadmap deleted; the checker that hardcodes both names updated; live back-links retargeted; `docs:check` folded into the documented gate lists. Closes [Follow-up C](../reviews/2026-07-12-roadmap-restructure-initiative.md) of the 2026-07-12 restructure |
| Item   | [`03_ROADMAP.md`](../03_ROADMAP.md) §3 · [`KIT_FEEDBACK`](../KIT_FEEDBACK.md) `K46` / `K48` |

**Resume here:** **The roadmap is now one file with the obvious name.** `docs/03_ROADMAP.md` is the
plan of record, `docs/03_ROADMAP-HISTORY.md` its append-only sibling, and the pre-restructure
roadmap — carried as `Superseded-in-place` since 2026-08-02 — is deleted. The item had ridden four
kickoff prompts as *Blocked on K30 Part B*; `BUD-S97` cleared it the previous day, and this cutover
is the evidence that it did: renaming with the checker untouched **crashed** `docs:check`, and
fixing the checker turned the fallout into a **precise 16-problem worklist** — 14 broken links
across 10 files, named by the gate before a single one was touched. No grepping. The one thing the
gate could *not* see is recorded as `K48`: the new file **reuses the retired name**, so the ~29
dated records linking `03_ROADMAP.md` still resolve — to different content. Green links, wrong
destination; the only fix is prose, and both roadmap files now say so. Gate green: **495 Vitest +
142 e2e**, both at the floor. The work is **uncommitted** — proposed message in §6. Next item:
**`shellcheck` for `scripts/*.sh`** — kickoff prompt in §9.

## 1. The cutover, in the order it actually happened

The kickoff said to run `docs:check` immediately after the rename, before fixing anything. That was
the right instruction and it produced three distinct results worth separating:

**Step 1 — rename, checker untouched.** `docs:check` did not report problems; it **crashed**:

```text
Error: ENOENT: no such file or directory, open 'docs/03_ROADMAP-v2.md'
```

Loud and non-zero, so the gate is safe — but it is a crash, not a worklist, because the checker
reads the plan by path to build the crosswalk *before* any validation runs. Noted in §7; I did not
fix it, because a graceful message here is polish and this slice had a defined scope.

**Step 2 — checker updated, then re-run.** Five references in
[`check-docs.ts`](../../scripts/check-docs.ts): the two path constants, and **three `-v2` strings
embedded in markdown it *generates*** (the crosswalk's `Source` row, its HTML comment, and the
history §2 prose). `V2` was also renamed to `PLAN` and `parseV2` to `parsePlan` — with the suffix
retired, a constant called `V2` is a trap for the next reader. This time the check produced the
worklist:

```text
docs:check — 16 problem(s):
  crosswalk is stale · history §2 is stale          ← the two generated files
  README.md: broken link → docs/03_ROADMAP-v2.md    (×3)
  …14 broken links across 10 files, each named…
```

**Step 3 — fix, regenerate, diff.** `npm run docs:crosswalk` rewrote both generated files; the diff
was exactly the three prose strings and **zero ledger rows**, which is what confirms the generator
change was inert with respect to content.

## 2. The 14 links, and the rule that decided each one

| Where | Links | Treatment |
| ----- | ----- | --------- |
| **Living docs** — root `README.md` (×3), the plan, the history, `features/first-run-setup.md` | 6 | Text **and** target updated. These describe the current system; the old filename is simply wrong now. |
| **Dated records** — `ADR-0009` (×2), `reviews/2026-07-12-roadmap-sizing-flags`, `reviews/2026-07-27-hub-deployment-readiness`, `status-reports/2026-08-02-docs-onboarding-gap`, `status-reports/2026-08-03-bud-s97-doc-ids-links` (×2) | 7 | **Target only.** Prose, link text and fenced blocks untouched. |
| **Generated** — the artifact crosswalk | 1 | Regenerated from the fixed emitter. |

The kickoff flagged a genuine conflict: doc→doc links are strict *even in snapshots*
([`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4 rule 1), yet rewriting a dated record to
chase a rename is exactly what that section forbids. They only appear to collide. **In a dated
record the visible link text is the record; the target is navigation.** So the pointer moved and nothing else did —

```markdown
[`03_ROADMAP-v2.md`](../03_ROADMAP-v2.md)   →   [`03_ROADMAP-v2.md`](../03_ROADMAP.md)
```

— the snapshot still says what it said, and the pointer still reaches the document it named. Unlinking
would have destroyed a working path to a live doc and preserved nothing. This is the same reasoning
`BUD-S97` used for ADRs (append-only protects the decision, not the path), extended to renames and
now written into §4.

## 3. What the gate could not catch — the reason this slice needed prose, not just tooling

`03_ROADMAP.md` is a **reused name**. The old file with that name was deleted; a different document
now answers to it. Consequences, measured:

- **14 links broke** (the `-v2` names) — every one caught, named, and fixed.
- **~29 links did not break** — the dated records, spikes and reviews pointing at
  `03_ROADMAP.md`. They resolve exactly as before, and now land on a **different document**. An
  older report citing "`03_ROADMAP.md` §4" (the plan) now reaches a file whose §4 is not the plan;
  §3 is, and the old §5/§6 live in the history file.

The same blind spot has a second form, which bit twice here: **prose mentions of a filename are not
links at all.** [`KICKOFF-PROMPT.md`](../../KICKOFF-PROMPT.md) told a fresh agent *"in THIS repo the
plan of record is `03_ROADMAP-v2.md`; `03_ROADMAP.md` is superseded"* — actively wrong instructions
after the cutover — and the PR template asked for a roadmap id *"from `03_ROADMAP-v2.md`"*. Both
were found by `grep`, because the gate has nothing to say about a filename written as prose.

No link checker can see this — resolution is all it verifies. Rewriting ~29 dated records is the
wrong fix (it falsifies them, and §2's rule exists precisely to prevent that), so the defense is
stated where a reader will hit it: the plan's banner explains what a pre-cutover
`03_ROADMAP.md §4` reference means, and the history's header names the deleted file it was migrated
from rather than the file that now holds the name. Logged as **`K48`** — the exact complement of
`K46` (which this cutover otherwise vindicated).

## 4. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The deliverable is the docs tree itself: one roadmap, at the obvious name, with its history beside it and no superseded twin. `docs:check` green over it. |
| Gate green | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ **214 docs, 2,005 links, 176/176 artifacts + 37 core/review docs, both generated files regenerated** (the deleted roadmap alone carried ~337 links, which is why the total fell from 2,318) · `test` ✅ **495** · `test:e2e` ✅ **142** |
| Acceptance criteria | ✅ | All four sub-parts: (1) rename + delete, ids unchanged (`DOC-ROADMAP` still names the plan; `DOC-ROADMAP-LEGACY` retired with its file); (2) checker updated — 5 references, regenerated and diffed; (3) Follow-up D back-links retargeted; (4) `docs:check` in every documented gate list, and `CLAUDE.md` now carries the conventions. |
| Accessibility | n/a | No user-facing surface. |
| Input validation & secrets | ✅ | No runtime code changed. Docs and one tooling script. |
| Docs in the same change | ✅ | [`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4 (the retarget rule + the name-reuse hazard) and §5 DoD · [`ENGINEERING_STANDARDS.md`](../ENGINEERING_STANDARDS.md) §2 · [`TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) §3 · [`README.md`](../../README.md) (scripts table + gate sentence + doc map) · [`CLAUDE.md`](../../CLAUDE.md) · [`PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) · [`07_NFR.md`](../07_NFR.md) · [`KICKOFF-PROMPT.md`](../../KICKOFF-PROMPT.md) · [`KIT_FEEDBACK.md`](../KIT_FEEDBACK.md) (`K46` confirmed, `K48` added) · both roadmap files' headers. |
| **Verified by the gate, not by grep** | ✅ | §1: the rename's fallout was enumerated by `docs:check` — 16 problems — before any fix. This is the first use of `BUD-S97` for the purpose it was built for. |
| Test-count delta | ⚠ **0 new Vitest/e2e tests** | Docs + one tooling script; no runtime behaviour changed. The relevant assertion is the docs gate, which ran at every step. Unchanged from `BUD-S97` §7: the checker itself still has no unit tests. |

## 5. What was left out, and why

- **The `~65` dated status reports were not touched** (beyond the 3 retargets above), exactly as the
  roadmap row required. They are point-in-time records.
- **The spec-back-referencing pass is still deferred** — `FEAT-*` spec names, `features/*` and
  `status-reports/*` paths, and `ADR-*` filenames keep their legacy names. That was always a
  separate item from the roadmap rename; the plan's banner now says so plainly instead of bundling
  it into `BUD-S94`.
- **`docs/README.md` needed no edit.** Its taxonomy table and tree already listed
  `03_ROADMAP.md` + `03_ROADMAP-HISTORY.md` — it was written for the post-cutover state and had been
  quietly *wrong about the present* until today. Worth noting as the mirror image of link rot: a doc
  that describes the intended end state reads as correct and is unverifiable by any checker.
- **The checker's ENOENT crash was not made graceful** (§7).
- **A false positive I hit while writing this up, worth naming:** the link check skips *fenced*
  code but not **inline** code spans, so documenting link syntax in prose — bracket-text
  followed by a parenthesised path, inside backticks — is parsed as a real link and fails. It
  caught my own §4 example, and then caught this very bullet twice while I wrote it up. The escape hatch (a fenced
  block) is idiomatic and is what both §4 and §2 above now use, so I left the extraction alone
  rather than widening this slice; recorded in §7 beside the other checker gaps.

## 6. Proposed commit

The work is **uncommitted** for review. 21 entries: the two renames, one deletion,
`scripts/check-docs.ts`, 16 edited docs, and this report.

```text
docs(roadmap): retire the legacy roadmap — the v2 cutover (BUD-S94)
```

Body worth keeping: `03_ROADMAP-v2.md` and `03_ROADMAP-HISTORY-v2.md` take the unsuffixed names and
the pre-restructure roadmap is deleted, closing Follow-up C of the 2026-07-12 restructure. Ids are
unchanged — `DOC-ROADMAP` still names the plan, which is what made this a contained change.
`check-docs.ts` updated in five places, including three `-v2` strings inside the markdown it
generates; regenerated and diffed with zero ledger rows changed. The rename's fallout was
enumerated by `docs:check` itself (16 problems, 14 broken links across 10 files) rather than by
grep — the first real use of `BUD-S97`. Dated records had their link *targets* retargeted and their
prose left alone, per a rule now recorded in `00_WAYS_OF_WORKING.md` §4. `docs:check` folded into
all four documented gate lists, and `CLAUDE.md` now states the frontmatter convention, the id
scheme, and where the roadmap lives. `K48` records what a link check structurally cannot catch: the
name was reused, so ~29 older references still resolve — to different content.

## 7. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| **`docs:check` crashes (ENOENT) instead of reporting when the plan file is missing** | It reads the roadmap to build the crosswalk before validation runs. The gate still fails loudly and non-zero, so this is message quality, not safety — and fixing it is a change to the checker's control flow, outside a cutover slice. A one-line `existsSync` guard with a named message would do it. | open |
| **Unit tests / a committed self-test for the docs gate** | Unchanged from `BUD-S97` §7. Two slices have now leaned on this checker for correctness; it is still verified only by a throwaway harness. Rising, not falling, in priority. | open |
| **Inline code spans are parsed as links** | A Markdown link written inside an inline code span fails the check; only *fenced* code is skipped, so documenting link syntax needs a fenced block. Cheap to fix (skip inline spans during extraction) but it is a change to link extraction, which this slice had no business touching. | open |
| **Anchor targets (`#section`) are still unvalidated** | Unchanged from `BUD-S97` §7 — and this cutover made it slightly more relevant, since section numbers shifted for anyone following an old `§4` reference. | open |
| **`shellcheck` for `scripts/*.sh`** | Unchanged — a dependency + gate-step decision (`BUD-S96` §7). Named as the next item in §9. | open |
| **The spec-back-referencing pass** (`FEAT-*`, `features/*`, `ADR-*` filenames) | Explicitly out of this item's scope; the plan's banner now records it as its own deferred work rather than as part of `BUD-S94`. | open |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 | Carried forward, unchanged. | labs-hub SPIKE-03 / owner |

## 8. Commands & gotchas

```bash
npm run docs:check
```

- **The roadmap is `docs/03_ROADMAP.md`.** There is no `-v2` file and no second roadmap. Its
  history is `docs/03_ROADMAP-HISTORY.md`, whose **§2 is generated** — never hand-edit it.
- **A pre-2026-08-03 reference to `03_ROADMAP.md` means the deleted file.** Section numbers do not
  carry over: its §4 (plan) is §3 here; its §5/§6 are §1/§2 of the history. Links resolve either
  way, so nothing will warn you.
- After changing any plan row's **status**, rerun `npm run docs:crosswalk` — the history's
  Done/shipped ledger is generated from those rows and `docs:check` fails on a stale one.
- `scripts/check-docs.ts` no longer contains the string `v2` anywhere. If you add a third generated
  file, pass its directory to `linkTarget` (`BUD-S97` §8) and check whether it needs the plan's
  filename in its prose.
- No container runtime needed; colima stayed stopped for the whole gate.

## 9. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-03-bud-s94-retire-legacy-roadmap.md — this report, the newest.
- Read docs/status-reports/2026-08-02-bud-s96-validate-demo.md §7 (the shellcheck row) and
  §9b, which is the original proposal for this item, kept as the record.
- Skim the three scripts you are putting under a linter: scripts/demo-instance.sh,
  scripts/validate-deploy.sh, scripts/validate-demo.sh (~390 lines, the largest).

Build EXACTLY ONE item this session: adopt shellcheck for scripts/*.sh.

Why it is next: the repo has three operator/harness shell scripts carrying real logic — standing
up a demo box, validating the deploy, validating the demo profile — and NOTHING checks them. Every
other language surface in this repo is gated: tsc covers every .ts including scripts/ (BUD-S95),
ESLint runs at zero warnings, prettier checks formatting, docs:check now validates the docs.
Shell is the one blind spot, and it is the surface where a quoting mistake silently does the wrong
thing rather than failing. This has been carried as deferred in BUD-S96 §7, BUD-S97 §7 and this
report §7 — three consecutive slices — without the decision being made either way.

The decision the slice must settle, in writing: shellcheck is a NON-npm dependency (a binary,
installed via brew/apt), which is why it has been deferred. Pick a stance and record it:
- Gate step or local-only? gate.yml runs on ubuntu-latest where shellcheck is preinstalled, but a
  contributor without it must not get a broken `npm run lint`. Consider a `lint:sh` script that
  skips with a clear message when the binary is absent, and a hard requirement in CI.
- Which severity level, and are existing warnings fixed or baselined? Fix them if the count is
  small; a baseline file that nobody prunes is how a linter becomes decoration.
Write the answer into ENGINEERING_STANDARDS/TESTING_STRATEGY and the README scripts table — the
gate lists are now canonical and were just corrected in BUD-S94; keep them accurate.

Watch out for:
- Verify the check FAILS on an injected defect before trusting the green (K41's rule, applied in
  BUD-S91/S95/S96/S97): introduce an unquoted variable or a masked exit code and watch it fail.
- validate-demo.sh and validate-deploy.sh need a container runtime to RUN, but shellcheck is
  static — you can lint all three without starting colima. Keep colima STOPPED.
- Do not "fix" a warning by changing what a script does. If shellcheck flags real behaviour
  (e.g. intentional word-splitting), silence it with a scoped `# shellcheck disable=` plus a
  comment saying why — never a file-wide disable.
- If you add a lint:sh npm script, it must land in the documented gate lists (README scripts
  table · TESTING_STRATEGY §3 · ENGINEERING_STANDARDS §2 · the PR template) in the same change.

For CONTEXT only, not for this session — still open:
- The docs gate has no unit tests and crashes (ENOENT) rather than reporting when the roadmap file
  is missing (this report §7). Two slices have now leaned on that checker.
- Anchor targets (#section) are still unvalidated by the link check.
- The spec-back-referencing pass (FEAT-* spec names, features/*, ADR-* filenames) is deferred.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- The roadmap says every build track is Done and V1 is in Alpha (review + UAT). This is tooling;
  it does not move the product.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```
