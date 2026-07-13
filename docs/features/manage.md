---
type: feature-spec
roadmap-item: BUD-S51
status: Implemented
---
<!--
FEATURE SPEC — scopes roadmap item UX6 (2026-06-25 UX Uplift, Phase 2). Build as a vertical slice:
DEMOTE account/envelope management off the home into the /accounts·/envelopes LIST routes (per-entity
CRUD) and a cross-cutting /manage hub, so the home (`/`) renders the UX5 cockpit only. Fan-out over
existing reads (no new endpoint). Status ladder: docs/00_WAYS_OF_WORKING.md §4.
-->

# Feature Spec — Demote management to a dedicated surface (`/accounts` · `/envelopes` · `/manage`)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Feature ID   | FEAT-UX6                                                               |
| Status       | Implemented ([status report](../status-reports/2026-06-28-ux6.md))    |
| Owner        | Wesley Cutting                                                         |
| Last updated | 2026-06-28                                                            |
| Related      | [UX Uplift brief](../reviews/2026-06-25-ux-uplift-initiative.md) (`UX6`) · builds on [FEAT-UX3](app-shell.md) (shell + routes) · [FEAT-UX4](design-system.md) (design system) · [FEAT-UX5](cockpit.md) (the cockpit home) · UX spec [ux/manage.md](../ux/manage.md) · reuses [accounts](accounts.md) · [envelopes](envelopes.md) · [transfers](transfers.md) (Move-money #7b) · net-worth (R4/R9) |

## 1. Summary

UX5 made the home (`/`) a **cockpit**, but left account/envelope management stacked below it
(deliberately — there was nowhere else for it to go yet). UX6 **demotes management off the home** so
`/` renders the **UX5 cockpit only**, and builds the surfaces deferred from UX3:

- **`/accounts` — the accounts LIST route.** Per-entity management: a **progressive "Add account"**
  affordance, the account list with each name a **`<Link>`** to its register (`/accounts/:id` — UX3
  left these as buttons), inline **rename / archive / unarchive**, and a **Show archived** toggle.
- **`/envelopes` — the envelopes LIST route.** A **progressive "Add envelope"** affordance, the
  envelope list with each name a **`<Link>`** to its ledger (`/envelopes/:id`), inline
  **archive / unarchive**, and the **R5 inline monthly target/spent/remaining**.
- **`/manage` — the cross-cutting hub.** The tools that span more than one account/envelope: the
  **R4 net-worth summary** (sums all accounts) and **Move-money** (re-budgets between two envelopes),
  plus links to the two list pages.

The shell nav gains **Accounts · Envelopes · Manage**. **Everything fans out over existing reads —
no new endpoint, no schema/API/domain change** (the cockpit's precedent).

## 2. Surface split (the decision)

The brief routes the moved content into "`/manage` **and** the `/accounts`·`/envelopes` LIST routes."
Resolved (owner) to **list routes own per-entity CRUD; `/manage` owns the cross-entity tools** — the
cleanest, non-duplicated reading:

| Concern | Lives on | Why |
| ------- | -------- | --- |
| Add / rename / archive an **account**; browse to a register | `/accounts` | It is *that account's* lifecycle — co-located with the list you act on. |
| Add / archive an **envelope**; inline budget; browse to a ledger | `/envelopes` | Same, for envelopes. |
| **Net-worth summary** (Σ over *all* accounts) | `/manage` | Spans the whole account set — not any one account. |
| **Move-money** (between *two* envelopes) | `/manage` | Spans two envelopes — not any one envelope. |

The list route for an entity **is** its management home; `/manage` is the hub for what doesn't belong
to a single entity. No list is rendered twice.

## 3. Composition (data → UI)

Four thin route components (each its own `<main>` + one `<h1>`, reached from the UX3 shell nav). All
fetch on mount; the shell remounts routes on navigation, so figures refresh on each visit (the
established freshness model — this retires the UX5 "within-mount freshness" carry).

| Route | Component | Reads | Notes |
| ----- | --------- | ----- | ----- |
| `/` | `Home.tsx` | — (renders `<Cockpit>`) | Cockpit **only** now; `<h1>Budgeteer</h1>`. |
| `/accounts` | `AccountsList.tsx` | `listAccounts` (+ `rename`/`archive`/`unarchive`/`createAccount`) | Names → `<Link to="/accounts/:id">`. |
| `/envelopes` | `EnvelopesList.tsx` | `listEnvelopes` · `getBudgetVsActual(month)` (R5 inline) (+ `archive`/`unarchive`/`createEnvelope`) | Names → `<Link to="/envelopes/:id">`. |
| `/manage` | `ManageView.tsx` | `listAccounts` (net worth) · `listEnvelopes` (Move-money) | Net-worth = client-side Σ split by `isLiabilityKind` (R4, = `/analysis/net-worth`); Move-money = `createEnvelopeTransfer` (#7b). |

`Dashboard.tsx` is **retired** (its forms/lists/summary moved into the three new components).

## 4. Progressive "Add" affordance

The always-on Add forms become progressive: a button (`Add account` / `Add envelope`) reveals the
form; revealing **swaps** the button for the form + a **Cancel**, so there is never a second
`Add account` control to make selectors ambiguous; a successful submit collapses it again. **Mount /
unmount only — no opacity animation on a text wrapper** (that trips the axe contrast gate; transform
is the only animation pattern allowed, per the UX3 lesson). The form internals are unchanged
(`aria-label`, labels) so existing selectors keep working.

## 5. States & a11y

- **Per route:** exactly one `<main>` + one `<h1>` (`Accounts` / `Envelopes` / `Manage`; the home
  keeps `Budgeteer`); the shell supplies the single banner/nav. Load failure → a `role="alert"`.
- **List items are `<Link>`s** with the entity name as their accessible name; kind/balance/controls
  are sibling elements (not surrounding prose), so they do **not** trip `link-in-text-block`.
- **`/manage` hub links** stand alone in their `<li>` (the descriptive prose is a separate intro
  `<p>`) — a link surrounded by prose trips WCAG 1.4.1 `link-in-text-block` (caught in the axe sweep).
- **Color is never the sole signal** (archive/rename are text buttons; net-worth is a labelled table;
  R5 inline budget is plain labelled text keeping its sign).
- **Axe-clean (WCAG 2.2 AA) in light AND dark** — `e2e/a11y.spec.ts` scans `/accounts`, `/envelopes`,
  and `/manage` (populated) in both schemes, plus the now-cockpit-only home.

## 6. Acceptance criteria

- ✅ Home `/` renders the **cockpit only** — no Add-forms, no net-worth table, no Move-money
  (asserted in `Home.test.tsx`).
- ✅ `/accounts` & `/envelopes` are built (not empty): progressive Add, name-as-`<Link>` to detail,
  inline rename/archive (+ R5 inline budget on envelopes).
- ✅ `/manage` carries the net-worth summary + Move-money + links to the two list pages.
- ✅ Shell nav exposes **Accounts · Envelopes · Manage** (`AppShell.test.tsx`).
- ✅ Figures reconcile to the ledger — net worth `net = assets + liabilities` (`ManageView.test.tsx`
  + `e2e/accounts.spec.ts` invariant); Move-money derives both balances (`MoveMoneyForm.test.tsx` +
  `e2e/transfers.spec.ts`).
- ✅ a11y green (light + dark) on all three new surfaces; one banner/main, `<h1>` preserved.
- ✅ **No new endpoint**, no schema/API/domain change — fan-out over existing reads.

## 7. Out of scope (later slices)

Global quick-add transaction modal route (`UX7`) · Insights rename + charts (`UX8`) · richer
management UX — confirm-on-destructive for Archive (`UX12`), budget-health visual encoding (`UX13`),
first-run onboarding (`UX14`), responsive pass (`UX15`).
