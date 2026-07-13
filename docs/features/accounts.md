---
type: feature-spec
roadmap-item: BUD-S1
status: Implemented
---
<!--
FEATURE SPEC — copy of templates/FEATURE-SPEC-TEMPLATE.md. Part of the Foundation slice.
Pairs with docs/ux/foundation.md. Build as a vertical slice (data → API → UI).
-->

# Feature Spec — Accounts

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-001                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | PRD Foundation scope · [UX spec](../ux/foundation.md) · [ADR-0001](../adr/ADR-0001-stack.md) · [ADR-0002](../adr/ADR-0002-datastore.md) · [ADR-0003](../adr/ADR-0003-money-integer-minor-units.md) · [Domain](../04_DOMAIN_MODEL.md) |

## 1. Summary

Create, view, and rename **accounts** that mirror the user's real bank/card/cash accounts.
Opening an account with a starting balance creates an **opening transaction** for that
amount (initially unallocated), so the starting balance can later be split like any other
money. Account balances are **derived** from transactions.

## 2. Scope

- **In scope** — create an account (name, kind, starting balance); list accounts with their
  derived balances; rename an account.
- **Out of scope** — entering normal transactions and splitting them (Slice 1); archiving
  accounts (later); bank import/sync; liability sign semantics (debt/credit area).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to add an account with a name, a kind, and a starting balance so my real accounts exist in Budgeteer. | Must |
| US-2 | As the user, I want to see each account's current balance so I can sanity-check against the bank. | Must |
| US-3 | As the user, I want to rename an account so I can fix typos / relabel. | Should |

## 4. Acceptance criteria

- **Given** the accounts view, **when** I submit a valid name + kind + starting balance,
  **then** the account is created with one `opening` transaction equal to the starting
  balance, and it appears in the list with that balance.
- **Given** a starting balance entered as `"1,abc"` or `"12.345"`, **when** I submit,
  **then** it's rejected with an inline error and **no** account is created.
- **Given** an existing account named "Checking", **when** I add another "checking",
  **then** it's rejected (case-insensitive uniqueness per household).
- **Given** an account, **when** I rename it to a valid, unique name, **then** the list
  reflects the new name.
- **Given** a starting balance of `0`, **when** I submit, **then** the account is created
  with a `$0.00` balance (opening txn of 0 allowed).

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Whitespace-only name | Treated as empty; rejected with "Name is required." |
| Duplicate name (any case) | Rejected: "An account with that name already exists." |
| Negative starting balance (e.g. a credit card at `-500.00`) | Allowed; balance shows negative. |
| Non-numeric / >2dp amount | Rejected at the boundary; form preserves input. |
| Server/DB write fails | Inline error; entered values preserved; nothing partially created (atomic). |

## 6. Data changes

Introduces `accounts` and (the opening) `transactions` rows — see
[`05_DATA_MODEL`](../05_DATA_MODEL.md). Creating an account and its opening transaction is a
**single atomic** write.

## 7. Interface changes

API (per the forthcoming `06_API_CONTRACT`):
- `POST /accounts` `{ name, kind, startingBalance }` → creates account + opening txn.
- `GET /accounts` → accounts with derived balances.
- `PATCH /accounts/:id` `{ name }` → rename.

Input validated at the boundary (name non-empty/unique; money parsed to integer cents).
UI surface: the Accounts view — see the [UX spec](../ux/foundation.md).

## 8. Dependencies

Foundation scaffolding (app shell, Postgres, domain core ported from SPIKE-02); ADR-0001/0002/0003.

## 9. Security, privacy & accessibility

Confidential financial data — never logged or committed; tests use synthetic fixtures. V1
is single (implicit) household; `householdId` scoping is present but auth is not yet built.
UI is keyboard-operable and labeled (see UX spec §8).

## 10. Test plan

- **Unit (domain):** account name validation (trim/non-empty); money parse rejects bad input;
  balance = sum of transactions.
- **Integration:** `POST /accounts` persists account + opening txn atomically; duplicate name
  rejected; `GET /accounts` returns derived balances.
- **e2e:** add an account → it appears with the right balance; reload → still present; rename
  reflects; a11y check on the view.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should "kind" offer a custom/"other" label field? | Wesley | open (lean: not in V1) |
