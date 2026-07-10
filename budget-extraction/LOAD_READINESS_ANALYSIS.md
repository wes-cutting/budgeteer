# Load-Readiness Analysis — `budget-extraction/` review

| Field | Value |
| ----- | ----- |
| Date | 2026-07-10 |
| Reviewer | Claude (session review, owner-requested) |
| Scope | The `budget-extraction/` drop: extraction artifacts from two prior ETL sessions + bank statements |
| Stance | **Redaction-safe** — this doc cites counts and structure only, never real amounts, payees, or sources (SPIKE-08 stance, `SECURITY.md`) |

## 1. What was reviewed

| Artifact | Committed? | Verdict |
| -------- | ---------- | ------- |
| `EXTRACTION_ROADMAP.md` (Rev 2, D1–D7 locked) | yes (untracked) | ⚠ Thorough and correct, but **contains real amounts, merchant names, funding sources, and a bank name** — see §4.1 |
| `EXTRACTION_REPORT.md` (generated 2026-06-23) | yes (untracked) | ⚠ Milder, but still carries real totals — see §4.1 |
| `SCHEMA_MAP.yaml` | yes (untracked) | ✅ Clean — derived from repo docs, no personal data; correctly declares itself subordinate to `docs/05_DATA_MODEL.md` et al. |
| `extract.py` | yes (untracked) | ✅ Clean — no hardcoded personal strings (matches on amounts are report-template code); deterministic UUIDv5 ids, integer cents, faithful to the roadmap's Rules 1–4 |
| `budgeteer_import.json` (8.3 MB) | gitignored ✅ | ✅ Data validates clean — independently re-verified, §2 |
| `Budget.xlsx` (source workbook) | gitignored ✅ (global `*.xlsx`) | — |
| `bank-statements/` (20 PDFs: 10 Bank of America 2025-09→2026-06 + 10 Capital One 2025-09→2026-06) | gitignored ✅ | ✅ **Text-extractable** (real font/text operators, not scans) — no OCR needed for a future statement ETL, §5 Path B |

`.gitignore` coverage was verified with `git check-ignore`: the workbook, the import
JSON, the statements, and `.DS_Store` are all excluded. Only the four
docs/tooling files above would enter the repo.

## 2. Independent verification of `budgeteer_import.json`

Re-ran the roadmap's §9 validation checklist from scratch (not trusting the generated
report). **All checks pass:**

| Check | Result |
| ----- | ------ |
| Envelope of tables | All 15 Budgeteer tables present; counts match the report exactly (1 account · 27 envelopes · 12,080 transactions · 14,497 allocations · 34 envelope transfers · rest 0) |
| Σ all `amount_cents` across transactions | **0** (the book balances) |
| Split invariant (Σ allocations = transaction amount, per transaction) | **0 violations**; 0 unallocated transactions |
| Money | All integer cents, no floats |
| Dates | All `YYYY-MM-DD`; range 2014-07-18 → 2025-10-03 |
| Reset (Rule 4) | Exactly 1 reset transaction on 2025-10-03 with 10 allocations |
| Envelope transfers | 0 self-transfers, 0 non-positive amounts |
| Envelope names | 27 unique (case-insensitive), 5 archived with `archived_at` set |
| FK integrity | 0 dangling `account_id` / `envelope_id` / `transaction_id` refs |
| Transaction kinds | All `normal` |
| Row columns | Match `apps/api/src/db/schema.ts` interfaces exactly (transactions: 11 cols incl. `transfer_id`/`recurring_id` nulls; allocations: 4 cols) |

**Conclusion: the Extract + Transform phases are done and trustworthy.** This also
empirically answers roadmap **#17 (SPIKE-03)** — yes, the 12-yr workbook extracts
cleanly from its in-cell formula strings, with a fully reconciled discrepancy register.

## 3. Fit against the app's Load path

**The Load mechanism already exists** — this is the key finding. EH10 (2026-07-03,
[SPIKE-09](../docs/spikes/09-restore-roundtrip.md)) shipped `npm run db:restore -- <file>`
(`apps/api/src/db/restore.ts` → `restoreService.ts`): zod-validated envelope, FK-safe
insert order, one transaction (partial failure restores nothing), non-destructive
(empty-store-only), prints counts never contents. No new ingestion endpoint is needed —
and per SEC3, none should be added (CLI-only is the documented stance).

**One blocking mismatch:** the restore CLI validates a `BudgeteerBackup` envelope; the
import JSON has a `meta` block instead. Required shape:

```jsonc
{
  "version": 1,                     // literal
  "exportedAt": "<ISO timestamp>",
  "householdId": "00000000-0000-0000-0000-000000000001",
  "schema": { "migrations": ["0001-baseline", "0002-recurring-occurrence-idempotency"] }, // optional
  "tables": { /* the 15 tables — already correct as-is */ }
}
```

The `tables` payload needs **zero changes**. Omitting `schema` also works (restore
proceeds with a warning); stamping the two current migration names is the cleaner path.
This is a ~10-line wrapper script or a small edit to `extract.py`'s emit step.

**Second precondition:** the dev store currently holds the seeded demo data, and restore
correctly refuses an occupied store. Loading requires either `npm run db:reset` on the
dev store or a dedicated `PGLITE_DIR` for the real ledger (see §5 decision).

## 4. Gaps & risks

### 4.1 Privacy — the two extraction docs are not commit-safe (action before commit)

`EXTRACTION_ROADMAP.md` quotes real purchase amounts, the whole-book total, example
paycheck amounts with their income-source names, merchant names, and an external bank
name. `EXTRACTION_REPORT.md` carries real reset/transfer totals. Intake §133 and
`SECURITY.md` say real balances/transactions never enter the repo; the SPIKE-08
precedent is *commit the analysis with amounts + creditors redacted*. Options:
add both files to `.gitignore` (keep full fidelity locally), or redact in place.
Envelope *names* are cleared as non-sensitive (intake §133). Note also the repo's
designated confidential-inputs location is `/data/` (`.gitignore` line 4) — a future
tidy could move raw artifacts there, but the folder-local ignores work as-is.

### 4.2 The account-model seam (phase-2 design question)

The workbook records no real accounts, so the import puts 12 years on **one synthetic
`"Budget"` checking account** (D1, locked — correct for the historical era). The bank
statements introduce **two real accounts**. How the synthetic historical account and
real statement-backed accounts coexist (naming, net-worth reading, whether the
historical account gets archived at the reset date) is an owner decision that shapes
the statement ETL. Not blocking Path A.

### 4.3 Coverage seam: overlap and gap

The workbook data ends at the **2025-10-03 reset** (envelopes zeroed — a clean era
boundary). Statements cover **2025-09 → 2026-06**:

- **Overlap** (Sep–early Oct 2025): statement transactions that are already in the
  workbook import must be deduplicated or the overlap window excluded.
- **Gap** (2025-10-03 → today): only statements cover it; envelope attribution for
  statement transactions doesn't exist in the source (statements know merchants, not
  envelopes) — a mapping/rules question for the statement ETL.

### 4.4 Process/docs debt (close when acting, not before)

The ETL ran outside this repo's ceremony while it was roadmap-deferred (#17/#18). When
we act on it, the same-change doc updates are owed: mark **#17 effectively answered**
(redacted findings promoted to `docs/spikes/03-history-extraction.md`, SPIKE-08 style),
re-scope **#18** to "wrap → load → verify" + the statement phase, and log the
re-sequencing in `03_ROADMAP.md` §5.

## 5. Paths forward (suggested)

**Path A — Load & verify the historical import (recommended first; smallest step to "usable").**
1. Decide the store: dedicated `PGLITE_DIR` for the real ledger vs resetting the dev store.
2. Wrap the JSON in the `BudgeteerBackup` envelope (§3) — extend `extract.py` or a tiny wrapper.
3. `npm run db:restore -- <wrapped file>` into the empty store.
4. Verify in the app against reality: envelope balances match the workbook's final
   balances (the extractor already proved this at the data layer; eyeball it in the UI),
   Insights/charts render 12 years sanely, archived envelopes behave.
5. Close the docs debt (§4.4) in the same change. Gate stays green (no app code changes
   expected — if the app needs fixes to *display* 12 years well, those are follow-on slices).

**Path B — Statement ETL (phase 2, after A).** The PDFs are text-extractable. Run it as
its own spike → extraction: profile both statement formats, resolve §4.2 (account model)
and §4.3 (overlap dedup + envelope attribution) as decision points with the owner, then
extend the pipeline. This is also the natural on-ramp to roadmap **#20** (CSV/statement
import as a product feature) — the throwaway spike here informs that slice's spec.

**Path C — Commit hygiene (before any commit of this folder).** Resolve §4.1
(gitignore vs redact the two docs), then commit the extraction tooling + this analysis.

**Recommended order: C → A → B**, with C+A in one motion (C is minutes, A is the value).

---

## 6. Outcome (2026-07-10) — C and A are done

The owner resolved §4.1 by gitignoring the two working docs. Path A executed the same
day: `wrap_backup.py` added the envelope (the `tables` payload needed zero changes),
`npm run db:restore` inserted all 26,640 rows into the dedicated gitignored
`data/budgeteer-ledger` store first-try with no warnings, and the app was verified live
against it. Findings are promoted (redacted) to `docs/spikes/03-history-extraction.md`;
roadmap `#17`/`#18` are `Done`. Path B (statement ETL) is the open follow-on — decision
points in SPIKE-03 §6.
