<!--
UX SPEC — UX7: a global "add a transaction" entry as an accessible modal route that reuses the
register's allocation editor (with an added account picker) and returns you where you were.
Pairs with FEAT-UX7.
-->

# UX Spec — Global quick-add transaction (`/transactions/new`)

| Field        | Value                                                            |
| ------------ | --------------------------------------------------------------- |
| Status       | Accepted                                                        |
| Feature      | FEAT-UX7 ([feature spec](../features/quick-add-transaction.md)) |
| Owner        | Wesley Cutting                                                  |
| Last updated | 2026-06-28                                                     |

## 1. User & job

Recording a transaction is **the most common thing** a user does — yet it lived **inside one account's
register**: you had to navigate to the right account before you could even start. UX7 makes "add a
transaction" a **first-class, always-available action**: one click from anywhere opens a modal where
you **choose the account**, enter the amount/payee, and allocate — then drop back to whatever you were
looking at. Same editor, same allocation model; just no longer buried.

## 2. Entry points & navigation

- The persistent shell nav (UX3) gains an **Add transaction** action, styled as the nav's **primary
  action** (accent fill) and placed first — always visible on every screen.
- Activating it opens the **modal route** `/transactions/new` **over** the current page. The URL is
  real (deep-linkable / shareable), but the experience is a dialog, not a full page swap.
- **Closing** (Save, `Esc`, overlay click, ×, or Cancel) **returns you to where you were** (history
  back). A direct deep-link with no in-app history falls back to the home.

## 3. Screen & states

A centered **dialog** over a dimmed overlay; the page behind is inert while it is open.

- **Title** `Add a transaction` (the dialog's accessible name) + a one-line description, and a corner
  **× Close**.
- **Form** (`Add transaction`) — reused from the register, with one addition at the top:
  - **Account** — a labelled `<select>` of your **active** accounts, defaulting to "Choose an
    account…". *(This is the only field the register doesn't have — it already knows its account.)*
  - **Type** — Deposit / Withdrawal (defaults to Withdrawal, the common "I spent" case).
  - **Amount · Date · Payee.**
  - **Allocate** — the full editor: **Single** (whole amount → one envelope) or **Split** (rows with a
    live `Allocated / Remaining`, use-remaining, distribute, refund rows, apply-template) — verbatim.
  - **Save transaction** — **disabled until an account is chosen** (and the editor's existing
    amount/allocation guards); on success the modal closes and returns you.
- **States:**
  - **Loading** — a skeleton while accounts/envelopes load.
  - **No accounts** — "You need an account first." with a `<Link>` to `/accounts` (no dead form).
  - **Error** (load or save) — a `role="alert"` message inside the dialog; the modal stays open.
  - **Partial allocation** — allowed; on save the **remainder** lands in **Needs allocation** (the
    shell badge + `/needs-allocation`), exactly as the register's partial does.

## 4. Accessibility

- The dialog is a **`role="dialog"` with an accessible name** (`aria-labelledby` → the title) and a
  description; built on **Radix** (`ADR-0005`) so it **traps focus**, closes on **`Esc`** / overlay
  click, and **restores focus** to the trigger on close. The background is made inert.
- The **Add transaction** trigger lives in the persistent nav, so it stays mounted across the route
  change — focus returns to it cleanly on close.
- The account picker is a **labelled native `<select>`**; Save's disabled state is conveyed by the
  control, not color; **color is never the sole signal** anywhere in the form.
- **No opacity animation on a text wrapper** (the axe contrast gate); the Radix portal escapes the
  shell's transform so there is no fixed-in-transform glitch. `prefers-reduced-motion` honored.
- **Axe-clean (WCAG 2.2 AA) in light AND dark** with the modal **open** (`e2e/a11y.spec.ts`).

## 5. Out of scope

Transfers / envelope reallocations / recurring from the modal (separate flows) · editing existing
transactions (register + Needs allocation) · a cockpit Needs-allocation-panel entry (shell-nav-only
chosen; the brief's "and/or") · charts / Insights (`UX8`).
