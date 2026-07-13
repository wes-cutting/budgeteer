---
type: status-report
roadmap-item: BUD-S64
status: Snapshot
---
<!--
STATUS REPORT — UXR2 (pay-period planner), the first UX-Redesign slice to touch data/API. Promotes
the S7 Insights tab to a first-class /pay-periods planner (two side-by-side ledgers) and adds two
additive read fields (projectedBalanceCents + reserveCents). Newest report = the live handoff +
launch pad for UXR3.
-->

# Status Report — 2026-07-07 (UXR2 — pay-period planner)

| Field  | Value                                                                          |
| ------ | ------------------------------------------------------------------------------ |
| Status | Snapshot                                                                       |
| Date   | 2026-07-07                                                                     |
| Author | Claude (with the owner)                                                        |
| Scope  | UXR2 built + `Done`; delta since [2026-07-07-uxr1-sidebar-shell.md](2026-07-07-uxr1-sidebar-shell.md) |

**Resume here:** **UXR2 is `Done`** — the S7 pay-periods surface is reworked into the sheet's
planner shape. **Placement:** promoted from the Insights tab to a first-class **`/pay-periods`**
route (sidebar Planning item retargets + lights `aria-current`; `/insights/pay-periods` →
`<Navigate replace>`; the Insights sub-nav drops the tab — this **retires the UXR1 transitional
dual-highlight**). **Presentation:** the stacked per-check sections are re-laid as **two
side-by-side ledgers** — **Bills** (bill · due · amount · month-scoped **left-to-pay** countdown +
per-month subtotal rows + a 90-day pane figure · **Covered by**) ‖ **Paychecks** (payday · income ·
committed · **per-check headroom** · **projected balance** · **reserve** · status) — whole horizon
on one screen, stacking ≤ 640px (Paychecks first). Selection is `aria-pressed` payday toggles that
highlight covered bills, **additive over the permanent "Covered by" text join** (colour-only join
stays banned), announced via a polite `role="status"` line. **Data (the first UXR API touch):** two
**additive** fields on `GET /analysis/pay-periods` — `projectedBalanceCents` (forecast cash-flow
math read off as of each payday; reconciles with the forecast endpoint) and `reserveCents` (running
Σ of per-check headroom). **Cockpit:** the Upcoming panel gains a **Next paycheck** deep-link line
(in-slice). Gate **green** — **426 Vitest + 110 e2e**; build **123.80 KB gz** (+1.29 vs 122.51;
~16 KB under the 140 KB budget). **Next: UXR3 (Ledgers tables)** — §7 kickoff.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Domain: two additive figures | `payPeriodPlan` emits `projectedBalanceCents` (forecast event-walk — scheduled + `evenDaily` `includeExpected` spend — summed as of each `committedOn`) and `reserveCents` (running Σ of per-check headroom, seeded by bucket zero, no clamp) | [`payperiod.ts`](../../packages/domain/src/payperiod.ts) |
| Reserve ≡ headroomAfter (raised) | Reserve as specced equals the plan's existing `headroomAfterCents` exactly; flagged to the owner → **owner chose to surface `reserveCents` as its own field anyway** (self-documenting API, additive per EH12) | this change · [FEAT-UXR2 §8](../features/pay-periods-planner.md) |
| API contract + test | Fields flow through `PayPeriodBucket` → `PayPeriodPlanView`; the pay-periods API test asserts they're present and reconcile (reserveₙ = reserveₙ₋₁ + headroomₙ; balance = the forecast endpoint's balance as-of each payday) | [`pay-periods.test.ts`](../../apps/api/test/pay-periods.test.ts) · [`06_API_CONTRACT`](../06_API_CONTRACT.md) |
| View re-laid | `PayPeriodsView` → two `.table-scroll` ledgers (CSS grid; stacked ≤ 640px, Paychecks first); month subtotal rows + the 90-day pane figure (both countdown scopes **client-derived**); `aria-pressed` payday toggles + additive highlight + `role="status"` announcement; status badge carries S7 semantics exactly; shell owns `<h1>`, panes are the view's `<h2>`s | [`PayPeriodsView.tsx`](../../apps/web/src/PayPeriodsView.tsx) · [`Insights.module.css`](../../apps/web/src/Insights.module.css) |
| Placement | `/pay-periods` route (title handle) + `/insights/pay-periods` redirect (`routes.tsx`); Insights sub-nav drops the tab (`AnalysisSection`); sidebar Planning item retargets (`AppShell`) — dual-highlight retired | `routes.tsx` · `AnalysisSection.tsx` · `AppShell.tsx` |
| Cockpit (Q4) | Upcoming panel `NextPaycheckLine` (date · committed · headroom badge → `/pay-periods`), fed by one added `getPayPeriodPlan` call on the forecast account; degrades independently | [`Cockpit.tsx`](../../apps/web/src/Cockpit.tsx) |
| Tests | Domain +4 (reserve fold · over-committed run-down · balance-bucket · forecast reconciliation); `PayPeriodsView.test` rewritten for the two ledgers (5 → 6); `Cockpit.test` gains the Next-paycheck deep-link assertion; e2e re-pointed (`analysis.spec` two-ledger journey + redirect + sidebar-active; `a11y.spec` two-ledger scans light+dark + 320px reflow; `setup.ts` `openPayPeriods`) | unit + `e2e/` |
| Docs | FEAT-UXR2 → `Implemented` (+ §8 "as built"); UX spec → `Implemented`; `06_API_CONTRACT` additive fields + route note; `07_NFR` §1³ bundle delta; roadmap (row `Done` + focus + changelog); this report | this change |

## 2. Definition of Done — current state (a vertical UI + data slice)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Data → API → UI: the two additive server fields render as the planner's Balance/Reserve columns; the whole horizon reads on one screen; selecting a payday highlights its bills; the cockpit deep-links the next payday. Same policy/data behind the new shape. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **426 Vitest + 110 e2e**, build **123.80 KB gz**, audit clean at `--audit-level=critical`. (The full e2e suite runs green; two independent **pre-existing flakes** — `spend by envelope` cold-start and `transfers` delete, neither UXR2 code — each failed once across two full runs and **passed on isolated retry**.) |
| Acceptance criteria met & tested (UX §9) | ✅ | Full horizon as two ledgers with income·committed·headroom·balance·reserve·status; join readable with zero interaction (Covered-by text) + additive highlight; left-to-pay in both scopes reconciling to the ledger; first non-viable check reads *Plan breaks here* then *Short*; redirect + sidebar-active + axe light/dark + 320px reflow all pass in e2e. |
| A11y (WCAG 2.2 AA) | ✅ | Join never colour-alone (permanent text column + `aria-pressed` + `role="status"`); two real tables with header scopes; panes are labelled regions; payday toggles carry accessible names with the visible date inside (2.5.3); `.table-scroll` focusable regions; panes stack ≤ 640px. axe green light AND dark (a11y.spec two-ledger scans). |
| Input validation & secrets | ✅ | Read-only additive fields; no new inputs, no schema change; synthetic fixtures only. |
| Docs updated in same change | ✅ | FEAT-UXR2 · UX spec · `06_API_CONTRACT` · `07_NFR` §1³ · roadmap · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 421 | 426 | +5 (domain +4: reserve fold · over-committed run-down · balance-bucket · forecast reconciliation; `PayPeriodsView` 5 → 6; API + Cockpit gained assertions, not new tests) |
| E2E | 109 | 110 | +1 (`/insights/pay-periods` → `/pay-periods` redirect); the S7 pay-periods journey + a11y scans re-pointed in place. Full suite run green (§2). |

## 4. The reserve-field call (decision record)

`reserveCents` as the UX spec defines it (running Σ of per-check headroom, seeded by bucket zero,
no clamp) is **numerically identical to the plan's existing `headroomAfterCents`** — same
recurrence, same seed, for every bucket. The new **per-check "Headroom" column** (`income − total`)
is the genuinely new figure but is derivable client-side; the only genuinely new API computation is
`projectedBalanceCents`. This was flagged to the owner before building; the owner chose to **add
`reserveCents` literally** (a self-documenting field over asking the client to know the
equivalence). It is emitted as the running headroom value with a comment recording the equivalence.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Two flaky e2e tests (`spend by envelope`, `transfers` delete) | Each failed once across two full runs, passed on isolated retry — pre-existing cold-start/timing flakes, **not UXR2 code**; noted for a future stabilization pass | Not blocking; watch |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | **Explicitly out of UXR2 scope**; still the roadmap's open decision | Owner |
| Headroom sparkline/chart | Noted UXR2 follow-on (reuse `LineChart`) | Later |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); it starts its own
  throwaway-store server. Kill any dev server on those ports first.
- **`reserveCents` == `headroomAfterCents`** by construction (see §4) — that's intentional, not a bug.
- **`projectedBalanceCents`** uses the forecast's `evenDaily` + `includeExpected` defaults so it
  reconciles with `GET /analysis/cash-flow-forecast`; it is a cash-flow figure, NOT the
  commitment-time headroom.
- The two **left-to-pay countdowns are client-derived** in `PayPeriodsView`, not API fields.
- Demo data to design against: `npm run db:reset && npm run seed:demo`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr2-pay-period-planner.md — its
  "Resume here" has state (UXR2 is Done; gate green at 426 Vitest + 110 e2e, build 123.80 KB gz;
  two known pre-existing e2e flakes noted in §5, not blocking).
- Read docs/03_ROADMAP.md — the next item is UXR3 (Ledgers tables), gated by UXR1 (Done).

Next milestone: UXR3 — Ledgers tables. Turn the Accounts · Envelopes · Needs-allocation LISTS into
real design-system tables (one shared table treatment), PRESENTATION ONLY: UX6 progressive Add,
inline rename/archive, the R5 inline budget editor, the allocate flow, and the needs-allocation
count badge all carry unchanged. PLUS the Accounts-page Add-transaction button (the additive half
of UXR1 §11 Q2, queued to this slice). Spec of record: docs/ux/ledgers-tables.md (Proposed).

Watch out for: (1) presentation-only — do NOT change data/API/domain or the existing flows; this is
a table treatment over the current reads. (2) the shell owns the <h1> (UXR1) and first-class routes
drop their own title — content headings start at <h2> (see PayPeriodsView/Templates/Recurring for
the pattern). (3) table bar: <th> scope semantics · per-row accessible action names · UX15 reflow
(.table-scroll, no horizontal page scroll at 320px) · axe-clean light AND dark. (4) e2e that drives
these lists (setup.ts helpers, accounts/envelopes/needs specs) will need re-pointing to the table
structure. (5) demo data: npm run db:reset && npm run seed:demo.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (FEAT/UX spec → Implemented,
NFR bundle delta, roadmap); and at the end leave the project handoff-ready with the next-session
kickoff prompt (for UXR4/parallel next item) in the status report.
```
