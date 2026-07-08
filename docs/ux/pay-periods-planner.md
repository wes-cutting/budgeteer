<!--
UX SPEC — UXR2: the pay-period planner (the 2026-07-06 UX-redesign rework of the S7 surface).
Supersedes the PRESENTATION of ux/pay-periods.md §3 (the stacked bucket sections) — the S7
domain model, endpoint, and balanced-latest-fit policy are NOT in question here (the owner's
2026-07-06 feedback was presentation + placement + missing figures; the FEAT-S7 §5 policy
ratify/veto remains its own open roadmap decision). Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Pay-period planner (first-class, at-a-glance)

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Status       | **Proposed** — every §11 design question owner-resolved 2026-07-06         |
| Feature      | [FEAT-UXR2](../features/pay-periods-planner.md) (`Proposed`; updates [FEAT-S7](../features/pay-periods.md) presentation) |
| Owner        | Wesley Cutting                                                             |
| Last updated | 2026-07-06                                                                 |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · supersedes the presentation of [S7 UX spec](pay-periods.md) §3 · [UXR1 sidebar shell](app-shell-sidebar.md) (nav placement) · sheet reference: `BudgetHome.xlsx` (SPIKE-08 §5; screenshot from the 2026-07-06 session) |

## 1. User & job

The sheet's core view was a **single-screen planner**: every bill for the horizon, every
payday's projected position, and every check's commitments — visible at once, no scrolling, no
drilling. The shipped S7 view carries the same data but as a **vertical stack of per-check
sections**, and it lives as a tab inside Insights. The owner's 2026-07-06 feedback: the stack
loses the at-a-glance whole-horizon read, the surface is buried, and two of the sheet's
running figures (the remaining-to-pay countdown; the per-payday balance/funds ledger) were
dropped. This spec restores the planner shape — in app idioms, not the sheet's color-only
joins.

## 2. Entry points & navigation

- **Promoted to first-class:** route moves `/insights/pay-periods` → **`/pay-periods`** (old
  URL redirects); the Insights sub-nav drops the tab.
- **Sidebar (UXR1):** a **Pay periods** item in the **Planning** group (Templates · Recurring ·
  **Pay periods**) — the [UXR1 spec §2](app-shell-sidebar.md) is updated in the same change.
- **Cockpit:** the Upcoming panel (or a successor — the cockpit's own redesign item may
  supersede this) gains a **"Next paycheck"** deep-link line: date · committed total · headroom
  badge → `/pay-periods` (ships **in this slice** — §11 Q4, resolved).

## 3. Primary flow

1. User opens **Pay periods** from the sidebar → the planner renders the whole horizon on one
   screen: **Bills ledger** (left) and **Paycheck ledger** (right), side by side on desktop.
2. The user reads down the paycheck ledger — each payday's income, committed total, headroom,
   projected balance, and reserve — and sees the plan's viability at a glance (badges mark the
   first break).
3. The user selects a paycheck row → its covered bills **highlight** in the bills ledger
   (selection is an *addition* to the always-present "Covered by" text column, never the only
   join).
4. The user scans a bill's row to see when it's due, what covers it, and how much of the
   horizon's total remains from that point (the countdown).

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Bills ledger (left pane) | The sheet's "Monthlies" | Date-ordered bill occurrences: **bill · due · amount · left to pay · covered by**, with **month-boundary subtotal rows** and a pane-level **90-day left-to-pay figure** (§11 Q3 — both scopes); bucket-zero rows read "Current balance" in Covered by |
| Paycheck ledger (right pane) | The sheet's "PayDay / Balance / Funds" | One row per payday: **date · income · committed · headroom · projected balance · reserve · status badge**; a Planned-spending sub-line per check (the netted share) |
| Controls | Same as S7 | Account picker only (one-account convention); horizon fixed in V1 |

States (carried from the S7 spec, unchanged in meaning):

- **Loading** — `Skeleton` (polite "Loading…").
- **Error** — inline `role="alert"` failure note; chrome intact.
- **Empty (no income rule)** — `EmptyState`: "No expected paychecks — add a recurring
  **deposit** rule (e.g. your paycheck) to plan pay periods", linking to `/recurring`.
- **Empty (no bills)** — the paycheck ledger renders with planned spending only; the bills
  ledger shows "No bills in this horizon."
- **Populated** — §5. **Over-committed / Plan breaks here / Short / Covered** text badges carry
  over exactly (FEAT-S7 §5 overflow is never silent).

## 5. Wireframe / layout

Desktop (side-by-side; the two panes share one scroll — the point is one screen):

```
+------------------------------------------------------------------------------------+
| Pay periods                                            [ Account: Checking ▾ ]     |
| Next 90 days · paychecks every 2 weeks · +$2,452.91 each                            |
+------------------------------------------+-----------------------------------------+
| BILLS                                    | PAYCHECKS                               |
| Bill        Due     Amount  Left   Covered by | Payday   Income  Committed Headroom  Balance  Reserve        |
| Rent        Aug 1   $2,099  $6,519 Jul 24 ▒|▒ Jul 10  +$2,452  $2,180    +$272     $6,201   $1,369  Covered |
| 21st Mort.  Aug 1   $870    $4,420 Jul 24 ▒|  Jul 24  +$2,452  $2,415    +$37      $6,238   $1,406  Covered |
| Sandy Lake  Aug 1   $920    $3,550 Jul 24 ▒|  Aug 7   +$2,452  $2,433    +$19      $6,257   $1,425  Covered |
| Storage     Aug 2   $243    $2,630 Aug 7  |  Aug 21  +$2,452  $2,510    -$58      $6,199   $1,367  Plan    |
| Lending Cl. Aug 7   $650    $2,387 Aug 7  |                                          breaks here            |
| …           …       …       …      …      |  (selected payday ▒-highlights its      |
|                                           |   bills; "Covered by" text is the       |
|                                           |   permanent join — highlight is extra)  |
+------------------------------------------+-----------------------------------------+
  Left = the sheet's Total countdown, month-scoped (resets at each month boundary, with a
  subtotal row per month — the sheet's semantics); the whole-horizon total sits above the
  pane as a figure: "Left to pay, next 90 days: $X" (§11 Q3 — both scopes shown)
```

≤ 640px / narrow: the panes **stack** (Paychecks first — the viability read), each table in
its own `.table-scroll` reflow region (UX15 bar unchanged: no horizontal page scroll at 320px).

## 6. Interactions & inputs

- **Account picker** — unchanged from S7.
- **Paycheck selection** — each payday row carries a toggle (real button / `aria-pressed`, or a
  radio group): selecting highlights its bills in the bills ledger **and** announces the link
  ("Jul 24 check — covers 5 bills"). Deselect clears. Keyboard: fully operable; highlight is
  visible on focus paths too.
- **No drag/move** — pinning a bill to a different check is still the FEAT-S7 §8 assignment
  store (explicitly out of scope; the trigger is unchanged).
- **Edge inputs:** many bills per check (the month-boundary cluster) — the bills pane scrolls
  within itself if the horizon overflows the viewport, paychecks stay visible; $0 planned
  spending omitted (S7 convention); negative headroom always signed + badged.

## 7. Content & copy

- Page title: **Pay periods** (route `/pay-periods`).
- Column headers: Bill · Due · Amount · **Left to pay** · **Covered by** ‖ Payday · Income ·
  Committed · Headroom · **Balance** · **Reserve** · Status.
- "Covered by" values: the covering payday ("Jul 24 check") or **"Current balance"** (bucket
  zero).
- Bills-pane figures: **"Left to pay, next 90 days: $X"** (pane header); month subtotal rows:
  **"<Month> remaining: $X"**.
- Badges (carried from S7): **Covered · Plan breaks here · Short · Over-committed**.
- Empty copy carried from the S7 spec verbatim (§4).

## 8. Accessibility

Baseline **WCAG 2.2 AA**, axe-clean light AND dark (the existing gate):

- The **join is never color/highlight alone**: "Covered by" is a permanent text column;
  selection-highlight is additive (WCAG 1.4.1) and pairs with a text/`aria-pressed` state.
- Two real tables with proper headers; the panes are labeled regions; one `<h1>`/`<h2>` per
  the shell's heading rule (UXR1 §11 Q3 outcome applies here).
- Selection toggles are real buttons with accessible names ("Highlight bills covered by the
  Jul 24 check"); state announced politely.
- Running figures (`Left to pay`, `Reserve`) are plain table text — readable in row context by
  a screen reader, same order as the sighted read.
- Reflow per UX15: `.table-scroll` keyboard-focusable regions; panes stack ≤ 640px; no
  horizontal page scroll at 320px. No new animation.

## 9. Acceptance criteria (UX)

- **Given** an income rule + bills, **when** `/pay-periods` loads, **then** the full horizon is
  visible as the two ledgers (desktop side-by-side), each payday row showing income ·
  committed · headroom · balance · reserve · status.
- **Given** a paycheck row is selected, **then** its bills highlight **and** the "Covered by"
  column already names that check (join readable with zero interaction).
- **Given** any bill row, **then** "Left to pay" equals the sum of that bill and all later
  bills **in its month** (resets at month boundaries — the sheet's Total semantics), **and**
  the pane-level figure shows the 90-day total (both reconcile to the ledger; spot-checkable
  against the bucket totals).
- **Given** the first non-viable check, **then** its row reads **Plan breaks here** (text
  badge), subsequent shortfalls read **Short** — never color alone.
- `/insights/pay-periods` redirects to `/pay-periods`; the sidebar's Planning group shows the
  active item; e2e re-pointed.
- Axe green light AND dark; 320px reflow holds with the stacked panes.

## 10. Out of scope / later

- **Assignment policy & pinning** — balanced latest-fit stands as shipped; the FEAT-S7 §5
  ratify/veto and the §8 assignment store remain separate, open roadmap decisions.
- **`leadDays` / horizon controls, multi-account plans** — unchanged S7 V1 exclusions.
- **A headroom sparkline/chart** — still the noted follow-on (reusing `LineChart`).
- **The cockpit's own redesign** — only the one "Next paycheck" deep-link line here; the
  cockpit page is its own capture item.

## 11. Open questions (owner) — all resolved 2026-07-06

| # | Question | Resolution |
| - | -------- | ---------- |
| Q1 | **Balance & Reserve definitions** — sheet's *Balance* = projected account balance at each payday; *Funds* ≈ accumulated leftover. App equivalents: projected balance from the shared projection inputs (the forecast's math), and *Reserve* = running Σ of per-check headroom. Are those the two figures you want, defined that way? | **Resolved 2026-07-06 (owner): yes as proposed.** Owner confirmed *Funds* meant accumulating leftovers and **Reserve** is the right name for it; Balance = projected payday balance (forecast math). Pinned exactly in FEAT-UXR2. |
| Q2 | **Where the new figures come from** — additive fields on `GET /analysis/pay-periods` (server derives; one read) vs. client-side compose with the existing forecast read (R4/R5 fan-out precedent; zero API change). | **Resolved 2026-07-06 (owner): API-provided** — additive fields on `GET /analysis/pay-periods` (same `gatherProjectionInputs`, one reconcilable read); `06_API_CONTRACT` updated in the same change. |
| Q3 | **"Left to pay" scope** — Σ to the end of the 90-day horizon (as specced), or month-scoped like the sheet's Total column (resets each month, kin to S9's still-owed)? | **Resolved 2026-07-06 (owner): both scopes shown.** The column is **month-scoped** (the sheet's Total semantics, resetting at month boundaries, with a subtotal row per month); the **90-day total** is a pane-level figure ("Left to pay, next 90 days: $X"). |
| Q4 | **Cockpit tie-in now or later** — add the "Next paycheck" line to the Upcoming panel in this slice, or leave it to the cockpit's own redesign item? | **Resolved 2026-07-06 (owner): in this slice** — the Upcoming panel gains the Next-paycheck line with UXR2. |
