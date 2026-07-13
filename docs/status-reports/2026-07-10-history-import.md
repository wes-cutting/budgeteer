---
type: status-report
roadmap-item: [BUD-S79, SPIKE-03]
---
<!--
STATUS REPORT — #17 (SPIKE-03) + #18 (historical import). The last V1-era track closes: the owner's
out-of-repo Budget.xlsx ETL was reviewed, independently re-verified, wrapped, and restored via the EH10
db:restore CLI into a dedicated gitignored store (data/budgeteer-ledger) — 26,640 rows, verified live.
NO app code changed. REDACTED per SECURITY.md: this report carries counts and structure, never real
amounts/merchants/sources. Newest report = the live handoff; the next front is the owner's call.
-->

# Status Report — 2026-07-10 (#17 + #18 — the 12-year history import)

| Field  | Value                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| Status | Snapshot                                                                                                       |
| Date   | 2026-07-10                                                                                                     |
| Author | Claude (with the owner)                                                                                        |
| Scope  | `#17` (SPIKE-03) + `#18` (historical import) both `Done`; delta since [2026-07-08-uxr12-manage-formatting.md](2026-07-08-uxr12-manage-formatting.md) |

**Resume here:** **The 12-year history is in the app — `#17` and `#18` are `Done`, closing the last
V1-era track. No app code changed.** The owner ran the `Budget.xlsx` ETL **out-of-repo** (two sessions,
2026-06-23) and transferred the results into `/budget-extraction/` — committed: `SCHEMA_MAP.yaml` (a
repo-derived data-model "Rosetta Stone"), `extract.py` (deterministic extractor), `wrap_backup.py`
(envelope wrapper), [`LOAD_READINESS_ANALYSIS.md`](../../budget-extraction/LOAD_READINESS_ANALYSIS.md)
(this session's review); gitignored: the source workbook, `budgeteer_import.json`, 20 bank-statement
PDFs, and the two full-fidelity working docs (they carry real amounts/merchants — flagged in review,
owner gitignored them). This session **independently re-verified** the import JSON from scratch (Σ all
transaction cents = 0 · 0 split-invariant violations · 0 unallocated transactions · 0 FK dangles · all
integer cents/ISO dates · 27 unique envelopes, 5 archived · exactly one Reset transaction with 10
allocations · row columns match `schema.ts`), **wrapped** it in the `BudgeteerBackup` envelope
(the `tables` payload needed **zero** changes), and **restored 26,640 rows** via the EH10
`npm run db:restore` CLI into a **dedicated gitignored store** `data/budgeteer-ledger` — first try, no
warnings; the `data/budgeteer-dev` demo store is untouched. **Verified live** (API + preview): 1
synthetic `Budget` account and all 27 envelopes at $0 (correct post-reset state), the archived section
right, the register renders real weeks including the 2025-10-03 Reset row, Insights computes the full
2014→2025 range (spend-by-envelope table spans every month; trends over any historical window). SPIKE-03's
question — does the workbook extract cleanly from its in-cell formula strings? — is **answered yes,
empirically**; findings promoted **redacted** to [spikes/03-history-extraction.md](../spikes/03-history-extraction.md).
Real data revealed one latent display bug (fractional-cent y-axis ticks render malformed in
[`ui/Chart.tsx`](../../apps/web/src/ui/Chart.tsx), e.g. `-$895.84.75`) — **filed as a follow-up task, not
fixed here**. Gate **green** — **433 Vitest + 121 e2e**, build **125.52 KB gz** (unchanged — no app
code). **Next front is the owner's call:** the **statement ETL** (fills the 2025-10 → now gap; sharpens
`#20`; decision points in SPIKE-03 §6), the open FEAT-S7 §5 ratification, or `#19`.

## 1. What landed since the last report

| Item | Notes | Source |
| ---- | ----- | ------ |
| `/budget-extraction/` reviewed | Inventory + privacy audit + independent data re-verification + fit-against-load-path analysis; flagged the two working docs' real amounts (owner gitignored them) and the envelope mismatch | [`LOAD_READINESS_ANALYSIS.md`](../../budget-extraction/LOAD_READINESS_ANALYSIS.md) |
| Envelope wrapper | `wrap_backup.py` (~40 lines): `meta` block → `version: 1` + `exportedAt` + `householdId` + `schema.migrations` stamp; `tables` passthrough; output to gitignored `/data/` | [`wrap_backup.py`](../../budget-extraction/wrap_backup.py) |
| 26,640 rows restored | 1 account · 27 envelopes · 12,080 transactions · 14,497 allocations · 34 envelope transfers · 1 household, into `data/budgeteer-ledger` (dedicated, gitignored); EH10 CLI, one transaction, no warnings | `npm run db:restore` output |
| Live verification | Balances $0 post-reset · archived envelopes right · register renders real weeks + the Reset row · Insights computes 2014→2025 · no console errors, no failed requests | preview session (see §4) |
| SPIKE-03 findings doc | Redacted (SPIKE-08 stance): the four mapping rules, losslessness, discrepancy handling, what's excluded, the load outcome, and the §6 follow-on decision points | [`spikes/03-history-extraction.md`](../spikes/03-history-extraction.md) |
| Roadmap | `#17`/`#18` → `Done`; `#20` trigger sharpened (statements named); header re-pointed at the three candidate fronts; §5 log entry | [`03_ROADMAP.md`](../03_ROADMAP.md) |
| Chart tick bug filed | Fractional-cent y-axis ticks (tick interpolation can land off integer cents; the formatter doesn't round) — spun off as its own task, out of this change's scope | follow-up task |

## 2. Definition of Done — current state (a load-and-verify slice; zero app-code delta)

| Check | State | Evidence |
| ----- | ----- | -------- |
| Vertical & usable | ✅ | The owner's real 12-year ledger is browsable end-to-end in the app today: register weeks, envelope history, 12 years of Insights. Data → (existing) API → (existing) UI. |
| Gate green | ✅ | typecheck · lint · format · unit · e2e · build · SCA all **pass** — **433 Vitest + 121 e2e**, build **125.52 KB gz** (unchanged), `npm audit --omit=dev --audit-level=critical` exit 0. |
| Acceptance criteria met & tested | ✅ | SPIKE-03's falsifiable question answered with a fully reconciled extraction (re-verified from scratch this session); restore inserted every row first-try; app verified live over the restored store. No new app tests — no new app code; the restore path's own gate test (EH10) already proves the mechanism. |
| A11y (WCAG 2.2 AA) | ✅ | No UI change. Verified surfaces render with existing semantics (archived labels, table structure, honest empty states for post-reset months). |
| Input validation & secrets | ✅ | The backup file is external input → zod-validated envelope + PostgreSQL row-level constraints (the EH10 design). **No real data in the repo**: workbook/JSON/statements/working docs gitignored (verified with `git check-ignore`); committed docs are redaction-safe; the restored store lives in gitignored `/data/`. |
| Docs updated in same change | ✅ | SPIKE-03 doc (new) · roadmap (rows, header, §5, `#20` trigger) · `LOAD_READINESS_ANALYSIS.md` outcome § · this report — prettier-clean. |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | 433 | 433 | 0 — no app code changed |
| E2E | 121 | 121 | 0 — the e2e suite runs against its own throwaway store, untouched by the ledger load |

## 4. Design notes / small calls

- **The EH10 restore path was the whole ingestion story.** D5 (bulk `BudgeteerBackup` JSON) meant the
  extractor's output was already row-shaped for `db:restore`; the only delta was the envelope
  (version/stamp/householdId). No import endpoint was added — SEC3's CLI-only stance holds.
- **A dedicated store, not the dev store.** The real ledger went to `data/budgeteer-ledger`; the demo
  seed store (`data/budgeteer-dev`) is untouched, so design/dev work keeps its synthetic data and the
  real ledger stays a deliberate opt-in (see §6). Restore's empty-store-only rule made this the
  zero-risk path.
- **Verification read the app's honest states.** All-zero balances aren't a bug — the workbook era ends
  with a deliberate 2025-10-03 zero-out, so $0 everywhere **is** the reconciled state; the register's
  current-month default window being empty is likewise honest (last activity 2025-10-03). The
  interesting checks were historical windows, which render correctly.
- **Real data ranges found a latent bug synthetic data never hit** — y-axis tick interpolation can land
  on fractional cents and the money formatter doesn't round (`-$895.84.75`). Presentation-only, shared
  `ui/Chart.tsx`, filed separately to keep this change zero-app-code.
- **Redaction line held.** Committed artifacts (SPIKE-03 doc, analysis doc, this report) carry counts
  and structure only; the two full-fidelity working docs the ETL produced are gitignored rather than
  scrubbed, preserving them locally as the extraction's audit trail.

## 5. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| **Statement ETL** (the 2025-10 → now gap) | 20 machine-readable PDFs on hand (gitignored); needs its own spike with three owner decision points: real-vs-synthetic account coexistence · Sep–Oct 2025 overlap dedup · envelope attribution ([SPIKE-03 §6](../spikes/03-history-extraction.md)) | Owner picks the front |
| Chart fractional-cent tick fix | Filed as a spun-off task (`ui/Chart.tsx` + a unit test) | Anyone; small |
| FEAT-S7 §5 divergence ratify/veto | Still the roadmap's standing open decision | Owner |
| Reference screenshots into `docs/ux/assets/` | Carried from prior reports | Owner, when convenient |
| Two pre-existing e2e flakes | Watch-only — both passed clean this run | Watch |
| **Third e2e flake candidate**: `quick-add.spec.ts` "Escape closes the modal without recording anything" | Failed once in the first full gate run, passed clean on immediate re-run (180ms) and in the full-suite re-run; no app code changed in this slice, so it cannot be a regression from it | Watch (add to the flake list if it recurs) |

## 6. Commands & gotchas (cold-start)

```sh
npm install
# Full local gate (the real gate — CI mirror is manual-only):
npm run typecheck && npm run lint && npm run format && npm test && npm run test:e2e \
  && npm run build --workspace @budgeteer/web && npm audit --omit=dev --audit-level=critical
```

- **Two stores now exist under gitignored `/data/`:** `budgeteer-dev` (synthetic demo seed — the `.env`
  default) and **`budgeteer-ledger` (the owner's real 12-year ledger)**. Run the app against the real
  ledger with `PGLITE_DIR=../../data/budgeteer-ledger` (env vars beat `.env`), e.g.
  `PGLITE_DIR=../../data/budgeteer-ledger npm run start --workspace apps/api` — or point `.env` at it to
  make it the daily driver. A local-only `api-ledger` launch config exists in `.claude/launch.json`
  (untracked) for preview sessions.
- **The wrapped backup file** is `data/budgeteer-backup-2026-07-10.json` (gitignored) — re-restorable
  into any fresh store; regenerate anytime with `python3 budget-extraction/wrap_backup.py`.
- **Never commit real data**: everything under `/data/` and the gitignored `/budget-extraction/`
  artifacts (workbook · import JSON · `bank-statements/` · the two `EXTRACTION_*.md` working docs) stays
  local. Committed extraction docs must stay redaction-safe (counts/structure only).
- **e2e wants `:3001` and `:5173` free** — stop any dev stack (and preview servers) first;
  `reuseExistingServer` is OFF by design.
- The ledger store's last activity is **2025-10-03** (the workbook era's deliberate zero-out) — current-
  month views are honestly empty; use historical windows (register from/to; Insights end-month).

## 7. Next-session kickoff prompt

```text
You are resuming Budgeteer (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST status report, docs/status-reports/2026-07-10-history-import.md — its "Resume here"
  has state (#17 SPIKE-03 + #18 historical import are Done: the owner's real 12-year ledger — 26,640
  rows — is restored into the dedicated gitignored data/budgeteer-ledger store and verified live; NO
  app code changed; gate green at 433 Vitest + 121 e2e, build 125.52 KB gz).
- Read docs/spikes/03-history-extraction.md (redacted findings) and docs/03_ROADMAP.md — the
  "Current focus", "Next fronts", and §4 tables.

The last V1-era track is closed. There is no queued next item; the next front is the owner's call.
Confirm direction with the owner before starting new work. The candidates on the board:
- Statement ETL (the strongest continuation): 20 machine-readable bank-statement PDFs (two
  institutions, 2025-09 → 2026-06, gitignored in budget-extraction/bank-statements/) cover the gap
  after the ledger's 2025-10-03 end. It sharpens roadmap #20 and needs its own spike FIRST
  ("reality before paper") with three owner decision points enumerated in SPIKE-03 §6: how real
  accounts coexist with the synthetic historical "Budget" account · Sep–Oct 2025 overlap dedup ·
  envelope attribution for statement transactions.
- The open FEAT-S7 §5 decision (ratify or veto the pay-period latest-fit divergence) — gates whether
  the bill↔paycheck assignment store gets scoped.
- The deferred #19 (multi-user/household scoping — a full-ceremony epic).
- Small: the filed ui/Chart.tsx fractional-cent tick fix (may already be done via its spun-off task).

Ask the owner which front to take. Keep it vertical and gate-green; spike unproven assumptions before
the spec/ADR that depends on them; update docs in the same change; leave the project handoff-ready
with a next-session kickoff prompt. NOTE: the e2e gate needs ports 3001/5173 free — stop any dev
stack (npm run dev + tsx watch) first. Real data NEVER enters the repo: /data/ and the gitignored
budget-extraction artifacts stay local; committed docs stay redaction-safe (counts/structure only).
Provide a single-line short commit message; the owner reviews and commits.
```
