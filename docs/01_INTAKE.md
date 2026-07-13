---
type: intake
status: Proposed
---
<!--
INTAKE RECORD — the captured output of the discovery conversation (see
templates/DISCOVERY-GUIDE.md). This is the FIRST thing filled in on a new project, BEFORE
the PRD. It is a pre-PRD map of what we know and what we're betting on — NOT a substitute
for the PRD. Promote its content into 02_PRD.md after the first spike de-risks the bet.
Status starts at Draft. Replace this skeleton's placeholders as the conversation proceeds.
-->

# Intake — Budgeteer

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Proposed                               |
| Owner        | Wesley Cutting                         |
| Facilitated  | Wesley Cutting + agent                 |
| Last updated | 2026-06-13                             |

**Resume here:** Budgeteer reimagines a 12-year, hand-built Excel envelope-budgeting
system as an application. This is **not** "rebuild the spreadsheet": the pain is the
spreadsheet's **data-entry model**. Today, transactions are typed directly into
per-envelope weekly ledgers as fragile in-cell formula strings. The desired model
**inverts** that — enter each line item once into an **account** ledger (mirroring a real
bank/card account), then **split-allocate** it across one or more **envelopes**. Accounts
are the physical truth; envelopes are the logical budget; a one-to-many split allocation
is the bridge, with the invariant that a transaction's allocations sum to its amount.
**Decided in discovery:** V1 is a **fresh start** (no 12-year migration) with **manual**
entry (no bank integration). The riskiest remaining unknown was the **value/UX bet** with
the **split-allocation UX** as its sharp edge — that was **SPIKE-01** (§4), now **Done and
Confirmed** (paper walkthrough): enter-once-then-split is the right model, templates defuse
the many-way-split slog, and partial "split-it-later" allocation is a first-class workflow.
**Next step: write the PRD** ([`02_PRD.md`]). See
[`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md).

---

## 1. Problem & why now

The spreadsheet's outputs work; its **input system** is the pain. Income and expenses are
entered **directly into per-envelope weekly ledgers** (Deposit/Withdrawal columns), as
additive in-cell formula strings (`=14.77+12.39+…`) with a **positionally-parallel,
comma-separated description list** in adjacent columns. This is fragile — a stray comma or
an unexpanded `(amount*count)` multiplier desyncs the labels from the amounts — and it
keeps real bank-account balances on a separate manual surface, never reconciled to the
envelopes by formula.

What the user wants instead: enter a line item once into an **account ledger** (mirroring
a real bank/card), then **split-allocate** that line item across one or more **envelopes**.
The split is genuinely one-to-many in both directions of cash flow:

- A **deposit** (e.g. a paycheck) is split across many envelopes — funding the budget.
- A **withdrawal** (e.g. one store run) is split across several envelopes — by what was
  bought.
- A **starting balance** can likewise be split across envelopes.

Secondary goal: data processing and review to surface **trends and breakdowns**.

**Why now:** a long-standing ("for years") itch; pairing with an AI agent makes it
feasible to build quickly enough to not lose momentum.

## 2. Users & context

Single user — the spreadsheet's author — running a **single household**. No collaborators
today.

**Future direction (explicit v1 non-goal):** evolve into multi-user with **profiles and
households**, where a household's data is isolated and inaccessible to anyone outside it.
Noted here because owner/household scoping is a data-model concern worth designing toward
even while it is out of v1 scope — and because multi-tenant data is a process "scale up"
trigger (§11) if/when it arrives.

## 3. The value hypothesis (the core bet)

**Confirmed in discovery:**

> If we ship **account-level transaction entry with split allocation across envelopes**,
> the user will be able to **keep the budget current and accounts reconciled to the banks
> with far less friction than the spreadsheet**, which is worth it because **a trusted,
> low-effort budget is the entire point**.

- **How we'd know it paid off:** the user enters a real week of transactions — including a
  split paycheck and a split store run — through the app with less friction/time than the
  spreadsheet, and account balances reconcile to the actual bank balances.
- **Validation status:** ☑ **Validated (paper)** by [SPIKE-01](spikes/01-split-allocation-ux.md)
  — confirmed by the actual user via paper walkthrough. Residual risk: *felt* friction of a
  real many-way split, to be confirmed when slice 1 is usable.

## 4. Riskiest assumptions & the spikes they imply

Fresh-start (fork A) and manual entry (fork B) **retire** the two heaviest risks for V1
(historical migration; bank integration). What remains is the value/UX bet — and the
split-allocation UX is its sharp edge.

| # | Assumption (what we believe) | Have we looked? | Cheapest way to check (→ spike) | Spike type |
| - | ---------------------------- | --------------- | ------------------------------- | ---------- |
| 1 | The account-entry → **split-allocation** loop is meaningfully less friction than the spreadsheet — *especially* splitting a paycheck across many envelopes and one store run across several (the core bet) | **Yes — [SPIKE-01](spikes/01-split-allocation-ux.md): Confirmed (paper)** | Done. Templates defuse the many-way slog; partial allocation is first-class | **value-hypothesis / UX** ✅ |
| 2 | Migrating 12 years of history is **not** required for V1 value | Decided: **fresh start** | Deferred — a **post-V1** data-profiling spike on the real `.xlsx` if/when import is pursued | data-profiling (deferred) |
| 3 | "In sync with banks" is satisfied by **manual entry + reconcile-to-balance** in V1 | Decided: **manual** | Deferred — CSV import or a live bank API would be separate, heavier later tracks | integration (deferred) |

**SPIKE-01 (value-hypothesis / UX) — DONE, Confirmed.** Ran as a paper walkthrough; the
actual user confirmed enter-once-then-split is the right model, chose **templates/presets**
as the primary slog-killer (wanting all three accelerators), and resolved partial
allocation in favor of **save-now-split-later**. Full findings:
[`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md).

## 5. Scope sketch & explicit non-goals

- **In scope (rough, value/uncertainty-ordered):**
  1. **V1 core loop:** open an **account** with a starting balance → enter a
     **transaction** (deposit/withdrawal) → **allocate** it, in **Single** (one-tap, the
     common case) or **Split** (multi-row, live `Allocated/Remaining`, last-row =
     remainder) mode → **account + envelope balances** update consistently (allocations
     sum to the amount). **Partial allocation allowed** — save now, split later, surfaced
     by a "needs allocation" indicator.
  2. **Accelerators (fast-follow, confirmed wanted):** **templates/presets** (primary) ·
     keyboard-first row entry · distribute-remainder.
  3. **Further capabilities (in scope, own slices):** **user-managed envelopes**
     (create/rename/**archive** — sinking-fund lifecycle, soft-delete preserving history) ·
     account-to-account **transfers** *(must be double-entry)* · **refunds** (negative
     allocation) · **recurring** transactions · **edit a past split** *(preserve the sum
     invariant)*. *(Decided post-PRD: money = **integer minor units**; envelopes =
     **user-managed CRUD + archive**.)*
  4. **Later areas:** reconcile an account to its real bank balance · **trends/breakdowns**
     (still to be fleshed out) · bills/planning · debt & credit · weekly→monthly rollups.
- **Non-goals (v1):** multi-user / multi-household / profiles *(future direction)* ·
  live bank-API integration (Plaid-style auto-pull) · CSV/statement import *(maybe later)*
  · migrating 12 years of history *(deferred to a post-V1 spike)* · porting every one of
  the 37 spreadsheet tabs for "parity" *(parity is explicitly **not** the goal)*.

## 6. Constraints

| Area | Notes |
| ---- | ----- |
| Data sensitivity (confidential/regulated?) | **Yes — personal financial data.** The real `Budget.xlsx` and any real balances/transactions are confidential and must **never enter the repo**; tests use synthetic fixtures (spine §8). Drives `SECURITY.md` + `.gitignore`. The 22 envelope *names* (from `FEATURE_BREAKDOWN.md`) are non-sensitive and fine to seed the prototype. |
| Compliance / legal | None identified at single-user, manual scale; revisit if multi-household or bank integrations arrive. |
| Stack leanings & constraints | None stated — **do not decide** (input to `ADR-0001` after the feasibility/UX spike). The future multi-household direction is an input, not a present requirement. Spike code is throwaway and does **not** constitute the stack choice. |
| Non-functional needs (latency / volume / availability) | Modest volume (fresh start → small; ≈14.6k txns only if history is ever imported). Entry/splitting must feel fast and low-friction — that is the whole bet. |
| Timeline / team / budget | Solo builder; momentum-driven; wants to move quickly **without** skipping the load-bearing value/UX spike. |

## 7. First usable slice

The thinnest end-to-end loop that exercises the bet: the user (1) has at least one
**account** with a starting balance, (2) **enters a transaction** into it, and (3)
**split-allocates** that transaction across one or more **envelopes**, then sees both the
account balance and the envelope balances update consistently (allocations summing to the
transaction amount). Foundation it builds into: the app shell + a local store + the
account / envelope / transaction / split-allocation domain core. *(SPIKE-01 de-risks the
split UX before this slice is built for real.)*

## 8. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~Must a transaction be fully allocated before saving?~~ | Wesley | **resolved (SPIKE-01): partial allowed** — save now, split later, surfaced as "needs allocation" |
| ~~Does a painless paycheck split need allocation presets/templates?~~ | Wesley | **resolved (SPIKE-01): yes** — templates are the primary accelerator (all three wanted) |
| ~~What "trends and breakdowns" matter most?~~ | Wesley | **resolved: all four** — spend-by-envelope over time · budget-vs-actual · cash-flow forecast · debt & credit trends (later slices) |
| Is the real `Budget.xlsx` available (kept out of the repo) for the **post-V1** historical-import spike? | Wesley | open (deferred) |
| ~~A. Migrate vs. fresh start~~ | Wesley | **resolved: fresh start** (history → post-V1 spike) |
| ~~B. Meaning of "in sync with banks"~~ | Wesley | **resolved: manual** entry + starting balance; import/API later |

## 9. Outputs & next steps

What this intake hands off to, in order:

- [x] **Run SPIKE-01** (value-hypothesis / UX on the enter→split-allocate flow) →
      [`spikes/01-split-allocation-ux.md`](spikes/01-split-allocation-ux.md) — **Done, Confirmed.**
- [ ] **Write the PRD** ([`02_PRD.md`](../templates/PRD-TEMPLATE.md)) — bet is de-risked;
      this is the next step. (Flesh out the "trends & breakdowns" area while drafting.)
- [x] **Draft the roadmap** ([`03_ROADMAP.md`](03_ROADMAP.md)) — sequenced by uncertainty
      × value.
- [ ] **Open `ADR-0001` (stack)** after the feasibility spike (SPIKE-02) informs it; write
      the decided `ADR-0003` (money = integer minor units) now.

> This intake is **pre-PRD**. It stays `Proposed` until SPIKE-01 validates the bet; it is
> not a place to design the system. See
> [`templates/DISCOVERY-GUIDE.md`](../templates/DISCOVERY-GUIDE.md) for how it was produced.
