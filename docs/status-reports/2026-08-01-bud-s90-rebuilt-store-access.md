---
id: SR-2026-08-01-bud-s90-rebuilt-store-access
type: status-report
roadmap-item: BUD-S90
---
<!--
STATUS REPORT — BUD-S90, "a rebuilt store has a way in" (BUD-E14, front F).
Auth state and ledger state were on separate tracks, so every path that rebuilt the ledger locked
the household out of it. Fixes the reset→restore user wipe, gives the demo capture its own session,
and records the owner's decision to keep seeds credential-free.
-->

# Status Report — 2026-08-01 (BUD-S90, a rebuilt store has a way in)

| Field  | Value                                                                 |
| ------ | --------------------------------------------------------------------- |
| Status | Snapshot                                                               |
| Date   | 2026-08-01                                                             |
| Author | Wesley Cutting + agent                                                 |
| Scope  | `BUD-E14` front F: the three paths that rebuild a ledger without leaving a way into it — disaster-recovery restore, dev/demo seed, demo capture. |

**Resume here:** all three are closed. **Restore is the real one:** `db:reset` no longer truncates
`households`, so a reset-then-restore recovery keeps the accounts that can reach the ledger it just
brought back — proven by 3 new Vitest tests *and* by the deployment harness against real
PostgreSQL 16, where the assertion that used to encode the broken behaviour is now inverted (still
**24/24**). **Demo capture was broken and is now fixed:** verified first that it had no
authentication at all against an always-on gate — every data call 401 — so its 20 screenshots and
the golden-path video were of the login page; it now provisions its own admin through first-run
`/api/auth/setup` with a per-run random password, and a re-run produced a real populated dashboard.
**Seeds stay credential-free by owner decision** and now print the two ways in. Gate green: **483
Vitest + 124 e2e + 24 harness checks**. Nothing from this slice is deferred.

## 1. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **`db:reset` stops taking the accounts with it** | The defect in one line: `reset` truncated `households` `CASCADE`, `users.household_id` references it, and `sessions.user_id` cascades off `users` — so the documented recovery flow returned a complete ledger nobody could sign in to. The truncate moved to a new [`db/resetLedger.ts`](../../apps/api/src/db/resetLedger.ts) **without `households`**. Confirmed the surrounding machinery already tolerated this before changing it: `migrateToLatest` re-inserts the household `on conflict do nothing` on every call, `restoreService` upserts households `on conflict (id) do update` so exported values still win exactly, and its "store must be empty" refusal already excluded the default household. `users` is not one of the 15 backup tables, so surviving accounts cannot block a restore either. | `apps/api/src/db/resetLedger.ts` · `reset.ts` |
| **The harness assertion, inverted** | `validate-deploy.sh` asserted *"restore leaves no user accounts — create-admin is required afterwards"* — a test written to the bug, which would have failed on the fix and made it look like the regression. Replaced with "restore preserves the user accounts" plus a real login using the same `$CREDS` that set the box up **before** the backup was taken. Net check count unchanged at 24. | `scripts/validate-deploy.sh` |
| **Demo capture authenticates — verified broken first** | Reality before paper: started a throwaway API exactly as the capture script does, against a freshly seeded demo store, and probed it. `/api/accounts`, `/api/envelopes`, `/api/transactions`, `/api/auth/me` → **401**, and [`api.ts:213`](../../apps/web/src/api.ts) redirects to `/login` on any 401. So the failure was real, silent, and had produced login-page screenshots on every run since auth landed. `provisionSession()` now POSTs `/auth/setup` + `/auth/login` with a per-run `randomBytes` password, lifts the **server-signed** cookie verbatim from the response, and hands it to both browser contexts. | `scripts/capture-demo-assets.ts` |
| **Seeds stay credential-free (owner decision)** | The options were a seeded dev admin, folding `create-admin` into `db:fresh`, or self-provisioning. **Owner chose self-provisioning:** no known credential exists anywhere on disk, and the capture generates a throwaway one per run. Structurally safe beyond the choice — `seed.ts`/`seedDemo.ts` are not entry points in [`scripts/build.ts`](../../apps/api/scripts/build.ts), so they are absent from the production image rather than merely guarded. Both seeds now end with `printAccessNotice`, which names `create-admin` and first-run onboarding when a store has no users. | `apps/api/src/db/accessNotice.ts` |
| **The PGlite reset asymmetry, decided rather than inherited** | With `PGLITE_DIR` set, `reset` deletes the whole directory — accounts included. Left as is (a PGlite store is a disposable dev store), but it is now **stated** in the script's doc comment, its output, and the README instead of being an accident of implementation. | `reset.ts` · `README.md` |

## 2. Definition of Done — current state

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | All four from the kickoff: a test pins reset→restore preserving accounts ✅ · the harness assertion is inverted ✅ · `DEPLOY_CONTRACT` §7 no longer documents the trap ✅ · the seed decision is implemented and documented ✅. |
| Gate green (types/lint/format/tests/e2e/build) | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ 165/165 · **483 Vitest** ✅ · **124 e2e** ✅ (5.9 min, colima stopped) · `validate-deploy.sh` **24/24** ✅ against PostgreSQL 16. |
| Usable end-to-end (data→API→UI) | ✅ | Two independent proofs, both against something real rather than a mock. (a) The harness runs export → reset → restore inside the deployed container and then **logs in with the original credentials**. (b) `npm run capture:demo` re-run end to end: 20/20 screenshots saved, and `01-dashboard-overview.png` is a populated dashboard with a `Log out` control — not the login page. The two mid-run clicks on `Everyday Checking` and `Groceries` corroborate it: those links exist only on an authenticated page. |
| Docs updated in same change | ✅ | [`DEPLOY_CONTRACT`](../DEPLOY_CONTRACT.md) §7 rewritten (trap → the two facts that actually hold, with the in-place vs. different-box distinction the old text elided) · [`05_DATA_MODEL`](../05_DATA_MODEL.md) §migrations · [`06_API_CONTRACT`](../06_API_CONTRACT.md) restore semantics · `README` dev commands + a "a seeded store has no way into it" note · roadmap (`BUD-S90` added to the `BUD-E14` table, the §2 id table, and the epic's summary line; `BUD-S85`'s row corrected — one of its "two runbook traps" was a defect, not a trap) · the stale comment in `migrate.ts` that justified itself by the truncate this slice removed. |
| Security (input/authz/secrets) | ✅ | **No credential is created, stored, or defaulted anywhere.** The capture's password is `randomBytes(24)`, exists only in that process, and is never logged; `/auth/setup` is a dead endpoint the moment a user exists, so it works exactly once per reset store. Nothing here is reachable from a production image — seeds are not bundled, and the capture script is not in the image at all. The cookie is lifted from the response rather than constructed, because it is server-signed. Reset now preserving `sessions` is deliberate and not a widening: sessions are still revoked on logout, password reset, and disable. |
| Accessibility | n/a | No UI change. The two a11y e2e scans still pass. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 480 | **483** | **+3** |
| E2E | 124 | 124 | 0 |
| Deployment harness | 24 | 24 | 0 (2 checks replaced, both inverted) |

New coverage — [`apps/api/test/reset-restore.test.ts`](../../apps/api/test/reset-restore.test.ts), the
whole round-trip through the real HTTP surface with auth **on**: setup → login → write → export →
`truncateLedger` → restore → **log in again**, plus a proof that surviving accounts do not trip
restore's emptiness refusal, plus a proof the truncate still reaches child tables (an account's
opening transaction, not just the parents it lists first).

**The regression test was checked against the bug, not just against the fix.** Putting `households`
back into the truncate list failed the first test at exactly the right assertion (the household row
gone, `expected undefined to be '0000…0001'`) and left the other two passing. A test that would have
passed either way would have been worthless here — which is precisely what the old harness assertion
was.

## 4. Manual carries / deferred

Nothing deferred from this slice. Still open on `BUD-E14`, unchanged by it:

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **At-rest encryption** | `BUD-S85`'s other half; belongs to labs-hub SPIKE-03. A deployed hub is unencrypted at rest. | Owner + labs-hub SPIKE-03 |
| **The GHCR workflow has never run** | Tag-triggered; the repo has no tags. Needs a real `v*` push, then the package made pullable by the hub. | Owner |
| **TLS vs `SESSION_COOKIE_SECURE=false`** | A deployment decision, before going live ([contract §5](../DEPLOY_CONTRACT.md)). | Owner |
| **`scripts/` is not typechecked** | Noticed while working: no `tsconfig` includes `scripts/**`, so `capture-demo-assets.ts` gets eslint but not `tsc` — this slice's changes to it were typechecked by hand (`tsc --noEmit` standalone, clean). Pre-existing, out of scope here, worth a tidy-up. | Follow-up |

## 5. Outstanding & next steps

- **`BUD-E14` is functionally complete except encryption.** No known trap remains in the recovery runbook.
- **Push a real tag** to prove the GHCR path end to end — the one unexercised piece of the deployment story.
- **labs-hub SPIKE-03** closes the encryption half of `BUD-S85`.
- Optional tidy-ups, both noticed in passing: bring `scripts/**` under a tsconfig, and move dev/CI to Node 22 to match the image.

## 6. Commands & gotchas (cold-start)

```sh
npm install
npm run typecheck && npm run lint && npm run format && npm run docs:check
npx vitest run                 # 483
npx playwright test            # 124 — needs :3001 and :5173 free, and colima STOPPED
./scripts/validate-deploy.sh   # 24 deployment checks; needs `colima start`
```

- **`colima stop` before e2e, `colima start` before the harness, never both at once.** An idle colima
  VM alone stretches e2e to 7.5–34.8 min and flakes a random spec on 30 s timeouts; stopped, it is
  5.8–5.9 min and 124/124 (re-confirmed this session).
- **`npm run capture:demo` needs the web dev server on :5173 and :3001 free.** It owns the api-demo
  server and the `data/budgeteer-demo` store for the run, resetting both — that reset is what keeps
  `/auth/setup` usable on every run.
- **A freshly seeded store has no way in.** That is by design; the seed output names the two routes.
  `db:reset` against `DATABASE_URL` keeps accounts; against `PGLITE_DIR` it deletes the directory and
  they go with it.
- The API is at **`/api`**; `VITE_API_BASE_URL` is the **origin only**.

## 7. Next-session kickoff prompt

```text
You are resuming budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST file in docs/status-reports/ (2026-08-01, BUD-S90) — its "Resume here" has state.
- Read docs/03_ROADMAP-v2.md — BUD-E14's build fronts are Done; BUD-S85's encryption half is open.

budgeteer is deployable and its recovery path is now sound: one 82 MB ARM64 image serving the SPA +
API on one origin against PostgreSQL 16, and a reset→restore that keeps the accounts able to reach
the restored ledger. Gate: 483 Vitest + 124 e2e, plus ./scripts/validate-deploy.sh (24 checks,
needs `colima start`).

YOUR ONE ITEM THIS SESSION — BUD-S84's unfinished half: prove the GHCR publish path end to end.

.github/workflows/publish-image.yml has NEVER RUN. It is tag-triggered and the repo has no tags at
all, so QEMU cross-build, GHCR auth, and provenance attestation are all unexercised. Reviewing it
once already caught a real bug (attest-build-provenance needs `attestations: write` as well as
`id-token: write`), which is evidence that reading it is not the same as running it.

This item is mostly NOT code — it is an owner-driven operation, so plan it as one:
- The tag push is the OWNER'S action, not yours. Do not create or push a tag. Prepare exactly what
  is needed, tell the owner the command, and wait.
- Decide the first version with the owner (v0.1.0 is the obvious candidate) and check whether
  package.json's 0.0.0 should move with it — say what you recommend and why.
- Watch the run with `gh run watch` / `gh run view --log-failed`. Expect the arm64 QEMU build to be
  SLOW (tens of minutes); do not mistake slowness for a hang.
- AFTER a green run, the package is NOT pullable yet: a new GHCR package is private by default. The
  hub needs either the package made public or a read:packages PAT. Verify the pull actually works
  (`docker pull ghcr.io/wes-cutting/budgeteer:<tag>`) rather than assuming the push implies it —
  that verification is the point of the item.
- If the run fails, fix forward: the fix is a commit and a NEW tag, since a pushed tag should not be
  moved. Say so before the first tag rather than after.

Done when: a real tag has built and pushed an arm64 image to GHCR with provenance, the digest is
recorded in DEPLOY_CONTRACT.md, and a pull of that digest is verified to work from outside CI.

Housekeeping: BUD-S84's roadmap row still says "⚠ Unexecuted" — update it, and DEPLOY_CONTRACT's
image section, in the same change.

Build ONLY that, then write the status report and STOP for review — do not continue into the items
below even if they look quick and you have context left (CLAUDE.md; 00_WAYS_OF_WORKING §9).

For CONTEXT only, not for this session — still open on BUD-E14:
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Two tidy-ups noticed in BUD-S90: scripts/** is not covered by any tsconfig (eslint only), and
  dev/CI run Node 20 while the image runs Node 22.

Watch out for:
- Run `colima stop` BEFORE e2e — an idle colima VM alone makes full e2e runs take 7.5-34.8 min and
  flake a random spec on 30s timeouts; stopped, it is ~5.9 min and 124/124.
- Never run the deploy harness and e2e at the same time.
- The API lives under /api as of BUD-S81; VITE_API_BASE_URL is the ORIGIN only.
- A freshly seeded store has NO user by design (BUD-S90) — create-admin or first-run /api/auth/setup.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 483 Vitest + 124 e2e). The deployment harness is
./scripts/validate-deploy.sh and needs `colima start` first.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change. Leave the work UNCOMMITTED with
a proposed Conventional-Commit message — the owner reviews and commits. End handoff-ready with
the next-session kickoff prompt (naming ONE item) in the status report.
```
