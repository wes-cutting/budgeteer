<!--
FEATURE SPEC — Slice 1, the core enter→allocate loop. Pairs with docs/ux/transactions.md.
Build as a vertical slice (data → API → UI). The validated heart of the product (SPIKE-01).
-->

# Feature Spec — Transactions & split allocation

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-003                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-13                             |
| Related      | PRD journeys 1–4 · [UX](../ux/transactions.md) · [Domain](../04_DOMAIN_MODEL.md) · [API](../06_API_CONTRACT.md) · [SPIKE-01](../spikes/01-split-allocation-ux.md) |

## 1. Summary

Enter a transaction once into an account (deposit or withdrawal), then **allocate** it across
envelopes — **Single** (the whole amount to one envelope) or **Split** (across several, with a
live `Allocated / Remaining` tally and a "use remaining" helper). **Partial allocation is
allowed** ("save now, split later"); anything not fully allocated surfaces in a
**Needs-allocation** list, including each account's opening balance. Account and envelope
balances are derived and update as allocations land. This is the validated heart of the
product and closes the SPIKE-01 felt-friction caveat in the running app.

## 2. Scope

- **In scope** — create a transaction (deposit/withdrawal) with 0..N allocations; view an
  account register; set/complete a transaction's allocations later; a household-wide
  needs-allocation list; the split editor (Single/Split, live remainder, last-row/use-remaining).
- **Out of scope** — templates/presets, keyboard-first entry, distribute-remainder (Slice 2);
  editing a *fully* allocated split as a dedicated flow (#5); transfers, refunds, recurring.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to record a deposit/withdrawal in an account so my balance matches the bank. | Must |
| US-2 | As the user, I want to allocate the whole amount to one envelope quickly (the common case). | Must |
| US-3 | As the user, I want to split one transaction across several envelopes, seeing what's left to allocate. | Must |
| US-4 | As the user, I want to save a transaction now and finish allocating it later. | Must |
| US-5 | As the user, I want a list of what still needs allocating (incl. opening balances). | Must |

## 4. Acceptance criteria

- **Given** an account, **when** I add a `withdrawal` of `48.20` allocated fully to `Gas`,
  **then** the account balance drops by `48.20`, `Gas` drops by `48.20`, and the txn shows
  fully allocated.
- **Given** a `deposit` of `3200.00`, **when** I split `1400/600` across two envelopes,
  **then** `Remaining` shows `1200.00`, the save succeeds (partial), and it appears in
  **Needs allocation** with `1200.00` unallocated.
- **Given** that partial transaction, **when** I later allocate the remaining `1200.00`,
  **then** unallocated becomes `0` and it leaves the needs-allocation list.
- **Given** a split whose parts exceed the amount, **when** I try to save, **then** it's
  rejected (client disables save; server returns `400`).
- **Given** an allocation targeting an archived/unknown envelope, **then** the server
  rejects it `400`.
- **Given** a transaction amount of `0` or negative magnitude, **then** create is rejected `400`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Over-allocation (sum > amount) | Client shows negative Remaining + disables save; server `400` defensively. |
| Empty allocation set | Allowed → fully unallocated; shows in needs-allocation. |
| Allocation to archived envelope | `400` "Unknown or archived envelope." |
| Opening balance | Treated as a transaction; appears in needs-allocation until allocated. |
| Odd-cent split via "use remaining" | Remainder is exact to the cent (integer math, ADR-0003). |
| Account/transaction not found | `404`. |

## 6. Data changes

Uses existing `transactions` + `allocations` tables ([05_DATA_MODEL](../05_DATA_MODEL.md));
no schema change. Normal transactions are `kind='normal'`; allocations share the transaction's
sign. Writes (transaction + its allocations; allocation replacement) are **atomic**.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `POST /accounts/:accountId/transactions` — create txn + allocations.
- `GET /accounts/:accountId/transactions` — account register.
- `PUT /transactions/:id/allocations` — set/replace allocations (allocate-later).
- `GET /transactions/needs-allocation` — household needs-allocation list.

Amounts are entered as positive magnitudes; the server applies sign from the transaction
direction. UI: account register + add-transaction + the **allocation editor** + needs-allocation
(see [UX](../ux/transactions.md)).

## 8. Dependencies

Foundation (accounts/envelopes, domain core, derived-balance views). Domain `validateAllocations`,
`unallocated`, `accountBalance`, `envelopeBalance`.

## 9. Security, privacy & accessibility

Single implicit household; all queries household-scoped. Input validated at the boundary;
money is integer cents. Allocation editor is keyboard-operable and labeled; Remaining is
conveyed as text (not color alone) — see UX §8.

## 10. Test plan

- **Unit (domain):** invariant (`validateAllocations`), `unallocated`, balances (already covered).
- **Integration (API):** create full/partial/over/empty; sign handling; archived-envelope reject;
  replace allocations (allocate-later) zeroes unallocated; needs-allocation list; account balance
  reflects txns; envelope balance reflects allocations.
- **Component (web):** allocation editor — single, split sum/remaining, use-remaining exactness,
  over-allocation disables save, partial save; add-transaction creates; allocate-later from the list.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should the register paginate once volumes grow? | Wesley | open (not in V1) |
| Edit/delete an existing allocation row from the register | Wesley | open → slice #5 |
