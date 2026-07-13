---
type: adr
id: ADR-0004
status: Accepted
---
<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. A "further ADR" for an expensive-to-reverse choice (the data
representation of money movement). Validated by SPIKE-04 before adoption.
-->

# ADR-0004: Transfers are modeled as two orthogonal primitives (account legs + envelope-transfer rows)

| Field        | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| Status       | Accepted                                                                       |
| Date         | 2026-06-14                                                                     |
| Deciders     | Wesley Cutting + agent                                                         |
| Validated by | [SPIKE-04](../spikes/04-transfer-modeling.md) — *Confirmed* (strict typecheck + 8/8 throwaway tests) |

## Context

Budgeteer needs two kinds of money movement (owner-confirmed during `#7` intake):

- **(A) Account↔account transfer** — physical money between accounts (checking → savings).
  The envelope budget is unchanged; only the money's *location* moves.
- **(B) Envelope↔envelope reallocation** — re-budget money between envelopes (Groceries →
  Vacation), independent of any account move.

The existing model (realized `#1`–`#6`) is precise and load-bearing: a **Transaction belongs
to exactly one Account**; **Account↔Envelope connect only through a Transaction's
Allocations**; the **split invariant** holds (`0 ≤ |Σ allocations| ≤ |amount|`, matching sign);
balances are **derived** (`account = Σ txns`, `envelope = Σ allocations`); and a transaction
with a non-zero unallocated remainder surfaces in **needs-allocation**. The money
representation is integer minor units ([`ADR-0003`](ADR-0003-money-integer-minor-units.md)).

How transfers attach to this model is a **data-representation decision that is expensive to
reverse** (spine §11) — so it was spiked before building. The genuinely uncertain parts were
*not* "can we add numbers" (retired by SPIKE-02) but: where transfer legs live relative to the
split invariant and the needs-allocation surface, and how an envelope move (which has **no**
parent account transaction) can change envelope balances without corrupting the allocation
model.

## Decision

Adopt a **minimal, additive, two-primitive** model. The two movements are **orthogonal** — an
account move never changes an envelope balance and vice-versa — and the existing
allocation/split model is left **untouched**.

**(A) Account transfer = a `transfers` parent + two linked transaction legs.**
- A `transfers` row (homes shared `occurred_on`/`memo`) plus **two** `transactions` of a new
  `kind = 'transfer'` linked by `transfer_id`: `−magnitude` on the source account, `+magnitude`
  on the destination. The legs **sum to zero** (money conserved, only relocated).
- Transfer legs carry **no allocations** and are **exempt from needs-allocation** — relocated
  money is already budgeted. This is why a new `kind` is required, not optional: as `'normal'`,
  every transfer would nag in needs-allocation forever (SPIKE-04 *Invalidated* "a transfer is
  just a normal transaction").
- Account-balance derivation is **unchanged** (it already sums all of an account's
  transactions, of any kind). Created/edited/deleted as an **atomic pair**
  (`transfer_id … on delete cascade`).

**(B) Envelope reallocation = a dedicated `envelope_transfers` table.** *(Built in `#7b`.)*
- A row `(from_envelope_id, to_envelope_id, amount_cents > 0, occurred_on, memo)` that creates
  **no** account transaction. Envelope-balance derivation **extends** to
  `Σ allocations + Σ incoming − Σ outgoing`. The transaction split invariant is undisturbed.

**Shared rules:** positive magnitude; `from ≠ to`; cannot transfer **into** an archived
account/envelope; draining **from** an archived envelope is allowed (move-out before archive).
**Negative envelope balances are permitted** (owner decision) — consistent with today, where
envelope balances can already go negative via normal over-spending; surface a warning later
rather than block.

## Consequences

### Positive
- **The heart is untouched.** The split invariant and allocation model carry over verbatim;
  transfers extend only the two balance derivations.
- **Orthogonal & composable.** "Send money *and* re-budget" is two clean primitives, not one
  overloaded operation (SPIKE-04 proved no double-counting; conservation holds on both axes).
- **Derive-don't-store preserved.** Both balances stay derived; nothing is materialized.
- **Future synergy.** Envelope-transfers are the primitive behind the deferred "move remaining
  balance on archive" (`#6` open-Q).

### Negative / cost
- A **new transaction `kind`** and a **new column** (`transfer_id`) evolve the transactions
  table (forward migration; the kind check now allows `'transfer'`).
- Envelope-balance derivation (and the `v_envelope_balances` view) becomes a **two-source**
  sum once `#7b` lands — slightly more query surface.
- Two write paths now insert `transactions`; the `'transfer'` kind must be consistently
  excluded from allocation-oriented queries (centralized in the transaction service).

### Neutral
- Account transfer legs deliberately **cannot** carry allocations — funding-an-envelope is a
  *composition* of (A) then (B), not a coupled operation.
- Single household / no auth still applies (V1); transfers are household-scoped server-side.

## Alternatives considered

- **"A transfer is just a normal transaction (pair)."** Rejected — without a distinct kind,
  transfer legs pollute needs-allocation permanently (SPIKE-04 *Invalidated*).
- **One operation expressing both axes.** Rejected — conflating account + envelope movement
  double-counts or couples independent axes; orthogonal primitives are cleaner and were proven.
- **Envelope reallocation via a zero-amount pseudo-transaction with ±allocations.** Rejected —
  it has no parent account, breaks the "allocations share their txn's sign" rule, and pollutes
  an account register. A dedicated `envelope_transfers` table is the honest fit.
- **A generalized "envelope ledger entry" replacing allocations.** Rejected for V1 — a large
  refactor of the built-and-tested allocation model; over-engineered for the need.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
