---
type: spike
id: SPIKE-01
roadmap-item: [BUD-S3, SPIKE-01]
status: Done
---
<!--
SPIKE REPORT
A spike is a time-boxed, throwaway investigation that answers ONE question against
reality before we commit to a spec/ADR or build on an assumption (see
docs/00_WAYS_OF_WORKING.md §6). The spike's CODE is disposable; this report is the
deliverable.
-->

# SPIKE-01: Is account-entry + split-allocation lower-friction than the spreadsheet?

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Status     | Done                                                                   |
| Type       | Value-hypothesis / UX                                                  |
| Owner      | Wesley Cutting                                                         |
| Time-box   | One conversation (paper walkthrough) — honored                         |
| Date       | 2026-06-13                                                             |
| Blocks     | The PRD's value hypothesis ([`02_PRD.md`]) and the roadmap sequencing  |

## 1. The question

**Is entering a transaction once at the account level and then splitting it across
envelopes meaningfully lower-friction than the spreadsheet's direct per-envelope entry —
specifically for the two hardest real cases: splitting a paycheck across *many* envelopes,
and splitting a single store withdrawal across *several*?**

## 2. Method

A **paper / described walkthrough** (zero code, by the human's choice — the cheapest real
test). The agent presented a concrete interaction model — accounts, a transaction entry
screen, and an allocation screen with a **Single** default and a **Split** mode showing a
live `Allocated / Remaining` tally — seeded with the user's **real 22 envelope names** (from
`FEATURE_BREAKDOWN.md`; names are non-sensitive). Two real scenarios were walked through: a
`+$3,200` paycheck split across many envelopes, and a `−$214` store run split across three.
Three accelerators for the many-way case were put up for reaction: **(a) templates/presets**,
**(b) keyboard-first row entry**, **(c) distribute-remainder**.

**Deliberately not done:** no code, no persistence, no styling, no stack choice; real
dollar amounts were synthetic, not the user's actual figures (kept out of the repo).

**Fidelity caveat:** paper can confirm the *model* and *which accelerators are wanted*; it
cannot fully prove the *felt* friction of a real 12–22-way split. Final confirmation of
that comes when the first usable slice exists (see Follow-ups).

## 3. Findings

The user reacted to all five prompts. Verbatim-in-substance:

- **Enter-once-then-split is "the right move."** The inversion (account first, then
  allocate) matches how they think about the problem.
- On the paycheck slog: **templates/presets are the primary accelerator they want**, *and*
  they want **all three** (templates, keyboard-first rows, distribute-remainder) as
  features — not as either/or.
- On partial allocation: they want to **save a transaction into an account now and split it
  later** — i.e. an unallocated remainder is allowed and surfaced (a "Needs allocation"
  badge), not forced to zero at save time.
- On the store run: **last row = remainder** makes sense.
- On model gaps: **account-to-account transfers, refunds (negative allocation), recurring
  transactions, and editing a past split are all wanted** — incorporate them.

### Confirmed
- **The core value/UX bet holds (on paper):** account-level entry with split allocation is
  judged clearly lighter than typing into per-envelope ledgers. → Moves the PRD value
  hypothesis to `Validated` (with the fidelity caveat above).
- **The common (single-envelope) case staying one-tap** is the right call; the split grid
  is opt-in.
- **Templates are the answer to the many-way paycheck slog** — the specific risk that could
  have invalidated the bet.

### Invalidated
- Nothing was outright invalidated. The pre-spike worry that *"a 12–22-way split is an
  unavoidable slog"* was **retired** — templates/presets defuse it (so building manual-only
  splitting and stopping there would have been a mistake).

### Surprises / unknowns uncovered
- **Partial allocation is a first-class workflow, not an edge case.** "Enter now, split
  later" means the app needs a durable notion of *unallocated amount* per transaction and a
  global "needs allocation" surface. (Resolves intake open-question #1.)
- **Four capabilities were pulled into scope** that weren't in the original sketch:
  transfers, refunds, recurring transactions, edit-a-past-split. Two warrant care:
  **transfers** (must be modeled as proper double-entry, not the spreadsheet's brittle
  one-way cell pointer) and **edit-split** (must preserve the sum invariant). These become
  their own feature specs/slices — not V1-core, but in scope.

## 4. Recommendation / decision

- **Build (V1 core loop, first):** account with starting balance → enter a
  deposit/withdrawal → allocate, with **Single** (one-tap) and **Split** (multi-row, live
  remainder, last-row-takes-remainder) modes, and **save-with-unallocated-remainder**
  allowed + a "needs allocation" surface.
- **Build next (the accelerators, fast-follow):** **templates/presets** (primary),
  keyboard-first row entry, distribute-remainder. These convert the paycheck case from
  tolerable to good and should be sequenced immediately after the core loop is usable.
- **In scope, later slices (own feature specs):** account-to-account **transfers**
  (double-entry), **refunds** (negative allocation), **recurring** transactions,
  **edit-a-past-split**, then the analysis/trends and the bills/debt/rollup areas.
- **No follow-up spike needed before the PRD** — the bet is sufficiently de-risked to
  write it. (The only residual risk is *felt* friction, validated when slice 1 is usable.)

## 5. Impact on the plan

- **Specs/ADRs affected:** PRD value hypothesis → `Validated` (paper). Intake open-question
  on partial allocation → **resolved** (allow + surface). Intake scope → expanded (see
  below).
- **Scope changes — added:** templates/presets, keyboard-first entry, distribute-remainder,
  transfers, refunds, recurring transactions, edit-a-past-split, "needs allocation" surface.
  **Confirmed deferred:** history migration, bank integration (forks A/B), parity.
- **Sequencing changes:** Slice 1 = the core enter→allocate loop (Single + Split + partial).
  Slice 2 = the accelerators (templates first). Transfers/refunds/recurring/edit and the
  analysis layer follow, prioritized in the roadmap.

## 6. Follow-ups

- [ ] Write [`../02_PRD.md`](../02_PRD.md) with the `Validated` hypothesis and the expanded
      capability set; mark "trends & breakdowns" as the one area still to flesh out.
- [ ] Draft [`../03_ROADMAP.md`](../03_ROADMAP.md) sequenced: core loop → accelerators →
      transfers/refunds/recurring/edit → analysis → (post-V1) history-import spike.
- [ ] When slice 1 is usable, **confirm felt friction** on a real many-way split (closes the
      paper-fidelity caveat).
- [ ] Carry the two flagged design constraints into their feature specs: **transfers =
      double-entry**, **edit-split preserves the sum invariant**.
