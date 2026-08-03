---
id: SR-2026-08-02-docs-onboarding-gap
type: status-report
roadmap-item: [BUD-S92, BUD-S93]
status: Snapshot
---
<!--
STATUS REPORT — a docs + roadmap pass, not a build slice. An audit of the README against the
running code found that the app has no browser path to its first user: BUD-E13 shipped "you must
log in" without "here is how the first person gets an account". Corrected the docs that claimed
otherwise and scoped the fix as BUD-S92 (+ BUD-S93, the demo instance). No app code changed.
Right-sized per 00_WAYS_OF_WORKING §11: short report, full kickoff prompt — because this pass
CHANGED WHAT "NEXT" IS, and the previous handoff now points at the wrong item.
-->

# Status Report — 2026-08-02 (docs + roadmap: the first-run onboarding gap)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-02 |
| Author | Wesley Cutting + agent |
| Scope  | Audit README vs. reality; correct every doc that misstated the auth/onboarding story; scope the missing first-run path as `BUD-S92` and the showcase demo as `BUD-S93`. **Docs only — no app code.** |

**Resume here:** **this report supersedes the handoff in
[`2026-08-02-bud-s91-auth-a11y.md`](2026-08-02-bud-s91-auth-a11y.md) §7.** That prompt named the
`scripts/**` typecheck gap (`K40`) as the next item — a reasonable pick at the time, made before
anyone had noticed that **the application cannot be opened by a new user.** Authentication is
default-deny and always on, and **no UI creates the first account**: `POST /api/auth/setup` has
existed since `BUD-S87` but has zero call sites in the web app, and there is no `/setup` route. A
fresh install — dev, container, or a backup restored onto a new box — is a `/login` page with no
reachable credential. That is now `BUD-S92`, it is `Ready`, and it is **the one thing blocking
launch**. `K40` is still open and is carried forward as context, not as the next item.

## 1. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **The finding, verified against a running server** | Booted the API on a spare port with the README's own default config and probed it: `GET /api/accounts` → **401**, `POST /api/auth/setup` → **201**, a second setup → **409**. So the endpoint works and the product does not: the only routes in are the `create-admin` CLI (which additionally refuses the default in-memory store) or a hand-made `POST`. Static confirmation: `api.setup` is defined at [`api.ts:227`](../../apps/web/src/api.ts:227) with **no call sites**, and [`routes.tsx`](../../apps/web/src/routes.tsx) has no `/setup`. | live probe + code read |
| **README corrected** | New **Create the first user** section (both routes, and which one works on an in-memory store). Configuration table gained the five variables the auth/deploy epics added and it never picked up — `SESSION_SECRET`, `SESSION_COOKIE_SECURE`, `APP_ENV`, `LOG_LEVEL`, `WEB_STATIC_ROOT`. Removed **"no authentication yet"** from Design principles and the stale "the API has no auth" rationale on `HOST`. Fixed `db:reset`'s "keeps the household + accounts", which read as *bank* accounts — the opposite of what it does. | [`README.md`](../../README.md) |
| **The same false claim, tracked down everywhere it appeared** | "First-run onboarding is available in the browser" was in `DEPLOY_CONTRACT` §7 and (still) in the seed scripts' console notice. The contract now carries an explicit ⚠ that this is an API call, not a screen, and that a fresh box cannot be handed to a non-technical user. | [`DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) |
| **`BUD-S92` scoped** | Owner-decided shape: a dedicated `/setup` route, reached by redirect from `/login` when a public `GET /api/auth/needs-setup` reports an empty store, auto-logging-in on success. Full spec written. **Enrollment model ratified**: bootstrap one admin who then provisions everyone else — no self-service registration, with the additive ladder (invite links → registration-with-tenancy) recorded so the deferral is re-openable with its reasoning intact. | [`features/first-run-setup.md`](../features/first-run-setup.md) |
| **`BUD-S93` scoped** | Demo instance as a **second container off the same image** with its own database and credential, seeded by the existing `seed:demo`. Chosen over an in-app demo mode specifically because `scripts/build.ts` excludes `seedDemo` from the production image — demo data is *absent* there, not merely guarded, and an in-app mode would give that up. Gated on `BUD-S92`: a demo box you can only enter by `exec`-ing a CLI is not "easy to show someone". | [`03_ROADMAP-v2.md`](../03_ROADMAP.md) `BUD-E14` |
| **`SECURITY.md` §3 tightened ahead of the build** | The accepted first-run race is currently defensible partly because the endpoint is obscure. `BUD-S92` puts it behind a discoverable screen, so the note now **requires that slice to make the check-and-insert atomic** rather than inherit the acceptance. | [`SECURITY.md`](../SECURITY.md) |
| **Name collision defused** | `features/first-run-onboarding.md` (UX14, shipped) is the *authenticated* first run — "my ledger is empty". The new spec is the *unauthenticated* one — "there is no account". Both now cross-link, with a disambiguation table. They compose, and that combined path **has never run end to end.** | both specs |
| **`K42` logged** | The generalizable lesson (below). | [`KIT_FEEDBACK.md`](../KIT_FEEDBACK.md) |

## 2. Definition of Done — current state

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | Scope was "correct the docs, scope the work". Every inaccuracy found in the audit is fixed or explicitly deferred (§4); both new items are `Ready` with an owner-decided shape. |
| Gate green | ✅ *(relevant steps)* | `npm run format` ✅ · `npm run docs:check` ✅ **169/169 artifacts + 38 core/review docs, crosswalk in sync**. `typecheck`/`lint`/`test`/`test:e2e`/build **not run — no file outside `docs/` and `README.md` changed.** Stated plainly rather than implied: this report does **not** claim a full gate run. |
| Usable end-to-end | n/a | No behaviour changed. The *point* of the pass is that the product is **not** usable end-to-end for a new user, and the docs now say so instead of claiming otherwise. |
| Docs updated in same change | ✅ | The change *is* the docs. Roadmap §0, `BUD-E13`, `BUD-E14`, §2 id table, feature spec, `SECURITY`, `DEPLOY_CONTRACT`, `README`, `KIT_FEEDBACK`, regenerated crosswalk. |
| Security | ✅ | No surface touched. One security *decision* recorded for the next slice: the first-run race must be closed at the database, not merely accepted (§1). |
| Accessibility | n/a → **owed by `BUD-S92`** | No UI shipped. The spec requires `/setup` to be axe-gated light **and** dark **in that slice**, not as a follow-up — `BUD-S91` is the precedent for why. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 483 | 483 | 0 (not run — docs only) |
| E2E | 132 | 132 | 0 (not run — docs only) |
| Deployment harness | 24 | 24 | 0 (not run) |

## 4. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| [`accessNotice.ts:19`](../../apps/api/src/db/accessNotice.ts:19) still says "complete first-run onboarding in the browser" | Same false claim as the docs, but it is `src/`, and this pass was scoped to docs. **Folded into `BUD-S92`'s scope** — when the screen exists, the message becomes true. | `BUD-S92` |
| [`03_ROADMAP.md`](../03_ROADMAP.md) (legacy, pre-cutover) is stale about auth | Superseded-at-cutover; re-editing it fights the restructure. `03_ROADMAP-v2.md` is the live plan for `BUD-*` ids. | cutover |
| [`KICKOFF-PROMPT.md`](../../KICKOFF-PROMPT.md)'s generic resume prompt points at `docs/03_ROADMAP.md` | That is correct for the *kit* (a new project has no `-v2`), wrong for *this* repo, where it sends a cold-start session to the legacy plan. Left alone rather than polluting a stack-agnostic kit file with project specifics — but a fresh session should be handed §7 below, not the generic prompt. | owner |

## 5. The lesson (`K42`)

A green gate proved nothing here, because **every automated consumer provisions its credential out
of band** — `e2e/global-setup.ts` POSTs `/auth/setup` directly, the demo capture self-provisions,
and API tests run with auth off. The suite has only ever tested the app *after* the hard part. This
is the sibling of `K41`: there, a green scan suite hid an unscanned surface; here, a green test
suite hid an unreachable product. Both are the gate being asked the wrong question. The kit fix is
a **cold-start check in the DoD** ("from an empty datastore, can a new user reach a working app
using only the documented steps?") plus a **cold-start e2e archetype** forbidden from reusing the
shared `storageState`.

Corollary worth carrying: **a doc claim about a user-facing path should name the surface, not the
endpoint.** "`POST /auth/setup` exists" and "a user can sign up" are different assertions, and this
is exactly where they diverged — quietly, across three documents.

## 6. Commands & gotchas (cold-start)

```bash
npm install
npm run dev --workspace apps/api    # API → http://localhost:3001
npm run dev --workspace apps/web    # web → http://localhost:5173
npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test && npm run test:e2e
```

- **A fresh store has no user.** `ADMIN_USERNAME=… ADMIN_PASSWORD=… npm run create-admin` (needs
  `PGLITE_DIR`/`DATABASE_URL`), or `POST /api/auth/setup` against a running API (the only route that
  works on the default in-memory store). This is the thing `BUD-S92` fixes.
- Run `colima stop` **before** e2e — an idle colima VM alone pushes full runs to 7.5–34.8 min and
  flakes a random spec on 30 s timeouts; stopped, it is ~5.9 min.
- Stop the dev stack (**3001 / 5173** — it respawns) before e2e or the deploy harness.
- Never run the deploy harness and e2e at the same time.
- The API lives under **`/api`** since `BUD-S81`; `VITE_API_BASE_URL` is the **origin** only.

## 7. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-docs-onboarding-gap.md — the newest report. It supersedes
  the kickoff in 2026-08-02-bud-s91-auth-a11y.md, which named a different next item.
- Read docs/features/first-run-setup.md — the full spec for what you are building.
- Read docs/03_ROADMAP-v2.md §0 and the BUD-E13 slices table.

Build EXACTLY ONE item this session: BUD-S92 — the first-run setup UI.

Why it matters: auth is default-deny and always on, and nothing in the UI creates the first user.
POST /api/auth/setup has existed since BUD-S87 with ZERO call sites in the web app, and there is no
/setup route. A brand-new install is a /login page with no reachable credential. This blocks launch.

Scope it as a vertical slice (data → API → UI), per docs/features/first-run-setup.md:
- Add public GET /auth/needs-setup → { needsSetup: boolean }, true only while zero users exist.
  /login cannot infer this: a userless store and a wrong password both return 401 by design
  (enumeration-safety, BUD-S89). Leak that one bit and nothing else.
- Add a standalone /setup route OUTSIDE the app shell (like /login): username · password · confirm,
  POSTing the existing /auth/setup. Redirect /login → /setup while needsSetup, and /setup → /login
  once a user exists. Neither may be a dead end.
- On 201, auto-login and land on /. If setup succeeds but the auto-login fails, do NOT report
  failure — the account exists; redirect to /login with an explanation, or the user will retry
  setup, get a 409, and conclude their account was never created.
- Make the first-user creation ATOMIC. SECURITY.md §3 currently ACCEPTS the check-then-insert race
  partly because the endpoint is obscure; a discoverable screen removes that argument. Enforce it in
  Postgres (partial unique index, or INSERT … SELECT … WHERE NOT EXISTS) and map the violation to
  the existing 409. The winner must be decided by the database, not by a countUsers() that raced.
- Update apps/api/src/db/accessNotice.ts — it currently tells operators to "complete first-run
  onboarding in the browser", which only becomes true when this ships.
- Docs in the SAME change: 06_API_CONTRACT (new endpoint), SECURITY.md §3 (race now closed, not
  accepted), DEPLOY_CONTRACT §7 (drop the "API call, not a screen" warning), README.

Write the e2e FIRST and watch it fail: from a store with NO user, load /, get routed to /setup,
create an admin, arrive at an authenticated dashboard — with no out-of-band provisioning. It must be
unable to pass via global-setup's shared storageState. That test is the acceptance criterion for the
whole slice and the thing whose absence hid this bug (KIT_FEEDBACK K42).

Axe-scan /setup in light AND dark IN THIS SLICE, not as a follow-up (BUD-S91 is the precedent — it
found a real 2.78:1 contrast defect that had shipped unnoticed). Verify each new scan fails on an
injected defect before trusting it.

Done when: a brand-new install is usable from the browser alone — no CLI, no curl — proven by that
e2e; concurrent setup yields exactly one admin; /setup is unreachable once a user exists; gate green.

Build ONLY that, then write the status report and STOP for review — do not continue into the items
below even if they look quick and you have context left (CLAUDE.md; 00_WAYS_OF_WORKING §9).

For CONTEXT only, not for this session — still open:
- BUD-S93 (demo instance, second container off the same image) is Ready and gated on BUD-S92.
- K40: scripts/** is in no tsconfig — eslint only, never typechecked. This was the previous
  report's "next item"; it is still worth doing, just not before the launch blocker.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.

Watch out for:
- A freshly seeded store has NO user by design (BUD-S90) — that is the premise of this slice.
- Run `colima stop` BEFORE e2e; stop the dev stack (3001/5173, it respawns) before e2e or the
  deploy harness; never run the harness and e2e together.
- The API lives under /api since BUD-S81; VITE_API_BASE_URL is the ORIGIN only.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 483 Vitest + 132 e2e, and e2e MUST end higher than 132).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change. Leave the work UNCOMMITTED with
a proposed Conventional-Commit message — the owner reviews and commits. End handoff-ready with
the next-session kickoff prompt (naming ONE item) in the status report.
```
