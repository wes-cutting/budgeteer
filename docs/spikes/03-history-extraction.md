---
type: spike
id: SPIKE-03
roadmap-item: SPIKE-03
status: Done
---
<!--
SPIKE REPORT — findings only, REDACTED per SECURITY.md / SPIKE-08 stance: counts and
structure are recorded; real amounts, merchants, funding sources, and balances are not.
The full-fidelity working docs (EXTRACTION_ROADMAP.md, EXTRACTION_REPORT.md), the source
workbook, and the generated import JSON live in /budget-extraction/ and are gitignored.
-->

# SPIKE-03: Does the 12-yr `Budget.xlsx` extract cleanly from its in-cell formula strings?

| Field    | Value                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| Status   | Done                                                                               |
| Type     | Data-profiling (the deferred post-V1 spike from intake §96/§156)                    |
| Owner    | Wesley Cutting + agent                                                              |
| Method   | Two owner-run ETL sessions outside this repo (2026-06-23), reviewed + loaded 2026-07-10 |
| Date     | 2026-07-10 (findings captured; extraction ran 2026-06-23)                           |
| Unblocks | Roadmap `#18` (historical import — loaded the same day, see §5)                     |

## 1. The question

Discovery deferred the 12-year history migration because a first extraction attempt "got
too messy." The falsifiable question left on the board (roadmap `#17`): **do the
workbook's Deposit/Withdrawal cells — sums held as in-cell formula strings — reconcile
and extract losslessly into Budgeteer's account → transaction → allocation → envelope
model?**

## 2. Method (what actually happened)

The owner ran the extraction in two prior sessions **outside this repo**, then transferred
the results into the gitignored `/budget-extraction/` folder for review:

1. **`SCHEMA_MAP.yaml`** — a self-contained "Rosetta Stone" of Budgeteer's data model,
   generated *from this repo's docs* (`05_DATA_MODEL`, `04_DOMAIN_MODEL`,
   `06_API_CONTRACT`, `schema.ts`, domain parsers) so a different agent could transform
   foreign spreadsheet data without repo access. Declares itself subordinate to those docs.
2. **`EXTRACTION_ROADMAP.md` (Rev 2)** — pre-extraction analysis: profiled the workbook
   (27 tabs = envelopes, identical weekly layout, 2014-07-18 → 2026-01-02), discovered the
   core structure (each Deposit/Withdrawal cell is a `=a+b+c` formula whose **terms**
   enumerate the week's individual movements, paired 1:1 with comma-separated description
   items), and fixed four mapping rules + seven decision points (D1–D7), all
   owner-confirmed before generation.
3. **`extract.py`** — deterministic extractor (UUIDv5 ids, integer cents) emitting
   `budgeteer_import.json` (raw rows for all 15 tables) + a live-computed validation
   report with a discrepancy register.

This session then independently re-verified the output and loaded it (§5).

## 3. Findings

**Verdict: yes — the extraction is clean, lossless, and fully reconciled.** The "too
messy" impression came from reading cells as values; splitting each formula on top-level
`+` (parenthesized groups = one term) recovers the per-purchase grain exactly.

### F1 — The formula-term split is lossless

~3.8k withdrawal-cell formulas expand to ~11.3k purchase terms; ~2.1k deposit-cell
formulas to ~3.3k funding terms. Both sides re-sum to the identical book-wide total
(amount redacted) and **every one of the 27 envelope tabs nets to $0** against its own
derived Balance column (which is never imported). One dangling cross-sheet reference in
the entire book resolves to an empty cell and is skipped.

### F2 — The workbook maps onto the Budgeteer model with three reshapes + one special case

- **Rule 1:** each withdrawal term = one transaction (−) + one allocation to the tab's
  envelope; term N pairs with description item N (payee).
- **Rule 2:** same-week deposit terms sharing a source name consolidate into **one**
  deposit transaction whose allocations fan across the envelopes it funded (a paycheck
  split) — satisfying the split invariant by construction.
- **Rule 3:** equal same-week withdrawal↔deposit pairs with transfer-labelled
  descriptions become `envelope_transfers` rows (34 pairs), not transaction pairs.
- **Rule 4:** the 2025-10-03 end-of-budget zero-out ("Reset") becomes one account
  withdrawal with one draining allocation per remaining envelope (10).

### F3 — Discrepancies are bounded and handled, not silent

~10% of rows have term↔description count mismatches; amounts are authoritative (every
term is emitted; payee/memo attribution is positional best-effort), so the balance
cross-checks stay exact. Unpaired transfer-labelled terms (money leaving/entering the
budget envelope-world) are kept as normal withdrawals/deposits (D7) — dropping them would
break the per-tab $0 cross-check. All buckets are enumerated in the (gitignored)
report's discrepancy register; nothing is dropped silently.

### F4 — Independent re-verification passed in full

This session re-ran the validation from scratch against `budgeteer_import.json`
(2026-07-10): Σ all transaction cents = **0**; **0** split-invariant violations; **0**
unallocated transactions; **0** FK dangles; all money integer cents; all dates ISO;
27 unique envelope names (5 archived with computed `archived_at`); exactly one Reset
transaction with 10 allocations; row columns match `schema.ts` exactly.
**Headline: 1 synthetic account · 27 envelopes · 12,080 transactions · 14,497
allocations · 34 envelope transfers (26,640 rows).**

## 4. What the extraction deliberately does NOT cover

- **No real accounts** — the workbook is envelope-centric; everything lives on one
  synthetic `"Budget"` checking account (D1). Real accounts arrive with the statement
  work (§6).
- **No targets, recurring rules, templates, credit/loan metadata** — the sheet holds
  actuals only.
- **Nothing derived** — Balance columns, spent/remaining/utilization figures are
  re-derived by the app, never imported.
- **Nothing after 2025-10-03** — the reset ends the workbook era; later activity exists
  only in bank statements (§6).

## 5. Outcome — loaded and verified (2026-07-10)

The EH10 restore path ingested the data unchanged: a ~10-line wrapper
(`budget-extraction/wrap_backup.py`) added the `BudgeteerBackup` envelope (version 1 +
`schema.migrations` stamp; the `tables` payload needed **zero** changes), and
`npm run db:restore` inserted all 26,640 rows into a dedicated store
(`data/budgeteer-ledger`, gitignored) — first try, no warnings. Verified live in the app:
account/envelope balances $0 (correct post-reset), archived section correct, the register
renders real weeks (Reset row included), Insights computes the full 2014→2025 range.
Details + evidence: the 2026-07-10 status report.

## 6. What remains (the next front, owner's call)

- **Bank-statement ETL** — 20 machine-readable PDFs (two institutions, 2025-09 → 2026-06,
  gitignored) cover the post-reset gap. Open decision points: how real accounts coexist
  with the synthetic historical account; overlap dedup (Sep–Oct 2025 exists in both
  sources); envelope attribution for statement transactions (statements know merchants,
  not envelopes). Natural on-ramp to roadmap `#20`.
- **Chart tick bug** (revealed by real data ranges): fractional-cent y-axis ticks render
  malformed (e.g. `-$895.84.75`) in `ui/Chart.tsx` — filed as a follow-up fix.
