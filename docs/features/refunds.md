<!--
FEATURE SPEC — #8: refunds (mixed-sign / "refund" rows within a split). Extends the FEAT-003
allocation editor. No schema change; the split invariant (validateAllocations) governs the
signed TOTAL and already admits mixed-sign rows. Pairs with docs/ux/refunds.md.
-->

# Feature Spec — Refunds (refund rows within a split)

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-008                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-14                             |
| Related      | [Transactions](transactions.md) (FEAT-003) · [UX](../ux/refunds.md) · [Domain](../04_DOMAIN_MODEL.md) · [API](../06_API_CONTRACT.md) · PRD §9 (open Q resolved) |

## 1. Summary

Allow an allocation row to be a **refund** — money pointing the **opposite** direction to the
transaction — **within a single split**. This lets one transaction mix spending and a return
(e.g. a store receipt that's `$100` of groceries minus a `$30` returned item, net a `$70`
withdrawal), or credit one envelope back while spending from others. A standalone refund (a
deposit allocated to an envelope) already worked; this closes the *mixed-sign-within-a-split*
gap (PRD §9 open question).

The change is at the **boundary + UX only**: the split invariant
([`validateAllocations`](../04_DOMAIN_MODEL.md)) was always defined on the **signed total**
(`0 ≤ |Σ allocations| ≤ |amount|`, same direction as the amount) and already admits mixed-sign
rows — the API/UI simply previously forced every row to the transaction's sign.

## 2. Scope

- **In scope** — a per-row **Refund** toggle in the split editor (positive magnitude, opposite
  direction); mixed-sign rows on create **and** on edit/allocate-later (`PUT`); the live
  Allocated/Remaining tally accounts for refund rows; over-allocation and net-direction-flip are
  blocked (client + server).
- **Out of scope** — a dedicated "refund transaction" type (a refund deposit is just a deposit);
  per-row magnitude caps (only the *total* is bounded); refunds in Single mode (refunds are a
  split concept).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want one transaction to mix a purchase and a returned item so a single receipt is recorded accurately. | Must |
| US-2 | As the user, I want a refund row to **credit its envelope back** (opposite sign) while the others are spent. | Must |
| US-3 | As the user, I want the editor to stop me if my refunds flip the transaction's direction (I should enter a deposit instead). | Should |

## 4. Acceptance criteria

- **Given** a `withdrawal` of `70.00`, **when** I split `100.00` to Groceries and mark a
  `30.00` row to Gas as **Refund**, **then** Remaining shows `0.00`, the save succeeds, the
  account drops `70.00`, Groceries drops `100.00`, and **Gas rises `30.00`**.
- **Given** the same withdrawal, **when** refund rows make the **net positive** (e.g. spend
  `50` / refund `60`), **then** the editor shows "Refunds exceed the amount" and disables Save,
  and the server rejects it `400`.
- **Given** a saved transaction with a refund row, **when** I reopen it (Edit split), **then**
  the refund row shows the **Refund** toggle checked with a positive magnitude.
- **Given** over-allocation (net exceeds the amount), **then** Save is disabled and the server
  rejects `400` (unchanged from FEAT-003).

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Refund row magnitude exceeds the transaction (offset by spend rows) | Allowed — only the **net total** is bounded (e.g. −100 + 30 on a −70 txn). |
| Refunds net the transaction to **0** | Allowed (a wash); treated as a valid partial (Remaining = full amount). |
| Refunds flip net **opposite** the txn direction | Rejected — client message + server `400`. |
| Refund row to an archived/unknown envelope | Rejected `400` (existing `assertEnvelopesUsable`). |
| Refund in Single mode | N/A — refund is only offered on Split rows. |

## 6. Data changes

**None.** `allocations.amount_cents` is already signed; a refund row is simply stored with the
opposite sign to the transaction. Envelope/account balances derive as before. Writes stay atomic.

## 7. Interface changes

API ([06_API_CONTRACT](../06_API_CONTRACT.md)): allocation inputs on
`POST /accounts/:id/transactions` and `PUT /transactions/:id/allocations` gain an optional
**`refund: boolean`** (default `false`) per row; a refund row is stored opposite the
transaction's direction. The split invariant on the signed total is unchanged.

UI: the split editor gains a per-row **Refund** checkbox; the Allocated/Remaining line nets
refund rows; Save disables on over-allocation **or** a net-direction flip (see [UX](../ux/refunds.md)).

## 8. Dependencies

FEAT-003 (transactions + the allocation editor + `validateAllocations`). No new domain code —
the invariant already governs mixed signs (pinned by new domain tests).

## 9. Security, privacy & accessibility

Household-scoped; magnitudes validated positive at the boundary; the refund flag only flips
sign — the signed-total invariant still fails loudly on a net flip / over-allocation. The
Refund control is a labeled checkbox; direction is conveyed by the toggle + the Allocated text,
not color.

## 10. Test plan

- **Unit (domain):** `validateAllocations` accepts mixed-sign rows netting within `[0, amount]`;
  rejects a net direction flip and over-allocation ([refund-allocations.test.ts](../../packages/domain/test/refund-allocations.test.ts)).
- **Integration (API):** a refund row nets to the amount and credits its envelope (opposite
  sign); net-flip → `400`; a refund row survives `PUT` (allocate-later/edit).
- **Component (web):** the Refund toggle nets the row, enables Save at Remaining `0`, and on a
  net flip shows "Refunds exceed the amount" + disables Save; balances reflect the credit.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Cap an individual refund row's magnitude (vs. only bounding the net)? | Wesley | open (V1: only the net is bounded) |
| Surface a per-envelope "refunded" indicator in the register? | Wesley | open (later, cosmetic) |
