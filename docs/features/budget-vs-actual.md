<!--
FEATURE SPEC — #12: analysis, budget vs. actual (per-envelope monthly target vs. actual spend).
The second analysis slice. ADDS the "budget" half Budgeteer lacked — per-envelope MONTHLY TARGETS
(a small new store) — and compares it to the "actual" (outflow) spend per month. Pairs with
docs/ux/budget-vs-actual.md.
-->

# Feature Spec — Analysis: budget vs. actual

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-012                               |
| Status       | Implemented                            |
| Owner        | Wesley Cutting                         |
| Last updated | 2026-06-16                             |
| Related      | [Spend-by-envelope](analysis-envelope-spend.md) (FEAT-011) · [Envelopes](envelopes.md) (FEAT-002) · [Transactions](transactions.md) (FEAT-003) · [Refunds](refunds.md) (FEAT-008) · [UX](../ux/budget-vs-actual.md) · [Domain](../04_DOMAIN_MODEL.md) · [Data](../05_DATA_MODEL.md) · [API](../06_API_CONTRACT.md) · PRD §6 (journey 9), §9 (the monthly-target open Q) |

## 1. Summary

For a chosen month, show each envelope's **monthly budget target** (what you planned to spend)
beside its **actual spend** that month, with the **remaining** budget (`target − spent`). The
"actual" side already existed as generated data (FEAT-011 reads the same allocations); the missing
half was the **budget** — Budgeteer did not store per-envelope targets. This slice adds that store
(one recurring monthly amount per envelope, set/cleared inline) and the per-month compare. It
resolves PRD §9's open question — _"Do envelopes carry a monthly budget target in V1?"_ — **yes, a
single recurring monthly target**.

## 2. Scope

- **In scope** — a per-envelope **recurring monthly target** (a single amount; no effective-dating)
  that you **set/clear inline**; a **budget-vs-actual table** for a selectable month (envelope ·
  target · spent · remaining) with footed totals; **outflow-only** actuals (see §4); archived
  envelopes shown when they have a target or spend that month.
- **Out of scope** — **per-month / effective-dated** targets (a single recurring target is V1;
  owner decision §11); rollover / carry-forward of unspent budget; percentage or category-group
  targets; multi-month variance trends and charts (a later analysis item); the spend-over-time grid
  itself (that is FEAT-011); cash-flow forecast (#13).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As the user, I want to set a monthly target on an envelope so I can plan what I intend to spend. | Must |
| US-2 | As the user, I want to see, for a month, each envelope's target vs. what I actually spent, and how much budget is left. | Must |
| US-3 | As the user, I want to pick which month I'm looking at so I can review a past month or the current one. | Should |
| US-4 | As the user, I want over-budget envelopes to read clearly (negative remaining) so I can see where I overspent. | Should |
| US-5 | As the user, I want spend I made in an un-budgeted envelope to still show, so nothing is hidden. | Should |

## 4. Acceptance criteria

- **Given** a Groceries target of `$400.00` and, in the selected month, a `$500` deposit allocation
  (funding) **plus** a `$360` withdrawal allocation (spend), **then** the Groceries row shows
  **target `$400.00`**, **spent `$360.00`** (the funding deposit is **excluded** — actual is
  **outflow only**), and **remaining `$40.00`**.
- **Given** a target of `$100.00` and `$150` of spend that month, **then** remaining is **`-$50.00`**
  (over budget — shown as text, not colour alone).
- **Given** a withdrawal split as `−$100` spend **+ `$30` refund** (FEAT-008) on an envelope, **then**
  that envelope's spend for the month is **`$70`** (refund rows net **down** the actual spend).
- **Given** an envelope↔envelope **reallocation**, **then** the numbers are **unchanged**
  (reallocations carry no allocations, so they are not spend — as in FEAT-011).
- **Given** spend in another month, **then** it is **excluded** from the selected month's figures.
- **Given** an envelope with **no target**, **then** its row shows **no target** and a blank
  (`—`) remaining, but its **spend is still shown**.
- **Given** an **active** envelope with neither target nor spend, **then** it still has a row (ready
  to set a target). An **archived** envelope appears **only** if it has a target or spend that month.
- **Setting** a target (PUT) **replaces** any existing one; **clearing** (DELETE) removes it and is
  **idempotent**. Invalid month → `400`; a target ≤ 0 or unparseable → `400`; a target on a missing
  envelope → `404`.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Refunds exceed spend in a month | "Spent" can go **negative** (net money returned via withdrawal-direction txns); remaining then exceeds the target. Truthful, not clamped. |
| Funding-only month (deposit, no withdrawal) | Spent `$0.00`; remaining = the full target (funding is not spend). |
| Opening-balance allocation | An opening transaction is not a withdrawal (`amount_cents ≥ 0`), so it never counts as spend. |
| Transfer legs / reallocations | Carry no allocations → never counted (as in FEAT-011). |
| No target set | `targetCents`/`remainingCents` are `null`; the UI shows an empty input and `—`. |
| Target with leading/trailing space or `$` | Parsed at the boundary (`parseMoney`); unparseable → `400`. |
| Month with no activity at all | Active envelopes still listed (target editable, spent `$0.00`). |

## 6. Data changes

**One new table** — [`envelope_targets`](../05_DATA_MODEL.md) (FEAT-012): `id`, `household_id`,
`envelope_id` (**unique** — one target per envelope), `monthly_target_cents` (`BIGINT`, `> 0`),
`created_at`, `updated_at`. **No row = no target.** Mutable config (not a ledger row), so it carries
`updated_at`. Ships with an **idempotent** migration (`create table if not exists` + unique index)
in `db/migrate.ts`, so the dev/test PGlite path keeps doubling as the migrator. Money stays
**integer cents** end to end. This is a **single recurring monthly amount** — _not_ effective-dated
— so it is a **definition in this spec, not an ADR** (owner decision, §11). The **actual** side adds
**no** schema: it is a read-only aggregate over existing `allocations ⋈ transactions`.

## 7. Interface changes

New API ([06_API_CONTRACT](../06_API_CONTRACT.md)):

- `GET /analysis/budget-vs-actual?month=YYYY-MM` (`month` required since EH8 — the client sends
  its local month) → `200 { report }`.
- `PUT /envelopes/:id/target` `{ amount: string }` → `200 { target }` (set/replace).
- `DELETE /envelopes/:id/target` → `204` (clear; idempotent).

```
BudgetVsActualReport = {
  month: string;                 // "YYYY-MM"
  rows: BudgetVsActualRow[];     // active envelopes + any archived with target/spend, by name
  totalTargetCents: number;      // Σ targets over rows that have one
  totalSpentCents: number;       // Σ spend over all rows
  totalRemainingCents: number;   // Σ remaining over budgeted rows
}
BudgetVsActualRow = {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  targetCents: number | null;    // null = no target set
  spentCents: number;            // net outflow this month (≥ 0 normally)
  remainingCents: number | null; // target − spent; null when no target
}
EnvelopeTargetView = { envelopeId: string; monthlyTargetCents: number }
```

**The "actual" definition (the modeling decision).** Actual = **net spend on outflow
transactions**: `−Σ allocation.amount_cents` over allocations whose **transaction is a withdrawal**
(`amount_cents < 0`), bucketed by the transaction's `occurred_on` month. This (a) **excludes funding
deposits** by construction — a budget is "planned vs. **spent**", not net change — and (b) **nets
refund rows** (a refund is a `+` allocation on a withdrawal, FEAT-008) **down**. It lives in
`analysisService.budgetVsActual` as a **sibling** of FEAT-011's net-flow query (which is untouched).
`remaining = target − spent` (positive = under budget).

UI: a new **Budget** view (Dashboard button) with a **month picker** and a table whose target column
is an inline editor — see [UX](../ux/budget-vs-actual.md).

## 8. Dependencies

Real allocation/transaction data from FEAT-003; reuses the API's `parseMoney`/positive-magnitude
boundary parse, the `{ error: { message } }` envelope + zod-at-boundary house style, the
`bigint`→`Number` read convention (ADR-0003 / [05_DATA_MODEL](../05_DATA_MODEL.md) §1), and the web
`formatCents`/`formatMoney` (EH1). **Domain stays pure** — variance is `target − spent`, computed in
the read service; no new domain module. No change to FEAT-011's `envelopeSpend`.

> **CORS allow-methods fix (shipped with this slice).** The browser write path for targets is
> `PUT`/`DELETE`, which surfaced a latent bug: `@fastify/cors` defaulted the preflight's
> `Access-Control-Allow-Methods` to `GET,HEAD,POST`, so the browser silently blocked **all**
> cross-origin `PUT`/`PATCH`/`DELETE` (rename, edit-split, template/recurring delete — all
> previously only exercised via the fake API and `inject`). Fixed by declaring the methods the API
> uses; guarded by a new e2e write-verb round-trip. See [06_API_CONTRACT](../06_API_CONTRACT.md) §1.

## 9. Security, privacy & accessibility

Household-scoped server-side (targets carry `household_id`; the read is scoped on the transaction
and the target). Inputs validated at the boundary: `month` is a strict `YYYY-MM` regex (→ `400`),
the target is a positive-magnitude `parseMoney` (→ `400`), the envelope is verified to exist in the
household (→ `404`). Read/compare is otherwise read-only; tests use synthetic fixtures (no real
data). The view is a real `<table>` with a `<caption>`, `scope="col"`/`scope="row"` headers, and a
totals `<tfoot>`; each target input is labelled (`Monthly target for <envelope>`); negative
remaining is text (`-$…`), never colour alone; loading/empty/error are `role="status"`/`role="alert"`.
(WCAG 2.2 AA; the app-wide visual-contrast pass remains part of the consolidated #16 a11y/NFR pass.)

## 10. Test plan

- **Unit (domain):** none — no new pure money logic (variance is a single subtraction in the read
  service; allocations are pre-signed). Stated so the absence is deliberate.
- **Integration (API, 11):** outflow-only spend (funding excluded) + remaining; overspend (negative
  remaining); refund nets spend down; reallocations excluded; month filter; un-budgeted spend with
  null target; active-envelope-always-present / empty; archived shown only with target-or-spend;
  set/replace/clear (idempotent); validation (bad/missing month → `400` — required since EH8,
  missing envelope → `404`, bad amount → `400`); cent-exactness.
- **Component (web, 5):** target/spent/remaining render for a chosen month (funding excluded, over
  budget, un-budgeted `—`, footed totals); set a target inline → remaining updates; clear → `—`;
  empty state; load error.
- **e2e (Playwright):** the single journey is extended with a **budget-target step** — a real
  cross-origin **PUT** /envelopes/:id/target via the inline editor — guarding the CORS fix (the
  prior POST-only journey could not catch it).

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| ~~Do envelopes carry a monthly budget target in V1?~~ | Wesley | **resolved: yes — one recurring monthly target per envelope** (this slice); resolves PRD §9 |
| ~~Single recurring target, or per-month / effective-dated?~~ | Wesley | **resolved: single recurring** (leaner V1; a definition here, no ADR; effective-dating can layer on later without breaking it) |
| ~~What is "actual" — net flow (FEAT-011) or spend only?~~ | Wesley | **resolved: spend only (outflow)** — funding excluded, refunds netted (a budget is planned-vs-**spent**) |
| Add rollover / carry-forward of unspent budget? | Wesley | open (V1: each month stands alone) |
| Add multi-month variance trends / charts? | Wesley | open (later in the analysis area) |
