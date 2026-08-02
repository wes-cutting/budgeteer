---
type: status-report
roadmap-item: BUD-S84
---
<!--
STATUS REPORT — BUD-S84's unfinished half: executing the GHCR publish path.
The workflow was written and reviewed in BUD-S84 but had never run — tag-triggered, and the repo
had no tags. This slice pushed the first real tag (v0.1.0) and verified the result from outside CI:
a public, arm64, provenance-attested image that pulls, boots, and serves.
-->

# Status Report — 2026-08-02 (BUD-S84, the GHCR publish path, executed)

| Field  | Value                                                                 |
| ------ | --------------------------------------------------------------------- |
| Status | Snapshot                                                               |
| Date   | 2026-08-02                                                             |
| Author | Wesley Cutting + agent                                                 |
| Scope  | `BUD-E14` front E: prove `publish-image.yml` end to end with a real tag, and verify the published image is actually consumable by the hub. |

**Resume here:** **`BUD-S84` is executed, not merely written.** Tag `v0.1.0` on merge commit `1f478ab`
built and pushed `ghcr.io/wes-cutting/budgeteer@sha256:ef0883…71da2` — **linux/arm64, 81.8 MB
compressed**, carried by tags `0.1.0`/`0.1`/`latest`. Verified **from outside CI, not inferred from a
green check**: anonymous manifest fetch (the package is **public**, so no PAT is needed), `docker pull`
by digest, SLSA provenance verifying to this workflow and this commit, and the reference
`deploy/compose.yaml` standing the *published* image up to `{"status":"ok","db":"ok"}` with the SPA
served and all resource routes 401 without a session. **`BUD-E14` now has only at-rest encryption
open.** Gate green on the tagged tree: **483 Vitest + 124 e2e**, plus both workspace builds. One real
finding carried out of this slice — see §4.

## 1. What landed

| Item | Notes | Source |
| ---- | ----- | ------ |
| **The first real release tag** | `v0.1.0`, annotated, on merge commit `1f478ab` — the commit that actually reached `main` via PR #1, not the branch tip. Verified before tagging that the merge commit's **tree hash was byte-identical** (`f41634e…`) to the commit the gate ran on, so the gate result carried over without a re-run rather than being assumed to. | tag `v0.1.0` |
| **`chore(release): 0.1.0`** | Root `package.json` moved off `0.0.0` so the tagged source states its own version; the three workspace manifests stay `0.0.0` (all `private: true`, never resolved by version). The version is surfaced nowhere in the app — `metadata-action` derives the OCI `image.version` label from the tag itself, which is what the image actually carries. | `package.json` |
| **The workflow ran, and what reading could not settle is now settled** | Three things were unverifiable on paper and all three passed: **GHCR auth** via `GITHUB_TOKEN`; **`metadata-action`** did not choke on the `type=raw` entry whose value is empty on a tag push (`enable=false` skips it before value processing); and **`attest-build-provenance`** wrote to the attestation store — the permissions fix found by review (`attestations: write` alongside `id-token: write`) was correct and load-bearing. | [run 30733049897](https://github.com/wes-cutting/budgeteer/actions/runs/30733049897) |
| **`DEPLOY_CONTRACT` §1 now names a real artifact** | Was a shape (`e.g. v0.3.0`); is now the actual digest, its three tags, the source commit, the run, and a **pin-by-digest** instruction with the `gh attestation verify` line — plus the fact that the package is public, which is what tells the hub it needs no credential. | [`DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) §1 |
| **The 82 MB figure disambiguated** | `docker images` reported **400 MB** against a contract that said ~82 MB. Neither was wrong: 81.8 MB is the **compressed wire/pull** size (summed from the manifest's 13 layers), 400 MB is uncompressed on disk. The contract said neither, which is the number a Pi operator most needs. Both are now stated. | [`DEPLOY_CONTRACT.md`](../DEPLOY_CONTRACT.md) §1 |

## 2. Definition of Done — current state

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | All four from the kickoff: a real tag built and pushed an arm64 image with provenance ✅ · the digest is recorded in `DEPLOY_CONTRACT` ✅ · a pull of that digest verified **from outside CI** ✅ · roadmap row and image section updated in the same change ✅. |
| Gate green (types/lint/format/tests/e2e/build) | ✅ | Run on the tagged tree: `typecheck` ✅ · `lint` ✅ · `format` ✅ · `docs:check` ✅ · **483 Vitest** ✅ (24.4 s) · **124 e2e** ✅ (5.8 min, colima stopped) · **build** ✅ both workspaces. The harness (`validate-deploy.sh`, 24/24) was **not** re-run — it builds its own local image, so it does not exercise the published one; the compose smoke test below is the stronger check for this slice. |
| Usable end-to-end (data→API→UI) | ✅ | The published image was stood up with the **reference `deploy/compose.yaml`**, image pinned to the digest: `/api/health` → `{"status":"ok","db":"ok"}` (migrations ran against real Postgres 16), `GET /` → 200 (SPA served), and `/api/accounts`, `/api/envelopes`, `/api/transactions`, `/api/auth/me` all → **401** without a session, confirming default-deny is on in the artifact itself. Torn down with `down -v`; no containers or volumes left behind. |
| Docs updated in same change | ✅ | `DEPLOY_CONTRACT` §1 (digest, tags, provenance, public registry, pin-by-digest, size split) · roadmap `BUD-S84` row (⚠ Unexecuted → ✅ proven, with the run link) · roadmap `BUD-E14` summary line (two remaining items → one). |
| Security (input/authz/secrets) | ✅ | No credential was created or stored: GHCR auth used the ephemeral `GITHUB_TOKEN`, the pull needed **none at all** (public package), and the smoke test's `POSTGRES_PASSWORD`/`SESSION_SECRET` were `openssl rand` values that lived only in one shell invocation and went away with `down -v`. The provenance attestation is the security *gain* here: the hub can verify the image was built by this workflow from commit `1f478ab` rather than trusting a mutable tag. |
| Accessibility | n/a | No UI change in this slice. (An accessibility gap **inherited** from `BUD-S87`/`BUD-S88` is carried in §4 — it is not from this slice, but it is real and now recorded.) |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 483 | **483** | 0 |
| E2E | 124 | 124 | 0 |
| Deployment harness | 24 | 24 | 0 (not re-run — see §2) |

No new automated tests: this slice's subject is a CI workflow and a registry, neither of which the
Vitest/Playwright layers can reach. The verification is correspondingly **manual and evidenced** —
digest, provenance, pull, boot, and default-deny probes are all recorded above and reproducible from
§6.

**The run was interrogated rather than trusted.** It finished in **2 m 46 s**, against a prediction of
tens of minutes, which is exactly the shape of a build that silently did nothing — so the log was
checked before the result was accepted: **0 `CACHED` layers**, `npm ci` really executing (513 packages
in 1 m in the builder, 96 in 29 s in the runtime), Vite really building. The emulation penalty *is*
visible where it should be — Vite took **22.67 s** in CI against **543 ms** locally, ~40× — and absent
where it should be, because `npm ci` is network- and I/O-bound, not CPU-bound. The prediction was
wrong; the build was real. The decisive confirmation is independent of the log: the registry manifest
declares `"architecture": "arm64"`, and the pulled image reports `arch: arm64`.

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **No axe scan of `/login` or the Users page** | Found while filling the PR checklist, not by a failing test — which is the point: the 58-test axe suite is green and simply never looks at either surface. `BUD-S87` shipped the login page with **no accessibility line in its report at all**; `BUD-S88` scanned the admin-only Users *nav entry*, not the page. Two shipped UI surfaces have never been checked against WCAG 2.2 AA. Small to close: two `test.describe` blocks in `e2e/a11y.spec.ts`, light + dark. **This is the recommended next item.** | Next slice |
| **At-rest encryption** | `BUD-S85`'s other half; belongs to labs-hub SPIKE-03. A deployed hub is unencrypted at rest. The **only** thing still open on `BUD-E14`. | Owner + labs-hub SPIKE-03 |
| **TLS vs `SESSION_COOKIE_SECURE=false`** | A deployment decision, before going live ([contract §5](../DEPLOY_CONTRACT.md)). Now more concrete: there is a real image to deploy. | Owner, pre-launch |
| **`latest` is computed twice** | Cosmetic, no impact — the same tag is pushed once. `metadata-action`'s default `flavor: latest=auto` already adds `latest` for a non-prerelease semver tag, so the explicit `type=raw,value=latest,enable=…` rule duplicates it. Worth knowing that **removing the explicit rule would not disable `latest`**; the guard that keeps pre-releases out of `latest` is `latest=auto`, not that line. Left alone deliberately — changing a workflow immediately after proving it works, without re-proving it, is a bad trade. | Follow-up (optional) |
| **`scripts/**` is not typechecked** | No `tsconfig` includes it (eslint only). Pre-existing, noticed in `BUD-S90`. | Tidy-up |
| **Dev/CI run Node 20, the image runs Node 22** | Deliberate for the image (Node 20 went EOL April 2026), but the runtime is exercised on a version the gate never uses. GitHub also now warns that Node 20 actions are being forced onto Node 24 on the runners. | Tidy-up |

## 5. Outstanding & next steps

- **`BUD-E14` is functionally complete except at-rest encryption.** The deployment story now has no unexercised link: build ✅, contract ✅, recovery ✅, publish ✅, pull ✅.
- **labs-hub `LH-S3` can proceed against a real artifact** — a public, digest-pinnable, provenance-attested image, rather than against a promise.
- **Recommended next item: the two missing a11y scans** (§4). It is the only *unchecked Definition-of-Done box* on shipped UI, which outranks the tidy-ups.

## 6. Commands & gotchas (cold-start)

```sh
npm install
npm run typecheck && npm run lint && npm run format && npm run docs:check
npx vitest run                 # 483
npx playwright test            # 124 — needs :3001 and :5173 free, and colima STOPPED
./scripts/validate-deploy.sh   # 24 deployment checks; needs `colima start`
```

Reproduce this slice's verification (needs `colima start`):

```sh
D=sha256:ef088340334264d6ceb818e356de11224278c62c3d09626e70fd266161e71da2
docker pull ghcr.io/wes-cutting/budgeteer@$D
gh attestation verify oci://ghcr.io/wes-cutting/budgeteer@$D --owner wes-cutting
BUDGETEER_IMAGE=ghcr.io/wes-cutting/budgeteer@$D BUDGETEER_PORT=3098 \
  POSTGRES_PASSWORD=$(openssl rand -hex 8) SESSION_SECRET=$(openssl rand -base64 48) \
  SESSION_COOKIE_SECURE=false \
  docker compose -p budgeteer-smoke -f deploy/compose.yaml up -d
curl -s http://127.0.0.1:3098/api/health      # {"status":"ok","db":"ok"}
```

- **A pushed tag is spent.** A failed publish is fixed forward with a commit and a *new* tag, never by moving one.
- **Tag whatever commit reaches `main`.** With a PR merge that is the merge commit, not the branch tip — check the tree hash matches what you gated.
- **Tear the smoke stack down with the same env exported**, or compose refuses to interpolate the required vars and `down` fails.
- **`colima stop` before e2e, `colima start` before anything docker, never both at once.**
- A green Actions run proves a **push**, not a **pull**: package visibility is a separate axis. Here it was public because the repo is public and the package inherits that — do not assume it for a private repo.
- The API is at **`/api`**; `VITE_API_BASE_URL` is the **origin only**.

## 7. Next-session kickoff prompt

```text
You are resuming budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST file in docs/status-reports/ (2026-08-02, BUD-S84) — its "Resume here" has state.
- Read docs/03_ROADMAP-v2.md — BUD-E14 is complete except at-rest encryption (labs-hub SPIKE-03).

budgeteer is deployed-ready and now genuinely published: tag v0.1.0 built
ghcr.io/wes-cutting/budgeteer@sha256:ef0883…71da2 (public, arm64, 81.8 MB, SLSA provenance), and it
has been pulled, booted from the reference compose file, and confirmed default-deny — all from
outside CI. Gate: 483 Vitest + 124 e2e, plus ./scripts/validate-deploy.sh (24 checks, needs
`colima start`).

YOUR ONE ITEM THIS SESSION — close the accessibility gap on the two auth surfaces.

e2e/a11y.spec.ts has 58 axe tests and is green, but it has NEVER scanned the /login page or the
Users management page. Both are shipped UI. BUD-S87 landed the login page with no accessibility line
in its report at all; BUD-S88 scanned the admin-only Users *nav entry*, not the page behind it. This
was found by filling in a PR checklist, not by a failing test — the suite stays green precisely
because it does not look there, so do not treat "e2e passes" as evidence of anything here.

Scope it as a normal vertical slice:
- Add axe scans for /login (unauthenticated — note the suite's globalSetup signs in, so this spec
  needs its own isolated context, the way auth.spec.ts already does it) and for the Users page as an
  admin, both in light AND dark mode, matching the existing describe-block style.
- FIX what the scans find. Finding violations is the expected outcome, not a surprise — if both
  surfaces come back clean on the first run, be suspicious that the scan is not actually rendering
  the surface, and prove it is by asserting on a known element before scanning.
- WCAG 2.2 AA is the bar (CLAUDE.md); respect prefers-reduced-motion if you touch motion.
- Update the BUD-S87/BUD-S88 accessibility record honestly — those reports claimed a DoD that the
  tests did not cover. Do not rewrite history; note it in the new report.

Done when: /login and the Users page are both covered by passing axe scans in light and dark, any
violations found are fixed, and the e2e count has gone up from 124.

Build ONLY that, then write the status report and STOP for review — do not continue into the items
below even if they look quick and you have context left (CLAUDE.md; 00_WAYS_OF_WORKING §9).

For CONTEXT only, not for this session — still open:
- At-rest encryption (BUD-S85's other half) belongs to labs-hub SPIKE-03. It is the LAST BUD-E14 item.
- TLS vs SESSION_COOKIE_SECURE=false is an owner decision before going live (DEPLOY_CONTRACT §5).
- Tidy-ups: scripts/** is not covered by any tsconfig (eslint only); dev/CI run Node 20 while the
  image runs Node 22; publish-image.yml computes `latest` twice (cosmetic, explained in the
  2026-08-02 report §4).

Watch out for:
- Run `colima stop` BEFORE e2e — an idle colima VM alone makes full e2e runs take 7.5-34.8 min and
  flake a random spec on 30s timeouts; stopped, it is ~5.9 min and 124/124.
- Never run the deploy harness and e2e at the same time.
- The API lives under /api as of BUD-S81; VITE_API_BASE_URL is the ORIGIN only.
- A freshly seeded store has NO user by design (BUD-S90) — create-admin or first-run /api/auth/setup.

Gate: npm run typecheck && npm run lint && npm run format && npm run docs:check && npm test &&
npm run test:e2e  (floor: 483 Vitest + 124 e2e, and e2e MUST end higher than 124).

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change. Leave the work UNCOMMITTED with
a proposed Conventional-Commit message — the owner reviews and commits. End handoff-ready with
the next-session kickoff prompt (naming ONE item) in the status report.
```
