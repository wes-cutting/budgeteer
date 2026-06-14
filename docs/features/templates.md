<!--
FEATURE SPEC — Slice 2 accelerators. Pairs with docs/ux/templates.md. Build as a vertical
slice (data → API → UI). Reuses the AllocationEditor from Slice 1.
-->

# Feature Spec — Allocation templates & accelerators

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-004                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | PRD scope §7.3 · [UX](../ux/templates.md) · [Transactions](transactions.md) · [SPIKE-01](../spikes/01-split-allocation-ux.md) |

## 1. Summary

The paycheck slog-killer: save a split as a named **template** (a set of fixed-amount
`{envelope, amount}` lines) and **apply** it in the allocation editor to pre-fill all the
rows at once, then tweak. Plus two smaller editor accelerators: **distribute-remaining**
(spread the leftover evenly across the rows, exact to the cent) and **keyboard-first** row
entry (Enter adds the next row). Template lines are **fixed dollar amounts** (per the
owner's decision); applying is a client-side pre-fill — the server only stores templates.

## 2. Scope

- **In scope** — template CRUD (name + fixed-amount lines); apply a template into the editor;
  save the current split rows as a template; distribute-remaining; keyboard-first add-row.
- **Out of scope** — percentage / "both" template lines (fixed-only for now); direction-specific
  or auto-applied templates; editing a *fully* allocated past split (#5).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to save my usual paycheck split as a template so I don't re-enter ~12 rows each time. | Must |
| US-2 | As the user, I want to apply a template to a transaction and tweak a row before saving. | Must |
| US-3 | As the user, I want to spread the leftover evenly across my rows in one click. | Should |
| US-4 | As the user, I want to add the next split row from the keyboard without reaching for the mouse. | Should |
| US-5 | As the user, I want to rename/delete templates as my budget changes. | Should |

## 4. Acceptance criteria

- **Given** a template "Paycheck" with lines Rent `1400` + Savings `800`, **when** I apply it
  to a `3200.00` deposit, **then** the editor shows Split mode with those two rows and
  `Remaining 1000.00`.
- **Given** a split with rows summing `2000` of a `3200` amount, **when** I click
  **distribute remaining**, **then** the `1200` leftover is spread across the rows so
  `Remaining` is `0.00`, exact to the cent.
- **Given** I'm typing amounts, **when** I press Enter in the last row's amount, **then** a new
  empty row is added and focused.
- **Given** current split rows, **when** I "save as template" with a unique name, **then** a
  template with those lines is created.
- **Given** a duplicate template name, **then** create/rename is rejected `409`.
- **Given** a template line for an archived/unknown envelope or amount ≤ 0, **then** the
  server rejects it `400`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Apply a template whose total > the transaction amount | Editor shows over-allocation; Save disabled (Slice 1 rule). User adjusts. |
| Template with zero lines | Rejected `400` ("A template needs at least one line."). |
| Distribute-remaining with no envelopes chosen | No-op (nothing to distribute into); a hint shown. |
| Applying a template replaces the current rows | Confirmed implicitly (it pre-fills Split); user can still edit. |

## 6. Data changes

Adds `templates` and `template_lines` tables ([05_DATA_MODEL](../05_DATA_MODEL.md));
`template_lines.amount_cents` is a positive magnitude (bigint, ADR-0003). No change to
transactions/allocations.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)): `GET/POST /templates`,
`PUT/DELETE /templates/:id`. **Apply is client-side** (pre-fills the editor; the existing
`POST /accounts/:id/transactions` / `PUT /transactions/:id/allocations` persist the result).
UI: a Templates screen + "Apply template" / "Save as template" / "distribute remaining" /
keyboard-first in the `AllocationEditor` (see [UX](../ux/templates.md)).

## 8. Dependencies

Slice 1 (transactions + AllocationEditor); accounts/envelopes (Foundation). `splitEvenly`
(exact even split) for distribute-remaining — client-side util mirroring SPIKE-02.

## 9. Security, privacy & accessibility

Single household; template names + envelope refs only. Input validated at the boundary.
"Apply template" / "distribute" / "save as template" are labeled, keyboard-operable controls;
the editor's a11y rules (Slice 1 UX §8) carry over.

## 10. Test plan

- **Unit (web util):** `splitEvenly` distributes leftover exactly (incl. odd cents, negatives).
- **Integration (API):** template create/list/update/delete; duplicate name `409`; bad
  envelope/amount/zero-lines `400`; not-found `404`.
- **Component (web):** apply a template fills rows + remaining; distribute-remaining → 0;
  Enter adds a row; save-as-template calls the API; templates screen create/delete.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Add percentage / "both" lines later? | Wesley | open (deferred; fixed-only for V1) |
| Should "distribute remaining" target only rows with an envelope, or all rows? | Wesley | open (lean: only rows with an envelope) |
