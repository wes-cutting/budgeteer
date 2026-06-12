# UX Spec — Capture a task

> **Example** — a filled [`UX-SPEC-TEMPLATE`](../../../templates/UX-SPEC-TEMPLATE.md) for
> *TaskJot*. See [`examples/README.md`](../../README.md).

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Proposed                               |
| Feature      | FEAT-001 ([feature spec](../features/capture-task.md)) |
| Owner        | A. Maker                               |
| Last updated | 2026-06-12                             |

## 1. User & job

A keyboard-driven user mid-work who needs to offload a thought into a trusted list without
breaking flow or reaching for the mouse. Ties to PRD journey 1 (Capture).

## 2. Entry points & navigation

- The app opens directly to the single list screen; the capture input is focused on load.
- There is nowhere else to go in v1 — this *is* the screen.

## 3. Primary flow

1. App opens → capture input is focused.
2. User types a task → presses Enter.
3. Task appears at the top of the list; input clears and stays focused.
4. User repeats for the next thought.

## 4. Screens & states

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| List screen | Capture + see active tasks | Capture input (top); list of active tasks below |

- **Empty** — no tasks yet: input focused; below it, "No tasks yet — start typing."
- **Loading** — reading the local store on open: input usable immediately; list shows a
  brief skeleton/placeholder (sub-100 ms typically).
- **Populated** — input on top; active tasks listed newest-first below.
- **Error** — store write failed: inline message under the input, typed text preserved,
  "Couldn't save — your text is still here. Try again."
- **Success / confirmation** — the new task animates in at the top; input clears (the
  appearance *is* the confirmation; respects `prefers-reduced-motion`).
- **Permission-limited** — n/a (single-user, local).

## 5. Wireframe / layout

```
+--------------------------------------------------+
|  What needs doing?  ____________________  [Enter] |
+--------------------------------------------------+
|  • Email the venue about dates                    |
|  • Draft the spike report                         |
|  • Buy more coffee                                |
+--------------------------------------------------+
```

## 6. Interactions & inputs

- **Input:** single line; non-empty required; whitespace-only is treated as empty.
- **Enter:** creates the task (optimistic — appears immediately; reconciles on store write).
- **Re-focus:** input keeps focus after submit for rapid successive capture.
- **Edge inputs:** very long text stored in full, truncated visually with full text on
  focus/hover.

## 7. Content & copy

- Input placeholder: **"What needs doing?"**
- Empty state: **"No tasks yet — start typing."**
- Save error: **"Couldn't save — your text is still here. Try again."**

## 8. Accessibility

Baseline **WCAG 2.2 AA**:
- The input has a visible label association (placeholder is not the only label).
- New-task arrival is announced to assistive tech (a polite live region), not conveyed by
  motion/color alone.
- Fully keyboard-operable (it's the point); visible focus ring; respects
  `prefers-reduced-motion` for the insert animation.

## 9. Acceptance criteria (UX)

- **Given** the app loads, **when** it's ready, **then** the capture input is focused.
- **Given** I submit a task, **when** it's added, **then** it appears at the top and the
  input clears and stays focused.
- The empty / loading / error states render as specified.
- The accessibility checks above pass on the screen.

## 10. Out of scope / later

Completing tasks (FEAT-002), filtering/sorting, and the deferred global capture hotkey.
