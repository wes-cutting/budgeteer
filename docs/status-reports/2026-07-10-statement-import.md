<!--
STATUS REPORT — #20 (statement import, file half). The vertical slice SPIKE-11 unblocked:
committed deterministic extraction tooling parses the 20 gitignored statement PDFs into
statement-era rows (D1–D4), merges them with the workbook-era backup, and rebuilds the gitignored
data/budgeteer-ledger store; verified live. REDACTED per SECURITY.md: counts, structure, dates,
percentages, and per-account balances that are the statements' own STATED closings only — never
merchants, counterparties, account numbers, or the amount of any individual transaction.
-->

# Status Report — 2026-07-10 (#20 — statement import, file half)

| Field  | Value                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                        |
| Date   | 2026-07-10                                                                                      |
| Author | Claude (with the owner)                                                                         |
| Scope  | `#20` (statement import, file half) `Done`; delta since [2026-07-10-spike-11-statement-profiling.md](2026-07-10-spike-11-statement-profiling.md) |

**Resume here:** **`#20` is `Done` — the post-reset gap is filled and the ledger store now spans
2014-07-18 → 2026-06-30. Zero app code changed.** Three committed, redaction-safe Python tools on
the `extract.py` pattern (UUIDv5 ids · integer cents · a validation report) do the work:
`extract_statements.py` parses the 20 gitignored PDFs into **845 statement-era rows** (D1 cut at
2025-10-03 → 844 post-cut transaction rows + **1** BofA opening anchor); `build_merchant_rules.py`
drafts the owner-reviewed merchant→envelope rules; `merge_statements.py` folds the statement tables
into the workbook backup as one **27,523-row** `BudgeteerBackup`, validated (FK integrity ·
ADR-0004 transfer legs · split invariant) before the store is rebuilt (`db:reset` → `db:restore`
into `data/budgeteer-ledger`). **Verified live** (`api-ledger` + web): the three new real accounts
carry balances equal to their statements' stated closings (BofA **$0.00** · Capital One 360
Checking **$819.53** · Capital One 360 Performance Savings **$21.27**; synthetic `Budget` unchanged
at **$0.00**), the **70** ADR-0004 transfer legs net to **$0** and are excluded from spend, the
**needs-allocation** queue holds **775** items, and Insights' net worth (**$840.80**) spans into
2026-06. **Two reality corrections were found and applied while building (D1–D4 unchanged, see §4):**
(1) intra-Capital-One transfers run **both** directions → **35 pairs**, not SPIKE-11 F5's
one-directional **23**; (2) Capital One **wraps long merchant descriptions across physical lines**,
which the throwaway spike parser silently dropped (**259** blank payees) — the extractor reassembles
them (**0** blank). Merchant attribution is **owner-reviewed and opt-in**: the default load imports
every statement spend row **unallocated** into the needs-allocation triage flow; the gitignored
`merchant_rules.json` draft (head merchants, envelopes heuristically seeded from the owner's own
12-yr history) is delivered for review, then applied by a one-command idempotent re-run
(`extract_statements.py --rules merchant_rules.json` → merge → restore). Gate **green** — typecheck ·
lint · format · **434 Vitest** · **121 e2e** · build **125.53 KB gz** · SCA (exit 0). **Next: owner
reviews the merchant rules (optional), or picks the next front** (§7).

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| `extract_statements.py` (committed) | Deterministic PDF→rows extractor; reconciliation is its spine (opening-anchor + Σpost-cut = stated closing, per account; aborts on any mismatch). Emits gitignored `statement_import.json` + report | `budget-extraction/` |
| `build_merchant_rules.py` (committed) | Drafts the owner-reviewed merchant→envelope rules, envelopes seeded from the workbook's own payee→envelope history (word-boundary matched); writes gitignored `merchant_rules.json` | `budget-extraction/` |
| `merge_statements.py` (committed) | Folds workbook + statement tables into one wrapped `BudgeteerBackup`; validates FK / transfer-leg / split-invariant before writing | `budget-extraction/` |
| Store rebuilt | `data/budgeteer-ledger` = a pure derivation of its two gitignored sources; **27,523 rows** restored (was 26,640 workbook-only) | gitignored store |
| `.gitignore` (+3 lines) | New extraction outputs (`statement_import.json` · `STATEMENT_EXTRACTION_REPORT.md` · `merchant_rules.json`) kept local; the merged backup is already covered by `/data/` | `.gitignore` |
| Roadmap | `#20` → **Done** (row + this report linked); the two reality corrections recorded | [`03_ROADMAP.md`](../03_ROADMAP.md) |

## 2. Definition of Done — current state (a vertical slice; zero app code)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | Data → store → API → UI all present and used: the app lists the three new accounts with correct balances, their registers show real payees, the transfer/needs-allocation/Insights surfaces all read the new era. No new UI was needed (D2/D3/D4 all land on existing surfaces) — the slice is tooling + a store rebuild. |
| Gate green | ✅ | typecheck · lint · format · **434 Vitest** · **121 e2e** · build **125.53 KB gz** · `npm audit --omit=dev --audit-level=critical` (exit 0) all pass. No app code changed, so the test counts held. |
| Acceptance criteria met & tested | ✅ | Reconciliation enforced inside the extractor (30/30 account-statements still tie; the desc-reassembly fix is text-only and cannot move a reconciled amount). Live checks: per-account balances = stated closings; 70 transfer legs Σ=0 and absent from spend; needs-allocation = 775; Insights spans 2026-06. |
| A11y (WCAG 2.2 AA) | ✅ | No UI change. |
| Input validation & secrets | ✅ | **No real data in the repo:** the three committed scripts hardcode no amount, merchant, counterparty, or account number (grep-verified); all real-valued outputs are gitignored (`git check-ignore` confirmed). Extractor validates external input at the boundary and **fails loudly** (reconciliation mismatch, unpaired transfer leg, unknown-envelope rule all abort). |
| Docs updated in same change | ✅ | Roadmap `#20` → Done (+ corrections) · `.gitignore` · this report — prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 434 | 434 | 0 — zero app code changed |
| E2E | 121 | 121 | 0 — zero app code changed |

## 4. The two reality corrections (D1–D4 unchanged)

Both were caught because the extractor re-derives everything from the PDFs rather than trusting the
throwaway spike parser — "reality before paper", applied to our own prior artifact.

- **Intra-Capital-One transfers are bidirectional → 35 pairs, not 23.** SPIKE-11 F5 counted the
  savings→checking direction only (23). Filtering transfer legs by the **covered** account numbers
  finds the checking→savings direction too (**12** more), for **35** pairs / **70** legs. This is a
  *correctness* matter, not a count nicety: leaving the 12 as plain rows would have booked internal
  money movement as **spend and income** — precisely what ADR-0004 transfers exist to prevent. D4's
  decision ("intra-institution pairs → transfers; external stays plain") is unchanged; only F5's
  evidence figure was one-directional. Five further movements reference an **uncovered** third
  account and correctly stay plain.
- **Capital One wraps long merchant descriptions across lines.** The amount-bearing line often
  carries no merchant text (it sits on an adjacent `Debit Card Purchase - …` prefix line plus a
  trailing location tail). The spike parser read only the amount line, so **259** post-cut spend
  rows (37%) had **blank** descriptions — invisible in a reconciliation that only checks amounts,
  and a poor needs-allocation experience (blank payees). The extractor reassembles prefix + inline +
  suffix; blank payees drop to **0**. Text-only — reconciled amounts are untouched.

## 5. Design notes / small calls

- **Attribution is opt-in, and unreviewed by default.** D3 says the owner reviews merchant→envelope
  rules *before* load. History-seeded suggestions are genuinely ~half wrong (the workbook's
  budget-view payee labels don't map cleanly onto bank merchant descriptors), so the **default load
  applies no rules** — every spend row imports unallocated into the needs-allocation flow (itself an
  explicit `#20` deliverable). The draft `merchant_rules.json` is the review artifact; applying it is
  one idempotent re-run. Every *verification* property (balances, transfers-excluded-from-spend,
  needs-allocation populated, Insights range) is allocation-independent, so this costs the slice
  nothing.
- **Opening anchor = one `kind:'opening'` transaction, only when non-zero.** Two of three accounts
  drained to exactly $0 at the cut (SPIKE-11 F4), so they need no anchor row; only BofA (non-zero)
  gets one, dated at the cut and initially unallocated — exactly the domain's opening-balance model
  (`04_DOMAIN_MODEL` §5). It surfaces in needs-allocation by design.
- **Rebuild, don't append** (K26, second application). EH10 restore is empty-store-only, so
  `data/budgeteer-ledger` is a pure, idempotent derivation of its two gitignored sources — re-runnable
  each month as new statements arrive.
- **Reconciliation stayed the spine.** The extractor aborts if any account's opening-anchor + Σ(post-cut
  rows) ≠ the last statement's stated closing; the merge aborts on any FK dangle, malformed transfer
  pair, or split-invariant breach. Nothing half-baked can reach the store.

## 6. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **Review `merchant_rules.json`, then re-run with `--rules`** | D3 attribution is owner judgment; the draft's suggestions are heuristic | Owner, when convenient — the head-attribution re-run is one idempotent command |
| Statement tail gap (past 2026-06-30) | Filled when the owner drops the next statements into `bank-statements/`; the pipeline re-runs | Owner, monthly |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's standing open decision | Owner |
| `#19` multi-user/household scoping | Deferred epic (full ceremony) | Owner |
| Two pre-existing e2e flakes | Watch-only | Watch |

## 7. Commands & gotchas (cold-start)

```sh
# Rebuild the ledger store from the two gitignored sources (needs pdfplumber in a venv):
cd budget-extraction
python3 extract_statements.py                      # default: all spend unallocated
#   or, after reviewing the rules:  python3 extract_statements.py --rules merchant_rules.json
python3 merge_statements.py                         # writes ../data/budgeteer-backup-statements-<date>.json
cd .. && npm --prefix apps/api run db:reset
npm --prefix apps/api run db:restore -- "$PWD/data/budgeteer-backup-statements-<date>.json"   # ABSOLUTE path

# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **`db:restore` resolves its file arg relative to `apps/api`** (npm's cwd) — pass an **absolute** path.
- **e2e wants `:3001` and `:5173` free** — `lsof -iTCP:3001 -sTCP:LISTEN` (kill listeners, not wrappers);
  `reuseExistingServer` is OFF. e2e uses a throwaway `PGLITE_DIR`, so it never touches the ledger store.
- **Real data never enters the repo:** the committed scripts are structure-only; `statement_import.json`,
  `STATEMENT_EXTRACTION_REPORT.md`, `merchant_rules.json`, `bank-statements/`, and everything under
  `/data/` stay local (`git check-ignore`).
- **`.env` sets `PGLITE_DIR=../../data/budgeteer-ledger`** — `npm run dev` / `api-ledger` serve the real store.

## 8. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-10-statement-import.md — its "Resume
  here" has state (#20 Done: statement era imported; ledger store spans 2014-07-18 → 2026-06-30;
  3 real accounts at their stated closings; 35 intra-CO transfer pairs; needs-allocation 775; zero
  app code; gate green 434 Vitest + 121 e2e).
- Skim docs/03_ROADMAP.md — the V1 core, the UX Redesign, the 12-yr history (#17/#18), SPIKE-11
  (#21), and the statement import (#20) are all Done.

There is no queued build item — the data tracks are complete. Ask the owner which front to take:
  1. Apply the reviewed merchant→envelope rules: owner edits the gitignored
     budget-extraction/merchant_rules.json, then re-run `extract_statements.py --rules
     merchant_rules.json` + merge_statements.py + db:reset/db:restore to attribute the spend head
     (idempotent; everything else stays in the needs-allocation triage flow). No app code.
  2. Ratify or veto FEAT-S7 §5's residual divergence (docs/features/pay-periods.md §5 /
     docs/spikes/10-payperiod-policy-validation.md §3.6). A veto scopes the §8 bill↔paycheck
     assignment store — a §11 ceremony scale-up (frozen migration 0003 + 05_DATA_MODEL + an ADR).
  3. #19 multi-user / household scoping — a deferred epic (full ceremony).
Do NOT start build work before the owner picks. Keep it vertical and gate-green (e2e needs ports
3001/5173 free). Provide a single-line short commit message; the owner reviews and commits.
```
