---
type: reference
status: Accepted
---
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
| Last updated | 2026-07-03     |

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
| **Recurring rule** | A scheduled template transaction (account + direction + fixed amount + split + frequency) with a `next occurrence` cursor; **Post due** generates concrete transactions and advances the cursor (FEAT-009). |
| **Reconciliation** | A recorded compare of an account's derived balance against the real bank **statement** balance at a point in time (FEAT-010). `difference = statement − derived`. Manual; no per-transaction *cleared* concept in V1. |
| **Envelope target** | A per-envelope **recurring monthly budget** — what you plan to spend from the envelope each month (FEAT-012). A single amount (not effective-dated); optional (no target ⇒ none). |
| **Actual spend (outflow)** | For budget-vs-actual: an envelope's **net spend** in a month = `−Σ allocation.amountCents` over allocations on **withdrawal** transactions (`amountCents < 0`). Excludes funding deposits; **nets refund rows** down. **Remaining** = `target − actual`. (FEAT-012.) |
| **Cash-flow forecast** | **Derived:** an account's projected **running cash balance** over a horizon — current balance + future **scheduled** recurring events (± magnitude) and, optionally, **expected discretionary spend** from targets, netted to avoid double-counting. Yields the **minimum balance + date** and **first-negative date** (FEAT-013). |
| **Expected (discretionary) spend** | For the forecast: a month's `Σ max(0, target − actualThisMonth − scheduledThisMonth)` over target envelopes — the budgeted spend **not** already covered by a scheduled bill or already-posted actual. Spread even-daily across the month's in-window days (FEAT-013). |
| **Credit limit** | A per-**credit-account** stored amount: the card's credit ceiling (FEAT-014a). A single positive amount (no row ⇒ no limit). Only meaningful for `kind='credit'` accounts. |
| **Owed** | For a credit account: the liability reading of its balance — `owed = −balanceCents` (a credit account's balance is ≤ 0 when in debt). Positive = debt; ≤ 0 = a credit balance / overpayment. **Derived**, never stored (FEAT-014a). |
| **Credit utilization** | **Derived:** for a credit account, `owed ÷ limit` (reported in **basis points**: `round(max(0, owed) / limit × 10000)`). Floored at 0% (overpayment), **not** clamped above 100% (over-limit is real). A **trend** applies it to each month's cumulative owed; a **portfolio roll-up** is `Σ owed ÷ Σ limit` over accounts with a limit (FEAT-014a). |
| **Original principal** | A per-**loan-account** stored amount: the loan's original borrowed principal (FEAT-014b). A single positive amount (no row ⇒ no principal). Only meaningful for `kind='loan'` accounts. |
| **Debt payoff** | **Derived:** for a loan account, how much of the original principal is paid down — `paid-down ÷ original = 1 − owed/original` (reported in **basis points**, **truthful/not clamped**: 0% at origination, 100% settled, >100% overpaid, <0% if owing more than borrowed). A **trend** applies it to each month's cumulative owed; a **portfolio roll-up** is `Σ(original − owed) ÷ Σ original` over loans with an original principal (FEAT-014b). |
| **Unallocated** | The part of a transaction not yet assigned to any envelope (`amount − Σ allocations`). May be non-zero ("enter now, split later"). |
| **Account balance** | **Derived:** Σ of the account's transaction amounts. |
| **Envelope balance** | **Derived:** Σ of the allocation amounts landing in that envelope. |
| **Household** | The future ownership/isolation boundary (multi-household). V1 has a single implicit household; entities carry `householdId` to design toward it. |

## 2. Entities

### Account
- **Purpose:** mirror a real bank/card/cash account; the source of transactions.
- **Key attributes:** `id`, `householdId`, `name`, `kind` (`checking | savings | credit | loan | cash | other`), `createdAt`, `archivedAt?`.
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

### RecurringTransaction
- **Purpose:** a scheduled template that generates real transactions on a cadence (FEAT-009).
- **Key attributes:** `id`, `householdId`, `accountId`, `direction` (`deposit | withdrawal`), `amountCents` (positive magnitude), `payee?`, `memo?`, `frequency` (`weekly | biweekly | monthly`), `anchorOn` (date), `nextOccurrenceOn` (cursor), `createdAt`; plus ordered **lines** (`envelopeId`, positive `amountCents`, `refund`).
- **Invariants:**
  - Has ≥ 1 line; the lines form a valid split for the (signed) amount (same invariant as a
    manual transaction — over-allocation / net-flip rejected at creation).
  - **Monthly** occurrences land on the **anchor day-of-month**, clamped to short months
    (31 → Feb 28/29 → 31); weekly/biweekly add 7/14 days.
  - **Post due** is **idempotent**: it generates one transaction per occurrence on/before today
    (each with the rule's split, `recurring_id` set) and advances `nextOccurrenceOn` past today,
    atomically per rule. Deleting a rule **keeps** generated transactions (their `recurringId`
    is nulled).

### Reconciliation
- **Purpose:** record a manual compare of an account's derived balance to its real bank balance (FEAT-010).
- **Key attributes:** `id`, `householdId`, `accountId`, `statementBalanceCents` (the real balance, signed), `derivedBalanceCents` (the **snapshot** of the derived balance at reconcile time), `reconciledOn` (date), `createdAt`.
- **Invariants:**
  - `differenceCents = statementBalanceCents − derivedBalanceCents` is **derived**, never stored;
    `matched ⟺ difference == 0`.
  - It is a **record**, not a ledger entry — it creates **no** transaction and does **not**
    affect any balance. Past reconciliations keep their snapshot (historical truth) even as the
    account's derived balance later changes.
  - V1 has **no per-transaction cleared/statement state** (deferred).

### EnvelopeTarget
- **Purpose:** the **budget** side of budget-vs-actual (FEAT-012) — a per-envelope recurring monthly
  spending target.
- **Key attributes:** `envelopeId`, `householdId`, `monthlyTargetCents` (positive magnitude), `createdAt`, `updatedAt`.
- **Invariants:**
  - **At most one** target per envelope (no target ⇒ the envelope is un-budgeted).
  - `monthlyTargetCents > 0` (a budget of 0 is expressed as **no target**, not a zero row).
  - It is **mutable config**, not a ledger row — setting replaces, clearing removes; it has **no**
    balance/ledger effect.
  - A **single recurring** monthly amount (not per-month / effective-dated in V1 — FEAT-012 §11).

### CreditLimit
- **Purpose:** the reference number for credit **utilization** (FEAT-014a) — a per-credit-account
  credit limit (the "owed vs. **limit**" denominator).
- **Key attributes:** `accountId`, `householdId`, `creditLimitCents` (positive magnitude), `createdAt`, `updatedAt`.
- **Invariants:**
  - **At most one** limit per account (no limit ⇒ utilization is unknown for that account).
  - `creditLimitCents > 0` (a 0 limit is expressed as **no limit**, not a zero row).
  - Only set on a `kind='credit'` account (enforced at the service boundary, → `400` otherwise).
  - **Mutable config**, not a ledger row — setting replaces, clearing removes; **no** balance effect.
  - **Not effective-dated** in V1 — the current limit is applied to every historical period of the
    utilization trend (a definition here, not an ADR; effective-dated limits can layer on later).

### LoanPrincipal
- **Purpose:** the reference number for debt **payoff** (FEAT-014b) — a per-loan-account original
  principal (the "owed vs. **original**" denominator). The installment-debt sibling of `CreditLimit`.
- **Key attributes:** `accountId`, `householdId`, `originalPrincipalCents` (positive magnitude), `createdAt`, `updatedAt`.
- **Invariants:**
  - **At most one** original principal per account (no principal ⇒ payoff is unknown for that loan).
  - `originalPrincipalCents > 0`.
  - Only set on a `kind='loan'` account (enforced at the service boundary, → `400` otherwise).
  - **Mutable config**, not a ledger row — setting replaces, clearing removes; **no** balance effect.
  - **Not effective-dated** in V1 — the current original is applied to every historical period of the
    payoff trend (a definition here, not an ADR; effective-dated / refinance-aware originals can layer
    on later).

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
- **Budget-vs-actual** (FEAT-012, derived for a month): an envelope's **actual spend** =
  `−Σ allocation.amountCents` over allocations on **withdrawal** transactions in the month (outflow
  only — funding deposits excluded, refund rows netted down); **remaining** = `monthlyTarget −
  actual`. The target is **stored** (config); the actual and remaining are **derived**.
- **Cash-flow forecast** (FEAT-013, derived projection — the analysis area's only **forward** read):
  for one account, the **running cash balance** over a horizon, starting from the derived account
  balance and applying each **future dated event** (`date > today`). Events are (1) the account's
  **scheduled recurring rules** (the recurring engine fed the horizon as its bound; `±magnitude`)
  and, optionally, (2) **expected discretionary spend** from monthly **targets** — per month
  `Σ max(0, target − actualThisMonth − scheduledThisMonth)` (current month un-prorated, future-tail
  prorated), spread **even-daily**. The netting prevents double-counting bills/actuals already in the
  schedule or the balance (proven by [SPIKE-05](spikes/05-cashflow-forecast.md)). The **minimum
  balance + date** and **first-negative date** are derived over the series. **Nothing is stored** —
  it is a pure projection over existing rules, targets, balances, and actuals.
- **Credit utilization** (FEAT-014a, derived): for each **credit** account, `owed = −balanceCents`
  against the **stored** `creditLimit` → `utilization = owed ÷ limit` (basis points; floored at 0,
  unclamped above 100%); `available = limit − owed`; a monthly **trend** = the cumulative owed
  balance per period (Σ the per-month net flows) with utilization at each period end (current limit
  applied throughout); and a **portfolio roll-up** = `Σ owed ÷ Σ limit` over accounts with a limit.
  Only the **limit** is stored (`credit_limits`); owed, utilization, available, the trend, and the
  roll-up are all **derived**.
- **Debt payoff** (FEAT-014b, derived): for each **loan** account, `owed = −balanceCents` against the
  **stored** `originalPrincipal` → `payoff = 1 − owed/original` (basis points; **truthful, not
  clamped**); `paidDown = original − owed`; a monthly **trend** = the cumulative owed balance per
  period with payoff at each period end (current original applied throughout); and a **portfolio
  roll-up** = `Σ(original − owed) ÷ Σ original` over loans with an original principal. Only the
  **original principal** is stored (`loan_principals`); owed, payoff, paid-down, the trend, and the
  roll-up are all **derived**.

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
- **Timezone policy (EH8, decided 2026-07-03):** every calendar date in the model
  (`occurredOn`, `reconciledOn`, `anchorOn`, months, "today") is a **user-local calendar
  date**, stored and transported as a plain `YYYY-MM-DD`/`YYYY-MM` string with no timezone.
  **The client derives the current one from the user's local clock** (`apps/web/src/dates.ts`
  — never `toISOString()`, which is UTC and rolls a day/month early from evening on west of
  UTC); **the server never derives a user-facing calendar date** — every "today"/"this month"
  parameter is required at the HTTP boundary and a missing/malformed date fails loudly with
  `400` (`06_API_CONTRACT` §1). The server's injected clock (EH7) survives only for
  operational stamps (the backup filename) and tests. Event *instants* (`createdAt`,
  `archivedAt`) are unaffected: they stay full UTC timestamps — they record when something
  happened, not which budget day the user meant.
- **Account `kind`** is descriptive for the **ledger** (every account balance is uniformly the
  signed sum of its transactions — no kind-specific storage). The **liability** reading lives in the
  **analysis** layer, not the ledger: credit utilization (FEAT-014a, `kind='credit'`) and debt payoff
  (FEAT-014b, `kind='loan'`) both interpret the account's balance as **owed = −balance** (for owed/limit
  and 1−owed/original respectively). The stored balance sign is unchanged; only the analysis read flips
  it. `kind='loan'` is the installment-debt account type added by FEAT-014b.

## 7. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Should envelope/account name uniqueness be case-insensitive *and* whitespace-normalized? | Wesley | open (lean: yes) |
| Do we need an explicit "unarchive" in V1, or is archive one-way for now? | Wesley | open → archive slice (#6) |
| ~~Liability (credit-card / loan) balance sign convention~~ | Wesley | **resolved (#14a/#14b): owed = −balance** at the analysis layer (the stored ledger sign is unchanged); credit utilization = owed ÷ limit (#14a), debt payoff = 1 − owed/original on the new `kind='loan'` (#14b) |
