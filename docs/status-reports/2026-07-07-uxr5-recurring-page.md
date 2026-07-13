---
type: status-report
roadmap-item: BUD-S67
status: Snapshot
---
<!--
STATUS REPORT — UXR5 (Recurring page). Presentation over the existing recurring reads/flows, PLUS
two owner-ratified additions (Payee column · rule-delete UX12 ConfirmDialog). The rule FORM restyles
onto the UXR4 form-layout pattern by IMPORTING FormLayout.module.css (first proof it reuses); the
rules LIST becomes a design-system table with the split behind a per-row disclosure. Newest report =
the live handoff + launch pad for UXR6.
-->

# Status Report — 2026-07-07 (UXR5 — Recurring page)

| Field  | Value                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                           |
| Date   | 2026-07-07                                                                                         |
| Author | Claude (with the owner)                                                                            |
| Scope  | UXR5 built + `Done`; delta since [2026-07-07-uxr4-templates-page.md](2026-07-07-uxr4-templates-page.md) |

**Resume here:** **UXR5 is `Done`** — the Recurring page is rebuilt **presentation-only** over the
existing recurring reads/flows, plus the **two owner-ratified additions** (Payee column · rule-delete
`ConfirmDialog`). The **rule form restyles onto the UXR4 pattern by importing
[`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css)** — this slice is **the first proof
the pattern reuses**: fieldset/legend, the UX4 `Field`/`Input`/`Select` primitives, the carried
Deposit/Withdrawal radiogroup unchanged, natural pairs **gridded** (Amount+Payee · Frequency+First
date). The shared **AllocationEditor** (the split, with its own "Create recurring rule" submit) is
**unchanged** — only its framing adopts the pattern. The **one pattern-completing addition** (see §4)
was a single `.fieldRow` class: §3.1 always specified gridded pairs, but UXR4's Templates form had
none, so the shared module never realized a pair-row — UXR5 is the first consumer that needs it. The
**rules list is now a real table** on the **UXR3 [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css)
treatment verbatim** — **Payee** (`<th scope="row">`, "—" when absent) · **Account** · **Amount**
(signed by direction, right-aligned) · **Frequency** · **Next date** · **Status** ("N due" / "Up to
date") · **Split** · **Actions** — with **Payee surfaced** (data the old list never rendered) and the
**split moved out of the row** into a per-row disclosure (`<button aria-expanded aria-controls>`, "Show
N lines for {payee}") revealing an indented `colSpan` detail region. **Delete gains the UX12
`ConfirmDialog`.** Behavior is otherwise byte-for-byte (create/reset/post-due unchanged). Gate
**green** — **427 Vitest + 112 e2e** (+1 net: a seeded `scanRecurring` axe path, light AND dark);
build **124.96 KB gz** (+0.49 vs 124.47; ~15 KB under the 140 KB budget). **In passing I hardened a
pre-existing pay-periods a11y selection race** (§4). **Next: UXR6 (Insights IA) — owner-queued; §7
kickoff.**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Rule form → the UXR4 pattern | Imports `FormLayout.module.css`: `<fieldset>`/`<legend>New recurring rule>`, `Field`/`Input`/`Select`, carried radiogroup, pairs gridded (`.fieldRow`), stacking ≤ 640px; AllocationEditor unchanged in the capped group beneath. **First proof the pattern reuses** | [`RecurringView.tsx`](../../apps/web/src/RecurringView.tsx) |
| **One pattern-completing addition** | New `.fieldRow` (responsive two-column grid, stacks ≤ 640px) — realizes §3.1's gridded pairs for its first consumer; reused by UXR7. The **only** pattern code this slice added (see §4) | [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) |
| Rules list → table | `Payee` (row header) · `Account` · `Amount` (signed/right-aligned) · `Frequency` · `Next date` · `Status` · `Split` · `Actions`, in the global `.table-scroll` region with an `sr-only <caption>`; reuses `Ledgers.module.css` verbatim; **Payee surfaced**; per-row "Delete {payee}" | [`RecurringView.tsx`](../../apps/web/src/RecurringView.tsx) |
| Split → per-row disclosure | `<button aria-expanded aria-controls>` ("Show N lines for {payee}") toggles an indented `colSpan` `<ul>` (envelope · amount · refund marker); collapsed by default, state per-row (`Set`), not persisted; small page-local module | [`RecurringView.module.css`](../../apps/web/src/RecurringView.module.css) |
| Rule delete → UX12 confirm (§4) | Delete opens the `ConfirmDialog` ("Delete this rule?", the §4 copy) instead of one-click delete — the destructive-action convention catch-up (owner-ratified) | [`RecurringView.tsx`](../../apps/web/src/RecurringView.tsx) |
| Pay-periods a11y race hardened | `openPayPeriodsFor` now waits for the default account's plan to settle (planner OR empty state) before selecting — see §4 | [`a11y.spec.ts`](../../e2e/a11y.spec.ts) |
| UX spec → Implemented | `docs/ux/recurring-page.md` promoted + §9 "as built" added | [UX spec](../ux/recurring-page.md) |
| Tests | `RecurringView.test` re-pointed (`role="list"`→`role="table"`; "Up to date"; delete-confirm step). e2e: `recurring.spec` + `cockpit.spec` + `setup.ts` re-pointed (list→table, assert Payee, expand disclosure for the split); `a11y.spec` `scanRecurring` seeds+expands a rule (light AND dark) | unit + `e2e/` |
| Docs | UX spec → `Implemented` (+§9); `07_NFR` §1³ bundle delta; roadmap (row `Done` + focus + next-front + §5 changelog); this report | this change |

## 2. Definition of Done — current state (a presentation-only UI slice + 2 ratified additions)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Recurring renders as an organized form + a scan-and-act table; the split is one click away per rule; every carried flow works against the running app (create with a split, post due, delete-with-confirm) — verified live via the full e2e drive (`recurring.spec` creates a monthly rule, posts due, confirms the generated txn; `cockpit.spec` drives the same form). No data/API/domain change — the same reads/flows behind a new shape, plus the two ratified additions. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **427 Vitest + 112 e2e**, build **124.96 KB gz**, audit clean at `--audit-level=critical` (exit 0; 3 pre-existing *high* advisories are below the critical gate threshold). The two independent pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) **both passed** this run. |
| Acceptance criteria met & tested (UX §7) | ✅ | Rules render as the §2 table; the split appears only via the disclosure and lists every line incl. refund markers; Payee shows (or "—"). The form renders on the UXR4 pattern — **reuse by import proves UXR4** (the one `.fieldRow` addition realizes the pattern's own §3.1, reconciled in §4). Post-due/creation flows byte-for-byte; **delete now confirms** (§4, ratified), +1 confirm assertion. States per §5; axe light+dark (table + expanded split + form); 320px reflow. |
| A11y (WCAG 2.2 AA) | ✅ | Real table (`<th scope="col">`; Payee cell `<th scope="row">`; `sr-only <caption>`); per-row disclosure names ("Show N lines for {payee}", `aria-expanded`/`aria-controls`) and action names ("Delete {payee}"); the form's fieldset/legend + `Field` associations; carried radiogroup; keyboard order = visual order; the table in `.table-scroll`. **axe light AND dark** gate the table + its **EXPANDED** split detail + the form (`a11y.spec` `scanRecurring` seeds a rule and expands its disclosure, both schemes). |
| Input validation & secrets | ✅ | No new inputs, no schema change; payee trimmed to `undefined` when empty (carried); the editor's blank/zero-line filtering unchanged; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | UX spec (`Implemented` + §9) · `07_NFR` §1³ · roadmap (row + focus + next-front + §5) · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 427 | 427 | +0 (`RecurringView.test`'s single spec re-pointed in place — table roles, "Up to date", the delete-confirm step; no net new unit test) |
| E2E | 111 | 112 | +1 (the empty Recurring axe scan replaced by a seeded `scanRecurring` — light + a new **dark** scan; `recurring.spec`/`cockpit.spec`/`setup.ts` re-pointed in place, and `recurring.spec` now expands the disclosure to prove the split moved) |

## 4. Design notes / small calls

- **The one pattern-completing addition (watch-out §1 — disclosed for veto).** UXR4 asserted UXR5 would
  restyle "without new pattern code," and the table treatment + every form control **did** reuse
  existing classes verbatim. But the pattern's **§3.1 always specified responsive gridded field-pairs**
  (Amount+Payee, Frequency+First date), and UXR4's Templates form had **no natural pairs**, so the
  shared module never built a pair-row class. UXR5 is the first consumer that needs one. I made the
  faithful call: **land a single `.fieldRow` in the shared `FormLayout.module.css`** (the pattern
  realizing its own §3.1; UXR7 reuses it) rather than fragment it into page-local CSS or drop the
  gridded layout §3 explicitly calls for. Net: the "zero pattern code" claim holds for the table + all
  controls; the lone exception is this pair-row, which **completes** the pattern. If you'd rather the
  pairs simply stack (no shared-module change), that's a one-line revert of `.fieldRow` + the two
  `.fieldRow` wrappers — say the word.
- **Signed amount from `direction`.** The read carries a **positive magnitude** + a `direction`; the
  Amount column signs it (`withdrawal` → negative) so `-$1,500.00` / `$2,000.00` read at a glance,
  right-aligned tabular like every other money column. No behavior change — the old list showed the
  magnitude + a separate "withdrawal/deposit" word.
- **Split as a `colSpan` detail row.** No existing expandable-row idiom in the codebase, so the detail
  region is a second `<tr>` with a `<td colSpan={8}>` holding the `<ul>` — the accessible, table-valid
  way to keep the disclosure's target inside the table. Per-row `aria-controls` ties the button to its
  region; `aria-expanded` carries state (the label stays "Show N lines…", state is not doubled into it).
- **Pre-existing pay-periods a11y race, hardened in passing (disclosed).** Adding two seeding tests
  (`scanRecurring` light+dark) grew the shared e2e store enough to expose a latent race in the a11y
  suite's `openPayPeriodsFor` helper: it selected the pay-periods account **while `PayPeriodsView`'s
  default-account plan was still loading**, and that in-flight default re-render clobbered the
  controlled `<select>` back to the default account (whose plan has no paychecks → "No expected
  paychecks" → 4 deterministic failures). Confirmed by a clean-stash A/B run (0 failures without the
  slice) and the failure DOM (the *default* account shown selected, not the chosen one). Root cause is
  a controlled-select-vs-async-load race, not this slice's logic. **Fixed in the test helper only** —
  wait for the default plan to settle before selecting — so no app code changed. The pay-periods view
  itself is untouched.
- **No new field validation.** The pattern's §3.5 allows field-level `FieldError`, but the rule form
  has no field-level validation today (failures are form-level `role="alert"`; the editor guards the
  split). To keep behavior byte-for-byte, none was added.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| `.fieldRow` in the shared module | The one pattern addition (§4) — realizes §3.1's gridded pairs. Ships with the slice; flagged for veto (trivial revert to stacked) | Owner, at review |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR5) | Owner |
| Two pre-existing e2e flakes (`spend by envelope`, `transfers` delete) | Both **passed** this run; still watch-only, not UXR5 code | Not blocking; watch |
| Rule editing | Out of scope (§8) — a rule is delete-and-recreate today; adding edit is a feature, not formatting | Future feature, if wanted |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); it starts its own
  throwaway-store server. Kill any dev/preview server on those ports first. The e2e store is **shared
  across the whole run**, so entities from earlier specs are visible to later ones — hence `exact:true`
  on ambiguous substring labels, and the **`openPayPeriodsFor` wait-before-select** hardening (§4).
- **Two form-facing modules.** Tables → `Ledgers.module.css` (shared with Ledgers + Templates +
  Recurring); **forms → `FormLayout.module.css`** (the reusable pattern — now `.fieldRow` too; import
  it for UXR7, don't rebuild).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr5-recurring-page.md — its
  "Resume here" has state (UXR5 is Done; gate green at 427 Vitest + 112 e2e, build 124.96 KB gz;
  the two pre-existing e2e flakes both passed this run; §4 hardened a pay-periods a11y select race).
- Read docs/03_ROADMAP.md — the owner queued UXR6 (Insights IA) as the next build; UXR7 (Manage form)
  is the alternative and also reuses the now-twice-proven form pattern.

Next milestone: UXR6 — Insights IA. Spec of record: docs/ux/insights-ia.md (Proposed; owner-ratified
label renames Spend → "By envelope" · Budget → "vs Actual"). Turn the wrapping Insights sub-nav into a
page-level TOP TAB BAR: five category tabs (Spending: by-envelope/breakdown/trends · Budget:
vs-actual/burn-down · Cash flow: forecast · Debt: credit/payoff · Net worth) with segmented sub-views.
NON-NEGOTIABLE: every /insights/:view URL is PRESERVED (the flat-tab alternative was passed over). This
is a HIGHER-RISK slice than UXR3–UXR5 (an IA restructure, not a form/table restyle) — challenge the
plan and confirm it before building.

Watch out for: (1) URL preservation — /insights/:view must keep working (deep-links, the cockpit's
"Review budget"/"Manage recurring" links, e2e openAnalysis in setup.ts drives the sub-nav by tab
label — the two renames will need re-pointing). (2) the shell owns the <h1> (UXR1); Insights headings
are <h2> ("Insights — <name>") — the a11y + cockpit specs assert those level-2 names, so any rename
ripples there. (3) tab a11y: a real tablist/tab/tabpanel or a nav of links? Insights is URL-addressable
(ADR-0006 routing), so links-styled-as-tabs with aria-current is the likely fit — decide and justify.
(4) axe light AND dark for the new tab chrome; 320px reflow (the tab bar must not force page scroll).
(5) UXR6 has NO pattern/CSS dependency on UXR5 — it's Insights chrome, not forms/tables. (6) demo data:
npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change (UX spec → Implemented, NFR bundle
delta, roadmap); and at the end leave the project handoff-ready with the next-session kickoff prompt
(for UXR7 / the remaining UXR items) in the status report. Provide a single-line short commit message;
I will review and commit when ready.
```
