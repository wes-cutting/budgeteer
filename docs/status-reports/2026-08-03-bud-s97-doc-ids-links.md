---
id: SR-2026-08-03-bud-s97-doc-ids-links
type: status-report
roadmap-item: BUD-S97
status: Snapshot
---
<!--
STATUS REPORT — BUD-S97, K30 Part B scoped: a stable typed id on every doc, and link resolution
in the docs gate. Tooling + a docs sweep; the gate step itself changed, which is why this gets a
full report. Right-sized per §11: no ADR, no UX spec, no feature spec. One slice, then stop.
-->

# Status Report — 2026-08-03 (`BUD-S97` — stable doc ids + link integrity in the gate)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-03 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S97` — `docs:check` is the gate step whose entire job is documentation integrity, and it had never once checked that a link resolves. Give every doc a stable typed `id`; teach the gate to resolve every link; fix the rot that surfaces. `K30` Part B, deliberately scoped — see §2 |
| Item   | [`03_ROADMAP-v2.md`](../03_ROADMAP.md) §3 · [`KIT_FEEDBACK`](../KIT_FEEDBACK.md) `K30` / `K46` / `K47` |

**Resume here:** **`docs:check` now validates what its name has always implied.** All **214** docs
under `docs/` carry a stable typed `id` (was 23), and the gate resolves **2,318** links — a number
that was **zero** before this slice, over which it reported `OK` for three weeks while **100** links
were broken. **89** of those were written by the checker itself. The bug is fixed at its cause: the
generator now takes its output directory as an input instead of hardcoding `../`, and re-injecting
the old constant reproduces exactly 89 failures. The policy that makes a green gate *possible* —
**doc→doc strict everywhere, doc→code lenient only inside dated records, and printed on every run**
— is written down in [`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4. Verified against **13
injected defects**, not against the green. Gate green: **495 Vitest + 142 e2e**, both exactly at the
floor (this slice adds no runtime code). The work is **uncommitted** — proposed message in §6. Next
item: **`BUD-S94`**, now genuinely unblocked — kickoff prompt in §9.

## 1. What was actually wrong

The scoping note said 100 broken links, 89 self-inflicted. Both numbers reproduce exactly. The
mechanism is worth stating precisely, because it is the reusable lesson:

`check-docs.ts` writes **two** files from **one** set of link-emitting code paths — the artifact
crosswalk (which lives in `docs/reviews/`) and §2 of the roadmap history (which lives in `docs/`).
All three emitters wrote `](../${path})`. That prefix is correct for exactly one of the two
destinations. So every *Done / shipped* row in the history pointed at `docs/../status-reports/…` —
broken on GitHub, broken in every editor — while the same generator's crosswalk rows were fine.

The proof that this was the bug and not a coincidence was already sitting in the file: §1 of the
history, which is **hand-maintained**, contains 41 links written as `](status-reports/…)` — all
correct. §2, generated, contained 89 written as `](../status-reports/…)` — all broken. The human
convention and the machine convention disagreed, and only the machine's was wrong.

The fix is not "delete the `../`". It is that the emitter had no idea which file it was writing
into, so any correction would have been correct by luck:

```ts
const linkTarget = (fromDir: string, p: string): string => (fromDir ? relative(fromDir, p) : p);
// …then at each of the three emit sites, the output file's own dir:
`[${basename(p)}](${linkTarget(CROSSWALK_DIR, p)})`      // docs/reviews/… → "../status-reports/x.md"
`[report](${linkTarget(HIST_DIR, reports.at(-1)!)})`     // docs/…         → "status-reports/x.md"
```

## 2. What "K30 Part B" was taken to mean, and what it wasn't

`K30` Part B says *"the roadmap/specs reference **ids not filenames**, so renaming never cascades."*
Taken literally that means rewriting ~1,900 markdown links into id references plus a render step —
which turns `docs/` into generated output and contradicts **K30's own recorded tradeoff**: *keep the
frontmatter minimal and the prose primary.* The owner scoped it away, and having now seen the corpus
I agree: the safety Part B exists to provide is *"a rename cannot silently break a reference."* A
link check delivers that. Id-references deliver it too, at the cost of making the docs unreadable in
their source form. Links stayed ordinary clickable markdown.

What ids *do* deliver, and why they were still worth 189 edits: an id names the doc rather than its
location. `03_ROADMAP-v2.md` has the id `DOC-ROADMAP` — deliberately not its filename — so when
`BUD-S94` renames it, the id does not move.

**One correction to the scoping note:** it said 24 of 213 docs had an id. It is **23** — 10 ADRs and
13 spikes. The "one process doc" is a YAML *example* inside `00_WAYS_OF_WORKING.md` §4 showing what
frontmatter should look like, not frontmatter itself.

### The id scheme

`type` determines the prefix, one per kind of doc, so an id announces what it is (table in
[`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4). Three judgement calls the corpus forced:

- **`FEAT-*` prose ids are not unique.** `FEAT-UX12` is stated by **four** feature specs (the four
  UX12 threads), and two more specs have a sentence where the id should be. Reusing prose ids alone
  cannot satisfy "ids are unique". The four became `FEAT-UX12a`…`d`, following the convention this
  repo already uses for one item split across sibling specs (`FEAT-014a` / `FEAT-014b`); the two
  §11-compressed notes took the id their prose names (`FEAT-UXR7`, `FEAT-UXR8`).
- **UX specs never had an id of their own** — they cite their feature's (`| Feature | FEAT-011 |`).
  Minting `UX-<feature-id>` collides where one UX spec covers two features (`ux/foundation.md`
  covers `FEAT-001` and `FEAT-002`) and reads absurdly elsewhere (`UX-UX5`). They took `UX-<slug>`.
- **Core docs are named for what they are, not what they're called** — `DOC-ROADMAP`,
  `DOC-ROADMAP-HISTORY`, `DOC-ROADMAP-LEGACY` — precisely so `BUD-S94`'s rename doesn't cascade.

The sweep also surfaced a doc that **no check had ever looked at**: `docs/ux/assets/README.md` had
no frontmatter at all, because every existing check listed specific directories and none of them
recursed. The new id check is the only recursive walk, so it is now the net that catches this — it
reports "no frontmatter" rather than skipping, and that case is in the injected-defect harness.

## 3. The policy question, settled

Status reports are dated snapshots and code moves under them. Eight of the 100 broken links were
historical references to since-refactored paths. Both obvious stances fail:

- **Strict everywhere** → the gate can never be green, and a gate that is permanently red is a gate
  everyone learns to ignore. It also means editing a 2026-06-22 snapshot to chase a 2026-07 refactor
  — falsifying the record the snapshot exists to preserve.
- **Lenient everywhere** → it checks nothing, which is where we started.

The line drawn, and written into [`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4:

1. **Doc→doc links: strict, everywhere, no exception.** Every `.md` in this repo exists, so a broken
   one is always rot — including inside ADRs. Append-only protects the **decision**, not a path that
   was wrong the day it was typed. (`ADR-0003` linked `04_DOMAIN_MODEL.md` from `docs/adr/`, missing
   its `../`. That link never worked, in any state of the tree.)
2. **Doc→code links: strict only in docs that describe the current system** — the core docs, feature
   specs, UX specs. In **dated records** (status reports, spike reports, reviews, ADRs) a link to a
   path outside `docs/` is allowed to have moved.
3. The exception is **never silent**. Every run prints the count and each offending path:

```text
links — 2303 inter-doc links resolve; 5 moved code path(s) in dated records (allowed)
        docs/adr/ADR-0005-frontend-design-system.md: moved → ../../apps/web/src/index.css
        docs/reviews/2026-06-25-ux-uplift-initiative.md: moved → ../../apps/web/src/index.css
        docs/reviews/2026-06-25-ux-uplift-initiative.md: moved → ../../apps/web/src/Dashboard.tsx
        docs/status-reports/2026-06-15-eh5.md: moved → ../../e2e/journey.spec.ts
        docs/status-reports/2026-06-22-r3.md: moved → ../../apps/web/src/Dashboard.tsx
```

That list is a bounded, visible ledger of "the tree moved under a record", not a hole. It is five,
not six, because the sixth was in `features/design-system.md` — a **living** spec, and therefore
strictly checked: it claimed the touch-target floor was "currently in `index.css`", a file deleted
in `e1d54d2` by the very slice that spec describes. It now points at `ui/base.css`, which is where
that rule actually lives.

**Lexical rule for the line-suffix convention:** a trailing `:227` on a target with a file extension
(`api.ts:227`) is prose — a line reference, not part of the filename. It is stripped, then the file
is still resolved. The harness pins both directions: a real file with `:227` passes, a missing one
with `:227` fails. Fenced code is skipped for the same class of reason — a kickoff prompt inside a
status report is sample text, not a live reference (this report's §9 is exactly that case).

## 4. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The deliverable is the gate step itself, run the way anyone runs it: `npm run docs:check`. It goes from `OK`-over-100-broken-links to `OK` that means something, and it now prints what it checked — ids, link count, and the allowed exceptions — rather than a single opaque line. |
| Gate green | ✅ | `typecheck` ✅ (`tsconfig.tools.json` already covers `scripts/**` — `BUD-S95`) · `lint` ✅ · `format` ✅ (prettier rewrote `check-docs.ts` once; re-verified after) · `docs:check` ✅ **214 ids, 2,318 links, 175/175 artifacts + 38 core/review docs, crosswalk + history regenerated** · `test` ✅ **495** · `test:e2e` ✅ **142** |
| Acceptance criteria | ✅ | (1) every doc under `docs/` has a stable typed id — **214/214**; (2) `docs:check` validates ids *and* resolves every inter-doc link — both, with the id check also catching a doc with no frontmatter; (3) the 89-link generator bug and the genuine rot fixed — 89 + 4 strict cases, 5 remaining are policy-allowed and printed. |
| Accessibility | n/a | No user-facing surface. |
| Input validation & secrets | ✅ | No runtime code, no I/O beyond reading the repo's own files, no secrets. Unknown URL schemes deliberately fall through and are resolved as paths (fail loudly) rather than being silently skipped. |
| Docs in the same change | ✅ | [`00_WAYS_OF_WORKING.md`](../00_WAYS_OF_WORKING.md) §4 — the id scheme table and the link-integrity policy, plus a correction: it claimed `templates/` files carry frontmatter; none of the 13 do. [`KIT_FEEDBACK`](../KIT_FEEDBACK.md) — `K30` Part B applied-note, new `K46` (the false-green) and `K47` (templates ship without the frontmatter they document). [`03_ROADMAP-v2.md`](../03_ROADMAP.md) — `BUD-S97` → Done, `BUD-S94` → Ready, §0 state. History §2 regenerated. |
| **Verified against injected defects** | ✅ | 13 cases, §5. Including re-injecting the original bug: **exactly 89** broken-link failures, exit 1. |
| Test-count delta | ⚠ **0 new Vitest/e2e tests** | `scripts/` is in neither Vitest project (`node` = `packages/**` + `apps/api/**`; `web` = `apps/web/**`), so unit-testing the checker's helpers means adding a **third project** to `vitest.workspace.ts` — a structural change to the test harness, outside this slice. Verified by injected defect instead; see §7, where I argue this should not stay deferred forever. |

## 5. The injected-defect harness (K41's rule)

A green gate proves nothing until you have watched it go red for each reason it claims to catch.
Thirteen mutations, each applied to the real tree, checked, and reverted — all 13 behaved:

| # | Injected defect | Result |
| - | --------------- | ------ |
| 0 | none (baseline) | `OK` |
| 1 | rename a status report out from under its inbound links | 7 problems |
| 2 | dangling `.md` link in a living doc (`docs/README.md`) | 1 problem |
| 3 | dangling `.md` link **inside a dated snapshot** — proves doc→doc strictness has no snapshot exemption | 3 problems |
| 4 | code path that moved, in a **living** feature spec | 1 problem |
| 5 | duplicate id across two docs | 1 problem |
| 6 | malformed id (`feat 001`) | 1 problem |
| 7 | id prefix not matching the declared `type` (`SR-` on a feature spec) | 1 problem |
| 8 | doc with the `id` line removed | 1 problem |
| 9 | doc with no frontmatter at all, in the directory no other check walks | 1 problem |
| 10 | `:227` line-suffix on a **real** file | `OK` — the suffix is stripped and the file resolves |
| 11 | `:227` line-suffix on a **missing** file | 1 problem |
| 12 | **the original bug re-injected** — `linkTarget(HIST_DIR, …)` → the old `"../" + …` constant | **89** broken links, exit 1 |

Case 12 is the one that matters: it reproduces the exact defect that shipped green, at the exact
count, which is how we know the fix addresses the cause and the check would have caught it.

## 6. Proposed commit

The work is **uncommitted** for review. **193 files**: `scripts/check-docs.ts`, **191 docs** (189
`id` stamps, plus `ux/assets/README.md` which had no frontmatter at all — the rot repairs, the
process/roadmap/kit-feedback edits and the two regenerated files land on top of those same files),
and this report. The 22 docs left untouched are the ADRs and spikes that already carried an id.

```text
feat(docs): stable typed ids + link integrity in the docs gate (BUD-S97, K30 Part B)
```

Body worth keeping: `docs:check` reported `OK` over 100 broken links, 89 of which it generated
itself — one `](../…)` constant feeding two output files in different directories. The emitter now
takes its output directory as an input. Every doc under `docs/` gains a stable typed `id`
(214/214, prefix per `type`), validated unique, well-formed and type-matching; every inter-doc link
in `docs/**` and the repo-root docs is now resolved (2,318). Policy, recorded in
`00_WAYS_OF_WORKING.md` §4: doc→doc strict everywhere (including ADRs — append-only protects the
decision, not a wrong path), doc→code strict only in docs describing the current system and
permitted-but-printed in dated records, because editing a snapshot to chase a refactor falsifies the
record. Unblocks `BUD-S94`.

## 7. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| **Unit tests for `check-docs.ts`** | Needs a third Vitest project for `scripts/**` — a change to the test harness, not to this slice. The injected-defect harness covers the same ground *today*, but it lives in a scratchpad and dies with this session. **`K45`'s own lesson (validation that survives only as prose rots) argues this should become `scripts/check-docs.selftest.sh` or a Vitest project.** I did not do it because it is a new gate artifact nobody asked for; it is the natural sibling of the `shellcheck` decision below. | open |
| **Anchor targets are not validated** | `file.md#section-that-does-not-exist` passes — the file resolves, the anchor is unchecked. Real rot (headings get renamed), but it needs heading-slug extraction and a GitHub-slug-compat rule, and it would have widened this slice. Named here so the gate's coverage is not overstated: it checks that a **file** resolves. | open |
| **`templates/**` is excluded from the link check** | Kit scaffolds deliberately link to the filenames a *consuming* project will have (`03_ROADMAP-HISTORY.md`, which doesn't exist here — 4 such links). They need their own policy, and `K47` proposes the related fix (ship frontmatter in the templates). | open |
| **`shellcheck` for `scripts/*.sh`** | Unchanged by this slice — still a dependency + gate-step decision (`BUD-S96` §7). | open |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 | Unchanged by this slice; carried forward. | labs-hub SPIKE-03 / owner |

## 8. Commands & gotchas

```bash
npm run docs:check
```

- **No container runtime needed.** colima stayed stopped throughout, so the whole gate is runnable.
- `npm run docs:crosswalk` regenerates **two** files — the crosswalk *and* history §2. After editing
  a plan row's status in `03_ROADMAP-v2.md`, rerun it or `docs:check` fails on a stale ledger.
- **The generator's link prefix is a function of the output file.** If a third generated file is
  ever added, pass its directory to `linkTarget` — do not copy a prefix from an existing call site.
  That is the whole bug, and it is the kind that returns.
- `scripts/check-docs.ts` still **hardcodes both `-v2` roadmap filenames** (`V2`, `HIST`, plus three
  occurrences inside the text it generates). This is `BUD-S94`'s central trap and is unchanged.
- Ids are **stable handles**: `DOC-ROADMAP` is `03_ROADMAP-v2.md`. Do not "fix" an id to match a
  filename — that would reintroduce exactly the cascade `K30` Part B exists to prevent.

## 9. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §4, §9 and §11).
- Read docs/status-reports/2026-08-03-bud-s97-doc-ids-links.md — this report, the newest one.
  Its §8 lists the trap this next item walks into.
- Read the BUD-S94 row in docs/03_ROADMAP-v2.md §3 (all four sub-parts), and scripts/check-docs.ts
  — specifically V2, HIST, and the three `-v2` filenames embedded in the text it GENERATES.

Build EXACTLY ONE item this session: BUD-S94 — retire the legacy roadmap (the v2 cutover).

Why it is finally ready: it has been carried as "Blocked on K30 Part B" through four kickoff
prompts. BUD-S97 landed that (scoped) on 2026-08-03 — every doc now has a stable typed id, and
docs:check resolves all 2,318 inter-doc links, so a rename that breaks a reference FAILS THE GATE
instead of rotting silently. That is the safety the blocker was asking for. Content was never the
blocker: all 88 legacy §4 ids already appear in v2 (verified 2026-08-02).

Scope — four things move together, and doing only the first breaks the gate:
1. The rename: 03_ROADMAP-v2.md → 03_ROADMAP.md and 03_ROADMAP-HISTORY-v2.md →
   03_ROADMAP-HISTORY.md, deleting the superseded 03_ROADMAP.md. Their ids (DOC-ROADMAP,
   DOC-ROADMAP-HISTORY) do NOT change — that is the point of stable ids. DOC-ROADMAP-LEGACY goes
   with the deleted file.
2. scripts/check-docs.ts hardcodes both filenames in V2/HIST *and* in the markdown it generates
   (the crosswalk's Source row, the history's §2 prose). Update all of them, then regenerate with
   `npm run docs:crosswalk` and diff before trusting it.
3. Follow-up D: retarget the remaining LIVE back-links (00_WAYS_OF_WORKING, 01_INTAKE, 02_PRD,
   07_NFR, docs/README tree, CLAUDE.md) — but NOT the ~65 dated status reports, which are
   point-in-time records. The new link check will tell you exactly which links break the moment
   you rename; let it drive the work rather than grepping by hand.
4. Fold `docs:check` into the documented gate/DoD lists (it runs in the gate but appears in no
   prose gate list), and give CLAUDE.md the frontmatter convention + where the roadmap lives.

Watch out for:
- Run `npm run docs:check` immediately after the rename, BEFORE fixing anything. The failure list
  is your worklist, and it is the first real test of whether BUD-S97 actually unblocked this.
- Dated status reports linking the old filename are historical records — do not rewrite them. Note
  that doc→doc links are STRICT even in snapshots (00_WAYS_OF_WORKING §4), so if a snapshot links
  `03_ROADMAP.md` and that file is deleted, you have a genuine conflict between two rules. Decide
  it deliberately and write down the decision; do not silently loosen the checker.
- No container runtime needed — keep colima STOPPED so the whole gate is runnable throughout.
- Ids are stable handles: do NOT rename DOC-ROADMAP to match the new filename.

For CONTEXT only, not for this session — still open:
- Unit tests / a committed self-test for the docs gate (this report §7) — K45's lesson applied to
  the checker itself; currently verified only by a throwaway harness.
- Anchor targets (#section) are still unvalidated by the link check (§7).
- shellcheck for scripts/*.sh is unadopted (BUD-S96 §7) — a dependency + gate-step decision.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- The roadmap says every build track is Done and V1 is in Alpha (review + UAT). This is docs
  housekeeping; it does not move the product.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```
