---
type: status-report
roadmap-item: SPIKE-11
---
<!--
STATUS REPORT — #21 (SPIKE-11, statement profiling). The integration spike roadmap #20 required:
all 20 bank-statement PDFs profiled with a throwaway parser; 30/30 account-statements reconcile to
the penny; the SPIKE-03 §6 decision points are decided (D1–D4 owner-confirmed) and #20 is Ready.
Docs-only change (+ one .gitignore line). REDACTED per SECURITY.md: counts, structure, dates, and
percentages only — never real amounts/merchants/counterparties/balances/account numbers.
-->

# Status Report — 2026-07-10 (#21 — SPIKE-11, statement profiling)

| Field  | Value                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Status | Snapshot                                                                                                                    |
| Date   | 2026-07-10                                                                                                                  |
| Author | Claude (with the owner)                                                                                                     |
| Scope  | `#21` (SPIKE-11) `Done`; `#20` promoted to `Ready`; delta since [2026-07-10-history-import.md](2026-07-10-history-import.md) |

**Resume here:** **SPIKE-11 is answered yes and `#20` (statement import, file half) is `Ready` with
every decision locked. No app code changed.** A throwaway pdfplumber parser (session scratchpad;
preserved with its full-fidelity JSON output in the new **gitignored** `/budget-extraction/statement-spike/`)
profiled all 20 statement PDFs: **30/30 account-statements reconcile to the penny** — BofA per-section
sums tie to the statements' own stated totals and beginning+Σrows=ending; Capital One's running-balance
chain verifies on **every row** — yielding **1,009 rows across three real accounts** (each Capital One
PDF carries a checking *and* a savings account), with cross-statement chains unbroken
2025-08-15 → 2026-06-30 (no missing statements). The evidence retired SPIKE-03 §6's unknowns:
**row-level overlap dedup is structurally impossible** (59/165 amount+week matches — the workbook's
weekly consolidated grain ≠ bank settlement grain) and **reality mirrors the reset** (all three real
accounts drain to exactly $0 in early October 2025 — the same life event as the workbook zero-out —
making cut-date balances penny-exact; two of three are $0.00). The owner confirmed **D1–D4**
([SPIKE-11 §4](../spikes/11-statement-extraction.md)): era cut at 2025-10-03 (844 post-cut rows to
import, no dedup) · three new real accounts + computed opening anchors (synthetic `Budget` unchanged) ·
merchant→envelope rules for the head (top ~25 merchants = 69% of spend rows) + the rest unallocated
into the existing needs-allocation flow · intra-institution pairs → ADR-0004 transfers,
external-source deposits stay plain. **Load-path constraint found:** EH10 restore refuses non-empty
stores → the `#20` slice is a **full-store rebuild** (extract → merge with the workbook backup →
`db:reset` + `db:restore` `data/budgeteer-ledger`), zero app code expected, repeatable monthly. Gate
**green** — **434 Vitest + 121 e2e** (the +1 over the last report is the chart-tick fix that landed
separately as `0113e96`), build **125.53 KB gz**. **Next: build the `#20` slice** (§7).

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| SPIKE-11 run + report | All 20 PDFs profiled; reconciliation enforced during parsing; findings promoted **redacted** | [`spikes/11-statement-extraction.md`](../spikes/11-statement-extraction.md) |
| D1–D4 owner-confirmed | Era cut · account modeling · attribution policy · transfer/external handling — decided with evidence in hand, logged in SPIKE-11 §4 and the roadmap | SPIKE-11 §4 |
| Roadmap | `#21` added (`Done`) · `#20` re-scoped to the file half and promoted `Ready` · header/current-focus updated · §5 log entry · chart-tick watch item closed (fixed via `0113e96`) | [`03_ROADMAP.md`](../03_ROADMAP.md) |
| Spike artifacts preserved | Parser + analysis scripts + full JSON output moved to `/budget-extraction/statement-spike/` (**gitignored**, K27 pattern — local audit trail) | `.gitignore` (+1 line, verified `git check-ignore`) |
| Stale worktree cleanup | A merged, clean `.claude/worktrees/*` checkout (left by the spun-off chart-fix task) was failing repo-wide ESLint with 6 rule-not-found errors; removed (worktree + branch, tip was an ancestor of `main`) | K28 in [`KIT_FEEDBACK.md`](../KIT_FEEDBACK.md) |

## 2. Definition of Done — current state (a spike block; docs-only delta)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ (as a spike) | No app surface changed by design. The deliverable is validated knowledge: the falsifiable question answered with 30/30 penny-exact reconciliation, and all four load decisions made by the owner **with evidence in hand** — the `#20` slice can start with zero open questions. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** this session — **434 Vitest + 121 e2e**, build **125.53 KB gz**, `npm audit --omit=dev --audit-level=critical` exit 0. (Lint required the stale-worktree cleanup above — the working tree itself was always clean.) |
| Acceptance criteria met & tested | ✅ | Spike question answered empirically: every transaction row recovered (1,009), every account-statement reconciles opening+Σ=closing, chains unbroken across all 10 months, three §6 decision points evidenced and decided. Reconciliation was enforced *inside* the parser, not asserted after. |
| A11y (WCAG 2.2 AA) | ✅ | No UI change. |
| Input validation & secrets | ✅ | **No real data in the repo:** the new `/budget-extraction/statement-spike/` artifacts are gitignored (verified `git check-ignore`); committed docs carry counts/structure/dates/percentages only — no amounts, merchants, counterparties, balances, or account numbers. |
| Docs updated in same change | ✅ | SPIKE-11 doc (new) · roadmap (rows `#20`/`#21`, header, §5 log) · `.gitignore` · `KIT_FEEDBACK.md` K28 · this report — prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 433 | 434 | +1 — the spun-off chart-tick fix (`0113e96`), not this change; this change is docs-only |
| E2E | 121 | 121 | 0 |

## 4. Design notes / small calls

- **Reconciliation as the parser's spine.** The spike didn't extract-then-check; the parser fails
  loudly wherever a statement's own arithmetic doesn't tie (BofA stated totals; Capital One per-row
  balance chain). The two failures it did hit were both **sign-rendering wrinkles** (negative
  balances print the minus before the currency symbol at BofA, and as a detached `- $` at Capital
  One) — fixed in the parser, after which 30/30 reconcile with zero anomalies. Two amount-less
  Capital One anomaly rows (rejected movements) verify balance-neutral.
- **The era cut fell out of the data.** The owner asked whether the real accounts ever zero out like
  the workbook's close-out — they do, days apart from it, as part of the same life event. That turned
  the dedup decision from "pick a matching heuristic" into "butt-join two eras at a penny-exact
  boundary," with exactly one nonzero anchor (value kept in the gitignored profile).
- **The domain already had the answer to attribution's tail.** "Enter now, split later"
  (`04_DOMAIN_MODEL`'s needs-allocation set) means unattributed statement rows import legally and
  surface in an existing app flow — no synthetic "inbox" envelope, no schema change.
- **Load path: rebuild, don't append.** EH10 restore is empty-store-only by design (non-destructive),
  so `data/budgeteer-ledger` becomes a pure derivation of its two gitignored sources (workbook backup
  + statement extraction), rebuilt idempotently — the K26 lesson applied a second time.
- **Spike code preserved, not promoted.** The parser stays throwaway; it and its full output live
  gitignored as the audit trail (K27 pattern). The `#20` extractor will be written fresh on the
  `extract.py` pattern (UUIDv5 ids, integer cents, validation report).

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **Build the `#20` slice** | Everything is decided; see §7 | Next session |
| Statement tail gap (BofA past 2026-06-12, Capital One past 2026-06-30) | Covered when the owner drops the next statements into `/budget-extraction/bank-statements/`; the rebuild pipeline is designed to re-run | Owner, monthly |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's standing open decision | Owner |
| `#19` multi-user/household scoping | Deferred epic (full ceremony) | Owner |
| Reference screenshots into `docs/ux/assets/` | Carried from prior reports | Owner, when convenient |
| Two pre-existing e2e flakes (+ the `quick-add` Escape candidate) | Watch-only — the whole suite passed clean this run, first try | Watch |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **e2e wants `:3001` and `:5173` free** — verify with `lsof -iTCP:3001 -sTCP:LISTEN` (kill listeners,
  not just wrappers); `reuseExistingServer` is OFF by design.
- **If lint fails on paths under `.claude/worktrees/`**, a spun-off task session left a worktree
  behind: `git worktree list`, then `git worktree remove <path>` once its branch is merged (K28).
- **Real data never enters the repo:** everything under `/data/` and the gitignored
  `/budget-extraction/` artifacts (workbook · import JSON · `bank-statements/` · `EXTRACTION_*.md` ·
  **`statement-spike/`**) stays local; committed docs stay redaction-safe (counts/structure only).
- The spike parser can be re-run anytime:
  `python3 budget-extraction/statement-spike/profile_statements.py` (needs `pip install pdfplumber`;
  the committed-doc rule applies to anything derived from its output).
- The ledger store (`data/budgeteer-ledger`) still ends at **2025-10-03** until the `#20` slice lands;
  the dev store (`data/budgeteer-dev`) stays synthetic.

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-10-spike-11-statement-profiling.md —
  its "Resume here" has state (#21 SPIKE-11 Done: all 20 statement PDFs profiled, 30/30
  account-statements reconcile to the penny, 1,009 rows across three real accounts; decisions D1–D4
  owner-confirmed; #20 is Ready; gate green at 434 Vitest + 121 e2e, build 125.53 KB gz).
- Read docs/spikes/11-statement-extraction.md (the decisions D1–D4 in §4, the load path in §5, the
  slice outline in §6) and docs/03_ROADMAP.md rows #20/#21.

The item: build the #20 statement-import slice. Everything is decided — do not reopen D1–D4.
Shape (SPIKE-11 §5–6, zero app code expected):
1. A deterministic extractor in /budget-extraction/ (committed, redaction-safe; the extract.py
   pattern: UUIDv5 ids, integer cents, a validation report) parsing the 20 gitignored PDFs into
   statement-era rows: 844 transactions dated after 2025-10-03, three new real accounts with
   computed opening anchors at the cut, 23 intra-Capital-One pairs as ADR-0004 transfers
   (transfers parent + two kind:'transfer' legs), external-source deposits as plain deposits.
2. A merchant→envelope rules file the OWNER REVIEWS BEFORE LOAD (head merchants only, ~69% of spend
   rows); everything else imports unallocated (the needs-allocation flow is the triage surface).
3. Merge with the workbook-era backup into one BudgeteerBackup; rebuild the gitignored
   data/budgeteer-ledger store (db:reset → npm run db:restore); re-verify the restored totals.
4. Verify live (PGLITE_DIR=../../data/budgeteer-ledger): per-account balances match statement
   closings, transfers excluded from spend, needs-allocation queue populated, Insights spans into
   2026.
If any app-code change turns out to be needed, STOP and flag it before making it (the slice is
scoped zero-app-code). Extraction working docs with real amounts go in gitignored paths by default
(K27); committed docs stay counts/structure only. Keep it vertical and gate-green (e2e needs ports
3001/5173 free — verify with lsof, kill listeners not wrappers). Update docs in the same change
(roadmap #20 → Done; a dated status report with the next kickoff prompt). Provide a single-line
short commit message; the owner reviews and commits.
```
