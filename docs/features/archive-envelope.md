---
type: feature-spec
roadmap-item: BUD-S5
status: Implemented
---
<!--
FEATURE SPEC — #6: archive an envelope (sinking-fund soft-delete). Pairs with
docs/ux/archive-envelope.md. No schema change (archived_at exists since the Foundation).
-->

# Feature Spec — Archive an envelope

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-006                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | [Envelopes](envelopes.md) · [UX](../ux/archive-envelope.md) · [Domain](../04_DOMAIN_MODEL.md) §4 · [API](../06_API_CONTRACT.md) |

## 1. Summary

Archive an envelope (a soft-delete) when it's done — e.g. a one-off "Vacation" sinking fund.
An archived envelope **keeps its history and balance** (still derived from its existing
allocations) but **accepts no new allocations** and disappears from the allocation pickers.
It can be **unarchived** to bring it back. Mirrors the spreadsheet's `Archive*` pattern.

## 2. Scope

- **In scope** — archive / unarchive an envelope; hide archived envelopes from allocation
  pickers (transactions, templates); show them in a separate "Archived" area on the Dashboard.
- **Out of scope** — deleting an envelope (we soft-delete only); requiring a zero balance to
  archive; merging/moving a balance to another envelope; archiving accounts.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to archive a finished sinking fund so it stops cluttering my pickers. | Must |
| US-2 | As the user, I want archived envelopes' history preserved (balance still shown). | Must |
| US-3 | As the user, I want to unarchive an envelope if I need it again. | Should |

## 4. Acceptance criteria

- **Given** an active envelope, **when** I archive it, **then** it moves to the **Archived**
  list, keeps its balance, and no longer appears in the allocation/template pickers.
- **Given** an archived envelope, **when** I try to allocate to it (API), **then** it's
  rejected `400` ("Unknown or archived envelope") — already enforced.
- **Given** an archived envelope, **when** I unarchive it, **then** it returns to the active
  list and reappears in the pickers.
- **Given** a missing envelope id, **when** I archive/unarchive, **then** `404`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Archive an envelope with a non-zero balance | Allowed; the balance is preserved as history. |
| Editing a transaction that already allocates to a now-archived envelope | The picker omits archived envelopes; re-saving that split requires re-pointing the archived line (server rejects archived). **Known V1 limitation** (archived = frozen). |
| Archive an already-archived envelope | Idempotent (stays archived). |

## 6. Data changes

None — `envelopes.archived_at` already exists ([05_DATA_MODEL](../05_DATA_MODEL.md)). Archiving
sets it to `now()`; unarchiving sets it to `null`. The `v_envelope_balances` view already
includes archived envelopes (history preserved).

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `POST /envelopes/:id/archive` → `200 { envelope }`.
- `POST /envelopes/:id/unarchive` → `200 { envelope }`.

UI: Dashboard envelope list splits **Active** (with an **Archive** button) and **Archived**
(with **Unarchive**); allocation/template pickers filter to **active** envelopes
(see [UX](../ux/archive-envelope.md)).

## 8. Dependencies

Foundation (envelopes, `archived_at`, `assertEnvelopesUsable` guard already blocks archived).

## 9. Security, privacy & accessibility

Household-scoped; archive/unarchive are labeled buttons; the active/archived split is conveyed
by headings + text, not color alone.

## 10. Test plan

- **Integration (API):** archive sets `archivedAt`; allocating to an archived envelope → `400`;
  unarchive clears it; archive/unarchive missing → `404`; balance preserved after archive.
- **Component (web):** Dashboard archive moves an envelope to Archived (and back); the
  allocation picker excludes archived envelopes.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Allow editing splits that reference an already-archived envelope (keep, not add)? | Wesley | open (V1: not allowed — archived is frozen) |
| Offer "move remaining balance to another envelope" on archive? | Wesley | open (later) |
