<!--
SPIKE REPORT — findings only, REDACTED per SECURITY.md / the SPIKE-03/SPIKE-08 stance:
counts, structure, dates, and percentages are recorded; real amounts, merchants,
counterparties, balances, and account numbers are not. The throwaway parser and its
full-fidelity output (every parsed row/balance) are preserved locally in the gitignored
/budget-extraction/statement-spike/ as the profiling's audit trail.
-->

# SPIKE-11: Do the 20 bank-statement PDFs extract deterministically and reconcile — and what do they say about SPIKE-03 §6's decision points?

| Field    | Value                                                                           |
| -------- | ------------------------------------------------------------------------------- |
| Status   | Done                                                                             |
| Type     | Data-profiling (the integration spike roadmap `#20` requires before any spec)    |
| Owner    | Wesley Cutting + agent                                                           |
| Method   | Throwaway pdfplumber parser over all 20 PDFs, one session, out-of-gate           |
| Date     | 2026-07-10                                                                       |
| Unblocks | Roadmap `#20` (statement import — the post-reset gap slice)                      |

## 1. The question

The workbook era ends at the 2025-10-03 reset (`#18`); 20 machine-readable statement
PDFs (two institutions, gitignored in `/budget-extraction/bank-statements/`) cover what
came after. **Falsifiable question: do the statements extract deterministically — every
transaction row recovered, every statement reconciling opening + rows = closing to the
penny — and what does the real data say about SPIKE-03 §6's three open decision points
(account coexistence · overlap dedup · envelope attribution)?**

## 2. Method

A throwaway Python parser (pdfplumber; scratchpad code, preserved gitignored in
`/budget-extraction/statement-spike/` with its full JSON output) parsed every page of all
20 PDFs and enforced reconciliation as it went:

- **Bank of America** (mid-month statement periods): per-section row sums checked against
  the statement's own stated section totals **and** the account-summary block, plus
  beginning + Σrows = ending per statement.
- **Capital One** (calendar-month periods; one PDF carries **two** accounts): per-row
  running-balance chain verified on every single row, plus opening + Σrows = closing per
  account-statement.
- Cross-statement: closing balance of statement N = opening of statement N+1, per account.

Two format wrinkles found and handled (both sign-rendering: negative balances print the
minus **before** the currency symbol at BofA and as a detached `- $` at Capital One);
two Capital One rows are amount-less anomaly rows (rejected movements) and were verified
balance-neutral.

## 3. Findings

**Verdict: yes — the extraction is deterministic and fully reconciled.** Every one of the
30 account-statements (10 BofA + 10 Capital One × 2 accounts) parses cleanly and
reconciles to the penny, with zero unexplained rows.

### F1 — Fully machine-readable, fully reconciled

1,009 transaction rows total. Every BofA section sum ties to the statement's stated
totals; every Capital One row satisfies the running-balance chain; every
account-statement satisfies opening + Σrows = closing. 30/30 reconcile with zero
anomalies.

### F2 — Coverage is continuous, and there are three real accounts, not two

Cross-statement chains are unbroken for all three accounts — no missing statements. The
Capital One PDFs each carry **both** a 360 Checking and a 360 Performance Savings
account. Coverage: BofA 2025-08-15 → 2026-06-12; Capital One 2025-09-01 → 2026-06-30
(row counts 155 · 782 · 72). A tail gap (mid-June/July 2026 → now) remains until the
next statements arrive — the import must be repeatable.

### F3 — The workbook overlap is NOT row-matchable (dedup-by-matching invalidated)

165 statement rows fall on or before the 2025-10-03 reset. Only 59 of them find an
amount-equal workbook row within the surrounding week, in either direction. The cause is
structural, not noise: the workbook's weekly, consolidated, budget-view grain doesn't
align with bank settlement rows (e.g. a paycheck direct-deposit-split across two banks
was recorded as one number). Row-level dedup would mean human adjudication of ~⅔ of the
overlap — **fuzzy dedup is the wrong tool; an era cut is the right one.**

### F4 — Reality mirrors the reset: all three accounts drain to $0 in early October 2025

The same life event that ended the workbook era zeroed the real accounts: both Capital
One accounts sit at exactly $0.00 from 2025-10-02, and the BofA account reaches exactly
$0.00 on 2025-10-08. Chained balances **at the cut date 2025-10-03** are therefore
penny-exact and trivially anchored: two of three are exactly $0.00; one (BofA) is
nonzero (value in the gitignored profile), absorbed five days later by the final
early-October drain — which stays visible as an imported transaction.

### F5 — Counterparty structure is clean

- All **23** intra-Capital-One savings↔checking movements pair exactly (same day, equal
  amount, opposite sign) → they map onto the ADR-0004 `transfers` parent (two linked
  legs), keeping them out of spend/income.
- **10** deposits into the savings account come from an external linked account covered
  by no statement — and it is **not** the BofA account (0 same-day equal-amount
  counterparts). They stay plain deposits (D4 below).

### F6 — Envelope attribution has a strong head and a long tail

Post-cut there are 660 spend rows across 181 distinct normalized merchants: the top ~25
merchants cover **69%** of rows; 125 merchants appear exactly once. 60% of spend rows
contain a payee already recurring in the 12-yr workbook ledger. The domain model
natively supports the tail: transactions may rest **unallocated** ("enter now, split
later" — the needs-allocation set, `04_DOMAIN_MODEL` §invariants), so no synthetic
"inbox" envelope is needed.

## 4. Decisions (owner-confirmed 2026-07-10)

| # | Decision | Rationale (evidence above) |
| - | -------- | -------------------------- |
| D1 | **Era cut at 2025-10-03**: workbook authoritative on/before it; import only statement rows dated after it (**844 rows**) | F3 kills row dedup; F4 makes the cut penny-exact; no double-counting; October stays fully represented |
| D2 | **Three new real accounts + computed opening-balance anchors** at the cut; the synthetic historical `Budget` account stays as-is | F2/F4 — anchors come from reconciled chains (two are $0.00) |
| D3 | **Merchant→envelope rules for the high-frequency head; the rest imports unallocated** into the existing needs-allocation flow | F6 — ~69% auto-attributable by a small owner-reviewable rules file; zero guesswork on the tail |
| D4 | **Intra-Capital-One pairs become ADR-0004 transfers; external-source deposits stay plain deposits** with the source preserved in payee/memo | F5 — 23/23 pairs deterministic; the external account is out of coverage, a placeholder account's balance would be fiction |

## 5. Load path (constraint discovered, recommendation)

The EH10 `db:restore` path — how `#18` loaded the workbook era — **refuses non-empty
stores** (non-destructive by design). So the statement import cannot append to
`data/budgeteer-ledger`. Recommended slice shape, preserving the zero-app-code pattern:
a deterministic statement extractor (UUIDv5, integer cents — the `extract.py` pattern)
emits statement-era rows; a merge step folds them **with** the workbook-era tables into
one `BudgeteerBackup`; the ledger store is rebuilt (`db:reset` → `db:restore`). The
store becomes a pure derivation of its two gitignored sources — idempotent and
repeatable each time a new month's statements drop (F2's tail gap).

## 6. What remains (the `#20` slice this spike unblocks)

- The extractor + rules file + merge tooling in `/budget-extraction/` (committed,
  redaction-safe) emitting gitignored outputs; owner reviews the rules file before load.
- Rebuild `data/budgeteer-ledger`, verify live (per-account balances vs statement
  closings; transfers excluded from spend; needs-allocation queue populated).
- No schema/API/app change is expected (accounts, transfers, allocations, unallocated
  transactions all exist); if that holds, the slice is tooling + docs, per §11
  right-sizing — the money-domain ceremony was carried by this spike + D1–D4.
