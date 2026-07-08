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

- **~6 months of dated history:** envelope outflows with believable week-to-week variance and
  a visible trend or two (groceries drifting up; a one-month spike) — deterministic (fixed
  tables or a seeded RNG), so charts look the same on every machine.
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
- Deterministic across runs; refuses an occupied store; baseline `seed` byte-identical;
  gate untouched (e2e never uses the demo store).
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
