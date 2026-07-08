<!--
STATUS REPORT — UXR13 (Allocate form on the pattern). The FOURTH slice of the post-track polish batch
(UXR9–UXR13), an owner-directed batch opened after the UXR1–UXR8 UX Redesign track closed. Presentation-only:
re-laid the shared AllocationEditor (Single/Split allocation editor, embedded in four surfaces) on the UXR4
FormLayout.module.css pattern — the grouped fieldset shell + Field/Input/Select/Button primitives, with its
richer split rows in a new sibling AllocationEditor.module.css. Closes the Allocate-section clash UXR11
deliberately left. No data/API/domain change. Newest report = the live handoff + launch pad for UXR12.
-->

# Status Report — 2026-07-08 (UXR13 — Allocate form on the pattern)

| Field  | Value                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                                       |
| Date   | 2026-07-08                                                                                                     |
| Author | Claude (with the owner)                                                                                        |
| Scope  | UXR13 built + `Done`; delta since [2026-07-08-uxr11-add-transaction.md](2026-07-08-uxr11-add-transaction.md) |

**Resume here:** **UXR13 is `Done` — the fourth slice of the owner-directed post-track polish batch
(`UXR9`–`UXR13`); only `UXR12` (Manage formatting) now remains.** The shared
[`AllocationEditor`](../../apps/web/src/AllocationEditor.tsx) — until now raw
`<label>`/`<select>`/`<input>`/`<button>` inside its `<fieldset><legend>Allocate</legend>` — was re-laid on the
UXR4 form-layout pattern. The **shell** (grouped fieldset, `Field`/`Input`/`Select`/`Button` primitives,
`.fieldRow`/`.amount`/`.removeLine`/`.actionRow`) comes from
[`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) — the same reuse UXR5/UXR7/UXR11 proved. The
**allocation-specific rows** (the mode radiogroup, the single/split lines with their extra **refund** +
**use-remaining** controls, and the live summary) live in a **new sibling**
[`AllocationEditor.module.css`](../../apps/web/src/AllocationEditor.module.css): the split row is genuinely
richer than TemplatesView's shared 3-col `.lineRow` (envelope · amount · refund · use-remaining · remove = **5
columns**), so its grid stays in the component module rather than polluting the shared pattern — **FormLayout is
untouched, so TemplatesView is unaffected**. The `Apply template` / `Save as new template` accelerators became
`Field`s in a `.fieldRow`; the split rows reflow to one column ≤ 640px. **Behaviour is byte-for-byte:** every
accessible name (`Allocate`, `Allocation mode`, Single/Split, `Apply template`, `New template name`, `Envelope`,
`Envelope/Amount/Refund/Remove for row N`, `use remaining`, `Add row`, `distribute remaining`, the save label),
every handler, and the save guard (`canSave`) are unchanged — so all **four embeds** (quick-add modal, account
register, needs-allocation, Recurring rule form) and every unit/e2e selector still resolve. **This closes the
clash `UXR11` deliberately left** — the raw Allocate section sitting next to patterned fields. **No
data/API/domain change.** Verified live via preview: on the **Recurring** page (the owner's original callout)
and in the **quick-add modal**, the Allocate fieldset now matches the fieldsets around it; the split-row grid
aligns (envelope grows, amount right-aligned tabular, refund/use-remaining/remove trailing); the rows reflow to
one column at 375px; **no console errors**. Gate **green** — **433 Vitest + 121 e2e** (tests **unchanged**; the
AllocationEditor, register, quick-add, templates, recurring and transfers specs — which drive the editor
end-to-end — all pass unchanged, selectors preserved); build **125.48 KB gz** (+0.15 vs 125.33; CSS **+0.14 →
5.37** — the new component module; ~14.5 KB under the 140 KB budget). **Next: UXR12 (Manage formatting) — the
last item in the batch, `Planned`, presentation-only (re-lay `ManageView` on `Ledgers.module.css`).**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| AllocationEditor on the pattern | The `<fieldset>` uses `form.fieldset`/`form.legend`; every raw control swapped for the UX4 `Field`/`Input`/`Select`/`Button` primitives; the `Apply template`/`Save as new template` accelerators are `Field`s in a `.fieldRow`; the split rows sit in a `form.lineGrid`; the amount input carries `form.amount`; the Save button is `variant="accent"` in a `form.actionRow` | [`AllocationEditor.tsx`](../../apps/web/src/AllocationEditor.tsx) · [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) |
| New component CSS module | The allocation-specific layout — `.modeRow`, `.saveAsTemplate`, `.singleRow`, `.splitRow` (the 5-col grid), `.refund`, `.rowActions`, `.summary`, + the ≤ 640px reflow — lives here, not in the shared pattern | [`AllocationEditor.module.css`](../../apps/web/src/AllocationEditor.module.css) (new) |
| Accessible names preserved | All controls keep their `aria-label`s; the mode radios keep their wrapping-label text; the single-mode Envelope + `Apply template` + `New template name` get `useId` `htmlFor` associations *in addition to* their existing `aria-label`s (accessible name is unchanged) | [`AllocationEditor.tsx`](../../apps/web/src/AllocationEditor.tsx) |
| FormLayout / TemplatesView untouched | The shared `.lineRow` was **not** widened for the richer alloc row, so Templates(its only other consumer) is unaffected | — |
| Tests | Unchanged — `AllocationEditor.test.tsx` and every embed's unit/e2e spec pass as-is (selectors preserved) | [`AllocationEditor.test.tsx`](../../apps/web/src/AllocationEditor.test.tsx) |
| Docs | Roadmap (UXR13 row → `Done`, focus + next-fronts + §5 log); `07_NFR` §1³ bundle delta (+0.15 → 125.48, CSS +0.14 → 5.37); this report | this change |

## 2. Definition of Done — current state (a presentation-only form-pattern adoption)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The Allocate section now reads on the same pattern as the forms around it, in all four embeds. Verified live: the Recurring Allocate fieldset + the quick-add modal match their sibling fieldsets; single + split modes render correctly. No data/API/domain change. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **433 Vitest + 121 e2e**, build **125.48 KB gz**, `npm audit --omit=dev --audit-level=critical` exit 0 (3 pre-existing *high* advisories below the gate threshold). |
| Acceptance criteria met & tested | ✅ | Behaviour byte-for-byte — the AllocationEditor unit spec (single/split/over-allocation/use-remaining/distribute/template-apply/save-as-template/Enter-adds-row) and the register + quick-add + templates + recurring + transfers e2e, which drive the editor end-to-end via the preserved labels/roles, **all pass unchanged**. Visual match verified live. |
| A11y (WCAG 2.2 AA) | ✅ | Every accessible name preserved; the single-control fields gained `htmlFor` associations on top of their `aria-label`s. Existing a11y specs (axe over the register + quick-add, which include the editor) pass unchanged. |
| Input validation & secrets | ✅ | No schema/endpoint change; the editor's own guards (over/under-allocation, invalid amount, save gate) are carried verbatim; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | Roadmap (UXR13 row + focus + next-fronts + §5) · `07_NFR` §1³ · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 433 | 433 | 0 — pure restyle; the AllocationEditor spec + every embed's spec pass unchanged (selectors preserved) |
| E2E | 121 | 121 | 0 — the flows that exercise the editor (splits, templates, recurring, reallocation) pass unchanged |

## 4. Design notes / small calls

- **The split row is richer than the shared `.lineRow` — so its grid is component-scoped.** TemplatesView's
  line is `envelope · amount · remove` (3 cols); the AllocationEditor's split row adds a **refund** toggle and a
  **use remaining** button (5 cols). Widening the shared `.lineRow` would have changed TemplatesView too, so the
  5-col `.splitRow` lives in a new `AllocationEditor.module.css`. The shared shell (fieldset/legend/fieldRow/
  amount/removeLine/actionRow) is still reused from `FormLayout.module.css` — the split is minimal, not a fork.
- **Byte-for-byte accessible names — `aria-label` wins, `htmlFor` added on top.** The controls already carried
  `aria-label`s the tests query (`Envelope`, `Apply template`, `New template name`, `Envelope/Amount/Refund/…
  for row N`). Wrapping the single-instance ones in `Field` adds a visible label + a `useId` `htmlFor`
  association; the `aria-label` stays, so the accessible name (and every selector) is unchanged. Dynamic split
  rows keep `aria-label` only (same as TemplatesView's rows — no `htmlFor` for N-many controls).
- **This is the other half of UXR11.** UXR11 patterned the `New transaction` fieldset but left the embedded
  `AllocationEditor` raw *on purpose* — restyling the shared component was UXR13's job so all four embeds move
  together. With UXR13 done, the quick-add modal reads as one coherent form again.
- **Save button became `variant="accent"` in an `actionRow`.** The raw Save was an unstyled `<button>`; on the
  pattern the primary action is an accent button, right-aligned in a `form.actionRow` — matching TemplatesView's
  "Save template" and the other patterned forms. Its `disabled={!canSave}` guard is unchanged.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR13) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR13 code — both passed clean this run | Not blocking; watch |
| **Polish batch closes with** — `UXR12` `Planned` | UXR12 Manage formatting (`ManageView` on `Ledgers.module.css`) — the last item in the batch | Owner |

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
- **The Allocate editor** = the shared [`AllocationEditor`](../../apps/web/src/AllocationEditor.tsx), now on the
  pattern. Its shell classes come from [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css); its
  allocation-specific layout from [`AllocationEditor.module.css`](../../apps/web/src/AllocationEditor.module.css).
  It's embedded by [`AddTransactionForm`](../../apps/web/src/AddTransactionForm.tsx) (quick-add modal +
  register), [`InlineAllocationEditor`](../../apps/web/src/InlineAllocationEditor.tsx) (register "Edit split" +
  needs-allocation "Allocate"), and [`RecurringView`](../../apps/web/src/RecurringView.tsx) (rule form).
- **The form pattern** = `FormLayout.module.css` (`.form`, `.fieldset`, `.legend`, `.fieldRow`, `.lineGrid`,
  `.amount`, `.removeLine`, `.actionRow`) + the `Field`/`Input`/`Select` primitives in
  [`ui/Field.tsx`](../../apps/web/src/ui/Field.tsx) and `Button` in [`ui/Button.tsx`](../../apps/web/src/ui/Button.tsx).
  Consumers: Templates (UXR4, defined it), Recurring (UXR5), Move-money (UXR7), add-transaction (UXR11), and now
  the AllocationEditor (UXR13).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-08-uxr13-allocate-form.md — its
  "Resume here" has state (UXR13 Allocate-form restyle is Done; gate green at 433 Vitest + 121 e2e,
  build 125.48 KB gz; the two pre-existing e2e flakes are watch-only).
- Read docs/03_ROADMAP.md — the "UX Redesign — post-track polish (UXR9–UXR13)" subsection in §4 and
  the "Next fronts" line show what's left in the batch.

The owner-directed post-track polish batch (UXR9–UXR13) is nearly complete. UXR9 (Dashboard IA),
UXR10 (chart X-axis readability), UXR11 (add-transaction cleanup) and UXR13 (Allocate form on the
pattern) are DONE. One item remains — presentation-only:
- UXR12 — Manage page formatting: re-lay ManageView (net-worth table + management links) on the
  design-system table/section treatment (Ledgers.module.css), for consistency with the rest of the app.

UXR12 finishes the batch. Confirm with the owner if unsure. Keep it vertical and gate-green; update
docs in the same change; leave the project handoff-ready with a next-session kickoff prompt. NOTE: the
e2e gate needs ports 3001/5173 free — a running dev stack (npm run dev + tsx watch) must be stopped
first. Provide a single-line short commit message; the owner reviews and commits.
```
