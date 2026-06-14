<!--
FEATURE SPEC — Slice #5: edit a past split. Thin UI slice reusing the AllocationEditor and
the existing PUT /transactions/:id/allocations endpoint. Pairs with docs/ux/edit-split.md.
-->

# Feature Spec — Edit a transaction's split

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-005                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | [Transactions](transactions.md) · [UX](../ux/edit-split.md) · [API](../06_API_CONTRACT.md) |

## 1. Summary

From the **account register**, open any transaction's allocations in the `AllocationEditor`
(pre-filled with the current split) and revise them — change amounts/envelopes, add/remove
rows, apply a template, distribute the remainder — then save, **replacing** the split. The
sum invariant is preserved (server re-validates). Works on fully-allocated, partial, and
opening transactions; reducing below the amount leaves a remainder (back into needs-allocation).

## 2. Scope

- **In scope** — edit a transaction's **allocations** from the register, via the existing
  editor; persist with `PUT /transactions/:id/allocations`.
- **Out of scope** — editing a transaction's **amount / payee / date** or **deleting** a
  transaction (separate slice); bulk edits.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to fix a mis-allocated transaction without re-entering it. | Must |
| US-2 | As the user, I want to re-split a fully-allocated transaction across different envelopes. | Must |
| US-3 | As the user, I want to reduce an allocation and have the leftover return to needs-allocation. | Should |

## 4. Acceptance criteria

- **Given** a fully-allocated deposit, **when** I edit its split to two envelopes summing the
  same total, **then** both envelope balances reflect the new split and it stays fully allocated.
- **Given** a fully-allocated transaction, **when** I reduce an allocation, **then** the
  register row shows the new `needs …` remainder (and it reappears in needs-allocation).
- **Given** an edit whose rows exceed the amount, **then** Save is disabled (editor rule) and
  the server rejects it `400` defensively.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Remove all rows | Allowed → fully unallocated; shows in needs-allocation. |
| Allocation to archived/unknown envelope | Server rejects `400`. |
| Concurrent edit (single user) | Last write wins (acceptable at V1 scale). |

## 6. Data changes

None — reuses `transactions` / `allocations`. `PUT /transactions/:id/allocations` deletes the
existing allocations and inserts the new set atomically (validated by the domain invariant).

## 7. Interface changes

No new API. UI: an **"Edit split"** control per register row that opens the `AllocationEditor`
inline (pre-filled), saving via `setAllocations` (see [UX](../ux/edit-split.md)).

## 8. Dependencies

Slice 1 (transactions + editor + `PUT allocations`); Slice 2 (templates — re-usable while editing).

## 9. Security, privacy & accessibility

Household-scoped; input validated at the boundary; the editor's a11y rules (Slice 1 UX §8)
carry over to the inline edit.

## 10. Test plan

- **Integration (API):** `PUT` replaces a *fully-allocated* split with a different one and
  re-derives envelope balances; over-allocation `400`.
- **Component (web):** in the register, edit a fully-allocated transaction to a partial split
  and see the row's remainder update.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Add edit of amount/payee/date (and delete) as a follow-up slice? | Wesley | open |
