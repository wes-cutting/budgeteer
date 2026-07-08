<!--
UX SPEC — #6: archive an envelope. Dashboard active/archived split + picker filtering.
Pairs with FEAT-006.
-->

# UX Spec — Archive an envelope

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| Status       | Accepted                                           |
| Feature      | FEAT-006 ([feature spec](../features/archive-envelope.md)) |
| Owner        | Wesley Cutting                                     |
| Last updated | 2026-06-13                                         |

## 1. User & job

The user retires a finished sinking fund (or any unused envelope) so it stops cluttering the
pickers, while keeping its history; and can bring it back if needed.

## 2. Entry points & navigation

On the **Dashboard**, the Envelopes area splits into **Active** (each with an **Archive**
button) and **Archived** (each with **Unarchive**). Allocation/template pickers list **active**
envelopes only.

## 3. Primary flow

1. Dashboard → Envelopes → click **Archive** on an envelope → **a confirm dialog opens**
   ([FEAT-UX12](../features/destructive-confirms.md)); on **confirm** it moves to **Archived**
   (balance preserved) and leaves the pickers. Cancel/ESC dismisses with no change.
2. Later, click **Unarchive** → it returns to **Active** and the pickers.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Dashboard envelopes | Manage active vs archived | **Active** list (name · kind · balance · **Archive**); **Archived** list (name · balance · **Unarchive**) |

States:
- **Empty (active)** — "No envelopes yet — add your budget categories."
- **No archived** — the Archived section is hidden (or "No archived envelopes.").
- **Loading / Error** — as elsewhere (skeleton; inline `role="alert"`).
- **Success** — the envelope moves between sections immediately (reduced-motion).

## 5. Wireframe / layout

```
ENVELOPES                         [+ Add]
  Rent        standard  $0.00   [ Archive ]
  Groceries   standard  $0.00   [ Archive ]
  ── Archived ─────────────────────────────
  Vacation    sinking_fund  $0.00   [ Unarchive ]
```

## 6. Interactions & inputs

- **Archive** / **Unarchive** are per-row buttons; they call the API and refresh the list.
- Archived envelopes are **omitted** from the allocation editor and template pickers (the
  server also rejects allocating to them).

## 7. Content & copy

- Section headings: **"Envelopes"** (active) · **"Archived"**.
- Buttons: **"Archive"** / **"Unarchive"**.

## 8. Accessibility

The Archived list is its own labeled section/heading; Archive/Unarchive are labeled buttons;
status conveyed by section + text, not color alone; keyboard-operable.

## 9. Acceptance criteria (UX)

- **Given** an active envelope, **when** I Archive it, **then** it appears under **Archived**
  and not in the allocation picker.
- **Given** an archived envelope, **when** I Unarchive it, **then** it returns to **Active**
  and the picker.

## 10. Out of scope / later

Deleting envelopes; moving a balance on archive; archiving accounts; editing splits that
reference an archived envelope.
