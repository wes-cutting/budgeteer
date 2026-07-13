---
type: status-report
roadmap-item: BUD-S73
---
<!--
STATUS REPORT — UXR11 (Add-transaction cleanup). The THIRD slice of the post-track polish batch
(UXR9–UXR13), an owner-directed batch opened after the UXR1–UXR8 UX Redesign track closed. Presentation-only:
removed the redundant page-local "Add transaction" button on /accounts (the AppShell footer action is the
single entry) and re-laid the shared AddTransactionForm (quick-add modal + register embed) on the UXR4
FormLayout.module.css pattern. The embedded AllocationEditor is deliberately untouched — it is UXR13's scope.
No data/API/domain change. Newest report = the live handoff + launch pad for UXR12 / UXR13.
-->

# Status Report — 2026-07-08 (UXR11 — Add-transaction cleanup)

| Field  | Value                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                             |
| Date   | 2026-07-08                                                                                           |
| Author | Claude (with the owner)                                                                              |
| Scope  | UXR11 built + `Done`; delta since [2026-07-07-uxr10-chart-xaxis.md](2026-07-07-uxr10-chart-xaxis.md) |

**Resume here:** **UXR11 is `Done` — the third slice of the owner-directed post-track polish batch
(`UXR9`–`UXR13`).** Two presentation-only changes, both on the add-transaction surface: **(1)** the
page-local **Add transaction** `<Link>` on `/accounts` was **removed** — the persistent
[`AppShell`](../../apps/web/src/AppShell.tsx) sidebar-footer action is the single, always-available entry to
the `/transactions/new` quick-add modal, so the per-page control was redundant (the now-unused
`Button.module.css` import was dropped). **(2)** [`AddTransactionForm`](../../apps/web/src/AddTransactionForm.tsx)
— **one shared component** rendered in **two modes**: the **quick-add modal** (account-picker mode, via
[`QuickAddTransaction`](../../apps/web/src/QuickAddTransaction.tsx)) **and** the **account-register embed**
(fixed-account mode, via [`AccountRegister`](../../apps/web/src/AccountRegister.tsx)) — was re-laid on the
UXR4 form-layout pattern by **importing [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css)**
(the same reuse UXR5/UXR7 proved, **no new pattern code**): a grouped `New transaction` `<fieldset>`+visible
`<legend>`, every field via the UX4 `Field`/`Input`/`Select` primitives, **Amount+Date gridded** as
`.fieldRow` (collapses to one column ≤ 640px), full-width Payee. **The carried Deposit/Withdrawal radiogroup
and the embedded shared `AllocationEditor` (still raw `<label>`/`<select>`/`<input>`) are unchanged** — the
visible clash of the Allocate section against the newly-patterned fields is **exactly `UXR13`'s scope** (the
sibling item that restyles `AllocationEditor` everywhere it's embedded). **Behaviour byte-for-byte:** the
amount field keeps its **`aria-label="Transaction amount"`** (distinct from its visible "Amount" label) so
every test/e2e selector still resolves; the picker Save-gate, the UX12d inline amount validation
(`FieldError` inside the Amount `Field`, `aria-invalid`/`aria-describedby` carried), reset-on-success, and the
`createTransaction` fan-out are untouched. **No data/API/domain change.** Verified live via preview: the modal
renders on the pattern with **all accessible names preserved** (form "Add transaction", combobox "Account",
textbox "Transaction amount"/"Date"/"Payee"), `/accounts` `main` shows **only "Add account"** (the
Add-transaction link is gone from the page; the shell footer keeps it), **no console errors**, and `.fieldRow`
**collapses to one column at 375px**. Gate **green** — **433 Vitest + 121 e2e** (tests **−1/+1**: the
`/accounts` Add-transaction-link assertion was replaced by a "no page-local control" assertion — net 433; the
register/quick-add specs passed **unchanged**, selectors preserved); build **125.33 KB gz** (+0.01 vs 125.32;
CSS unchanged at 5.23; ~14.7 KB under the 140 KB budget). **Next: UXR12 (Manage formatting) / UXR13 (Allocate
form on the pattern) — both `Planned`, presentation-only, ordering is the owner's call (§7).**

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| Removed the `/accounts` Add-transaction button | The page-local `<Link to="/transactions/new">` (+ its `.actions` wrapper) deleted; the persistent `AppShell` footer action is the single entry. Dropped the now-unused `Button.module.css` import | [`AccountsList.tsx`](../../apps/web/src/AccountsList.tsx) |
| Form on the FormLayout pattern | `AddTransactionForm` wraps in `form.form`, a `New transaction` `<fieldset>`+`<legend>`, `Field`/`Input`/`Select` primitives, Amount+Date in a `.fieldRow`, full-width Payee. Import only — no new CSS | [`AddTransactionForm.tsx`](../../apps/web/src/AddTransactionForm.tsx) · [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) |
| Accessible names preserved | Amount `<Input>` keeps `aria-label="Transaction amount"` (≠ its visible "Amount" label); Account/Date/Payee names come from their `Field` labels — every existing selector resolves | [`AddTransactionForm.tsx`](../../apps/web/src/AddTransactionForm.tsx) |
| `AllocationEditor` untouched | The embedded split editor stays raw — deliberately UXR13's scope (coordinated: UXR13 restyles it for all four embeds at once) | — |
| Tests | `AccountsList.test.tsx`: the "page header offers Add transaction" test replaced by "no page-local Add transaction control (UXR11)"; register/quick-add specs unchanged | [`AccountsList.test.tsx`](../../apps/web/src/AccountsList.test.tsx) |
| Docs | Roadmap (UXR11 row → `Done`, focus + next-fronts + §5 log); `07_NFR` §1³ bundle delta (+0.01 → 125.33); this report | this change |

## 2. Definition of Done — current state (a presentation-only form-pattern adoption)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The add-transaction form (both the quick-add modal and the register embed) reads on the same pattern as the other forms; the redundant `/accounts` control is gone. Verified live: modal renders the `New transaction` fieldset, `/accounts` `main` shows only "Add account". No data/API/domain change. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **433 Vitest + 121 e2e**, build **125.33 KB gz**, `npm audit --omit=dev --audit-level=critical` exit 0 (3 pre-existing *high* advisories below the gate threshold). |
| Acceptance criteria met & tested | ✅ | Button removed — asserted in unit (`queryByRole("link", { name: "Add transaction" })` is null on `/accounts`) and preview (only "Add account" in `main`). Form on the pattern — verified live (fieldset/legend, `.fieldRow` grid); the register/quick-add unit + e2e specs, which drive the form end-to-end via the preserved labels, pass unchanged. |
| A11y (WCAG 2.2 AA) | ✅ | Every accessible name preserved (form, radiogroup, Account/amount/Date/Payee). The dual-label on Amount (visible "Amount" + `aria-label="Transaction amount"`) is the same state the raw form already had. Existing a11y specs (axe over the register + quick-add) pass unchanged. |
| Input validation & secrets | ✅ | No schema/endpoint change; UX12d inline amount validation carried verbatim; synthetic demo fixtures only. |
| Docs updated in same change | ✅ | Roadmap (UXR11 row + focus + next-fronts + §5) · `07_NFR` §1³ · this report — all in this change; prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 433 | 433 | 0 net (−1/+1 — the `/accounts` Add-transaction-link assertion replaced by a "no page-local control" assertion; register/quick-add specs unchanged) |
| E2E | 121 | 121 | 0 — quick-add enters via the shell footer (not the removed `/accounts` button); the register form selectors were preserved |

## 4. Design notes / small calls

- **One shared component, two modes — restyle once, both benefit.** `AddTransactionForm` is the quick-add
  modal's form (account-picker mode) **and** the account-register's inline add form (fixed-account mode).
  Adopting the pattern on the component lands both at once; the `showAccountPicker` branch just becomes a
  `Field`+`Select` at the top of the fieldset.
- **Byte-for-byte accessible names — the amount field's dual label.** The amount input's visible label is
  "Amount" but its queried name is **"Transaction amount"** (unit + e2e use `getByLabelText`/`getByRole` on
  that string). The raw form already carried both a wrapping `<label>Amount</label>` and
  `aria-label="Transaction amount"`; the patterned form keeps exactly that — `Field label="Amount"` for the
  visible text, `aria-label="Transaction amount"` on the `<Input>` so the accessible name is unchanged. The
  other fields (Account/Date/Payee) have matching visible/queried names, so their `Field` label alone
  suffices (redundant `aria-label`s dropped).
- **`AllocationEditor` left raw on purpose.** It renders its own `<fieldset><legend>Allocate</legend>` and is
  shared by four surfaces (this modal, the register, needs-allocation, the Recurring rule form). Restyling it
  is `UXR13` — doing it here would half-do UXR13 and risk the shared behaviour. The visible clash between the
  patterned `New transaction` fields and the raw `Allocate` section is the exact symptom UXR13 removes.
- **The shell footer is the single entry.** The `/accounts` page-local link (added back in UXR3 as UXR1 §11
  Q2's additive half) predated the always-visible `AppShell` footer action being the established global entry;
  with that in place the per-page control was a second, redundant affordance. Removing it is the owner's UXR11
  ask; no route or behaviour changed (the footer already points at `/transactions/new`).

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| Reference screenshots into `docs/ux/assets/` | Still only in the chat session (carried from prior reports) | Owner, when convenient |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's open decision (untouched by UXR11) | Owner |
| Two pre-existing e2e flakes (`spend by envelope` cold-start, `transfers` delete) | Watch-only, not UXR11 code — both passed clean this run | Not blocking; watch |
| **Polish batch continues** — `UXR12`–`UXR13` `Planned` | UXR12 Manage formatting (`ManageView` on `Ledgers.module.css`) · UXR13 shared `AllocationEditor` on the pattern (coordinates with this slice — it restyles the section UXR11 deliberately left raw) | Owner picks order (both presentation-only) |

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
- **The add-transaction form** = the shared [`AddTransactionForm`](../../apps/web/src/AddTransactionForm.tsx),
  rendered by [`QuickAddTransaction`](../../apps/web/src/QuickAddTransaction.tsx) (modal, account-picker mode)
  and [`AccountRegister`](../../apps/web/src/AccountRegister.tsx) (embed, fixed-account mode). The split lives
  in the shared [`AllocationEditor`](../../apps/web/src/AllocationEditor.tsx) — **still raw**, UXR13's target.
- **The form pattern** = [`FormLayout.module.css`](../../apps/web/src/FormLayout.module.css) (`.form`,
  `.fieldset`, `.legend`, `.fieldRow`, `.lineGrid`/`.lineRow`, `.actionRow`) + the `Field`/`Input`/`Select`
  primitives in [`ui/Field.tsx`](../../apps/web/src/ui/Field.tsx). Consumers so far: Templates (UXR4, defined
  it), Recurring (UXR5), Move-money (UXR7), and now add-transaction (UXR11).
- Demo data to design against: `npm run db:reset --workspace @budgeteer/api && npm run seed:demo --workspace @budgeteer/api`.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-08-uxr11-add-transaction.md — its
  "Resume here" has state (UXR11 add-transaction cleanup is Done; gate green at 433 Vitest + 121 e2e,
  build 125.33 KB gz; the two pre-existing e2e flakes are watch-only).
- Read docs/03_ROADMAP.md — the "UX Redesign — post-track polish (UXR9–UXR13)" subsection in §4 and
  the "Next fronts" line show what's left in the batch.

The owner-directed post-track polish batch (UXR9–UXR13) is underway. UXR9 (Dashboard IA), UXR10 (chart
X-axis readability) and UXR11 (add-transaction cleanup) are DONE. Continue with the batch — all
presentation-only, ordering is the owner's call:
- UXR12 — Manage page formatting: re-lay ManageView (net-worth table + management links) on the
  design-system table/section treatment (Ledgers.module.css).
- UXR13 — the shared AllocationEditor "Allocate" form (raw <label>/<select>/<input>/<button>) onto the
  FormLayout pattern (Field/Input/Select + split-line mini-grid). Shared — embedded in the add-transaction
  modal + register (UXR11, now on the pattern), needs-allocation, and the Recurring rule form; behaviour
  byte-for-byte. UXR11 deliberately left this section raw — it is exactly UXR13's scope.

Confirm the next item with the owner if unsure. Keep it vertical and gate-green; update docs in the
same change; leave the project handoff-ready with a next-session kickoff prompt. NOTE: the e2e gate
needs ports 3001/5173 free — a running dev stack (npm run dev + tsx watch) must be stopped first.
Provide a single-line short commit message; the owner reviews and commits.
```
