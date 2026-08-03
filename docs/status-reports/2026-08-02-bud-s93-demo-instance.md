---
id: SR-2026-08-02-bud-s93-demo-instance
type: status-report
roadmap-item: BUD-S93
status: Snapshot
---
<!--
STATUS REPORT — BUD-S93, the demo instance. Config + docs, no app code, as scoped. Right-sized per
§11 (deploy config + runbook; no ADR, no UX spec) — but validated against a real container rather
than on paper, because the claim being made is an isolation claim. One slice, then stop.
-->

# Status Report — 2026-08-02 (`BUD-S93` — the demo instance)

| Field  | Value |
| ------ | ----- |
| Status | Snapshot |
| Date   | 2026-08-02 |
| Author | Wesley Cutting + agent |
| Scope  | `BUD-S93` — a showcase box that can be handed to someone, screenshotted, or demoed live with the real ledger nowhere near it: a second container off the same image and tag, its own everything, seeded by `seed:demo`. Runbook: [`DEPLOY_CONTRACT` §10](../DEPLOY_CONTRACT.md). |

**Resume here:** **`./scripts/demo-instance.sh up` gives you a demoable Budgeteer on `:3010`** —
sign in as `demo` / `demo-budgeteer` and you land on a lived-in dashboard of invented money.
`refresh` re-pristines it between showings. It shares **nothing** with a real deployment: its own
compose project (pinned in the file), volume, network, database, `SESSION_SECRET`, and a
`DATABASE_URL` that is hard-wired rather than read from the environment. **No app code changed** —
`git status` touches `deploy/`, `scripts/`, and docs only. Gate green: **495 Vitest + 142 e2e**,
both at the floor, plus a live validation run against a real container. The work is
**uncommitted** — proposed message in §5. Next item: **`K40`** — kickoff prompt in §8.

## 1. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **The demo stack** | Same image and tag as production (`BUDGETEER_IMAGE`, defaulting to the same GHCR reference) — a demo built from a different artifact proves nothing about what you are showing. Everything else is its own: project, volume, network, database, signing secret. | [`deploy/compose.demo.yaml`](../../deploy/compose.demo.yaml) |
| **Isolation made structural, not conventional** | Three things, each closing a way the demo could have met the real ledger. (1) `name: budgeteer-demo` **inside the file** — without it, `docker compose -f deploy/compose.demo.yaml up` takes its project name from the parent directory, `deploy`, which is the same name a primary stack started that way gets, and the two then share containers and volumes. (2) `DATABASE_URL` hard-wired to its own `db` service instead of interpolated from the environment, so an operator with production values exported cannot aim it at the household's database. (3) Its secret is `DEMO_SESSION_SECRET`, a distinct variable name, so the demo box cannot inherit the real signing key. | [`deploy/compose.demo.yaml`](../../deploy/compose.demo.yaml) |
| **One command per operator intention** | `init` (generate secrets) · `up` (start, ensure the credential, seed) · `seed` · `refresh` (re-pristine) · `status` · `down [--purge]`. Shell, matching `validate-deploy.sh`: everything except reseeding runs with no toolchain on the box. | [`scripts/demo-instance.sh`](../../scripts/demo-instance.sh) |
| **`refresh` — the answer to "what a showing leaves behind"** | Two kinds of mess, not one: data a viewer entered, and a password a viewer changed. `refresh` empties the ledger (in-container, preserving `users`/`sessions` per `BUD-S90`, which is why the demo account survives), reloads the synthetic dataset, and restores the published password through the reset path — **which also revokes the previous viewer's session**. | [`scripts/demo-instance.sh`](../../scripts/demo-instance.sh) |
| **A credential that is written down** | `demo` / `demo-budgeteer`, in the runbook and the script, not generated per run — a showing that begins by reading a fresh password off a terminal is not a box you can hand to someone. The *generated* values (database password, `SESSION_SECRET`) go to `deploy/.env.demo`, which `.gitignore` excludes via `.env.*` (verified with `git check-ignore`) and which the compose file has **no fallback for**: it fails by name, before starting anything. | [`DEPLOY_CONTRACT` §10](../DEPLOY_CONTRACT.md) |
| **Docs, same change** | `DEPLOY_CONTRACT` **§10** (the runbook, the isolation guarantees, both deliberate deviations, the credential rationale) + a pointer from §7 + the header note + a line in §9 scoping §10 out of the hub's promise; `README` (a *Demo instance* section, the status banner, `deploy/` added to the repo layout); roadmap `§0` + the `BUD-S93` row; `KIT_FEEDBACK` **K43**. | — |

## 2. The constraint this slice had to accept, not design away

`seedDemo` is **not in the production image** — [`apps/api/scripts/build.ts`](../../apps/api/scripts/build.ts)
ships the server and the operational CLIs and nothing else. That absence is the entire reason the
owner chose a second container over an in-app demo mode: demo data is *absent* from a real
deployment rather than guarded behind a flag someone can flip, and no self-provisioning credential
path exists in production code.

The bill for that choice comes due here: **the demo box cannot seed itself.** Seeding runs from a
repo checkout against the demo database over a loopback-published port
(`127.0.0.1:5434`), which is a deliberate deviation from §2's "the database port is never
published". It is bound to `127.0.0.1`, nothing on the LAN can reach it, and the database behind it
holds invented figures. The alternatives were shipping the seeder into the production image (which
gives up the whole point) or building a second image (which stops it being *the same artifact*).
Everything except reseeding — start, stop, reset the ledger, restore the credential — runs from the
image's own CLIs and needs no toolchain.

The second deviation: `SESSION_COOKIE_SECURE` defaults to **`false`** here and `true` in production
(§5). A demo is served over plain `http://` to a laptop or a phone, and a browser discards a
`Secure` cookie that arrives over HTTP — the viewer would sign in and bounce straight back to the
login page, which is the exact trap §5 exists to name. The exposure it normally trades against is a
session token on a box holding nothing real.

## 3. Definition of Done

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Usable is the whole deliverable and it was **driven, not asserted**: `up` on a clean host → healthy container → `demo` / `demo-budgeteer` typed into the browser → the dashboard renders *This month's budget $3,072.00*, four transactions needing allocation, and upcoming items from invented payees (Northwind Payroll, Municipal Power Co., FiberStream ISP). The second entry path was checked too: after `down --purge`, `/api/auth/needs-setup` answers `{"needsSetup":true}` and the browser shows **Set up Budgeteer** — so a purged box can be handed to someone to claim (`BUD-S92`). |
| Gate green | ✅ | `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ **172/172 artifacts + 38 core/review docs, crosswalk regenerated** · `test` ✅ **495** · `test:e2e` ✅ **142**. Run with colima stopped and no dev stack up, after the container work. |
| Acceptance criteria & UX states | ✅ | No new UI — the demo box serves the same SPA. The operator-facing surface is the script, whose states are covered in §4. |
| Accessibility | n/a | No new user-facing surface. The screens the demo shows are the ones `BUD-S91`/`BUD-S92` axe-gated. |
| Input validation & secrets | ✅ | No secret in the repo: `deploy/.env.demo` is generated at mode `600`, gitignored via `.env.*` (`git check-ignore` confirms), and the stack **fails loudly by name** without it — verified by running `compose config` with the variables unset (`exit=1`, *"required variable DEMO_POSTGRES_PASSWORD is missing a value"*). The published demo credential is documented, not invented per run, and guards only synthetic data on an isolated box. |
| Docs in the same change | ✅ | Four docs, listed in §1. |
| **No app code** | ✅ | The scope said config + docs; `apps/**` is untouched. |

## 4. Validated against a real container

Isolation claims are exactly the kind that read fine on paper and fail in practice, so the box was
stood up and pushed on. All of this ran against a locally built image on colima, with e2e not
running:

| What was checked | Result |
| ---------------- | ------ |
| The demo box serves **seeded** data | 4 accounts · 22 envelopes · **220 transactions** · 8 recurring · 3 templates, read back from the demo Postgres itself |
| The documented credential lets you in | `demo` / `demo-budgeteer` → `200`, **typed into a browser**, landing on the dashboard |
| Default-deny still holds | anonymous `/api/accounts` and `/api/export` → `401`; `/api/auth/setup` → `409` once claimed |
| It shares nothing with the other stack on this host | the demo app sits on **one** network (`budgeteer-demo_default`), where `db` resolves to `172.19.0.2` — its own database container. The pre-existing `budgeteer` project (a *different* checkout, its own `budgeteer_budgeteer-pgdata` volume) was never touched, and is still up and untouched now |
| Project pinning works without `-p` | `compose config` reports `project: budgeteer-demo`, volume `budgeteer-demo-db` |
| `refresh` re-pristines a **dirtied** box | The box was deliberately broken the way a showing breaks it — a stray `Left By A Viewer` envelope (23 envelopes) and the password changed to something the runbook does not know (documented password → `401`). After `refresh`: stray envelope **gone**, 22 envelopes / 220 txns **back**, documented password **`200`**, still exactly **1 user** |
| `refresh` logs the previous viewer out | A session captured before the refresh: `200` before, **`401`** after |
| Teardown leaves nothing | `down --purge` removed the container, network and volume; `docker volume ls` shows only the pre-existing project's |

## 5. Proposed commit

The work is **uncommitted** for review.

```text
feat(deploy): a demo instance off the same image (BUD-S93)
```

Body worth keeping: adds `deploy/compose.demo.yaml` and `scripts/demo-instance.sh` — a second
container with its own project, volume, database, `SESSION_SECRET` and published credential, seeded
by `seed:demo` and re-pristined with one command. No app code: `seedDemo` stays out of the
production image, so demo data remains absent from a real deployment rather than merely guarded.

## 6. Deferred, deliberately

| Item | Why it was left | Owner |
| ---- | --------------- | ----- |
| `K40` — `scripts/**` is in no tsconfig (eslint only, never typechecked) | Untouched again, and this slice makes it slightly sharper: `scripts/` now holds two shell scripts and three TypeScript ones, none of the latter typechecked. It has been the "next item" twice and lost its place twice. | open |
| No automated test for the demo profile | The validation in §4 was run by hand and is recorded there rather than pinned by a harness. A `validate-demo.sh` sibling to `validate-deploy.sh` is the obvious follow-up, but the two harnesses cannot run together (and neither can run with e2e), and the demo profile is a local tool rather than a promise to another project (§9). Recorded so it is a choice, not an oversight. | open |
| At-rest encryption · TLS vs `SESSION_COOKIE_SECURE` · Node 20-vs-22 · `BUD-S94` | Unchanged by this slice; carried forward. | labs-hub SPIKE-03 / owner |

## 7. Commands & gotchas

```bash
./scripts/demo-instance.sh up        # demo box on :3010 — demo / demo-budgeteer
./scripts/demo-instance.sh refresh   # re-pristine between showings
./scripts/demo-instance.sh down --purge
npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test && npm run test:e2e
```

- The demo box needs a container runtime (`colima start`). It runs on **:3010**, deliberately clear
  of `3001`/`5173` (dev), `3002`/`5174` (the cold-start e2e stack) and `3099` (the deploy harness).
- **`up` and `refresh` need a repo checkout** (`npm install` done) — that is the seeding step, and
  §2 explains why it cannot come from the image. Everything else works without one.
- Run `colima stop` **before** e2e. Never run the deploy harness, the demo box's build, and e2e at
  the same time.
- To hand someone a box they claim themselves, `down --purge` and bring it up without seeding — the
  browser routes them to `/setup`.

## 8. Next-session kickoff prompt

```text
You are resuming work on Budgeteer in a fresh context window. Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md (esp. §9 and §11).
- Read docs/status-reports/2026-08-02-bud-s93-demo-instance.md — the newest report.
- Read docs/KIT_FEEDBACK.md K40, and tsconfig.base.json + every tsconfig.json in the repo.

Build EXACTLY ONE item this session: K40 — bring scripts/** under typecheck.

Why it matters: scripts/ holds real logic that no tsconfig covers — check-docs.ts (the docs gate
itself), capture-demo-assets.ts, and apps/api/scripts/build.ts (which produces the production
image). ESLint sees them; `tsc` never has. A type error in the script that BUILDS THE IMAGE would
be found by the image failing to run, not by the gate. It has been named as the next item twice
(BUD-S92, BUD-S93) and lost its place both times to work that was gating a launch. Nothing is
gating it now.

Scope: put scripts/** into a tsconfig that `npm run typecheck` actually runs, fix whatever that
surfaces, and keep the gate green. Expect the fixes to be real — untypechecked code accumulates
loose typing, and the repo bans `any` and equivalents (CLAUDE.md). If a fix would change what a
script DOES rather than how it is typed, stop and flag it before continuing.

Right-size it (00_WAYS_OF_WORKING §11): tooling/config, no ADR, no UX spec, no feature spec. A
status report is still expected — this touches the gate itself.

For CONTEXT only, not for this session — still open:
- No automated test pins the demo profile (BUD-S93 §6); a validate-demo.sh sibling is the follow-up.
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03 — the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Dev/CI run Node 20 while the image runs Node 22.
- BUD-S94 (retire the legacy roadmap) is still blocked on KIT_FEEDBACK K30 Part B.

Watch out for:
- Run `colima stop` BEFORE e2e; stop the dev stack (3001/5173, it respawns) before e2e or the
  deploy harness; never run the harness and e2e together. The harness runs on :3099, the demo
  box on :3010.
- The e2e harness binds FOUR ports — 3001/5173 and 3002/5174 (the cold-start stack, BUD-S92).
- scripts/check-docs.ts hardcodes both `-v2` roadmap filenames; do not rename those files here.
- tsconfig.e2e.json is already a separate project wired into `npm run typecheck` — read how it is
  composed before adding another one.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 495 Vitest + 142 e2e — neither may regress).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it gate-green; update docs in the same change. Leave the work UNCOMMITTED with a proposed
Conventional-Commit message — the owner reviews and commits. End handoff-ready with the
next-session kickoff prompt (naming ONE item) in the status report.
```
