<!--
UX SPEC — Slice 2: allocation templates + editor accelerators. Built BEFORE the slice
(Definition of Ready). Pairs with FEAT-004. Reuses the Slice 1 AllocationEditor.
-->

# UX Spec — Allocation templates & accelerators

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| Status       | Accepted                                         |
| Feature      | FEAT-004 ([feature spec](../features/templates.md)) |
| Owner        | Wesley Cutting                                   |
| Last updated | 2026-06-13                                       |

## 1. User & job

The user funds a recurring paycheck across many envelopes without re-typing ~12 rows every
time: save the split once as a **template**, then **apply → tweak → save**. Two smaller
helpers cut friction further: **distribute remaining** and **keyboard-first** rows. Ties to
the PRD bet (templates were the chosen slog-killer in SPIKE-01).

## 2. Entry points & navigation

- A **Templates** screen reached from the Dashboard ("Templates"), for managing templates.
- Inside the **AllocationEditor** (add-transaction and allocate-later): an **Apply
  template** picker, a **Save as template** action, and a **distribute remaining** button.

## 3. Primary flow

1. (Once) On the Templates screen, create "Paycheck" with fixed lines (Rent 1400, Savings 800…).
2. Adding a paycheck deposit → in the editor, pick **Apply template → Paycheck**: Split mode
   fills with those rows; `Remaining` updates.
3. Tweak a row / **distribute remaining** / **use remaining**; Save (partial allowed).
4. Or build a split manually and **Save as template** for next time.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| Templates | Manage templates | List (name · line count · total); create form (name + rows of envelope+amount); rename; delete |
| AllocationEditor (extended) | Apply/save templates; accelerators | "Apply template ▾"; "Save as template"; "distribute remaining"; Enter-adds-row |

States:
- **Empty** — Templates: "No templates yet — save a split to reuse it." Editor picker with no
  templates: the "Apply template" control is hidden/disabled.
- **Loading** — list skeleton.
- **Populated** — templates listed; editor picker lists them by name.
- **Error** — inline under the field/form; input preserved (e.g. duplicate name, bad amount).
- **Success** — created/applied reflected immediately (reduced-motion highlight).
- **Permission-limited** — n/a (single household).

## 5. Wireframe / layout

```
TEMPLATES                                   [ ← Dashboard ]
─────────────────────────────────────────────────────────
  Paycheck        12 lines · $3,200.00     [Rename] [Delete]
  Rent only        1 line  · $1,400.00     [Rename] [Delete]
  ─────────────────────────────────────────────────────────
  NEW TEMPLATE
   Name [ Paycheck ]
   [ Rent      ▾ ] [ 1400.00 ]  ✕
   [ Savings   ▾ ] [  800.00 ]  ✕
   [ + add line ]                         [ Save template ]

ALLOCATION EDITOR (Split)
  [ Apply template ▾ Paycheck ]   [ Save as template ]
  ...rows...
  Allocated $2,200.00 · Remaining $1,000.00   [ distribute remaining ]   [ Save ]
```

## 6. Interactions & inputs

- **Apply template:** a select of template names; choosing one switches the editor to **Split**
  and replaces rows with the template's `{envelope, amount}` lines (amounts as plain decimals).
- **Save as template:** prompts for a unique name; persists the current non-empty split rows.
- **distribute remaining:** spreads the current `Remaining` **evenly across rows that have an
  envelope**, exact to the cent (±1¢ across rows); no-op with a hint if none.
- **Keyboard-first:** **Enter** in the last row's amount adds a new empty row and focuses it;
  Tab moves field→field as normal.
- Validation mirrors the server: name required/unique; line amounts > 0; envelope chosen.

## 7. Content & copy

- Apply control: **"Apply template"**; Save: **"Save as template"**; **"distribute remaining"**.
- Templates empty: **"No templates yet — save a split to reuse it."**
- Name error: **"A template with that name already exists."** / **"Name is required."**
- Zero lines: **"Add at least one line."**

## 8. Accessibility

Baseline **WCAG 2.2 AA**: the apply control is a labeled `<select>`; "save as template" and
"distribute remaining" are labeled buttons; Enter-to-add-row keeps the flow keyboard-only;
visible focus; errors associated with their field and announced politely; the Slice 1 editor
a11y rules carry over.

## 9. Acceptance criteria (UX)

- **Given** a "Paycheck" template, **when** applied to a `3200` deposit, **then** Split rows
  fill from it and `Remaining` reflects the difference.
- **Given** a partial split, **when** I click distribute-remaining, **then** `Remaining`
  becomes `0.00`.
- **Given** the last row, **when** I press Enter in its amount, **then** a new row is focused.
- **Given** current rows, **when** I save-as-template with a unique name, **then** it appears
  on the Templates screen.
- Empty/error states render as specified; a11y checks pass.

## 10. Out of scope / later

Percentage/both template lines; direction-specific or auto-applied templates; edit-a-past-split (#5).
