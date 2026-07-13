---
type: status-report
roadmap-item: BUD-S70
status: Snapshot
---
<!--
STATUS REPORT — UXR8 (demo-grade synthetic seed), the first code of the UX-Redesign track.
Right-sized per 00 §9/§11: a small tooling slice (no user-facing surface, no new gate tests),
so the DoD table reflects a dev-tool, not a vertical UI slice. Newest report = the live handoff.
-->

# Status Report — 2026-07-07 (UXR8 — demo seed)

| Field  | Value                                                                        |
| ------ | ---------------------------------------------------------------------------- |
| Status | Snapshot                                                                     |
| Date   | 2026-07-07                                                                   |
| Author | Claude (with the owner)                                                      |
| Scope  | UXR8 built + `Done`; delta since [2026-07-07-uxr-scoping.md](2026-07-07-uxr-scoping.md) |

**Resume here:** **UXR8 is `Done`** — a new standalone **`npm run seed:demo`**
([`apps/api/src/db/seedDemo.ts`](../../apps/api/src/db/seedDemo.ts)) generates a deterministic,
strictly-synthetic ~6-month dataset so Insights, the pay-period planner, and the Templates page
show real patterns during design/dev. The baseline `seed` is **byte-identical (no diff)**, so the
gate and e2e/K24 isolation are unaffected — the gate is **green (415 Vitest + 99 e2e)**. One
design tension in the FEAT note was resolved by the owner mid-build: **standalone into a fresh
store** (refuses an occupied store, EH10), *not* layered on the baseline seed; the note + roadmap
now record that. **Next: UXR1 (the sidebar shell)** — owner-nodded to `Ready`; a large,
whole-slice chrome rewrite (see §7 for the kickoff prompt and the risk map).

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| `seed:demo` script | Standalone rich synthetic seed; deterministic (mulberry32, fixed seed); refuses an occupied store | [`seedDemo.ts`](../../apps/api/src/db/seedDemo.ts) · [`apps/api/package.json`](../../apps/api/package.json) |
| FEAT note → `Implemented` | Status flipped; the **standalone-vs-layered tension resolved** in the doc (owner call); flow corrected 3-step → **2-step** (`db:reset && seed:demo`); verification stamp added | [features/demo-seed.md](../features/demo-seed.md) |
| Roadmap | UXR8 row → **Done**; changelog row; "Next fronts" now points at UXR1 | [03_ROADMAP.md](../03_ROADMAP.md) |
| README | `seed:demo` documented (flow, determinism, refusal); `PGLITE_DIR` note updated | [README.md](../../README.md) |

## 2. Definition of Done — current state (a tooling slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ | Two fresh runs → identical content (216 txns, matching fingerprint) = deterministic; occupied-store run **refused** (EH10 message); a **7-bucket** `GET /analysis/pay-periods` plan against the demo store with the month-boundary bills spread across paychecks = the boundary-cluster claim. Content: 4 accts · 22 envs · 462 allocs · 8 recurring · 3 templates · 13 targets · credit 31% util · loan 440k/1.8M paid down |
| Gate green | ✅ | `typecheck · lint · format · unit · e2e · build · SCA` all pass — **415 Vitest + 99 e2e**, build 118.67 KB gz, audit clean at `--audit-level=critical` |
| Usable end-to-end | ✅ | `db:reset && seed:demo && dev` yields a lived-in app; verified the pay-periods endpoint end-to-end against the demo store |
| Docs updated in same change | ✅ | FEAT note · roadmap (row + changelog + next-fronts) · README — all in this change; prettier-clean |
| Security | ✅ | **Strictly synthetic** — invented payees/amounts/account names only, no real creditor (SECURITY.md, SPIKE-08 redaction stance); non-destructive (refuses occupied store); prints no row contents |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 415 | 415 | 0 (standalone dev tool — nothing imports it; no new gate tests) |
| E2E | 99 | 99 | 0 (e2e never touches the demo store) |

> No automated tests were added: `seed:demo` is a dev-only tool outside the gate's blast radius,
> exercised here by manual determinism/refusal/endpoint verification (§2). Adding a test would
> mean coupling the gate to the demo dataset — the opposite of the isolation the baseline `seed`
> is kept lean for.

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Real-data richness | `seed:demo` is the **dev-time proxy**; the durable unlock is the deferred **history import `#17`/`#18`** | Owner, when that track starts |
| Drop the reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from the scoping report) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Untouched by UXR8; still the roadmap's open decision | Owner |

## 5. Outstanding & next steps

- Commit (suggested: `feat: UXR8 — standalone demo-grade synthetic seed (seed:demo)`).
- Build **UXR1** next (brief §5 order): the sidebar app shell — see §7.

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical

# Lean dev baseline (what e2e/K24 depend on — do not change its determinism):
npm run db:fresh                              # = db:reset && seed
# Rich demo dataset for design/dev (standalone; fresh store only):
npm run db:reset && npm run seed:demo --workspace @budgeteer/api
```

- `seed:demo` **refuses a non-empty store** — always `db:reset` first (or point `PGLITE_DIR` at a
  fresh dir). It is deterministic: same data every run/machine.
- **Do not** fold demo data into the baseline `seed` — its byte-for-byte determinism is an
  e2e/K24 invariant.
- UXR1 is the next build and touches **every view's `<h1>`** — expect broad-but-shallow test
  churn (heading assertions re-point from view → shell). It's fully specced (FEAT-UXR1 §3).

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr8-demo-seed.md — its
  "Resume here" has state (UXR8 is Done; the gate is green at 415 Vitest + 99 e2e).
- Read docs/03_ROADMAP.md — the next item is UXR1 (sidebar app shell), owner-nodded to Ready.

Next milestone: UXR1 — replace the top-banner chrome with the reference layout (grouped left
sidebar: Budget · Ledgers · Planning · Administration, footer = Add transaction; a top bar with
the collapse toggle + the page <h1> title + a compact + Add at ≤ 640px; the route as content
canvas). Desktop collapse-to-rail (persisted, client-side); ≤ 640px off-canvas drawer on the
Radix Dialog machinery. NO route/data/API/domain change. Spec of record: docs/ux/app-shell-
sidebar.md (Proposed, every §11 Q resolved) + docs/features/app-shell-sidebar.md (FEAT-UXR1).

Watch out for: (1) blast radius — the shell takes ownership of the single <h1>, so EVERY routed
view (~16) drops its <h1> and demotes its top heading to <h2>, and every heading assertion in
unit + e2e re-points to the shell (FEAT-UXR1 §3); (2) dynamic titles — account register /
envelope ledger publish their resolved name via a shell title context (kind-label fallback until
data arrives), while static routes title via route `handle` + useMatches(); (3) the drawer is a
new a11y surface — ride the Dialog focus trap/Esc/restore, don't hand-roll; (4) icons — copy ~12
lucide (ISC) SVG paths into a repo-owned ui/icons.tsx (attribution + license kept), zero
dependency; (5) bundle budget is 140 KB gz (07_NFR §1³) — log the delta (expected ≈ +2–4 KB);
(6) e2e/setup.ts nav helpers re-point to the sidebar, and a11y.spec.ts gains rail + drawer scans
(light AND dark), 320px reflow stays green. Gate: the command block in §6.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (FEAT-UXR1 → Implemented, mark
FEAT-UX3's chrome superseded, NFR bundle delta, roadmap); and at the end leave the project
handoff-ready with the next-session kickoff prompt (for UXR2) in the status report.
```
