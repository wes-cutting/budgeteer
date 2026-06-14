<!--
FEATURE SPEC — #7a: account↔account transfer (double-entry). Pairs with docs/ux/transfers.md.
Models per ADR-0004 (validated by SPIKE-04). Envelope↔envelope reallocation = #7b (§12).
-->

# Feature Spec — Transfers

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-007                               |
| Status       | Implemented (#7a account transfer + #7b envelope reallocation) |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-14                             |
| Related      | [ADR-0004](../adr/ADR-0004-transfer-modeling.md) · [SPIKE-04](../spikes/04-transfer-modeling.md) · [UX](../ux/transfers.md) · [Domain](../04_DOMAIN_MODEL.md) · [Data](../05_DATA_MODEL.md) · [API](../06_API_CONTRACT.md) |

## 1. Summary

Move money between two of your accounts (e.g. checking → savings) as a **double-entry
transfer**: one transaction `−X` on the source account and one `+X` on the destination, linked
as a pair (ADR-0004). The total money is **conserved** (the legs sum to zero); each account's
**derived balance** updates automatically. A transfer carries **no envelope allocation** — the
money is already budgeted, only relocated — so it does **not** appear in needs-allocation.

## 2. Scope

- **In scope (#7a)** — create an account↔account transfer; both account balances reflect it;
  the transfer legs show in each account's register, labeled by their counterpart; transfers
  are excluded from needs-allocation.
- **In scope (#7b)** — create an envelope↔envelope reallocation; both envelope balances reflect
  it; accounts untouched (§12).
- **Out of scope** — editing/deleting a transfer or reallocation (immutable for now); transfers
  between households; FX.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to move money from one account to another so my balances mirror reality. | Must |
| US-2 | As the user, I want a transfer to **not** show up as "needs allocation" — it's already-budgeted money. | Must |
| US-3 | As the user, I want each leg labeled with the other account so my register reads clearly. | Should |

## 4. Acceptance criteria

- **Given** two accounts, **when** I transfer `$X` from one to the other, **then** the source
  balance drops by `$X`, the destination rises by `$X`, and the system total is unchanged.
- **Given** a transfer, **when** I view either account's register, **then** I see a leg labeled
  **"Transfer to/from <other account>"** with the signed amount, and **no** allocation status.
- **Given** a transfer, **when** I open needs-allocation, **then** neither leg appears.
- **Given** an invalid request — same account, amount ≤ 0, or a missing account — **then** the
  API rejects it (`400` / `404`) and nothing is created.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| from === to | Rejected `400` ("Choose two different accounts.") |
| amount ≤ 0 or unparseable | Rejected `400` ("Enter an amount greater than 0.") |
| from or to account missing | Rejected `404` ("Account not found.") |
| an account is archived | Rejected `400` ("That account is archived.") — default-deny (no account-archive UI yet) |
| transfer larger than the source balance | **Allowed** — accounts may go negative (mirrors real overdraft); not blocked in V1 |

## 6. Data changes

Per [ADR-0004](../adr/ADR-0004-transfer-modeling.md) / [05_DATA_MODEL](../05_DATA_MODEL.md):
- New **`transfers`** table (`id, household_id, occurred_on, memo, created_at`).
- `transactions.kind` check now allows **`'transfer'`**; new nullable
  **`transactions.transfer_id`** FK → `transfers` (`on delete cascade`); index on it.
- `v_account_balances` is **unchanged** (it already sums all transaction kinds).

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):
- `POST /transfers` `{ fromAccountId, toAccountId, amount, occurredOn?, memo? }` → `201 { transfer }`.

`TransactionView` gains `kind: "transfer"`, `transferId`, and `transferCounterpartName`. UI: a
**Transfer money** form on the account register (pick a destination account + amount); transfer
legs render as labeled rows without an allocation editor (see [UX](../ux/transfers.md)).

## 8. Dependencies

Foundation accounts (`#1`); the transaction model (`#3`). Gated by [SPIKE-04](../spikes/04-transfer-modeling.md).

## 9. Security, privacy & accessibility

Household-scoped; both accounts validated server-side (default-deny on missing/archived).
Inputs validated at the boundary (positive magnitude, distinct accounts, `YYYY-MM-DD` date).
The Transfer form has labeled controls; transfer legs convey direction via text
("Transfer to/from …") and sign, not color.

## 10. Test plan

- **Domain (unit):** `validateTransfer` (positive magnitude, distinct accounts); `transferLegs`
  (signed ∓magnitude, sum to zero; odd cents exact).
- **Integration (API):** balances move + conserved; both legs read back; transfer leg labeled
  by counterpart in the register and excluded from needs-allocation; same-account/zero → `400`,
  missing → `404`, archived account → `400`.
- **Component (web):** transferring out moves the balance and shows a labeled transfer leg with
  no allocation status; the source account is not offered as a destination.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Edit / delete a transfer (re-derive both legs atomically)? | Wesley | open (deferred past #7a) |
| Warn (not block) when a transfer overdraws the source account? | Wesley | open (later) |

## 12. #7b — envelope↔envelope reallocation (Implemented)

Re-budget money between two **envelopes** with **no** account movement (ADR-0004 (B)): a
dedicated `envelope_transfers` row `(from_envelope_id, to_envelope_id, amount_cents > 0)`.
Envelope-balance derivation extends to `Σ allocations + Σ incoming − Σ outgoing` (the
`v_envelope_balances` view becomes two-source). Account balances are **untouched**.

**Acceptance criteria**
- **Given** two envelopes with balances, **when** I move `$X` from one to the other, **then**
  the source drops by `$X`, the destination rises by `$X`, the budgeted total is unchanged, and
  no account balance moves.
- **Given** an invalid request — same envelope, amount ≤ 0, or a missing envelope — **then**
  the API rejects it (`400` / `404`).
- **Given** an **archived** destination envelope, **then** the move is rejected `400`; moving
  **from** an archived envelope (draining it) is **allowed**.
- **Given** a move larger than the source's balance, **then** it is **allowed** and the source
  goes **negative** (consistent with normal over-spending; owner decision).

**Data:** new `envelope_transfers` table (`id, household_id, from_envelope_id, to_envelope_id,
amount_cents > 0, occurred_on, memo, created_at`; check `from <> to`); `v_envelope_balances`
becomes the two-source view. **API:** `POST /envelope-transfers` `{ fromEnvelopeId, toEnvelopeId,
amount, occurredOn?, memo? }` → `201 { envelopeTransfer }`. **UI:** a **Move money between
envelopes** form on the Dashboard envelopes section (from/to active envelopes + amount + memo);
balances refresh on success (see [UX](../ux/transfers.md) §11).

**Tests:** domain `validateEnvelopeTransfer` + `envelopeBalanceWithTransfers`; API
move+conserve+account-untouched, same/zero/missing, into-archived `400`/from-archived ok,
overdraw→negative; web Dashboard reallocation updates both balances + inline error.
