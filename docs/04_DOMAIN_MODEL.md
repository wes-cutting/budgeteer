<!--
DOMAIN MODEL — copy of templates/DOMAIN-MODEL-TEMPLATE.md, filled for Budgeteer. The
conceptual model: entities, invariants, lifecycles. Storage-neutral (05_DATA_MODEL maps it
to Postgres per ADR-0002). Money per ADR-0003. Keep in sync with code in the same change.
-->

# Domain Model — Budgeteer

| Field        | Value          |
| ------------ | -------------- |
| Status       | Accepted       |
| Owner        | Wesley Cutting |
| Last updated | 2026-06-13     |

> Realizes [`02_PRD.md`](02_PRD.md); money per [`ADR-0003`](adr/ADR-0003-money-integer-minor-units.md);
> validated-in-TS by [`SPIKE-02`](spikes/02-stack-feasibility.md). The **Foundation** slice
> implements Accounts, Envelopes, and the opening transaction; **Slice 1** implements
> transaction entry + split allocation. The full entity set is defined here so the schema
> ([`05_DATA_MODEL.md`](05_DATA_MODEL.md)) is stable from the start.

## 1. Glossary

| Term | Meaning |
| ---- | ------- |
| **Money / Cents** | A signed amount in **integer minor units** (US cents). `+` = inflow, `−` = outflow. No floats (ADR-0003). |
| **Account** | A real place money lives — a mirror of a bank/card/cash account (checking, savings, credit, cash). The *physical* truth. |
| **Envelope** | A budget category (e.g. Groceries, Rent, a "Vacation" sinking fund). The *logical* budget. |
| **Transaction** | One line item in **one** account: a deposit (`+`) or withdrawal (`−`). Includes the **opening** transaction that seeds an account's starting balance, and the two **transfer** legs of an account↔account transfer. |
| **Allocation (split)** | A portion of a transaction assigned to **one** envelope. A transaction fans out to one-or-many allocations. |
| **Transfer** | A double-entry move of money between two **accounts**: a `transfers` parent linking two `kind: transfer` transaction legs (`−X` source, `+X` destination). The legs sum to zero; they carry no allocations (ADR-0004). |
| **Envelope transfer** | A re-budget of money between two **envelopes** with no account movement (a dedicated `envelope_transfers` row). Extends envelope-balance derivation (ADR-0004 (B)). |
| **Unallocated** | The part of a transaction not yet assigned to any envelope (`amount − Σ allocations`). May be non-zero ("enter now, split later"). |
| **Account balance** | **Derived:** Σ of the account's transaction amounts. |
| **Envelope balance** | **Derived:** Σ of the allocation amounts landing in that envelope. |
| **Household** | The future ownership/isolation boundary (multi-household). V1 has a single implicit household; entities carry `householdId` to design toward it. |

## 2. Entities

### Account
- **Purpose:** mirror a real bank/card/cash account; the source of transactions.
- **Key attributes:** `id`, `householdId`, `name`, `kind` (`checking | savings | credit | cash | other`), `createdAt`, `archivedAt?`.
- **Invariants:**
  - `name` is non-empty (trimmed) and **unique per household** (case-insensitive).
  - An account's **starting balance is not a stored scalar** — it is represented as an
    **opening Transaction** (see *Derived vs. stored*), so it flows through the same
    splitting mechanism as any other money.
  - Balance is **derived**, never stored.

### Envelope
- **Purpose:** a budget category that accumulates/drains via allocations.
- **Key attributes:** `id`, `householdId`, `name`, `kind` (`standard | sinking_fund`), `createdAt`, `archivedAt?`.
- **Invariants:**
  - `name` non-empty (trimmed), **unique per household** (case-insensitive).
  - An **archived** envelope cannot receive **new** allocations **or incoming envelope
    transfers**, but its history is preserved and still counts toward historical balances
    (mirrors the sheet's `Archive*`). Draining an archived envelope **out** via an envelope
    transfer is allowed (ADR-0004).
  - Balance is **derived**, never stored.

### Transaction
- **Purpose:** one movement of money in one account.
- **Key attributes:** `id`, `householdId`, `accountId`, `amountCents` (signed), `kind` (`opening | normal | transfer`), `occurredOn` (date), `payee?`, `memo?`, `transferId?`, `createdAt`.
- **Invariants:**
  - Belongs to exactly **one** account.
  - `amountCents` is a whole integer (ADR-0003). A `normal` transaction is non-zero; an
    `opening` transaction may be any value incl. 0; a `transfer` leg is non-zero.
  - Its allocations may be **either sign** (a refund row opposes the transaction — FEAT-008);
    their **signed total** stays within `[0, amountCents]` in the transaction's direction.
  - A `transfer` leg carries **no allocations**, sets `transferId`, and is **excluded from
    needs-allocation** (it relocates already-budgeted money — ADR-0004).

### Transfer
- **Purpose:** link the two legs of an account↔account transfer (double-entry).
- **Key attributes:** `id`, `householdId`, `occurredOn` (date), `memo?`, `createdAt`.
- **Invariants:**
  - Has exactly **two** `kind: transfer` transactions: `−magnitude` on the source account and
    `+magnitude` on the destination; the legs **sum to zero** (money conserved, only relocated).
  - The two accounts are **distinct** and **non-archived** (at creation time); `magnitude > 0`.
  - Legs are created/deleted as an **atomic pair** (delete cascades both legs).

### EnvelopeTransfer
- **Purpose:** re-budget money between two envelopes with **no** account movement (ADR-0004 (B)).
- **Key attributes:** `id`, `householdId`, `fromEnvelopeId`, `toEnvelopeId`, `amountCents` (positive magnitude), `occurredOn` (date), `memo?`, `createdAt`.
- **Invariants:**
  - The two envelopes are **distinct** (`from ≠ to`); `amountCents > 0`.
  - The **destination** must be non-archived; the **source** may be archived (drain-out allowed).
  - Affects **only** envelope balances (the source decreases, the destination increases by the
    same magnitude — budgeted total conserved); **no** account/transaction is created.
  - **Negative** envelope balances are permitted (consistent with normal over-spending).

### Allocation
- **Purpose:** assign a slice of a transaction to an envelope (the account↔envelope bridge).
- **Key attributes:** `id`, `transactionId`, `envelopeId`, `amountCents` (signed).
- **Invariants:**
  - References exactly one transaction and one (non-archived, at creation time) envelope.
  - **The split invariant** (the heart of the model): for a transaction `t`, the **signed
    total** satisfies `0 ≤ |Σ allocation.amountCents| ≤ |t.amountCents|` with the total in
    `t`'s direction. **Individual rows may be either sign** — a **refund** row points opposite
    `t` (FEAT-008), e.g. a `−$70` withdrawal split `−$100` spend + `+$30` refund. **Partial is
    allowed** (`|Σ| < |amount|` ⇒ unallocated remainder); **over-allocation and a net
    direction-flip are rejected.** Fully allocated ⟺ `Σ allocation.amountCents == t.amountCents`.
  - *(Validated in TypeScript by [SPIKE-02](spikes/02-stack-feasibility.md):
    `splitEvenly`/`splitByWeights`/`lastRowRemainder` sum exactly to the cent.)*

## 3. Relationships

```
Household 1───* Account 1───* Transaction 1───* Allocation *───1 Envelope
   (V1: single                                   (split)
    implicit hh)
```

- An **Account** has many **Transactions**; a **Transaction** has many **Allocations**.
- An **Envelope** has many **Allocations**. Account ↔ Envelope are connected **only**
  through a Transaction's Allocations — never directly.
- A **Transfer** links exactly **two** Transactions (its legs) on two different Accounts; an
  **EnvelopeTransfer** links two different Envelopes directly, with **no** Transaction (ADR-0004).
- *(Future)* a **Household** owns Accounts and Envelopes; all scoping is by `householdId`.

## 4. Lifecycles / state

**Envelope** (and, symmetrically later, Account):

```
active ──archive──▶ archived        (archived = soft-delete; history retained;
  ▲                    │                no NEW allocations; not deletable)
  └──────unarchive─────┘  (optional, later)
```

**Transaction allocation status** (derived, not a stored state):

```
unallocated ──(add allocations)──▶ partially allocated ──(remainder)──▶ fully allocated
   (Σ = 0)                              (0 < Σ < amount)                    (Σ = amount)
```

"Enter now, split later" means a transaction may rest in `unallocated`/`partially
allocated` indefinitely; the app surfaces these via a **needs-allocation** indicator.

## 5. Derived vs. stored

**Stored:** accounts, envelopes, transactions, allocations (their attributes above).

**Derived — never stored (derive-don't-store, ENGINEERING_STANDARDS §4):**
- **Account balance** = `Σ transaction.amountCents` for the account (includes the opening txn
  **and** any transfer legs — a transfer relocates money between accounts).
- **Envelope balance** = `Σ allocation.amountCents` into the envelope **plus** net envelope-
  transfer flow (`Σ incoming − Σ outgoing`) — a two-source derivation (ADR-0004 (B)).
- **Transaction.unallocated** = `amountCents − Σ its allocations`.
- **Needs-allocation set** = transactions where `unallocated ≠ 0`, **excluding `transfer`
  legs** (relocated money is already budgeted — ADR-0004).

> **Opening balance = an opening Transaction.** Creating an account with a starting balance
> creates the account **and** a `kind = opening` transaction for that amount (initially
> unallocated). This unifies the ledger (every balance derives from transactions) and lets
> the starting balance be split across envelopes through the *same* allocation flow — per
> the intake ("starting balance, deposit and withdrawal all need to be splittable").

## 6. Cross-cutting rules

- **Money:** integer minor units everywhere (ADR-0003); parse/format only at the boundary.
- **Ownership/household scoping:** every top-level entity carries `householdId`. V1 runs a
  **single implicit household** (one seeded row); **no** auth/RLS is built yet. When
  multi-household lands it becomes **default-deny**, owner-scoped at the resource level
  (spine §8) — a future epic, designed toward, not built now.
- **Validation at the boundary:** names trimmed + non-empty; money parsed from validated
  strings; invalid input fails loudly.
- **Account `kind`** is descriptive in V1 (display/grouping). Liability-account sign
  semantics (e.g. credit-card "balance owed") are deferred to the debt/credit area; V1
  treats every account balance uniformly as the signed sum of its transactions.

## 7. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should envelope/account name uniqueness be case-insensitive *and* whitespace-normalized? | Wesley | open (lean: yes) |
| Do we need an explicit "unarchive" in V1, or is archive one-way for now? | Wesley | open → archive slice (#6) |
| Liability (credit-card) balance sign convention | Wesley | open → debt/credit area (#14) |
