<!--
STATUS REPORT — UXR3 (Ledgers tables). Presentation-only: the three Ledgers-group lists (Accounts ·
Envelopes · Needs allocation) become real design-system tables over one shared treatment, plus the
Accounts page-local Add-transaction button. No data/API/domain change. Newest report = the live
handoff + launch pad for UXR4.
-->

# Status Report — 2026-07-07 (UXR3 — Ledgers tables)

| Field  | Value                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                  |
| Date   | 2026-07-07                                                                                |
| Author | Claude (with the owner)                                                                   |
| Scope  | UXR3 built + `Done`; delta since [2026-07-07-uxr2-pay-period-planner.md](2026-07-07-uxr2-pay-period-planner.md) |

**Resume here:** **UXR3 is `Done`** — the three Ledgers-group pages now render as real
design-system tables, **presentation-only** over the existing UX6/R5 reads (no data/API/domain
touched). **Accounts** (Name · Kind · Balance · Actions) · **Envelopes** (+ the R5 Target · Spent ·
Remaining columns, showing figures only when a target is set, **"—" otherwise** — no faked $0) ·
**Needs allocation** (Date · Payee/memo · Account · Amount, with the list's **"needs $X"** remainder
kept as a muted sub-line and the Allocate editor expanding in-row). One shared treatment in
**[`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css)** (a new scoped module — kept out of
UXR2's `Insights.module.css` so the two ledger surfaces never entangle; both token-derived so the
look matches). Each table sits in the global `.table-scroll` focusable region (**320px reflow
verified** — the page holds while only the table scrolls); `<th scope="col">` headers; the name cell
is a `<th scope="row">` `<Link>` on Accounts/Envelopes; archived rows stay a **separate named
table**. **Needs gains a Date column** (`occurredOn`, already in the read — no API change).
**Accounts page-local Add transaction** is a `<Link>` → the UX7 `/transactions/new` modal (UXR1 §11
Q2's additive half; `default` variant so **Add account** stays the accent primary). Gate **green** —
**427 Vitest + 110 e2e**; build **124.09 KB gz** (+0.29 vs 123.80; ~15.9 KB under the 140 KB
budget). **Next: UXR4 (Templates page)** — §7 kickoff.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Shared table treatment | New `Ledgers.module.css` (`.table` · `.numeric` · `.actions` · `.subNote`) imported by all three pages; mirrors the Insights table look off the same tokens but stays a separate scoped module (never reaches into UXR2's CSS) | [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) |
| Accounts → table | Active + archived (behind the Show-archived toggle) tables; name = `<th scope="row">` `<Link>` (inline rename swaps that cell for input+Save); Rename/Archive/Unarchive carry per-row accessible names in an Actions cell; **page-local Add transaction `<Link>`** → `/transactions/new` | [`AccountsList.tsx`](../../apps/web/src/AccountsList.tsx) |
| Envelopes → table | Name · Kind · Balance · **Target · Spent · Remaining** (R5 — figures only when a target is set, `—` otherwise) · Actions; archived section its own named table; `EnvelopeBudgetInline` → `EnvelopeBudgetCells` (three cells) | [`EnvelopesList.tsx`](../../apps/web/src/EnvelopesList.tsx) |
| Needs allocation → table | Date · Payee/memo · Account · Amount (+ muted "needs $X" sub-line) · Actions; the unchanged `InlineAllocationEditor` expands inside the row's Actions cell; column headers only (no stable row identifier) | [`NeedsAllocation.tsx`](../../apps/web/src/NeedsAllocation.tsx) |
| UX spec → Implemented | `docs/ux/ledgers-tables.md` promoted + §8 "as built" added | [UX spec](../ux/ledgers-tables.md) |
| Tests | `AccountsList.test` +1 (Add-transaction link → `/transactions/new`); the 3 unit specs re-pointed `role="list"`→`role="table"` and the R5 assertions to columns; e2e (`setup.ts` helpers · accounts/envelopes/needs/routing/transactions/transfers/quick-add) re-pointed with `getByRole("row")` + **`exact:true`** on the table names (so "Accounts"/"Envelopes" don't substring-match "Archived …") | unit + `e2e/` |
| Docs | UX spec → `Implemented` (+§8); `07_NFR` §1³ bundle delta; roadmap (row `Done` + focus + next-build + changelog); this report | this change |

## 2. Definition of Done — current state (a presentation-only UI slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The three scan-and-act pages render as real tables with their numbers lined up in columns; every carried behavior works against the running app (verified live on the demo seed: rename, archive+toggle, R5 columns with "—" placeholders, the allocate editor in-row, the Accounts Add-transaction link). No data/API/domain change — the same reads behind a new shape. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **427 Vitest + 110 e2e**, build **124.09 KB gz**, audit clean at `--audit-level=critical`. (Two independent **pre-existing** e2e flakes carried from UXR2 — `spend by envelope` cold-start, `transfers` delete — remain watch-only, not UXR3 code; see §5.) |
| Acceptance criteria met & tested (UX §6) | ✅ | Each page renders as a real table per §3 with all §2 behaviors intact; the Accounts header shows **Add transaction** → the UX7 quick-add modal route; empty/loading(Skeleton)/error(`role="alert"`) render per §4; existing unit/e2e specs pass with selectors re-pointed, no flow rewritten. |
| A11y (WCAG 2.2 AA) | ✅ | Real tables (`<th scope="col">`; name cell `<th scope="row">` on Accounts/Envelopes; `sr-only <caption>` names each table); per-row action accessible names carried ("Rename Checking", "Archive Vacation", "Allocate"); each table in a `.table-scroll` focusable region — **320px reflow verified live** (page `scrollWidth == clientWidth`; only the region scrolls); axe light+dark re-run against the new markup via the existing management-surface scans. |
| Input validation & secrets | ✅ | No new inputs, no schema change; the UX12d inline-validation flow on Add account is unchanged; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | UX spec (`Implemented` + §8) · `07_NFR` §1³ · roadmap · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 426 | 427 | +1 (`AccountsList` Add-transaction link → `/transactions/new`; the 3 ledger specs re-pointed in place — table roles + R5 column/em-dash assertions, no net new tests there) |
| E2E | 110 | 110 | +0 (the accounts/envelopes/needs journeys re-pointed in place — `role="list"`→`role="table"`, `listitem`→`row`, `exact:true` table names; no new e2e added) |

## 4. Design notes / small calls

- **Where the shared CSS lives.** "One shared table treatment" → a **new `Ledgers.module.css`**
  rather than promoting `.table` to a global. The global route would force className changes in
  UXR2's `PayPeriodsView`/`Insights.module.css` — code the slice was told to leave untouched — so a
  separate scoped module (both token-derived, so the look matches) was the minimal-blast-radius
  choice.
- **Needs allocation columns.** The spec §3 lists **Date · Payee/memo · Account · Amount**; the
  current list showed account/payee/amount/"needs $X" and **no date**. `occurredOn` is already in the
  read, so the Date column is a pure presentation add (no API change). The **"needs $X"** remainder
  the list showed is kept as a muted second line under Amount so no information is lost. Column
  headers only — a waiting transaction has no stable identifier to promote to a `<th scope="row">`.
- **`exact:true` on the e2e table names.** Renaming the list containers to table captions introduced
  a Playwright substring-name collision ("Archived accounts" contains "Accounts"); testing-library
  matches strings exactly so units were unaffected, but the Playwright locators needed `exact:true`.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Two flaky e2e tests (`spend by envelope`, `transfers` delete) | Pre-existing cold-start/timing flakes carried from UXR2 — **not UXR3 code**; pass on isolated retry | Not blocking; watch |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR3) | Owner |
| Sorting/filtering/pagination on the ledger tables | Out of scope (§7) — nothing needs it at household scale | Later, when felt |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); it starts its own
  throwaway-store server. Kill any dev/preview server on those ports first.
- **The three Ledgers pages share `Ledgers.module.css`** — the pay-period ledgers still use
  `Insights.module.css` (UXR2); they are deliberately two separate treatments.
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr3-ledgers-tables.md — its
  "Resume here" has state (UXR3 is Done; gate green at 427 Vitest + 110 e2e, build 124.09 KB gz;
  two known pre-existing e2e flakes noted in §5, not blocking).
- Read docs/03_ROADMAP.md — the next item is UXR4 (Templates page), gated by UXR1 + UXR8 (both Done).

Next milestone: UXR4 — Templates page. Turn the saved-templates LIST into a design-system table AND
re-organize the template editor (name + multi-row envelope/amount lines). This slice ESTABLISHES the
form-layout pattern that UXR5 (Recurring) and UXR7 (Manage) reuse — so get the pattern right here;
its §3 in the spec is the reference. Spec of record: docs/ux/templates-page.md (Proposed).

Watch out for: (1) presentation-only over the current reads — do NOT change data/API/domain or the
existing template create/edit/delete flows; verify the exact control set against TemplatesView at
build. (2) the shell owns the <h1> (UXR1); content headings start at <h2>. (3) reuse the UXR3 table
treatment where the saved-templates list becomes a table — decide whether Ledgers.module.css
generalizes or Templates gets its own module (the form-layout pattern is the new part). (4) table +
form bar: <th> scope semantics · per-row accessible names · UX15 reflow (.table-scroll, 320px) ·
axe light AND dark. (5) e2e that drives Templates (templates.spec, setup.ts helpers) will need
re-pointing. (6) demo data: npm run db:reset --workspace @budgeteer/api && npm run seed:demo
--workspace @budgeteer/api.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (UX spec → Implemented, NFR bundle
delta, roadmap); and at the end leave the project handoff-ready with the next-session kickoff prompt
(for UXR5/UXR6/parallel next item) in the status report. Provide a single-line short commit message; 
I will review and commit when ready.
```
