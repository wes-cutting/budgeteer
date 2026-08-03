---
type: status-report
roadmap-item: BUD-S96
status: Snapshot
---
<!--
STATUS REPORT — BUD-S96, a validation harness for the demo profile. Tooling; one new shell script
plus a one-line seam in demo-instance.sh. Right-sized per §11 (CLI/no user-facing surface + a
report, because the deliverable is an assertion about a thing we hand to people): no ADR, no UX
spec, no feature spec. One slice, then stop.
-->

# Status Report — 2026-08-02 (`BUD-S96` — pinning the demo profile)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-02 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S96` — `BUD-S93` validated the demo box thoroughly and **by hand**; the checks survived only as prose in that report's §4, so the next edit to `compose.demo.yaml` or `demo-instance.sh` had nothing to catch it. Make that report executable. |

**Resume here:** **`./scripts/validate-demo.sh` is `BUD-S93` §4, executable — 47 checks green.** It
stands the demo stack up in its own compose project on `:3098`/`:5435`, with per-run secrets in a
temp file, and leaves the host exactly as it found it. It **drives the real
[`demo-instance.sh`](../../scripts/demo-instance.sh)** rather than a copy of it, which cost one
deliberate seam in that script (an overridable `ENV_FILE`) and is the whole reason a `refresh`
regression is now catchable. The most valuable checks — the isolation claims — need **no container
at all**: they read `docker compose config` with a hostile environment exported. Three load-bearing
checks were verified against **injected defects**, so none is vacuously green. It is **not** wired
into `npm test` or `gate.yml`, as scoped. Gate green: **495 Vitest + 142 e2e**, both at the floor.
The work is **uncommitted** — proposed message in §6. Next item: **`shellcheck` for `scripts/*.sh`**
— kickoff prompt in §9.

## 1. The shape that mattered: two tiers, and the cheap one is the important one

The obvious reading of the scope is "stand the box up and assert things about it". Following that
literally would have produced a harness whose every check needs a build, a `up`, and a seed — and
whose most important claims (the demo box cannot reach the household's ledger) would have been the
*hardest* ones to write.

They turn out to be the easiest. `docker compose config` renders the whole stack as JSON **without
starting anything**, so each isolation claim is one command with a deliberately hostile environment
exported:

| Claim (`BUD-S93` §1, "structural, not conventional") | How it is asserted |
| ---------------------------------------------------- | ------------------ |
| The project name is pinned **in the file** | render with `COMPOSE_PROJECT_NAME` unset → `budgeteer-demo` |
| …and that matters because | **the counterfactual**: the production stack, unpinned, renders as project `deploy` — the name the demo stack would also have taken, in the same directory, sharing containers and volumes |
| `DATABASE_URL` cannot be redirected | render with `DATABASE_URL=postgres://real:real@household-db:…` exported → still `@db:5432` |
| `SESSION_SECRET` cannot be inherited | render with `SESSION_SECRET=the-real-production-signing-key` exported → still this run's demo secret |
| The stack fails **by name** without its secrets | render with each missing → exit 1, message naming `DEMO_POSTGRES_PASSWORD` / `DEMO_SESSION_SECRET` |
| Same image and tag as production (K43 point 1) | both configs rendered with `BUDGETEER_IMAGE` unset → identical |
| The two deliberate deviations (`DEPLOY_CONTRACT` §10) | db port `host_ip` is `127.0.0.1`; `SESSION_COOKIE_SECURE` is `false` here and `true` in production |

That is 12 of the 47 checks, they run in about two seconds, and they are the ones standing between a
demo box and the household's real ledger. The live tier — health, seeded shape, the published
credential, default-deny, network/volume scoping, dirty→`refresh`, `down --purge` — is the slow and
fragile half, and it guards the less severe failure.

## 2. It drives the real script, which cost one seam

`refresh` re-pristining a dirtied box is a property of **`demo-instance.sh`**, not of the compose
file. A harness that re-ran the underlying commands itself would have pinned its own copy of the
procedure while the real script rotted beside it — the failure mode is that `demo-instance.sh` loses
a step and the harness stays green.

So the harness shells out to `./scripts/demo-instance.sh up|refresh|down --purge`. That required the
script to be runnable against something other than the operator's box, and its `ENV_FILE` was a
constant:

```diff
-ENV_FILE="deploy/.env.demo"
+ENV_FILE="${BUDGETEER_DEMO_ENV_FILE:-deploy/.env.demo}"
```

One line, plus the comment saying who it is for. It is the **only** change to shipped behaviour in
this slice, and the default is unchanged. With it the harness writes its own env file (`mktemp`, mode
600, deleted on exit) holding per-run secrets and its own ports, and exports
`COMPOSE_PROJECT_NAME=budgeteer-demo-validate`.

**That override is load-bearing enough to be a precondition, not an assumption.** `compose.demo.yaml`
pins `name: budgeteer-demo` inside the file; `COMPOSE_PROJECT_NAME` outranks it (verified against the
real CLI: Compose's documented precedence is `-p` → env var → `name:` → directory). If it ever did
*not*, every command in the harness would be operating on the operator's demo box — and the last one
is `down --volumes`. So the harness re-reads the effective project name from the rendered config and
**refuses to continue** unless it is the validate one, before anything destructive runs.

## 3. What it asserts, and the three defects that prove it isn't vacuous

47 checks. The live tier follows `BUD-S93` §4 row for row: `/api/health` reports the database ·
4 accounts / 22 envelopes / 8 recurring rules / 3 templates · a named synthetic payee is present ·
anonymous `/api/accounts` and `/api/export` → `401` and a claimed box → `409` · the published
`demo` / `demo-budgeteer` signs in **and** its session serves the ledger over HTTP · the app sits on
exactly one network, that network and the single volume belong to this project, and `db` inside the
container resolves to this project's database IP.

Then the part `BUD-S93` had to do by hand — dirty the box the way a showing dirties it (a stray
`Left By A Viewer` envelope; the password changed through `POST /api/users/:id/reset-password`;
confirm the published credential now `401`s), take the session a viewer would be holding, run
`refresh`, and assert: stray envelope gone, counts back, published credential `200` again, **the
viewer's session `401`**, still exactly one user. Then `down --purge` and assert nothing of the
project survives — and, separately, that **every container and volume that existed on the host before
the run still exists after it**.

A green harness proves nothing on its own, so each of the three load-bearing checks was run against
the defect it exists to catch (`BUD-S95` and K41's discipline):

| Injected defect | Result |
| --------------- | ------ |
| Comment out `name: budgeteer-demo` in `compose.demo.yaml` | `FAIL: the demo stack pins its own compose project inside the file — expected 'budgeteer-demo', got 'deploy'` |
| Change `DATABASE_URL:` to `${DATABASE_URL:-…}` (interpolate it from the environment) | `FAIL: an exported DATABASE_URL cannot aim the demo box at another database — … got 'postgres://real:real@household-db:5432/budgeteer'` |
| Delete `ensure_credential` from `cmd_refresh` in `demo-instance.sh` | `FAIL: the published credential works again — expected '200', got '401'` |

All three restored; `git diff` clean afterwards. The third is the one that matters most for the
choice in §2 — it is a regression in the *operator script*, and only a harness that drives that
script can see it.

## 4. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The deliverable is one command, and it was run as an operator would run it — `./scripts/validate-demo.sh` with no arguments, building the ARM64 image from this checkout: **`PASS — 47 demo-profile checks green`**. Run four times in total (two debug, one injected-defect trio, one clean default-path run), consistently 47. |
| Gate green | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ **174/174 artifacts + 38 core/review docs, crosswalk regenerated** · `test` ✅ **495/495** · `test:e2e` ✅ **142/142**. Run with colima stopped and no dev stack up (all seven ports — the four e2e ones plus the three harness lanes — confirmed free first). Worth recording: e2e passed **on the first run**, where `BUD-S95` needed a retry for the toast-vs-click flake. That flake was fixed after `BUD-S95` by `b2ee522` (K44) and this is the first full-suite run since; nothing in this slice touches app or e2e code. |
| Acceptance criteria & UX states | ✅ | The acceptance criterion is the scope's own list, and every item on it is a named check: seeded counts ✅ · the documented credential ✅ · default-deny on anonymous `/api/accounts` and `/api/export` ✅ · project/volume isolation ✅ · `refresh` re-pristines **and** revokes the prior session ✅ · purge leaves nothing ✅. One item on the list is deliberately absent — §5. Operator-facing states: missing runtime, missing `jq`/`npm`/`node_modules`, and a busy port each fail with a named message before anything starts. |
| Accessibility | n/a | No user-facing surface. |
| Input validation & secrets | ✅ | Per-run secrets from `openssl`, written to a `mktemp` file at mode 600 and deleted on exit — **never** to `deploy/`, and the operator's `deploy/.env.demo` is not read, written, or moved aside (confirmed by mtime, unchanged at `14:33` across every run). No secret is echoed. The one credential in the script is the published demo one, which `DEPLOY_CONTRACT` §10 already prints. |
| Docs in the same change | ✅ | `README` (the demo-instance section now names the harness and its lane), `DEPLOY_CONTRACT` §10 (a new *What pins all of the above* subsection), `KIT_FEEDBACK` **K45**, roadmap `§0` + the `BUD-S96` row, plus the regenerated crosswalk and this report. |
| **Leaves nothing behind** | ✅ | The property this harness has to have, so it is asserted rather than asserted-in-prose: containers and volumes are snapshotted before the run and diffed after, and the pre-existing `budgeteer` project (a different checkout, its own `budgeteer_budgeteer-pgdata` volume, still running) was untouched across all four runs. Confirmed independently with `docker volume ls` afterwards. |
| Test-count delta | ⚠ **0 new Vitest/e2e tests, deliberately** | The deliverable is a harness that **cannot** live in the gate — it needs a container runtime, which makes it mutually exclusive with e2e (the same constraint `validate-deploy.sh` has). Its 47 checks are the tests; the injected-defect trio in §3 is what verified they fail when they should. Recorded as ⚠ so the zero is visible as a choice, not an omission. |

## 5. What was left out, and why

- **The exact transaction count is not asserted, and this is the one place a naive harness goes
  flaky.** `BUD-S93` §4 recorded "220 transactions". That number is an artifact of the day it was
  observed: `seedDemo` anchors its window on *today* (`todayStr` → `toISOString()`, so **UTC**, not
  local), giving six full prior months plus the current month through today. Asserting `220` would
  be exactly the relative-date fixture [`TESTING_STRATEGY`](../TESTING_STRATEGY.md) §4 names as a
  smell. Instead: the four counts that *are* constants in `seedDemo.ts` are asserted exactly, the
  transaction count gets a floor (**221 ≥ 120** on this run), and the exact number is pinned
  **relatively** — the same count before and after `refresh`, since the seed is deterministic for a
  given day. That comparison is itself guarded on the run not straddling UTC midnight; if it does,
  the check degrades to the floor and says so, rather than failing for a reason that is not a defect.
- **No browser.** `BUD-S93` typed the credential into a real browser and looked at the dashboard.
  This harness asserts the credential over HTTP and that the session returns the seeded accounts.
  Driving Chromium here would mean a second Playwright surface outside the e2e suite, for a box the
  e2e suite is forbidden from running alongside. The rendering claim stays a human check.
- **No LAN-reachability check.** `DEPLOY_CONTRACT` §10 says the db port is reachable from the seeding
  machine and nothing else. The harness asserts the *binding* (`host_ip` is `127.0.0.1`) statically,
  which is the assertable half; proving unreachability from another host needs another host.
- **`shellcheck` still does not run over any of this.** This slice adds a third shell script to
  `scripts/`, which makes the gap from `BUD-S95` §5 one script wider. Named again in §7.

## 6. Proposed commit

The work is **uncommitted** for review.

```text
test(deploy): pin the demo profile with a validation harness (BUD-S96)
```

Body worth keeping: adds `scripts/validate-demo.sh` — 47 checks over `deploy/compose.demo.yaml` and
`scripts/demo-instance.sh`, in its own compose project on `:3098`/`:5435`, torn down on exit, making
`BUD-S93` §4's hand-run validation executable. The isolation claims are asserted statically from
`docker compose config` under a hostile environment, with no container started. The harness drives
`demo-instance.sh` itself rather than a copy of it, which needed one seam in that script (an
overridable `BUDGETEER_DEMO_ENV_FILE`) so a run can never reach a demo box on `:3010`. A local tool,
not a gate step: it needs a container runtime and is mutually exclusive with e2e.

## 7. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| **`shellcheck` for `scripts/*.sh`** | Unchanged by this slice except that it now covers **three** shell scripts instead of two, and the newest is ~390 lines of `set -euo pipefail` with command substitution in every check — the kind of file `shellcheck` is for. Still a real decision, not an assumption: a new dev dependency and a new gate step. It is the last open item of its kind and nothing blocks it. | open — **proposed next**, §9 |
| The browser / LAN-reachability / exact-count gaps | §5, each with its reason. | open |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 · `BUD-S94` | Unchanged by this slice; carried forward. | labs-hub SPIKE-03 / owner |

## 8. Commands & gotchas

```bash
./scripts/validate-demo.sh
npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test && npm run test:e2e
```

- **Needs a container runtime** (`colima start`), which is precisely why it is not in the gate. Run
  `colima stop` before e2e.
- **Three harness lanes, none of which may overlap:** `:3099` deploy (`validate-deploy.sh`),
  `:3098`/`:5435` demo (`validate-demo.sh`), `:3010`/`:5434` the demo box itself. e2e binds four
  ports — `3001`/`5173` and `3002`/`5174`. Never run two of these at once; the harness warns if it
  sees a listener on any e2e port, and hard-fails if its own two are taken.
- `BUDGETEER_IMAGE=<tag>` skips the build and uses that image — much faster on a rerun, and the way
  to point the harness at a published GHCR image instead of this checkout.
- It needs `jq` (the static checks parse `docker compose config --format json`) and, for the two
  seeding steps, `npm` + `node_modules` — `seedDemo` is deliberately not in the production image
  (`BUD-S93` §2). All four are checked in preflight with a named message.
- **Do not set `BUDGETEER_DEMO_ENV_FILE` by hand.** It exists for this harness; an operator always
  wants `deploy/.env.demo`.

## 9. Next-session kickoff prompt

> **Redirected 2026-08-02, after this report was committed (`e5ae4aa`).** The owner reviewed the
> proposal below and chose a different next item: **`BUD-S97`** — `K30` Part B, scoped to *stable doc
> ids + link integrity in the gate*. Scoping it surfaced a live defect that makes it the stronger
> call: **`docs:check` reports `OK` over 100 broken links, 89 of which `check-docs.ts` generates
> itself.** The shellcheck prompt is kept below, unedited, as the record of what was proposed; the
> **live** kickoff prompt is §9a. `shellcheck` stays open in §7.

### 9a. Next-session kickoff prompt (live)

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-bud-s96-validate-demo.md §9 — this report, the newest one.
- Read docs/KIT_FEEDBACK.md K30 (both parts, and its recorded tradeoff), and the BUD-S97 and
  BUD-S94 rows in docs/03_ROADMAP-v2.md.
- Read scripts/check-docs.ts in full — you are extending it, and it is the source of the defect.

Build EXACTLY ONE item this session: BUD-S97 — stable doc ids + link integrity in the docs gate.

Why it matters: docs:check is the gate step whose whole job is documentation integrity, and it has
never once checked that a link resolves. Measured 2026-08-02: 100 broken links across docs/, and
**89 of them are generated by check-docs.ts itself** — it emits `](../${path})` at three sites
(lines ~192, ~213, ~302), which is correct for the crosswalk in docs/reviews/ and wrong for
03_ROADMAP-HISTORY-v2.md in docs/. Every "Done / shipped" report link in the roadmap history is
broken on GitHub, and the gate says OK. This is the same shape as K40 (typecheck green over code it
never read) and K41 (axe green over unscanned pages): a gate's coverage is the set of properties it
checks. It also unblocks BUD-S94, which has ridden three kickoff prompts as "blocked on K30 Part B"
without the claim ever being re-examined.

Scope — the OWNER PICKED THIS SHAPE, do not widen it:
1. Every doc under docs/ gets a stable typed `id` in frontmatter (24 of 213 have one today: ADRs,
   spikes, one process doc). Reuse the ids the prose already uses (FEAT-*, UX-*, ADR-*, SPIKE-*);
   status reports use date+slug per 00_WAYS_OF_WORKING §4.
2. check-docs.ts validates: ids unique and well-formed, AND every inter-doc link resolves.
3. Fix the 89-link generator bug and the ~11 genuine rot cases.
This is deliberately NOT K30's literal "reference ids not filenames" — links stay ordinary
clickable markdown. Rewriting ~1,900 links into id refs with a render step would make docs/
generated output and contradicts K30's own recorded tradeoff ("keep the frontmatter minimal and the
prose primary"). If you think that reading is required, STOP and flag it rather than widening.

The one policy question the slice must settle, in writing: status reports are dated SNAPSHOTS and
code moves under them. 8 of the 100 broken links are historical refs to since-refactored paths
(apps/web/src/index.css, Dashboard.tsx, e2e/journey.spec.ts). Editing a 2026-06-22 snapshot to
chase a refactor falsifies the record; leaving it red means the gate can never be green. Pick a
stance — e.g. strict on .md→.md everywhere, lenient (or explicitly escaped) on code paths inside
status-reports/ — and write down why. Also needs a lexical rule for the `path.ts:227` line-suffix
convention, which is prose, not a filename (2 instances).

Right-size it (00_WAYS_OF_WORKING §11): tooling + a docs sweep, no ADR, no UX spec, no feature
spec. A status report is expected — this touches the gate itself. Expect the id sweep across ~189
docs to be mechanical; expect the policy question above to be the only real decision.

For CONTEXT only, not for this session — still open:
- shellcheck for scripts/*.sh is unadopted (BUD-S96 §7) — a dependency + gate-step decision.
- BUD-S94 (retire the legacy roadmap) becomes genuinely unblocked once this lands. Do NOT also do
  it this session; it is its own slice, and check-docs.ts hardcodes both `-v2` filenames.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- The roadmap says every build track is Done and V1 is in Alpha (review + UAT). This is tooling;
  it does not move the product.

Watch out for:
- No container runtime needed — keep colima STOPPED so the whole gate is runnable throughout.
- check-docs.ts GENERATES text containing links (the crosswalk and history §2). Fixing the prefix
  bug means the generator must know which file it is writing into. Regenerate and diff before
  trusting it, and verify the fix against the real files rather than reasoning about the globs.
- Verify the new link check FAILS on an injected defect (rename a doc, point a link at nothing)
  before trusting the green — K41's rule, applied in BUD-S91/S95/S96.
- Any new .ts file must land inside a tsconfig project — root-level ones need adding to
  tsconfig.tools.json explicitly (BUD-S95 §8).
- scripts/check-docs.ts hardcodes both `-v2` roadmap filenames; do not rename those files here.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```

### 9b. Superseded proposal — shellcheck (kept as the record)

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-bud-s96-validate-demo.md — the newest report.
- Read all three of scripts/*.sh, plus package.json's script block and eslint.config.js.

Build EXACTLY ONE item this session: adopt shellcheck for scripts/*.sh — or decide, with reasons,
not to. Give it a roadmap id (next free BUD-S id) and a row before you build.

Why it matters: scripts/ now holds THREE shell scripts — demo-instance.sh, validate-deploy.sh and
validate-demo.sh — totalling ~830 lines that drive docker, compose and psql, and NO static check of
any kind runs over them. BUD-S95 brought every .ts in the repo under tsc and explicitly recorded
this as the sibling gap it did not close (§5). The scripts are exercised end-to-end by hand, on a
box with a container runtime, which is exactly the coverage profile that makes a linter worth
having: a quoting bug in a teardown path is found by it deleting the wrong thing.

Scope: decide whether shellcheck earns a place — it is a new dev dependency AND a new gate step, and
unlike the TypeScript projects it needs a non-npm binary unless run via a wrapper, which is the real
question (how does CI get it, how does a contributor get it). If yes: wire it, fix what it surfaces,
keep the gate green, and document it in the README scripts table + TESTING_STRATEGY §3. If no: write
down why, in KIT_FEEDBACK, and close the item rather than leaving it open a fourth time. Expect real
findings — unchecked shell accumulates unquoted expansions, and `set -euo pipefail` hides some of
them rather than catching them.

Right-size it (00_WAYS_OF_WORKING §11): tooling, no ADR, no UX spec, no feature spec. A status
report is expected — this touches the gate itself.

For CONTEXT only, not for this session — still open:
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- BUD-S94 (retire the legacy roadmap) is still blocked on KIT_FEEDBACK K30 Part B.
- validate-demo.sh's remaining gaps (no browser, no LAN-reachability proof) are recorded in
  BUD-S96 §5 as choices, not oversights.

Watch out for:
- This item does NOT need a container runtime, so keep colima STOPPED and the gate is runnable
  throughout. Do not run validate-demo.sh (:3098), validate-deploy.sh (:3099) or the demo box
  (:3010) in this session.
- shellcheck will flag scripts/validate-demo.sh's `local x="$(...)"` and masked-return-value
  patterns; some of those are in demo-instance.sh too. Changing a working teardown path to satisfy
  a linter is exactly the risk — if a fix would change what a script DOES, stop and flag it.
- Any new .ts file must land inside a tsconfig project — root-level ones need adding to
  tsconfig.tools.json explicitly (BUD-S95 §8).
- scripts/check-docs.ts hardcodes both `-v2` roadmap filenames; do not rename those files here.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```
