---
type: status-report
roadmap-item: BUD-S92
status: Snapshot
---
<!--
STATUS REPORT — BUD-S92, the first-run setup UI. A vertical slice: migration → API → UI, with the
cold-start e2e written first and watched fail. Full ceremony per §11 (it touches auth, it is public
and pre-session, and it closes a race SECURITY.md §3 had recorded as accepted). One slice, then
stop: BUD-S93 is unblocked by this and deliberately NOT started (§9).
-->

# Status Report — 2026-08-02 (`BUD-S92` — first-run setup UI)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-02 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S92` — a browser path to the first admin: public `GET /auth/needs-setup`, a standalone `/setup` route with redirects both ways, auto-login on success, and **atomic** first-user creation. Spec: [`features/first-run-setup.md`](../features/first-run-setup.md). |

**Resume here:** **the launch blocker is cleared.** A brand-new install is now usable from the
browser alone — open it, get routed to `/setup`, create the first admin, land on an authenticated
dashboard. No CLI, no `curl`. That is asserted end to end by a **cold-start e2e running against its
own empty stack**, which is the test the suite never had (`KIT_FEEDBACK` K42) and the reason this bug
survived five slices of green gates. Gate green: **495 Vitest + 142 e2e**. The work is
**uncommitted** — proposed message in §6. Next item: **`BUD-S93`** (demo instance), which was gated
on this and is now unblocked — kickoff prompt in §8.

## 1. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **The cold-start e2e — written first, watched fail** | Ten tests from a store with **no user**: `/` and `/login` both route to `/setup`; the mismatch is blocked client-side with **no request sent**; four axe scans; the journey itself; `/setup` inert afterwards; the probe flipped. First run failed exactly as it should — `expected /\/setup$/, received "http://localhost:5174/login"`. | [`e2e/first-run.spec.ts`](../../e2e/first-run.spec.ts) |
| **A second, genuinely empty stack for it to run against** | `global-setup.ts` POSTs `/auth/setup` before the first spec, so "zero users exist" is **unreachable** on `:3001` and no test written there could fail for the right reason. The harness now also starts an API on `:3002` + web on `:5174` over their own store. The isolation is **structural, not conventional**: the shared `storageState` cookie names a session row in the *other* store, so it cannot make this spec pass however it is later edited. | [`e2e/cold-start.ts`](../../e2e/cold-start.ts) · [`playwright.config.ts`](../../playwright.config.ts) |
| **Public `GET /auth/needs-setup`** | `{ needsSetup: boolean }` and nothing else — no counts, no usernames, no timestamps. Public because the SPA must ask before it has a session; `/login` cannot infer it, since a userless store and a wrong password both answer `401` by design (`BUD-S89`). The one bit it leaks is already readable from `POST /auth/setup`'s `201`-vs-`409`. | [`server.ts`](../../apps/api/src/http/server.ts) · [`authService.ts`](../../apps/api/src/services/authService.ts) |
| **`/setup`, outside the app shell** | Username · password · confirm, on `Login`'s card layout and stylesheet. Redirects both ways off one shared probe (`useNeedsSetup`), so **neither page is a dead end**. Renders nothing until the probe answers — an install that already has an owner must not flash a "claim me" screen, even for a frame. | [`Setup.tsx`](../../apps/web/src/Setup.tsx) · [`useNeedsSetup.ts`](../../apps/web/src/useNeedsSetup.ts) · [`Login.tsx`](../../apps/web/src/Login.tsx) · [`routes.tsx`](../../apps/web/src/routes.tsx) |
| **Auto-login — and the honest failure path** | `201` → `POST /auth/login` → `/`. If only the sign-in leg fails, this is **not** reported as a setup failure: the account exists, so it redirects to `/login` carrying *"Your account was created. Sign in to continue."* Calling it a failure would send the user back to a form that now answers `409`, from which the only reasonable conclusion is that their account was never created. | [`Setup.tsx`](../../apps/web/src/Setup.tsx) |
| **First-user creation made atomic** | Migration `0004`: `users.bootstrap` + `unique (bootstrap) where bootstrap`; the route's gate moved **inside** the write. Three concurrent setups now yield exactly one `201` and one admin. See §2 for why the spec's "or" had to become an "and". | [`0004-first-run-bootstrap.ts`](../../apps/api/src/db/migrations/0004-first-run-bootstrap.ts) |
| **`accessNotice.ts` made true** | It told operators to "complete first-run onboarding in the browser", which was false when written. It now names the browser route **first** (the only one that works on the in-memory dev store) and marks the CLI as the recovery path. | [`accessNotice.ts`](../../apps/api/src/db/accessNotice.ts) |
| **Docs, same change** | `06_API_CONTRACT` (new endpoint + the tightened `/auth/setup` guarantee), `SECURITY.md` §3 (race **closed**, not accepted), `DEPLOY_CONTRACT` §7 (the "API call, not a screen" ⚠ replaced by the real instructions), `README` (status banner + *Create the first user* rewritten browser-first, CLI folded into a `<details>`), `05_DATA_MODEL` (the column, the partial index, and the migration list), `TESTING_STRATEGY` §5 (the cold-start archetype), `KIT_FEEDBACK` K42 (part 2 now has a reference implementation), roadmap `§0` + `BUD-E13`, spec → `Implemented`. | — |

## 2. The one place the spec was wrong, and what shipped instead

[Spec §5](../features/first-run-setup.md) offered two ways to close the race — a partial unique index
**or** `INSERT … SELECT … WHERE NOT EXISTS` in one statement. **They are an *and*, not an *or*.**

The single statement alone does not close it: under READ COMMITTED two concurrent transactions each
take a snapshot, neither sees the other's uncommitted row, both find the table empty, and both
insert. And the index needs something to key on that identifies the *bootstrap* row — it may **not**
be `role = 'admin'`, because a household may legitimately have several admins (`BUD-S88` adds them;
`BUD-S89`'s last-admin guard assumes it).

So `0004` adds `users.bootstrap boolean not null default false` with
`unique (bootstrap) where bootstrap`, and the route runs the single statement on top of it. Ordinary
case: `where not exists` returns zero rows → `409`. Raced case: the loser is rejected by the index
(`23505`) → the same `409`. **The winner is decided by Postgres.** Flagged before building rather
than absorbed silently, because §6 of the spec had said this would not be a shape change and an
additive column is one; §6 now records what actually shipped.

**One honest limit, pinned rather than papered over:** PGlite runs on a single connection, so the
three-concurrent-setups test proves the *outcome* but never actually reaches the index — the losers
are turned away by `where not exists`. A second test asserts the constraint directly (a second
`bootstrap = true` row is rejected with `23505`), so the mechanism that matters on real Postgres is
pinned on both stores instead of only on the one the tests happen to run against.

## 3. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Migration → service → route → client → screen, in one slice. Usable is the *point* here and it is proven by the journey test, not asserted: no user → `/setup` → authenticated dashboard, with `Welcome to Budgeteer` (the UX14 empty state) rendering only because gated reads **succeeded**. The combined first-run story — unauthenticated setup composing into authenticated onboarding — has now run end to end for the first time. |
| Gate green | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ **170/170 artifacts + 38 core/review docs, crosswalk regenerated** · `test` ✅ **495** · `test:e2e` ✅ **142 (6.0m)**. Run with colima stopped and no dev stack up. |
| Acceptance criteria & UX states | ✅ | All seven of [spec §4](../features/first-run-setup.md) are covered by a test. States: loading (renders nothing until the probe answers), error (server + two client-side), success (auto-login), and the redirect-away state in both directions. |
| Accessibility | ✅ **in-slice, per `BUD-S91`** | Four axe scans (`/setup` clean + error, light + dark), serious/critical, the same bar as the rest of the suite. **Each verified against an injected defect before being trusted:** a `#7c7c7c` contrast defect on the shared page element failed all four (run individually, since a `serial` file stops at the first failure), and a second injection on the error element alone failed both error-state scans — so the error scans are proven to see the error, not just the page around it. A structural injection (dropping a `htmlFor`) was rejected as a probe: it breaks the locators, so the run aborts before the scans and proves nothing. |
| Input validation & secrets | ✅ | Server-side `zod` at the boundary unchanged; password floor enforced in `authService` and pre-checked client-side so the round trip is not the teacher. Passwords never logged, never in a query string, `autoComplete="new-password"` on both fields. The probe carries one boolean. |
| Docs in the same change | ✅ | Eight docs + the spec's status, listed in §1. |

## 4. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 483 | **495** | **+12** (3 API: the probe, concurrency, the constraint · 7 `Setup` · 2 `Login`) |
| E2E | 132 | **142** | **+10** (6 behaviour + 4 axe) |
| Deployment harness | 24 | 24 | 0 (not run — no deploy surface changed; the harness and e2e must never run together) |

Three pre-existing `migrator.test.ts` assertions pin the migration registry exactly, so they failed
on `0004` and were updated — the intended behaviour of that test.

## 5. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| `K40` — `scripts/**` is in no tsconfig (eslint only, never typechecked) | Untouched by this slice and still worth doing; it was the *previous* report's "next item" and lost its place to the launch blocker. It has not regained it — `BUD-S93` is the one thing gated on what just shipped. | open |
| The `create-admin` CLI stays | [Spec §2](../features/first-run-setup.md) — it is the recovery path when nobody can sign in, and the only option on a box with no browser. Docs now frame it that way instead of as the primary route. | — |
| No self-service registration | Ratified 2026-08-02, not forgotten — [spec §2.1](../features/first-run-setup.md) records the reasoning and the additive ladder (invite links → registration-with-tenancy) so the decision is re-openable. | owner |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 | Unchanged by this slice; carried forward from the previous report. | labs-hub SPIKE-03 / owner |

## 6. Proposed commit

The work is **uncommitted** for review.

```text
feat(web): create the first admin from the browser (BUD-S92)
```

Body worth keeping: adds public `GET /auth/needs-setup` and a standalone `/setup` route; makes
first-user creation atomic at the database (migration `0004`), closing the race `SECURITY.md` §3 had
accepted; adds a cold-start e2e over its own empty stack, the first automated proof that a new
install can be opened at all.

## 7. Commands & gotchas (cold-start)

```bash
npm install
npm run dev --workspace apps/api    # API → http://localhost:3001
npm run dev --workspace apps/web    # web → http://localhost:5173
npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test && npm run test:e2e
```

- **A fresh store still has no user — but that is no longer a problem.** Open the app and it routes
  you to `/setup`. The `create-admin` CLI remains for recovery.
- The e2e harness now binds **four** ports: `3001`/`5173` (primary) and `3002`/`5174` (cold start).
  Any of them being held fails the run fast, by design (K24).
- Run `colima stop` **before** e2e. Stop the dev stack (**3001 / 5173** — it respawns) before e2e or
  the deploy harness. Never run the deploy harness and e2e at the same time.
- The API lives under **`/api`** since `BUD-S81`; `VITE_API_BASE_URL` is the **origin** only.

## 8. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-bud-s92-first-run-setup.md — the newest report.
- Read docs/03_ROADMAP-v2.md §0 and the BUD-E14 slices table (BUD-S93's row).
- Read docs/DEPLOY_CONTRACT.md (esp. §5 and §7) and deploy/ as it stands today.

Build EXACTLY ONE item this session: BUD-S93 — the demo instance.

Why it matters: the owner wants to hand Budgeteer to someone, or screenshot it, without the real
ledger being anywhere near it. It was gated on BUD-S92 (a demo box you can only enter by exec-ing a
CLI is not "easy to show someone"); BUD-S92 shipped 2026-08-02, so it is unblocked.

Owner-decided shape (2026-08-02) — do NOT redesign it: a SECOND CONTAINER off the same image and
tag, with its own database, its own SESSION_SECRET, and its own demo credential, populated by the
existing seed:demo. Deliberately NOT an in-app demo mode: scripts/build.ts excludes seedDemo from
the production image, so demo data is ABSENT there rather than merely guarded, and an in-app mode
would give that up and put a self-provisioning credential path into production code.

Scope: a deploy/ compose profile, a seed-and-reset runbook in DEPLOY_CONTRACT, and a way to
re-pristine the box between showings. Expected to be config + docs with NO app code — if you find
yourself editing apps/**, stop and say why before continuing.

Right-size it (00_WAYS_OF_WORKING §11): deploy config + runbook, no ADR, no UX spec. But the
non-negotiables hold — nothing that could point a demo box at the real ledger, no secret in the
repo, and the demo credential documented rather than invented per-run.

Validate it for real, not on paper: stand the profile up and confirm the demo box serves seeded
data, that its /setup or documented credential actually lets you in, and that it shares NOTHING
with the primary instance's database. Note that the deploy harness needs colima and must NEVER run
at the same time as e2e.

Build ONLY that, then write the status report and STOP for review — do not continue into the items
below even if they look quick and you have context left (CLAUDE.md; 00_WAYS_OF_WORKING §9).

For CONTEXT only, not for this session — still open:
- K40: scripts/** is in no tsconfig — eslint only, never typechecked. Worth doing, still not next.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- BUD-S94 (retire the legacy roadmap) is still blocked on KIT_FEEDBACK K30 Part B.

Watch out for:
- Run `colima stop` BEFORE e2e; stop the dev stack (3001/5173, it respawns) before e2e or the
  deploy harness; never run the harness and e2e together. The harness runs on :3099.
- The e2e harness now binds FOUR ports — 3001/5173 and 3002/5174 (the cold-start stack, BUD-S92).
- The API lives under /api since BUD-S81; VITE_API_BASE_URL is the ORIGIN only.
- A freshly seeded store has NO user by design (BUD-S90) — but since BUD-S92 the browser walks you
  through /setup, which is exactly what makes a demo box handable to someone.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change. Leave the work UNCOMMITTED with
a proposed Conventional-Commit message — the owner reviews and commits. End handoff-ready with
the next-session kickoff prompt (naming ONE item) in the status report.
```
