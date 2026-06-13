<!--
PRD — copy of templates/PRD-TEMPLATE.md, filled for Budgeteer. Written AFTER SPIKE-01
de-risked the core bet (see docs/00_WAYS_OF_WORKING.md). Promoted from docs/01_INTAKE.md.
-->

# Product Requirements — Budgeteer

| Field        | Value          |
| ------------ | -------------- |
| Status       | Proposed       |
| Owner        | Wesley Cutting |
| Last updated | 2026-06-13     |

> Source: [`01_INTAKE.md`](01_INTAKE.md) · validated by
> [`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md).

## 1. Problem & why now

A 12-year, hand-built Excel envelope-budgeting system works, but its **input model** is the
pain: income and expenses are typed **directly into per-envelope weekly ledgers** as
fragile in-cell formula strings, with real bank balances tracked on a separate manual
surface and never reconciled. Budgeteer **inverts** the model — enter each transaction once
into an **account**, then **split-allocate** it across one or more **envelopes**. Worth
pursuing now: a long-standing itch, and the model was validated (paper) by
[`SPIKE-01`](spikes/01-split-allocation-ux.md).

## 2. Users

A single user — the spreadsheet's author — managing **one household**, entering
transactions **manually** at a desk/device. No collaborators in V1. *(Future, explicitly
out of scope: multi-user households with isolation — noted so the data model can anticipate
owner/household scoping without building it now.)*

## 3. Goals

- **Enter once, at the account level** — never type into a per-envelope ledger again.
- **Split one transaction across many envelopes with low friction** — including the
  recurring **paycheck**, made painless by saved **templates**.
- **Always reconciled** — a transaction's allocations sum to its amount; account and
  envelope balances stay consistent by construction.
- **Enter now, allocate later** — saving a partially/unallocated transaction is a
  first-class flow, surfaced by a "needs allocation" indicator.
- **Organize envelopes over their lifecycle** — create your own (including one-off
  **sinking funds** like a vacation), rename, and **archive** them when done, with history
  preserved (mirrors the spreadsheet's `Archive*` soft-delete pattern).
- **See the money** — surface trends/breakdowns the spreadsheet computed by hand
  (spend-by-envelope over time, budget-vs-actual, cash-flow forecast, debt & credit).

## 4. Non-goals (explicit)

- **Multi-user / multi-household / profiles** — future direction, not V1.
- **Live bank-API integration** (Plaid-style auto-pull); **CSV/statement import** — maybe
  later, not V1.
- **Migrating 12 years of history** — deferred to a post-V1 data-profiling spike.
- **Parity with all 37 spreadsheet tabs** — parity is explicitly *not* the goal; we build
  the better model, not the old layout.

## 5. Success metrics / value hypothesis

> If we ship **account-level entry with split allocation across envelopes**, the user keeps
> the budget current and accounts reconciled to the banks with **far less friction than the
> spreadsheet**.

Measured by: a real week — including a **split paycheck** and a **split store run** —
entered with less time/friction than the sheet; account balances reconcile to actual bank
balances; the budget is still being kept current past week one.

**Status: `Validated` (paper)** by [`SPIKE-01`](spikes/01-split-allocation-ux.md) —
enter-once-then-split confirmed by the user; **templates** defuse the many-way-split slog;
**partial allocation** is a first-class workflow. **Residual risk:** the *felt* friction of
a real 12–22-way split is confirmed only when slice 1 is usable (tracked as a SPIKE-01
follow-up).

## 6. User journeys

The critical end-to-end flows (these drive the e2e tests). **V1 core** first:

1. **Quick entry (single envelope)** — enter a transaction into an account, allocate the
   full amount to one envelope in one tap. *(The common case — must stay fast.)*
2. **Paycheck split** — enter a deposit, split it across many envelopes; **apply a saved
   template**, tweak a row, **distribute the remainder**; save.
3. **Store-run split** — enter a withdrawal, split across several envelopes; the **last row
   takes the remainder**; save.
4. **Enter now, allocate later** — save a transaction with an unallocated remainder; later
   resolve it from the **"needs allocation"** surface.
5. **Manage envelopes** — create and rename your own envelopes (including a one-off sinking
   fund), and **archive** a finished one without losing its history.

**Later journeys** (scoped, post-core): 6. **Transfer** between two accounts (double-entry).
7. **Refund** (money back into an envelope). 8. **Reconcile** an account to its real bank
balance. 9. **Review trends** — spend-by-envelope / budget-vs-actual / cash-flow forecast /
debt & credit.

## 7. Scope (high level)

Ordered by value/uncertainty for sequencing (the roadmap is the plan of record):

1. **Foundation** — app shell + local store + the **domain core** (account · envelope ·
   transaction · split-allocation, with the *allocations-sum-to-amount* invariant) +
   **user-managed envelopes** (create/rename).
2. **Slice 1 — core enter→allocate loop** — Single (one-tap) + Split (multi-row, live
   `Allocated/Remaining`, last-row-remainder) + **partial allocation** + balances
   reconcile. *(The validated heart of the bet.)*
3. **Slice 2 — accelerators** — **templates/presets** (primary) · keyboard-first row entry
   · distribute-remainder. *(Converts the paycheck case from tolerable to good.)*
4. **Transfers** (double-entry) · **refunds** (negative allocation) · **recurring**
   transactions · **edit a past split** (preserving the invariant) · **archive an envelope**
   (soft-delete, history preserved).
5. **Reconcile to bank** (manual balance compare).
6. **Analysis** — spend-by-envelope over time · budget-vs-actual · cash-flow forecast ·
   debt & credit trends.

*(Post-V1: a history-import spike; multi-household scoping.)*

## 8. Risks & assumptions

- **Felt-friction unproven beyond paper.** The bet is `Validated` on paper only; a real
  many-way split must feel fast — confirmed when slice 1 is usable. (SPIKE-01 follow-up.)
- **Transfers need double-entry.** The spreadsheet's one-way cell pointer was brittle;
  transfers must be modeled as balanced postings — own feature spec, real modeling risk.
- **Edit-a-past-split must preserve the sum invariant** — correctness risk; own spec.
- **Money representation — DECIDED: integer minor units** (whole-integer cents), adopting
  the kit's recommended pattern (ENGINEERING_STANDARDS §4). Reasoning: a prior float-based
  attempt produced rounding errors; integers also store more cleanly. **To be formalized in
  a money-representation ADR** in the next round (with the stack/datastore ADRs).
- **Reconcile-to-bank is manual in V1.** Drift is user-detected, not system-detected;
  acceptable at single-user scale.
- **Design toward owner/household scoping without building it.** The data model should not
  preclude future multi-household isolation, but multi-tenancy is *not* V1 work — avoid
  over-building it now.
- **Analysis depends on a clean fact base.** Trends/breakdowns come *after* the core loop
  produces real transaction/allocation data; budget-vs-actual needs per-envelope targets
  (open question).

## 9. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~Money representation — integer minor units vs. decimal?~~ | Wesley + agent | **DECIDED: integer minor units** → formalize in a money ADR next round |
| ~~Fixed seed vs. user-managed envelopes?~~ | Wesley | **DECIDED: user-managed CRUD + archive** (sinking-fund lifecycle; soft-delete preserves history) |
| Do envelopes carry a **monthly budget target** in V1 (needed for budget-vs-actual)? | Wesley | open → analysis area |
| Template definition — fixed-dollar, percentage, or both? | Wesley | open → slice 2 |
| Does "reconcile to bank" need a cleared/statement concept, or just a balance compare? | Wesley | open → later slice |
| Should a transaction's allocation also support **negative** rows (for refunds within a split)? | Wesley + agent | open → refunds slice |

> `Proposed`. The core bet is `Validated` (paper); the document is promoted toward
> `Accepted` as slices validate it against reality. Next: the
> [roadmap](03_ROADMAP.md) sequences these into spikes and slices.
