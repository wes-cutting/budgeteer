---
type: status-report
roadmap-item: BUD-S69
---
<!--
STATUS REPORT — UXR7 (Manage Move-money form). The LAST UX Redesign build and the lowest-risk: a
form restyle over the existing Move-money reads/flows, the opposite risk profile to UXR6. Second
proof the UXR4 form pattern reuses — MoveMoneyForm imports FormLayout.module.css, no new pattern
code. Presentation-only; the flow is byte-for-byte. With UXR7 Done the UXR1–UXR8 track CLOSES.
Newest report = the live handoff + launch pad for the next front (owner's call: #17/#18 or #19/#20).
-->

# Status Report — 2026-07-07 (UXR7 — Manage Move-money form)

| Field  | Value                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                                    |
| Date   | 2026-07-07                                                                                                  |
| Author | Claude (with the owner)                                                                                     |
| Scope  | UXR7 built + `Done`; delta since [2026-07-07-uxr6-insights-ia.md](2026-07-07-uxr6-insights-ia.md)          |

**Resume here:** **UXR7 is `Done` — and with it the entire `UXR1`–`UXR8` UX Redesign track is
complete.** The Manage page's [`MoveMoneyForm`](../../apps/web/src/MoveMoneyForm.tsx) is re-laid on the
**twice-proven UXR4 form-layout pattern** by **importing**
[`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) — a grouped `<fieldset>` + visible
`<legend>Move money</legend>`, every control via the UX4 `Field`/`Input`/`Select` primitives, natural
pairs **gridded** as `.fieldRow` (**From + To** envelope · **Amount + Memo**) stacking to one column
≤ 640px, the form capped at ~44rem, and a right-aligned **action row** (Move money). This is the
**second proof the pattern reuses** (UXR5 was the first): **no new pattern code** — UXR5 already landed
the one `.fieldRow` addition, so this slice is a pure import, exactly the reuse-evidence the FEAT note
promised. **Behavior is byte-for-byte:** the UX12d inline amount validation (the `FieldError` now lives
inside the Amount `Field`; `aria-invalid`/`aria-describedby` carried), the both-envelopes /
different-envelopes guards, reset-on-success, the hide-until-two-active-envelopes rule, and the
`createEnvelopeTransfer` API call are all unchanged. **The shell owns the `<h1>` (UXR1)**;
[`ManageView`](../../apps/web/src/ManageView.tsx) keeps its untouched `<h2 id="movemoney-heading">Move
money</h2>`, and the form's new `<legend>` mirrors it (the same h2/legend pairing UXR4/UXR5 use).
**Blast radius was zero test re-points** — `MoveMoneyForm.test`, `ManageView.test`, and the e2e
(`transfers.spec`, `a11y.spec`) all select by **label text** ("From envelope" / "To envelope" /
"Amount"), the form **aria-label**, and the **button name**, every one of which the `Field`/`Select`/
`Input` primitives preserve, so the whole suite passed **unchanged**. Gate **green** — **431 Vitest +
121 e2e** (no test-count delta: pure reuse, no new tests needed); build **125.21 KB gz** (+0.06 vs
125.15; CSS **unchanged** at 5.21 — no new CSS, the module was only imported; ~14.8 KB under the 140 KB
budget). **The UX Redesign initiative is finished; next front is the owner's call — §7.**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Move-money form → the form-layout pattern | `<form className={form.form}>` wrapping a `<fieldset>`+`<legend>`; From/To and Amount/Memo each a `.fieldRow` gridded pair; controls via `Field`/`Input`/`Select`; right-aligned `.actionRow` | [`MoveMoneyForm.tsx`](../../apps/web/src/MoveMoneyForm.tsx) |
| Reuse by **import** — no new pattern code | Imports `FormLayout.module.css` (the UXR4 module UXR5 already completed with `.fieldRow`). The second consumer, proving the pattern reuses without further additions | [`MoveMoneyForm.tsx`](../../apps/web/src/MoveMoneyForm.tsx) |
| Behavior byte-for-byte | Inline amount validation (`FieldError` relocated inside the Amount `Field`), both/different-envelope guards, reset-on-success, hide-until-two-active-envelopes, and the transfer API call all carried verbatim | [`MoveMoneyForm.tsx`](../../apps/web/src/MoveMoneyForm.tsx) |
| Heading unchanged | Shell owns the `<h1>`; `ManageView`'s `<h2>Move money</h2>` untouched; the form gains a matching `<legend>` (no new heading level) | [`ManageView.tsx`](../../apps/web/src/ManageView.tsx) |
| Tests | **No changes** — every selector (label text, form aria-label, button name) is preserved by the primitives; `MoveMoneyForm.test`/`ManageView.test`/`transfers.spec`/`a11y.spec` pass unchanged | unit + `e2e/` |
| Docs | FEAT note → `Implemented`; `07_NFR` §1³ bundle delta (+0.06 → 125.21, CSS unchanged); roadmap (row `Done` + focus + next-fronts + §5 changelog); this report | this change |

## 2. Definition of Done — current state (a presentation-only form restyle)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | `/manage` renders the Move-money form on the pattern; selecting From/To + Amount and submitting still moves budgeted money between envelopes — verified live via preview (the form renders as a bordered fieldset with legend, gridded pairs, and a right-aligned button) and by the carried `transfers.spec` e2e drive (moves $100 A→B, asserts the reallocated balances on `/envelopes`). No data/API/domain change. |
| Gate green | ✅ | typecheck · lint · format · unit · build · SCA all **pass** — **431 Vitest + 121 e2e**, build **125.21 KB gz**, audit clean at `--audit-level=critical` (3 pre-existing *high* advisories below the critical gate threshold). |
| Acceptance criteria met & tested (FEAT note) | ✅ | Form re-rendered on the pattern (stacked `Field`s, From/To + Amount/Memo gridded, action row, width capped); zero behavior change (inline amount validation, both/different-envelope checks, reset-on-success, hide-until-two-active-envelopes all carry); existing tests pass with **no** re-point; axe light + dark on `/manage`; no new pattern code (reuse evidence). Bundle delta ≈ 0 (+0.06). |
| A11y (WCAG 2.2 AA) | ✅ | `Field` renders an explicit `<label htmlFor>`→control association (every field keeps its accessible name); the amount error keeps `aria-invalid` + `aria-describedby`; the grouped `<fieldset>`/`<legend>` names the group; **axe light AND dark** on `/manage` (`a11y.spec` "manage hub is accessible", which asserts the form is visible); **320px reflow** confirmed live — `.fieldRow` collapses to one column and the page shows no horizontal scroll (`scrollWidth == clientWidth == 320`). |
| Input validation & secrets | ✅ | No schema/endpoint change; the same UX12d client-side amount parse + envelope guards; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | FEAT note (`Implemented`) · `07_NFR` §1³ · roadmap (row + focus + next-fronts + §5) · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 431 | 431 | 0 — pure reuse; the existing `MoveMoneyForm.test`/`ManageView.test` select by label/role/button name, all preserved by the primitives, so they pass unchanged and no new specs were warranted |
| E2E | 121 | 121 | 0 — `transfers.spec` (full move-money flow) and `a11y.spec` (manage hub axe, light+dark) already cover the form and pass unchanged (selectors preserved) |

## 4. Design notes / small calls

- **Second proof the pattern reuses — the deliberate "no new pattern code" outcome (the point of the
  slice).** UXR4 built `FormLayout.module.css`; UXR5 completed it with the one `.fieldRow` class §3.1
  always specified; UXR7 needed **neither a new class nor a new primitive** — it imports the module and
  arranges four `Field`s into two `.fieldRow` pairs. That the last form slice added nothing to the
  pattern is the evidence the pattern is done.
- **Amount + Memo gridded as the second pair (watch-out §2 — "natural pairs or stack?").** From/To
  envelope is the obvious pair (two sibling selects). Amount + Memo also pairs cleanly (two short
  inputs side by side), mirroring UXR5's Amount + Payee row — so the form is two `.fieldRow`s, not a
  stack. Both collapse to one column ≤ 640px; verified at 320px the fields stack with no page overflow.
- **The inline amount error moved *inside* the Amount `Field`.** Previously the `FieldError` rendered as
  a sibling after the whole `<label>`; now it renders as a child of the Amount `Field` (after the
  `Input`), so in the gridded row the error stays in the Amount column rather than pushing into Memo.
  `aria-invalid`/`aria-describedby` on the `Input` are unchanged, so the accessible error association is
  byte-for-byte.
- **Legend duplicates the section `<h2>` — intentional, matching UXR4/UXR5.** `ManageView` owns
  `<h2>Move money</h2>` (the shell owns the page `<h1>` per UXR1); the form's `<legend>Move money</legend>`
  names the fieldset group for AT. The visible duplication is the same shape the Templates and Recurring
  forms already ship, and it's the honest group label — the alternative (no legend) is worse for a11y.
- **Zero test re-points — the low-risk profile confirmed (watch-out §5).** Unlike UXR3–UXR6 (list→table
  role swaps, nav-label renames) this restyle changed no accessible names: labels, the form aria-label,
  and the button text are identical, and the `Field`/`Select`/`Input` primitives preserve the
  label→control association `getByLabelText`/`getByLabel` rely on. So no unit or e2e spec needed
  touching — the suite passed unchanged, exactly the opposite of UXR6's re-point sweep.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR7) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR7 code | Not blocking; watch |
| **UX Redesign complete** — next front is the owner's call | `UXR1`–`UXR8` all `Done`. Remaining tracks: **`#17`/`#18`** (SPIKE-03 history profiling → historical import — the last unstarted track, also the durable fix for the UXR8 limited-data callout) or the deferred **`#19`/`#20`** | Owner picks |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — `reuseExistingServer` is OFF (K20/K24); kill any dev/preview
  server on those ports first. The e2e store is **shared across the whole run**, so `exact:true` on
  ambiguous substring labels.
- **Forms → `FormLayout.module.css`** (fieldset/legend · `Field`/`Input`/`Select` · `.fieldRow` gridded
  pairs · `.actionRow`). Three consumers now: `TemplatesView`, `RecurringView`, `MoveMoneyForm`. Ledger
  tables → `Ledgers.module.css`; Insights chrome → `Insights.module.css` (`.categoryNav`/`.segmentNav`).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-07-uxr7-manage-form.md — its
  "Resume here" has state (UXR7 is Done and the whole UXR1–UXR8 UX Redesign track is complete;
  gate green at 431 Vitest + 121 e2e, build 125.21 KB gz; the two pre-existing e2e flakes are
  watch-only).
- Read docs/03_ROADMAP.md — the UX Redesign is finished; the current focus + §4 tables show what's left.

The UX Redesign (UXR1–UXR8) is DONE. The owner has signalled that "things have surfaced on the other
side of the Redesign" they want to address next — so the next work is owner-directed, NOT a
pre-planned roadmap item. Start by asking the owner what surfaced / what they want to tackle, then
right-size the ceremony to it (docs/00_WAYS_OF_WORKING.md §11). If they instead want to resume the
standing backlog, the open fronts are: #17/#18 (SPIKE-03 history profiling → historical import — the
last unstarted track, also the durable fix for the UXR8 limited-data callout) or the deferred
#19/#20, plus the one open owner decision (ratify/veto FEAT-S7 §5's residual pay-period divergence).

Keep it vertical and gate-green; update docs in the same change; leave the project handoff-ready with a
next-session kickoff prompt. Provide a single-line short commit message; the owner reviews and commits.
```
