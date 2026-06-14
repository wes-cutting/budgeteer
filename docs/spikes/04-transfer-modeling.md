<!--
SPIKE REPORT — the deliverable; the code is disposable (lives at
spikes/04-transfer-modeling/, gitignored deps). See docs/00_WAYS_OF_WORKING.md §6.
-->

# SPIKE-04: How do we model transfers — account↔account *and* envelope↔envelope — without breaking the split model?

| Field      | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Status     | Done                                                                           |
| Type       | Technical / modeling                                                           |
| Owner      | Wesley Cutting                                                                  |
| Time-box   | One session (~1–2 h) — honored                                                  |
| Date       | 2026-06-14                                                                      |
| Blocks     | `ADR-0004` (transfer modeling) · [`features/transfers.md`] · roadmap `#7` |

## 1. The question

The owner needs **two** kinds of money movement (confirmed in intake for `#7`):
**(A)** physical money between **accounts** (checking → savings) and **(B)** budgeted money
between **envelopes** (re-budget Groceries → Vacation, *independent of any account move*).

Single falsifiable question: **Is there a minimal, additive representation that supports
both — such that every existing balance invariant still holds exactly, the two movements are
orthogonal (an account move never changes an envelope balance and vice-versa), and the
already-built split/allocation model (`#3`–`#6`) is left undisturbed?** This is a
data-representation decision (expensive to reverse), so the spine (§11) wants it spiked +
ADR'd before building.

## 2. Method

A **throwaway** TypeScript model (`spikes/04-transfer-modeling/`, disposable — *not* the V1
app): an in-memory `Ledger` with the real entities, the two **derivation** functions, and the
two **operations**, asserted with `node:test` under strict `tsc`.

- `model.ts` — `accountBalance` (unchanged: signed Σ of an account's txns) · `envelopeBalance`
  (**extended**: Σ allocations + Σ incoming − Σ outgoing envelope-transfers) · `needsAllocation`
  (**changed**: excludes transfer legs) · `accountTransfer` (a `Transfer` parent + two linked
  `kind:"transfer"` legs, ∓magnitude, no allocations) · `envelopeTransfer` (a dedicated
  `EnvelopeTransfer` row; touches no account).
- `transfer-modeling.test.ts` — conservation, orthogonality, the needs-allocation exemption,
  the A+B composition (the owner's exact "send money *and* re-budget" case), odd-cent
  exactness, atomic two-leg delete, drain-to-zero, and boundary guard rails.

**Deliberately not built:** Fastify routes, Kysely migrations/SQL views, React UI — those are
the *slice*, not this spike. The candidate **representation** is what's under test.

## 3. Findings

Real output:

```
=== tsc --noEmit (strict) ===
TYPECHECK: PASS
=== node --test (via tsx) ===
# tests 8
# pass 8
# fail 0
```

Concretely proven (all exact, integer cents, no float drift):

- **(A) Account transfer** of $250 checking→savings: checking $1000→$750, savings $0→$250;
  whole-system account money **conserved**; both envelope balances **unchanged**.
- **(A) Transfer legs are exempt from needs-allocation** — a transfer creates **zero** phantom
  "needs allocation" rows, while a normal unsplit deposit still surfaces (1 row). This is the
  crux: reusing `kind:"normal"` would have made every transfer nag forever.
- **(B) Envelope transfer** of $150 groceries→vacation: groceries $600→$450, vacation
  $400→$550; budgeted total **conserved**; **no** account transaction created; accounts
  unchanged; the existing split is undisturbed.
- **(A+B) compose without double-counting** — the owner's stated case ("send $200
  checking→savings **and** re-budget groceries→vacation") yields the exact combined state, and
  conservation holds on **both axes independently** ($100000 each).
- **Odd cents** (3333¢, 1717¢) land exactly on both axes.
- **Atomic pair**: deleting a transfer removes **both** legs and restores balances.
- **Drain-to-zero**: an envelope transfer can take an envelope to exactly 0 (the primitive
  behind the deferred "#6 move-remaining-on-archive").
- **Guard rails fail loudly**: same-account / same-envelope, non-positive magnitude, and
  transfer **into** an archived envelope all reject; transfer **from** an archived envelope is
  allowed (drain-before-archive).

### Confirmed

- The **additive** model works and is exact. Two new, well-separated constructs —
  **`transfer` (parent + two `kind:"transfer"` legs)** for (A) and a **dedicated
  `envelope_transfers` table** for (B) — extend only the two derivations and leave the
  allocation/split invariant (the heart, `#3`–`#6`) **completely untouched**.
- **Orthogonality holds**: account location and envelope budget are independent axes that
  compose cleanly. The owner's "also between envelopes" need is met by *composing* two
  primitives, not by overloading one.
- `needsAllocation` exempting `kind:"transfer"` is the right and sufficient rule for keeping
  relocated (already-budgeted) money out of the allocation surface.

### Invalidated

- **"A transfer is just a normal transaction."** A pure account transfer carries **no**
  envelope allocation, so as `kind:"normal"` it would sit in needs-allocation permanently — a
  new enum value (`transfer`) exempt from the split rule is required, not optional.
- **"One operation can express both."** Conflating them (e.g. an account transfer that also
  re-budgets) double-counts or couples the axes. Two orthogonal primitives is the clean model.
- **"Envelope reallocation can ride on the allocations table."** It has **no** parent account
  transaction; forcing a zero-amount pseudo-transaction breaks the "allocations share their
  txn's sign" rule and pollutes an account register. A separate table is the honest fit.

### Surprises / unknowns uncovered (→ resolve in the ADR)

- **Negative envelope balances.** The model permits an envelope transfer to overdraw an
  envelope (balance < 0), consistent with today's permissive allocation model. *Decision
  needed:* allow (simplest, V1) or block at the boundary.
- **`envelope_balances` SQL view must change.** Derived envelope balance now sums **two**
  tables — a real (if small) data-model edit shipped with the slice.
- **Un-budgeted money is untouched by either primitive.** Σ envelope balances can be < total
  account money when deposits are partially allocated; transfers don't change that asymmetry
  (it already exists). No "available to budget" pool envelope is introduced.

## 4. Recommendation / decision

**Adopt the additive two-primitive model** (→ write `ADR-0004`):

1. **Account transfer (A)** = a `transfers` parent row (homes shared `occurred_on`/`memo`) +
   **two** `transactions` of new `kind = 'transfer'` linked by `transfer_id` (−X on `from`,
   +X on `to`). Legs carry **no** allocations and are **excluded** from needs-allocation.
   Created/edited/**deleted atomically** as a pair (delete cascades both legs).
2. **Envelope transfer (B)** = a dedicated **`envelope_transfers`** table
   (`from_envelope_id`, `to_envelope_id`, `amount_cents > 0`, `occurred_on`, `memo`). Envelope
   balance derivation extends to `Σ allocations + Σ incoming − Σ outgoing`.
3. **Rules:** magnitude > 0; `from ≠ to`; can't transfer **into** an archived envelope/account;
   draining **from** an archived envelope is allowed. **Allow** negative envelope balances in
   V1 (flag as an open Q) unless the owner wants a block.
4. **No follow-up spike** — the representation is proven; this is now build + ADR + UX work.

## 5. Impact on the plan

- **Specs/ADRs:** new **`ADR-0004` (transfer modeling)** → `Proposed`; new
  `features/transfers.md` + `ux/transfers.md`; `04_DOMAIN_MODEL` (add Transfer + EnvelopeTransfer
  entities, extend envelope-balance derivation, add `kind:'transfer'`), `05_DATA_MODEL` (two
  tables + view change), `06_API_CONTRACT` (transfer endpoints) — all **with the slice**.
- **Scope/sequencing (recommended, pending owner nod):** the owner's "also between envelopes"
  answer means `#7` is **two** thin vertical slices, not one — build **`#7a` account transfer**
  first (the classic, lower-risk case), then **`#7b` envelope reallocation**. Logged in the
  roadmap re-sequencing table; the numbered plan is updated **with** the owner's confirmation.

## 6. Follow-ups

- [ ] Owner confirms the decision + the two open Qs (negative envelope balances; one slice vs.
      the `#7a`/`#7b` split).
- [ ] Write `ADR-0004` and the `features/transfers.md` + `ux/transfers.md` specs.
- [ ] Build `#7a` (account transfer) as a vertical slice; then `#7b` (envelope reallocation).
- [ ] Discard `spikes/04-transfer-modeling/` once its findings are absorbed (throwaway).
