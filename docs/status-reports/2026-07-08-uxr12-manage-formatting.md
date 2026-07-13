---
type: status-report
roadmap-item: BUD-S74
---
<!--
STATUS REPORT — UXR12 (Manage page formatting). The FIFTH and FINAL slice of the post-track polish batch
(UXR9–UXR13), an owner-directed batch opened after the UXR1–UXR8 UX Redesign track closed. Presentation-only:
re-laid ManageView's net-worth summary on the shared Ledgers.module.css table treatment and turned the two
management links into design-system button-like <Link>s. No data/API/domain change. With UXR12 done the whole
UXR9–UXR13 batch is CLOSED. Newest report = the live handoff; the next front is the owner's call.
-->

# Status Report — 2026-07-08 (UXR12 — Manage page formatting)

| Field  | Value                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                                |
| Date   | 2026-07-08                                                                                              |
| Author | Claude (with the owner)                                                                                 |
| Scope  | UXR12 built + `Done`; delta since [2026-07-08-uxr13-allocate-form.md](2026-07-08-uxr13-allocate-form.md) |

**Resume here:** **UXR12 is `Done` — the fifth and final slice of the owner-directed post-track polish batch
(`UXR9`–`UXR13`); with it the whole batch is closed.** Two presentation-only changes on
[`ManageView`](../../apps/web/src/ManageView.tsx): **(1)** the **net-worth summary** — previously a raw
`<table>` with an inline `text-align: right` style on each `<td>` and a visible `<caption>` redundant with the
section `<h2>` — now uses the shared UXR3 [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) `.table`
treatment (bordered rows + padding, `.numeric` right-aligned tabular money), wrapped in the global
`.table-scroll` group (phone-safe), with the caption made `className="sr-only"` (the `<h2>Net worth` already
labels the section — the same convention the Accounts/Envelopes tables use). **(2)** the two **management
links** (`Accounts` · `Envelopes`) become a row of design-system button-like `<Link>`s — a new small
[`ManageView.module.css`](../../apps/web/src/ManageView.module.css) mirrors `ui/Button`'s default variant
(border + surface + radius, hover to surface-2) — in place of the bare bullet list. **Behaviour byte-for-byte:**
the `Management` `<nav>` keeps its `aria-label` and both links' visible names + hrefs (`/accounts`,
`/envelopes`); the net-worth table keeps its accessible name (`Net worth summary`, via the sr-only caption) and
its figures; the empty-state prompt and the Move-money form (already UXR7-patterned) are untouched — so all four
[`ManageView.test.tsx`](../../apps/web/src/ManageView.test.tsx) specs pass unchanged. **No data/API/domain
change.** Verified live via preview: `/manage` renders the bordered net-worth table (right-aligned tabular
figures) and the two pill links, matching the rest of the app; the `Management` nav + `Net worth summary` table
resolve in the a11y tree; **no console errors**. Gate **green** — **433 Vitest + 121 e2e** (tests
**unchanged**); build **125.52 KB gz** (+0.04 vs 125.48; CSS **+0.04 → 5.41** — the new module; ~14.5 KB under
the 140 KB budget). **The `UXR9`–`UXR13` polish batch is complete. Next front is the owner's call** — the
standing backlog is `#17`/`#18` (SPIKE-03 history profiling → historical import) or the deferred `#19`/`#20`;
the open FEAT-S7 §5 decision also still stands.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Net-worth table on the Ledgers treatment | `<table className={ledger.table}>` in a `.table-scroll` group; money cells `className={ledger.numeric}` (dropped the inline `NUM` style const); caption → `className="sr-only"` (section `<h2>` labels it) | [`ManageView.tsx`](../../apps/web/src/ManageView.tsx) · [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) |
| Management links as button-like `<Link>`s | The `<ul>`/`<li>`/`<Link>` list keeps its roles/names/hrefs; a new `.links` (flex row, no bullets) + `.link` (bordered pill mirroring `ui/Button` default) restyle it | [`ManageView.tsx`](../../apps/web/src/ManageView.tsx) · [`ManageView.module.css`](../../apps/web/src/ManageView.module.css) (new) |
| Accessible structure preserved | `Management` nav `aria-label`, `Accounts`/`Envelopes` link names + hrefs, and the `Net worth summary` table name (sr-only caption) all unchanged | [`ManageView.tsx`](../../apps/web/src/ManageView.tsx) |
| Move-money untouched | Already on the form pattern (UXR7); no change | — |
| Tests | Unchanged — all four `ManageView.test.tsx` specs (links, net-worth-by-kind, empty prompt, Move-money) pass as-is | [`ManageView.test.tsx`](../../apps/web/src/ManageView.test.tsx) |
| Docs | Roadmap (UXR12 row → `Done`, focus + next-fronts + §5 log; batch closed); `07_NFR` §1³ bundle delta (+0.04 → 125.52, CSS +0.04 → 5.41); this report | this change |

## 2. Definition of Done — current state (a presentation-only design-system adoption)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The `/manage` hub now reads consistently with the rest of the app — the net-worth summary is a bordered ledger table with right-aligned tabular figures, the management links are design-system pills. Verified live. No data/API/domain change. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **433 Vitest + 121 e2e**, build **125.52 KB gz**, `npm audit --omit=dev --audit-level=critical` exit 0 (3 pre-existing *high* advisories below the gate threshold). |
| Acceptance criteria met & tested | ✅ | Net-worth table on the treatment + links restyled — verified live; the four `ManageView.test.tsx` specs (which assert the nav links' names/hrefs, the net-worth figures by kind, the empty prompt, and Move-money availability) pass unchanged. |
| A11y (WCAG 2.2 AA) | ✅ | Every accessible name preserved (nav `aria-label`, link names, table name via sr-only caption); the pill links keep the ≥ 24px tap target and text-not-colour affordance; `.table-scroll` keeps the table keyboard-scrollable and phone-safe. |
| Input validation & secrets | ✅ | No schema/endpoint change; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | Roadmap (UXR12 row + focus + next-fronts + §5) · `07_NFR` §1³ · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 433 | 433 | 0 — pure restyle; the four ManageView specs pass unchanged (names/hrefs/figures preserved) |
| E2E | 121 | 121 | 0 — no e2e drives `/manage` formatting directly; the transfers/reallocation flows (which touch Move-money) pass unchanged |

## 4. Design notes / small calls

- **The net-worth summary is a real ledger table now.** It had the same shape as the Accounts/Envelopes
  tables (rows of a row-header + a right-aligned money cell) but rendered raw, with an inline `text-align`
  style. Adopting `Ledgers.module.css` `.table` + `.numeric` lines its figures up the same way as every other
  table in the app — the exact "reference look" UXR3 defined. No new table CSS; it reuses the shared module.
- **Caption → `sr-only` (the ledger convention).** The section already has a visible `<h2>Net worth`, so a
  second visible "Net worth summary" caption was redundant. Every ledger table with a heading uses an sr-only
  caption; ManageView now matches. The caption text is unchanged, so the table's accessible name (and the
  `findByRole("table", { name: "Net worth summary" })` selector) is preserved.
- **Management links as pills, not a new component.** The links must stay `<Link>`s (router navigation) with
  their existing names/hrefs (the tests + a11y depend on it), so rather than force them through the `Button`
  component (which renders a `<button>`), a tiny `ManageView.module.css` mirrors `ui/Button`'s default variant
  on the `<Link>`s. They read as affordances consistent with the design system without changing the DOM
  contract. (The accent `.cta` link style from FirstRunOnboarding was the alternative, but accent is for
  primary actions — these are secondary shortcuts, so the neutral/default weight is the right call.)
- **Scope held to the two raw surfaces.** Move-money was already patterned (UXR7) and the section structure
  (`<section aria-labelledby>` + `<h2>`) was already consistent — so UXR12 touched only the net-worth table and
  the link list, the two things that still read raw.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR12) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR12 code — both passed clean this run | Not blocking; watch |
| **Polish batch is closed** — `UXR9`–`UXR13` all `Done` | No batch work remains; the next front (historical import `#17`/`#18`, or deferred `#19`/`#20`) is the owner's call | Owner |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); a **dev stack**
  (`npm run dev` + `tsx watch`) auto-respawns on those ports, so **stop it before running e2e** (kill the
  `npm run dev` + `tsx watch` parents, not just the leaves — `tsx watch` restarts the API on crash). Preview
  needs the same ports: start both the `api` and `web` launch configs, and **stop them before the e2e gate**.
- **The Manage hub** = [`ManageView`](../../apps/web/src/ManageView.tsx) (`/manage`). Its net-worth table now
  uses [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css); its links use the new
  [`ManageView.module.css`](../../apps/web/src/ManageView.module.css). Move-money is
  [`MoveMoneyForm`](../../apps/web/src/MoveMoneyForm.tsx) (UXR7, on the form pattern).
- **The shared table treatment** = `Ledgers.module.css` (`.table`, `.numeric`, `.subNote`, `.actions`) + the
  global `.table-scroll` region (base.css, UX15). Consumers: Accounts, Envelopes, Needs allocation, Templates,
  Recurring, and now the ManageView net-worth summary.
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-08-uxr12-manage-formatting.md — its
  "Resume here" has state (UXR12 Manage formatting is Done; the entire UXR9–UXR13 post-track polish
  batch is now CLOSED; gate green at 433 Vitest + 121 e2e, build 125.52 KB gz; the two pre-existing
  e2e flakes are watch-only).
- Read docs/03_ROADMAP.md — the "Current focus", "Next fronts", and §4 tables.

The owner-directed post-track polish batch (UXR9–UXR13) is COMPLETE — all five slices are Done and
the whole UX Redesign initiative before it (UXR1–UXR8) is done. There is no queued next item; the
next front is the owner's call. Confirm direction with the owner before starting new work. The
candidates on the board:
- #17/#18 — SPIKE-03 history profiling → historical import (the last unstarted V1-era track; also the
  durable fix for the UXR8 "seeded demo data" callout). This is a real vertical slice (data → API →
  UI), NOT presentation-only — it needs a spike first (profile real history shape) per the
  "reality before paper" rule, and likely ceremony scale-up (docs/00 §11) if it touches the data model.
- The deferred #19/#20 items.
- The open FEAT-S7 §5 decision (ratify or veto the pay-period latest-fit divergence) — an owner
  decision that gates whether the bill↔paycheck assignment store gets scoped.

Ask the owner which front to take. Keep it vertical and gate-green; spike unproven assumptions before
the spec/ADR that depends on them; update docs in the same change; leave the project handoff-ready with
a next-session kickoff prompt. NOTE: the e2e gate needs ports 3001/5173 free — a running dev stack
(npm run dev + tsx watch) must be stopped first. Provide a single-line short commit message; the owner
reviews and commits.
```
