<!--
FEATURE SPEC — copy of templates/FEATURE-SPEC-TEMPLATE.md. Part of the Foundation slice.
Pairs with docs/ux/foundation.md. Build as a vertical slice (data → API → UI).
-->

# Feature Spec — Envelopes

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-002                               |
| Status       | Proposed                               |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | PRD Foundation scope · [UX spec](../ux/foundation.md) · [ADR-0001](../adr/ADR-0001-stack.md) · [Domain](../04_DOMAIN_MODEL.md) |

## 1. Summary

Create, view, and rename **user-managed envelopes** (budget categories). Envelope balances
are **derived** from the allocations that land in them (so they start at `$0.00` until
Slice 1 brings transaction splitting). Archiving (the sinking-fund lifecycle) is a later
slice; this feature is create / list / rename only.

## 2. Scope

- **In scope** — create an envelope (name, kind `standard | sinking_fund`); list envelopes
  with derived balances; rename.
- **Out of scope** — archiving/unarchiving (slice #6); allocations/balances changing
  (Slice 1); monthly budget targets (analysis area).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to create my own envelopes so the budget matches how *I* think, not a fixed list. | Must |
| US-2 | As the user, I want to mark an envelope as a sinking fund so I can tell one-off savings goals apart. | Should |
| US-3 | As the user, I want to see all envelopes and their balances in one place. | Must |
| US-4 | As the user, I want to rename an envelope. | Should |

## 4. Acceptance criteria

- **Given** the envelopes view, **when** I submit a valid, unique name (+ kind), **then** the
  envelope is created and listed with a `$0.00` balance.
- **Given** an existing "Groceries", **when** I add "groceries", **then** it's rejected
  (case-insensitive uniqueness per household).
- **Given** an empty/whitespace name, **when** I submit, **then** it's rejected with
  "Name is required."
- **Given** an envelope, **when** I rename it to a valid unique name, **then** the list
  updates.
- **Given** the first run with no envelopes, **when** I open the view, **then** I see an
  empty state inviting me to add one (optionally seed the real 22 names).

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Duplicate name (any case) | Rejected: "An envelope with that name already exists." |
| Very long name | Stored in full; list truncates visually, full text on focus/hover. |
| Server/DB write fails | Inline error; input preserved. |

## 6. Data changes

Introduces `envelopes` rows — see [`05_DATA_MODEL`](../05_DATA_MODEL.md). No allocations yet,
so balances are `0` until Slice 1.

## 7. Interface changes

API:
- `POST /envelopes` `{ name, kind }`.
- `GET /envelopes` → envelopes with derived balances.
- `PATCH /envelopes/:id` `{ name }`.

UI surface: the Envelopes view — see the [UX spec](../ux/foundation.md).

## 8. Dependencies

Foundation scaffolding; ADR-0001/0002/0003. (Archive depends on this; allocations in Slice 1
depend on this.)

## 9. Security, privacy & accessibility

Single (implicit) household; `householdId` scoping present, auth later. Keyboard-operable,
labeled inputs; balances conveyed as text, not color alone (UX spec §8).

## 10. Test plan

- **Unit (domain):** envelope name validation; uniqueness check helper; balance = sum of
  allocations (0 with none).
- **Integration:** `POST /envelopes` persists; duplicate rejected; `GET /envelopes` returns
  derived (zero) balances.
- **e2e:** add an envelope → appears at `$0.00`; reload → present; rename reflects; a11y check.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Offer a one-click "seed my 22 envelopes" on first run? | Wesley | open (lean: yes, optional) |
