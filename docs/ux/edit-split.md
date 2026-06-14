<!--
UX SPEC — Slice #5: edit a past split. Reuses the Slice 1 AllocationEditor, opened inline from
the account register. Pairs with FEAT-005.
-->

# UX Spec — Edit a transaction's split

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| Status       | Accepted                                       |
| Feature      | FEAT-005 ([feature spec](../features/edit-split.md)) |
| Owner        | Wesley Cutting                                 |
| Last updated | 2026-06-13                                     |

## 1. User & job

The user reviewing an account register spots a mis-allocated (or to-be-changed) transaction
and fixes its split in place, without re-entering the transaction. Reuses the Slice 1 editor.

## 2. Entry points & navigation

Each transaction row in the **account register** has an **"Edit split"** control that toggles
the `AllocationEditor` inline, pre-filled with that transaction's current allocations.

## 3. Primary flow

1. In the register, click **Edit split** on a transaction → the editor opens with its current
   rows.
2. Adjust amounts/envelopes (or apply a template / distribute remaining / use remaining).
3. **Save split** → the allocations are replaced; the register and balances update; the row's
   `fully allocated / needs …` status reflects the new split.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Register row (expanded) | Edit one transaction's split | "Edit split" toggle; inline `AllocationEditor` (Save label "Save split") |

States:
- **Collapsed** — the row shows date · payee · amount · allocation status + "Edit split".
- **Editing** — the editor is shown pre-filled; Save disabled while submitting or over-allocated.
- **Error** — inline `role="alert"` under the register; the editor's own rules apply.
- **Success** — the editor closes; the row's status + balances update (reduced-motion highlight).

## 5. Wireframe / layout

```
2026-06-13  Employer   +$100.00   fully allocated   [ Edit split ]
   └ (editing) Allocate  ( ) Single (•) Split
       [ Rent ▾ ] [ 60.00 ]  use remaining  ✕
       Allocated $60.00 · Remaining $40.00     [ distribute remaining ] [ Save split ]
```

## 6. Interactions & inputs

- **Edit split** toggles the inline editor for that row only.
- The editor behaves exactly as in Slice 1/2 (Single/Split, live remainder, use-remaining,
  apply-template, distribute-remaining); **Save split** calls `setAllocations`.
- Partial is allowed (leftover → needs-allocation); over-allocation disables Save.

## 7. Content & copy

- Toggle: **"Edit split"**; save: **"Save split"**. (Other copy inherited from the editor.)

## 8. Accessibility

Inherits the Slice 1 editor a11y (labeled controls, keyboard-operable, visible focus); the
"Edit split" toggle is a labeled button; status conveyed as text, not color alone.

## 9. Acceptance criteria (UX)

- **Given** a fully-allocated transaction, **when** I Edit split, switch to Split, set a row
  below the amount, and Save, **then** the row shows the new `needs …` remainder.
- The editor opens pre-filled with the current allocations; Save is disabled when over-allocated.

## 10. Out of scope / later

Editing amount/payee/date; deleting a transaction; the needs-allocation list already covers
*completing* partials (this adds in-place editing from the register).
