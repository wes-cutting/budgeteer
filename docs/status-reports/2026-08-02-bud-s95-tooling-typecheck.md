---
id: SR-2026-08-02-bud-s95-tooling-typecheck
type: status-report
roadmap-item: BUD-S95
status: Snapshot
---
<!--
STATUS REPORT — BUD-S95, bringing repo tooling under typecheck (KIT_FEEDBACK K40). Tooling/config
+ type-only fixes; no behaviour change. Right-sized per §11 (trivial-fix row + a report, because the
change is to the GATE ITSELF): no ADR, no UX spec, no feature spec. One slice, then stop.
-->

# Status Report — 2026-08-02 (`BUD-S95` — repo tooling under typecheck)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-02 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S95` — close [`KIT_FEEDBACK` K40](../KIT_FEEDBACK.md): `scripts/**` was in no tsconfig, so `npm run typecheck` reported green over code it had never read. Put it in a project the gate runs, fix what surfaces, and make the one remaining exclusion deliberate. |

**Resume here:** **`npm run typecheck` now covers every `.ts` in the repo except `spikes/**`, and
says so in writing.** A third project, [`tsconfig.tools.json`](../../tsconfig.tools.json), sits
beside `tsconfig.e2e.json` and covers `scripts/**/*.ts` + `vitest.workspace.ts`;
`apps/web/vite.config.ts` joined its own workspace's project. It surfaced **19 real type errors**
in the two previously-unchecked scripts — every fix type-only, no behaviour changed. Gate green:
**495 Vitest + 142 e2e**, both at the floor (this slice adds no tests — see §4 for why, and for what
stands in). The work is **uncommitted** — proposed message in §6. Next item: **`BUD-S96`** — a
`validate-demo.sh` sibling; kickoff prompt in §9.

## 1. The brief was right about the hole and wrong about its shape

The standing note — carried in two kickoff prompts — was that `scripts/check-docs.ts`,
`scripts/capture-demo-assets.ts` **and** `apps/api/scripts/build.ts` were all outside `tsc`, the
third being the alarming one because it builds the production image. The first thing this slice did
was check that, and **`build.ts` was already covered**: `apps/api/tsconfig.json` has
`"include": ["src", "test", "scripts"]`, and `tsc -p apps/api --listFiles` lists it. The claim had
been repeated twice without ever being tested in either direction.

That is the finding worth keeping, and it is now K40's remedy **(a)**: a tsconfig's coverage is its
`include` list, nothing reports the complement, so the only honest audit is mechanical — every `.ts`
in the repo, diffed against `tsc --listFiles` per project. Run once, it disproved the `build.ts`
claim *and* found two holes nobody had named:

| File | Covered before? | Now |
| ---- | --------------- | --- |
| `scripts/check-docs.ts` | ❌ no project | `tsconfig.tools.json` |
| `scripts/capture-demo-assets.ts` | ❌ no project | `tsconfig.tools.json` |
| `vitest.workspace.ts` | ❌ no project — **not previously named** | `tsconfig.tools.json` |
| `apps/web/vite.config.ts` | ❌ workspace included only `src` — **not previously named** | `apps/web/tsconfig.json` |
| `apps/api/scripts/build.ts` | ✅ **already covered** — the brief was wrong | unchanged |
| `spikes/**` | ❌ | ❌ **deliberately**, and now in writing |

## 2. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **A third typecheck project** | `scripts/**/*.ts` + `vitest.workspace.ts`. `types: ["node"]`, no DOM lib — everything in it runs under `tsx`/Vitest on Node, and the Playwright calls in the capture script never cross into the browser (the contrast with `tsconfig.e2e.json`, which needs DOM for `page.evaluate` callbacks, is written into the file so the next person doesn't copy the wrong one). | [`tsconfig.tools.json`](../../tsconfig.tools.json) |
| **Wired into the gate** | `typecheck` is now `--workspaces` → `tsconfig.e2e.json` → `tsconfig.tools.json`. CI needs no change: [`gate.yml`](../../.github/workflows/gate.yml) runs `npm run typecheck`, so it picked this up for free. | [`package.json`](../../package.json) |
| **`vite.config.ts` went to its owner, not to the tools project** | It is `apps/web`'s file and belongs in `apps/web`'s program, where it already has the right `lib` and `types`. Putting it in a root "tools" bucket would have been the tidy-looking wrong answer. | [`apps/web/tsconfig.json`](../../apps/web/tsconfig.json) |
| **19 type errors fixed — all one error** | Every single one was `noUncheckedIndexedAccess`: `RegExpExecArray` groups and `split()[0]`, which a reader knows are present and `tsc` types as `T \| undefined`. Fixes use the `?? fallback` idiom the checked half of the repo already uses (`apps/api/src/http/server.ts:167` is the same `split()[0]` case), so no `!` and no `any` were needed — the ban in [`CLAUDE.md`](../../CLAUDE.md) held without a fight. | [`scripts/check-docs.ts`](../../scripts/check-docs.ts) · [`scripts/capture-demo-assets.ts`](../../scripts/capture-demo-assets.ts) |
| **The exclusion is now a statement** | `spikes/**` stays out: throwaway by definition ([`00_WAYS_OF_WORKING`](../00_WAYS_OF_WORKING.md) §6), carrying its own per-spike tsconfig, and already ESLint-ignored for the same reason. K40 asked for coverage **or** a written reason; this is the written reason, in the tsconfig and in the README. | [`tsconfig.tools.json`](../../tsconfig.tools.json) |
| **Docs, same change** | `README` scripts table (what `typecheck` actually runs, and the one exclusion); `TESTING_STRATEGY` §3 (a typecheck step's coverage is its `include` list — the sibling of §5's "a scan suite's coverage is its list of surfaces"); `KIT_FEEDBACK` K40 (reference implementation + the two lessons); roadmap `§0` + `§2` + the `BUD-S95` row. | — |

## 3. The fixes, and why none of them changed behaviour

The scope said to stop and flag anything that would change what a script *does*. Nothing did — every
one of the 19 was a place where an index is provably in range and `tsc` cannot see it:

| Where | The read | Why the fallback can never fire |
| ----- | -------- | ------------------------------- |
| `check-docs.ts` `parseFrontmatter` | `m[1]` / `m[2]` from `/^([\w-]+):\s*(.+)$/` | Both groups are non-optional; if `exec` matched, both are strings. Rewritten as an explicit `undefined` guard that `continue`s — the same skip the `if (!m)` already did. |
| `check-docs.ts` `parseV2` | `c[0]`…`c[4]` after `c.length >= 5` | `split()` never leaves holes, so `length >= 5` *was* the narrowing — restated per-cell so the compiler can see it. Same five cells, same predicate. |
| `check-docs.ts` `idSort` | `m[1]` used as an object key | `?? ""` falls through to the existing `?? 9` default, which is what an unrecognized letter already got. |
| `check-docs.ts` `kindOf` | `p.split("/")[0]` | Always ≥ 1 element. `?? p` mirrors `http/server.ts:167`. One fix, three errors. |
| `capture-demo-assets.ts` | `toISOString()…split(".")[0]`, `header.split(";")[0]` | Both always ≥ 1 element. The cookie case falls back to the whole header, which then fails the existing `separator < 1` check and throws the message it already threw. |

## 4. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The deliverable *is* the gate step, so it was checked the way `BUD-S91` checked its axe scans — **against an injected defect, with the counterfactual run too.** `const injectedDefect: number = "nope"` appended to `check-docs.ts`: the **new** gate exits **2**, naming `scripts/check-docs.ts(398,7): error TS2322`; the **old** gate (`--workspaces` + `tsconfig.e2e.json`, exactly what shipped before this slice) exits **0** on the same file. Defect removed; `npm run typecheck` back to **0** and `git diff` shows only the real fixes. That pair is the whole claim: the step now catches what it demonstrably did not catch yesterday. |
| Gate green | ✅ **on the second e2e run — see the row below** | `typecheck` ✅ (now three projects) · `lint` ✅ · `format` ✅ · `docs:check` ✅ **173/173 artifacts + 38 core/review docs, crosswalk regenerated** · `test` ✅ **495/495** · `test:e2e` ✅ **142/142** (exit 0). Run with colima stopped and no dev stack up (all four e2e ports confirmed free first). |
| ⚠ **The first e2e run failed 1/142** | ⚠ pre-existing flake, **not this slice** | Recorded rather than quietly re-run, because "green on the retry" is exactly the sentence that hides a real defect. `a11y.spec.ts:722` *archive confirm dialog … dark mode (UX12)* failed: the success toast from the preceding `createEnvelope` helper still covered the page, and Playwright's actionability check reported *"`<li class="_toast_…">` … intercepts pointer events"* against the `Archive {name}` button. **A race in the test, not in the app** — [`e2e/setup.ts:60`](../../e2e/setup.ts) waits for the new row to appear but not for the toast to clear, so the click lands during the toast's dwell. Ruled out as mine on three grounds: this slice touches **no** app code and **no** e2e code (`git diff --stat` is tsconfig/package.json/two scripts/docs); the test passed **3/3** re-run in isolation; and the full suite then passed **142/142**. It is the same family as the flakes carried in the `UXR2`/`UXR4` reports. Left unfixed deliberately — see §7. |
| Acceptance criteria & UX states | ✅ | No UI. The acceptance criterion is K40's own wording — every `.ts` covered or the exclusion written down — and §1's table is the audit that answers it. |
| Accessibility | n/a | No user-facing surface. |
| Input validation & secrets | ✅ | No new I/O, no new inputs, no secrets touched. The two edited scripts read the same files and throw the same errors. |
| Docs in the same change | ✅ | Four hand-edited (`README` · `TESTING_STRATEGY` · `KIT_FEEDBACK` · `03_ROADMAP-v2`, the last in three places: §0, §2 and the `BUD-S95` row), plus two regenerated by `docs:crosswalk` (the crosswalk and history §2) and this report. |
| **No behaviour change** | ✅ | The strongest available proof, and the one that mattered: `check-docs.ts` **is** the docs gate, so a bad "fix" could silently change which docs pass. Immediately after the edits — before any doc in this slice was written — `npm run docs:crosswalk` regenerated the crosswalk **and** history §2 **byte-identical** to the committed files (`git status docs/` came back empty), on the same 172/172 + 38 it reported before. The 173/173 above is this report itself joining the set afterwards. |
| Test-count delta | ⚠ **0 new tests, deliberately** | There is no unit test to write for "this file is in a tsconfig" — the assertion is the gate step itself, which now runs on every slice, and the injected-error check above is what verified it fails when it should. The byte-identical regeneration is the behaviour-preservation test. Recorded as ⚠ rather than ✅ so the zero is visible as a choice. |

## 5. What this does *not* buy

Worth being plain, because "scripts are typechecked now" invites more confidence than it earns:

- **`capture-demo-assets.ts` is still unexercised.** It typechecks; nothing runs it in the gate. It
  needs a web dev server on `:5173` and a free `:3001`, so it never will. A type error is caught now;
  a broken selector is still caught by a human running `npm run capture:demo` and looking.
- **`noUncheckedIndexedAccess` is the only strict flag that had anything to say here.** That both
  scripts were otherwise clean is mild evidence they were written carefully, not evidence that
  typecheck-in-the-gate was low value — the value is on the *next* edit to them, not this one.
- **The two shell scripts in `scripts/` (`demo-instance.sh`, `validate-deploy.sh`) remain outside
  every static check**, as they were. `shellcheck` is not in the toolchain and adding it was not in
  scope; noted here rather than left implied by "scripts/ is covered".

## 6. Proposed commit

The work is **uncommitted** for review.

```text
build(typecheck): bring repo tooling under tsc (BUD-S95, K40)
```

Body worth keeping: adds `tsconfig.tools.json` (`scripts/**` + `vitest.workspace.ts`) to
`npm run typecheck` and folds `vite.config.ts` into the web workspace's project, closing K40 — every
`.ts` in the repo is now typechecked except `spikes/**`, which is excluded deliberately and in
writing. Surfaced and fixed 19 `noUncheckedIndexedAccess` errors in `check-docs.ts` and
`capture-demo-assets.ts`; all type-only, proven behaviour-preserving by the docs crosswalk
regenerating byte-identical. `apps/api/scripts/build.ts` was already covered, contrary to the
standing note.

## 7. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| No automated test for the demo profile (`BUD-S93` §6) | Unchanged by this slice — still the obvious next item, and now the only one of its kind left. A `validate-demo.sh` sibling to `validate-deploy.sh`; the two harnesses cannot run together, and neither with e2e. Given a roadmap id and a row this session (**`BUD-S96`**, roadmap §2 + BUD-E14) so the next report has something to declare in its frontmatter — the plan, not the build. | open — **proposed next**, §9 |
| `shellcheck` for `scripts/*.sh` | The natural sibling to this slice, and genuinely out of its scope: a new dev dependency and a new gate step, for two scripts that are exercised end-to-end by hand today. Worth a decision, not an assumption. | open |
| **The toast-vs-click e2e flake** (§4) | Not fixed here on purpose: this slice deliberately changes no app or e2e code, and the honest fix touches a shared helper every spec uses — `createEnvelope`/`createAccount` should wait for the toast to clear (or the suite should dismiss toasts between actions) rather than each caller guessing. That is a small stabilization slice with its own blast radius, not a drive-by edit inside a typecheck change. [`TESTING_STRATEGY`](../TESTING_STRATEGY.md) §4 says flaky tests are bugs to fix or track — **this is the tracking**, and it now names a cause and a location instead of "watch it", which is where the `UXR2`/`UXR4` carries stalled. | open |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 · `BUD-S94` | Unchanged by this slice; carried forward. | labs-hub SPIKE-03 / owner |

## 8. Commands & gotchas

```bash
npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test && npm run test:e2e
```

- `npm run typecheck` is now **three** things, not one — a workspace loop plus two root projects.
  Adding a `.ts` outside `apps/`, `packages/`, `e2e/` and `scripts/` puts it in no project again;
  the audit in §1 is how you'd find out.
- Prettier formats `tsconfig.tools.json` as JSONC, so the explanatory comments survive `npm run
  format`. Don't strip them — the `spikes/**` reason is what makes the exclusion deliberate rather
  than an omission, which is the whole point of K40.
- Unchanged from before: `colima stop` **before** e2e; stop the dev stack (`3001`/`5173`, it
  respawns); the e2e harness binds **four** ports (`3001`/`5173` + `3002`/`5174`); never run the
  deploy harness (`:3099`) or the demo box (`:3010`) alongside e2e.

## 9. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-bud-s95-tooling-typecheck.md — the newest report.
- Read docs/status-reports/2026-08-02-bud-s93-demo-instance.md §4 and §6, and
  scripts/validate-deploy.sh + scripts/demo-instance.sh + deploy/compose.demo.yaml.

Build EXACTLY ONE item this session: BUD-S96 — scripts/validate-demo.sh, a harness that pins the
demo profile the way validate-deploy.sh pins the production one.

Why it matters: BUD-S93 shipped the demo box and validated it thoroughly — seeded data served, the
documented credential signs in, refresh re-pristines a dirtied box, teardown leaves nothing — but
every one of those checks was run BY HAND and survives only as prose in that report's §4. The demo
box is what gets handed to people; the next change to compose.demo.yaml or demo-instance.sh has
nothing to catch it. validate-deploy.sh already exists as the shape to copy.

Scope: a shell harness that stands up the demo stack on its own port, asserts the §4 checks that can
be automated (seeded counts, the documented credential, default-deny on anonymous /api/accounts and
/api/export, project/volume isolation, refresh re-pristines AND revokes the prior session, purge
leaves nothing), and tears down. It is a local tool, not a gate step — do not wire it into
`npm test` or gate.yml. If a check cannot be automated cheaply, leave it out and say so in the
report rather than writing a flaky one.

Right-size it (00_WAYS_OF_WORKING §11): tooling, no ADR, no UX spec, no feature spec. A status
report is expected. It needs a real container runtime, so this is a colima session.

For CONTEXT only, not for this session — still open:
- shellcheck for scripts/*.sh is unadopted (BUD-S95 §7) — a dependency + gate-step decision.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- BUD-S94 (retire the legacy roadmap) is still blocked on KIT_FEEDBACK K30 Part B.

Watch out for:
- This item NEEDS colima running — and that makes it mutually exclusive with e2e. Build and verify
  the harness first, then `colima stop` and run the full gate. Never run validate-demo.sh,
  validate-deploy.sh (:3099) and e2e at the same time.
- The e2e harness binds FOUR ports — 3001/5173 and 3002/5174. The demo box is :3010. Pick a port
  for the new harness that collides with none of them.
- `up` and `refresh` need a repo checkout (seedDemo is deliberately NOT in the production image,
  BUD-S93 §2) — the harness cannot assume a toolchain-free box for those two steps.
- scripts/check-docs.ts hardcodes both `-v2` roadmap filenames; do not rename those files here.
- Any new .ts file must land inside a tsconfig project — root-level ones need adding to
  tsconfig.tools.json explicitly (BUD-S95 §8).

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```
