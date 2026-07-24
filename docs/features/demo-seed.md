---
type: feature-spec
roadmap-item: [BUD-S65, BUD-S70]
status: Implemented
---
<!--
FEAT NOTE — UXR8 (2026-07-06 UX Redesign): demo-grade synthetic seed. Tooling, not a page
slice — the owner's "insights are masked behind limited data" callout. Strictly synthetic
(SECURITY.md); the durable real-data unlock remains the deferred history import (#17/#18).
-->

# FEAT note — Demo-grade synthetic seed (UXR8)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Feature ID   | UXR8 (tooling; no UX spec — nothing user-facing ships)                   |
| Status       | **Implemented** 2026-07-07 (`apps/api/src/db/seedDemo.ts`; `npm run seed:demo`) |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) §4 · [SECURITY.md](../SECURITY.md) (synthetic-fixtures rule) · K24 (the clean dev-store baseline) · deferred `#17`/`#18` |
| Gated by     | — (no gate; can precede UXR1)                                            |

## What

A new **`npm run seed:demo`** ([`apps/api/src/db/seedDemo.ts`](../../apps/api/src/db/seedDemo.ts)) —
a **standalone** rich dataset that populates its **own fresh store**. The baseline `seed` stays
**byte-identical and untouched** (e2e isolation and the K24 clean baseline depend on its
determinism); `seed:demo` is a separate dev tool, not a layer on top of it. It fills a fresh dev
store so every visualization has patterns to show while the redesign is evaluated:

- **~6 months of dated history, rolling:** envelope outflows with believable week-to-week
  variance and a visible trend or two (groceries drifting up; a one-month spike) — deterministic
  per calendar day (a seeded RNG), so charts look the same on every machine. The window is
  relative to *today* (not a fixed calendar range) and always includes the current month through
  today, so Insights views scoped to "this month" (Breakdown, Budget vs. Actual, Burn-down) are
  never empty, no matter when the seed is run.
- **Recurring rules:** a biweekly paycheck **deposit** + 6–8 monthly **withdrawal** bills
  anchored across the month (1st/2nd/7th/15th/29th — the month-boundary cluster the planner
  policy exists for), each with its split.
- **Targets** on most budgeted envelopes (so Budget/Burn-down/cockpit health populate).
- **Debt surfaces:** a credit account with a limit + partial utilization; a loan with a
  principal + payment history (Credit/Payoff views).
- **2–3 saved templates** (the Templates page finally has sample data — the owner's UXR4
  observation) and a couple of transfers/refunds so those ledger shapes appear.

Documented flow: **`npm run db:reset && npm run seed:demo`** (or point `PGLITE_DIR` at a fresh
directory). The script refuses a store that already contains data (the EH10 non-destructive
precedent, [`restoreService.ts`](../../apps/api/src/services/restoreService.ts)) — it is a dev
tool, not an importer.

> **Resolved 2026-07-07 (owner) — standalone, not layered.** The `Proposed` note carried an
> internal tension: "additive on top of the baseline seed" (a 3-step `reset && seed && seed:demo`
> flow) versus "refuses a store with user data." Those can't both hold — a strict occupied-store
> refusal rejects a store the baseline `seed` just filled, and layering a second set of
> accounts/envelopes onto the baseline's would collide. The owner chose **standalone into a fresh
> store**: `seed:demo` builds a complete dataset and refuses any occupied store (the literal EH10
> precedent). "Additive" therefore means *a new, additional tool* — the baseline `seed.ts` is
> never touched. Flow corrected to the 2-step above.

## Guardrails (non-negotiable)

**Strictly synthetic.** Invented payees/amounts only — explicitly **not** the owner's real
creditors or figures (the BudgetHome bill names are real lenders; none may appear — the
SPIKE-08 redaction stance). Committed code = committed data: everything in the script is
synthetic by construction (SECURITY.md, the day-zero rule).

## Acceptance

- After the documented flow: every Insights view renders non-trivial, pattern-bearing content;
  the pay-period planner shows a multi-bucket plan with the boundary cluster; the Templates
  table is populated; the cockpit reads like a lived-in month.
- Deterministic across runs on the same calendar day (the history window is anchored on today,
  so it rolls forward by design across days); refuses an occupied store; baseline `seed`
  byte-identical; gate untouched (e2e never uses the demo store).
- **Honest limit, recorded:** this is the dev-time proxy. Real richness is the owner's
  history — the deferred **`#17`/`#18` import** remains the durable fix.

## Verified 2026-07-07

Two fresh runs into separate stores produced **identical** content (216 transactions across
2025-12-31 → 2026-06-29, matching fingerprint) — deterministic ✓. Re-running into a populated
store is **refused** with the EH10 message ✓. Content: 4 accounts · 22 envelopes · 462
allocations · 8 recurring rules (biweekly paycheck + 7 bills clustered at 1/2/7/15/29) · 3
templates · 13 targets · credit at 31% utilization · loan paid down 440k of its 1.8M principal.
The `GET /analysis/pay-periods` plan against the demo store returns a **7-bucket** plan with the
month-boundary bills distributed across paychecks (and one realistically over-committed bucket) —
the boundary-cluster acceptance, confirmed. `apps/api/src/db/seed.ts` shows **no diff** (baseline
byte-identical). typecheck · lint · format all green on the new file.

## Fixed 2026-07-22 — the fixed window had gone stale

The window above (2025-12-31 → 2026-06-29) was a fixed calendar range, not relative to *today*.
By 2026-07-22 real time had passed it, so the app's own clock (`apps/web/src/dates.ts`, browser
`new Date()`) put "this month" at July 2026 — a month the seed had zero transactions in. Every
current-month-scoped Insights view rendered empty or zeroed: Breakdown showed "No spending
recorded," Budget vs. Actual showed $0.00 spent against every target, Burn-down showed "0.0% of
budget" beside "Pace today (67.7%)," and the Trends chart's last point fell straight to $0. Two
recurring bills also showed as already overdue. Confirmed via `npm run capture:demo`'s screenshots
before the fix.

**Fix:** `seedDemo.ts`'s date engine (`apps/api/src/db/seedDemo.ts`) now anchors on
`todayStr(systemClock)` (the same clock convention as `apps/api/src/util/dates.ts`) instead of a
hardcoded year/month range — 6 full prior months plus the current month populated through today,
with every recurring rule's `next_occurrence_on` computed as its next real future date. Determinism
is now **per calendar day** (same-day reruns are still byte-identical) rather than forever-fixed —
the window rolling forward daily is the fix, not a regression.

Re-verified same day via `npm run capture:demo`: Breakdown lists 13 funded categories for 2026-07;
Budget vs. Actual shows real Spent bars (Groceries $726.51 over its $520 target); Burn-down reads
99.2% of budget at 71.0% pace elapsed; Trends' last point is a genuine (lower, partial-month) value
instead of $0; the dashboard reads "Spent $3,046.06 / Remaining $25.94 · 1 envelope over budget";
Recurring shows every rule "Up to date" with real future dates. `npm run docs:check` and
typecheck/lint/format all green.

### Follow-up same day — Emergency Fund's opening lump dwarfed the by-envelope chart

The savings account's $8,200 opening had been allocated in full to the Emergency Fund envelope
(so it would "show a live balance") — but Insights → Spending → By envelope sums net flow across
the whole window, and an $8,200 one-time lump made every other envelope's few-hundred-dollar
pattern unreadable on the same axis. Fix: that opening is now left unallocated, like the
checking/card/loan openings already were (Needs allocation goes from 3 items to 4, uniform across
all four accounts) — Emergency Fund's balance instead comes from its ongoing paycheck line, a
smaller but *growing* ~$650 over the window. Account-level totals, Net worth, and Accounts are
unaffected (the account's own opening amount didn't change, only what got allocated). Re-verified:
Emergency Fund's bar is now ~$651.90, in line with its neighbors instead of ~13x the next-tallest
bar; Needs allocation reads "4 · $28,980.00 unallocated"; typecheck/lint/format all green.

### Follow-up same day — Groceries' trend compounded into the chart's other outlier

Unlike the Emergency Fund lump, this one wasn't a single event: Groceries' per-trip cost trends
upward (a deliberate feature — a visible drift) while its paycheck funding stays flat, proportional
to its $520/mo target. The trend range ($95→$135/trip) ran far enough ahead of that target that the
funding/spend gap compounded across all 7 months into a -$2,014 net flow — about 3x the next most
negative envelope, dominating the low end of the same by-envelope chart. Fix: lowered the trend
range to $72→$102/trip (still a visible upward drift, still modestly over budget — a deliberate
"over budget" signal for Budget vs. Actual/Burn-down — just not compounding into an outlier).
Re-verified: Groceries' net flow is now ~-$698.73, matching Rent's ~-$698 as the chart's two most
negative bars instead of one dominant one; 2026-07 Budget vs. Actual reads $548.92 spent vs. $520
target (105.6%, still over budget); typecheck/lint/format/tests (434 passed) all green.
