<!--
ADR — one decision per file. Append-only: supersede, don't edit. Status ladder:
docs/00_WAYS_OF_WORKING.md §4. ADR-0001 = stack, ADR-0002 = datastore (per ADR-0000);
this is a "further ADR" for an expensive-to-reverse choice (money/units representation).
-->

# ADR-0003: Money is represented as integer minor units

| Field         | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Status        | Accepted                                                              |
| Date          | 2026-06-13                                                            |
| Deciders      | Wesley Cutting + agent                                                |
| Validated by  | No spike required — adopts a proven pattern (ENGINEERING_STANDARDS §4); prior float-based attempt is the negative evidence |

## Context

Budgeteer is an envelope-budgeting system whose correctness story *is* the product: the
source spreadsheet nets to **$0.00 to the penny**, and the core domain invariant is that a
transaction's **split allocations sum exactly to its amount** (see
[`02_PRD.md`](../02_PRD.md) §5–8). Two forces make the money representation an
expensive-to-reverse decision worth an ADR (spine §11):

- **A prior attempt used floating-point and produced rounding errors.** This is documented
  negative evidence, not speculation — it's part of why this project exists.
- **The split invariant must hold exactly.** With binary floating point, `0.1 + 0.2 ≠ 0.3`;
  summing allocations and comparing to a parent amount cannot be trusted to the cent.

The kit explicitly lists **integer-minor-unit money** as a recommended pattern and names
"money/units representation" as a candidate for its own ADR ([`ADR-0000`](ADR-0000-record-architecture-decisions.md)).

## Decision

We will represent **every monetary amount as a signed integer in the currency's minor
unit** (US **cents** for USD), throughout the domain core and the datastore.

Specifics another contributor must follow:

- **No floating-point for money, anywhere** in the domain or storage layers. Amounts are
  integers (e.g. `1234` means `$12.34`). Deposits are positive, withdrawals negative (sign
  convention finalized in [`04_DOMAIN_MODEL`](04_DOMAIN_MODEL.md)).
- **Single currency (USD) for V1.** No multi-currency, no FX. If that ever changes, write a
  superseding ADR — do not bolt a currency field on silently.
- **The split invariant is exact in minor units:** `sum(allocation.amount_minor) ==
  transaction.amount_minor`. There are **no fractional cents**; the
  "last-row-takes-the-remainder" rule (SPIKE-01) absorbs any division remainder so the sum
  is exact to the cent.
- **Parsing/formatting happens only at the presentation boundary** — strings like `"12.34"`
  are converted to/from integer cents at the edge (validated input, spine §8). The core and
  store never see a decimal string or a float.
- A small **money helper / value object** (parse, format, add, negate, split-with-remainder)
  centralizes this so the rule isn't re-implemented per call site. Its exact form is a
  detail of the foundation slice + the chosen stack ([`ADR-0001`](ADR-0001-stack.md)).

## Consequences

### Positive
- **Exact arithmetic.** Sums, comparisons, and the split invariant are integer-exact — the
  "$0.00 to the penny" property is enforceable, not hoped for.
- **Clean storage.** Integers store and index trivially in any datastore (decided in
  [`ADR-0002`](ADR-0002-datastore.md)); no decimal-type portability concerns.
- **Testable invariant.** "Allocations sum to amount" becomes a simple integer equality —
  ideal for unit/property tests.

### Negative / cost
- Must **parse/format at the boundary** and resist the temptation to do money math in
  floats for convenience. A lint rule / typed `Money` wrapper helps prevent leakage.
- A **typed money helper** must exist before real amounts flow (foundation slice).

### Neutral
- **Single-currency** is assumed; multi-currency would be a future superseding ADR.
- Minor-unit granularity is the cent; sub-cent concepts (e.g. interest accrual at fractions
  of a cent) are out of scope and would need their own decision.

## Alternatives considered

### Arbitrary-precision decimal type (BigDecimal / decimal.Decimal)
Correct and avoids float error, and is a legitimate option. Rejected as the default because
it's heavier, varies by language/datastore, and the prior pain was specifically float
rounding — integer minor units is the simplest representation that makes the invariant
exact and stores identically everywhere. (If a future need for sub-cent precision or
multi-currency arises, revisit via a superseding ADR.)

### Floating-point (double)
**Rejected.** This is the documented prior failure: rounding errors break the
penny-exact invariant. Non-negotiable per this project's history.

## Supersedes / superseded by

- Supersedes: —
- Superseded by: —
