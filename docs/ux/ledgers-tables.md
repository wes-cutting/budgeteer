<!--
UX SPEC — UXR3 (2026-07-06 UX Redesign): the three Ledgers-group pages trade list markup for
real tables. Presentation only — behaviors carry. §11 call: build detail lives here; no
separate feature spec (no new logic). Initiative brief:
reviews/2026-07-06-ux-redesign-initiative.md.
-->

# UX Spec — Ledgers tables (Accounts · Envelopes · Needs allocation)

| Field        | Value                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Status       | Implemented                                                              |
| Feature      | UXR3 (presentation-only; no separate feature spec — §11 compression)     |
| Owner        | Wesley Cutting                                                           |
| Last updated | 2026-07-07                                                               |
| Related      | [initiative brief](../reviews/2026-07-06-ux-redesign-initiative.md) · [UXR1 shell](app-shell-sidebar.md) (the Ledgers nav group; the Q2 Accounts-page button) · carries [foundation UX](foundation.md) behaviors |
| Gated by     | UXR1 (sequence — tables render inside the new chrome)                    |

## 1. User & job

The three Ledgers pages are scan-and-act surfaces: find an account/envelope/waiting
transaction, read its numbers, act on its row. Today they render as lists with inline
controls; tables give the numbers columns to line up in (the reference look) and make the row
actions predictable.

## 2. Scope

**Presentation only.** Every behavior carries unchanged: UX6 progressive Add, inline rename,
archive/unarchive + the "Show archived" toggle, the R5 inline budget controls on Envelopes,
the allocate flow, the nav count badge, all existing copy and confirmation flows. The exact
control set per row is **verified against the components at build**
(`AccountsList` · `EnvelopesList` · `NeedsAllocation`) — this spec restructures, it does not
re-inventory.

## 3. Tables

| Page | Columns | Row actions (carried) |
| ---- | ------- | --------------------- |
| Accounts | Name (link → register) · Kind · Balance | Rename · Archive/Unarchive |
| Envelopes | Name (link → ledger) · Kind · Balance · Target · Spent · Remaining | Rename · budget set/edit (R5) · Archive |
| Needs allocation | Date · Payee/memo · Account · Amount | Allocate (→ the editor flow, unchanged) |

- Money columns right-aligned, monospaced (existing convention); negatives signed, never
  color-only.
- Envelope Target/Spent/Remaining render only when a target is set (the R5 rule — no faked
  `$0`); untargeted rows show "—".
- Archived rows stay a separate section/table behind the existing toggle, not mixed in.
- **Accounts page additionally gains the page-local “Add transaction” button** in its page
  header (the additive half of [UXR1 §11 Q2](app-shell-sidebar.md)) → the UX7 modal route.

## 4. States

Carried per page: **Loading** — `Skeleton` rows in the table body. **Empty** — the existing
`EmptyState` copy (no table chrome around an empty state). **Error** — the existing
`role="alert"` banner. **Populated** — §3. No new states.

## 5. Accessibility

- Real tables: `<th scope="col">` headers; the name cell is the row's link (≥ 24px target).
- Row actions keep per-row accessible names ("Rename Checking", "Allocate <payee>").
- Reflow (WCAG 1.4.10): each table in the global `.table-scroll` keyboard-focusable region
  (the UX15 utility); no page scroll at 320px.
- Axe light AND dark on all three pages (existing suite, re-run against the new markup).

## 6. Acceptance criteria (UX)

- **Given** each page, **then** the data renders as a real table per §3 with all §2 behaviors
  intact (rename, archive+toggle, R5 budget, allocate) — existing unit/e2e specs pass with
  selectors re-pointed, no flow rewritten.
- **Given** the Accounts page, **then** its header shows **Add transaction** → the quick-add
  modal opens and returns (UX7 semantics).
- Empty/loading/error render per §4; axe light+dark green; 320px reflow holds.

## 7. Out of scope

Sorting/filtering/pagination (nothing needs it at household scale — add only when felt) ·
column customization · any data/API change · the register/ledger detail pages (unchanged).

## 8. As built (2026-07-07)

Presentation-only, as specced — no data/API/domain touched. Notes on how the plan met reality:

- **One shared treatment:** [`Ledgers.module.css`](../../apps/web/src/Ledgers.module.css) — a new
  scoped module (`.table` · `.numeric` · `.actions` · `.subNote`) imported by all three pages. Kept
  separate from UXR2's `Insights.module.css` (which owns the pay-period ledgers) so the two never
  entangle; both derive from the same tokens, so the look matches. Each table sits in the global
  `.table-scroll` focusable region (base.css, UX15).
- **Tables (§3):** columns per spec, `<th scope="col">` headers, money cells right-aligned/tabular
  and signed; an **Actions** column carries the row controls. Accounts/Envelopes promote the name
  cell to `<th scope="row">` (the row's `<Link>`); inline rename swaps that cell for the input+Save.
  Needs allocation uses column headers only (a waiting txn has no stable identifier to promote).
  Each table is named by a `sr-only <caption>`.
- **R5 (Envelopes):** Target/Spent/Remaining are three columns, showing figures only when a target
  is set and **"—" otherwise** (no faked $0) — verified live against the demo seed.
- **Needs allocation:** gains the **Date** column the spec lists (`occurredOn`, already in the read,
  no API change) and keeps the list's **"needs $X"** remainder as a muted second line under Amount
  (`.subNote`) so no information the list showed is lost. The Allocate editor
  (`InlineAllocationEditor`, unchanged) expands inside the row's Actions cell.
- **Accounts "Add transaction":** a page-local `<Link>` → `/transactions/new` (the UX7 modal route),
  the additive half of [UXR1 §11 Q2](app-shell-sidebar.md). Rendered `default`-variant so the page's
  accent primary stays **Add account**. The sidebar's own Add-transaction link is unaffected.
- **A11y:** archived rows stay a separate named table (Accounts behind the Show-archived toggle;
  Envelopes always-shown Archived section). axe light+dark re-run against the new markup; 320px
  reflow verified — the page holds at 320px while the `.table-scroll` region scrolls.
