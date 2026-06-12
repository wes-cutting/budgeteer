# Feature Spec — Capture a task

> **Example** — a filled [`FEATURE-SPEC-TEMPLATE`](../../../templates/FEATURE-SPEC-TEMPLATE.md)
> for *TaskJot*. See [`examples/README.md`](../../README.md).

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Feature ID   | FEAT-001                               |
| Status       | Proposed                               |
| Owner        | A. Maker                               |
| Last updated | 2026-06-12                             |
| Related      | PRD journey 1 (Capture) · [UX spec](../ux/capture-task.md) · [ADR-0001](../adr/ADR-0001-stack.md) |

## 1. Summary

The core slice: an always-focused input that turns a typed line + Enter into a persisted
task that appears in the list instantly, with no mouse.

## 2. Scope

- **In scope** — capturing a task from the inline input; persistence; instant display.
- **Out of scope** — completing tasks (FEAT-002), filtering, the global hotkey (deferred per
  [SPIKE-01](../spikes/01-quick-capture-value.md)).

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As a user, I want to type a task and press Enter so that it's saved without reaching for the mouse. | Must |
| US-2 | As a user, I want the input re-focused after adding so I can capture several thoughts in a row. | Must |

## 4. Acceptance criteria

- **Given** the app is open, **when** it loads, **then** the capture input is focused
  automatically.
- **Given** text in the input, **when** I press Enter, **then** a task is created, shown at
  the top of the list, the input clears and stays focused.
- **Given** an empty input, **when** I press Enter, **then** nothing is created (no blank
  tasks).
- **Given** a created task, **when** I reload the app, **then** the task is still there.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| Whitespace-only input | Treated as empty; no task created. |
| Very long text | Stored in full; list row truncates visually (full text on hover/focus). |
| Store write fails | Inline error; the typed text is preserved so nothing is lost. |

## 6. Data changes

Introduces the `Task` entity (see the domain/data docs when written):
`id`, `text` (non-empty), `status` (`active` | `done`), `createdAt`. This slice creates
`active` tasks only.

## 7. Interface changes

A capture input + a `createTask(text)` operation in the application layer that validates
non-empty text at the boundary and writes via the data layer. UI surface: the list screen —
see the [UX spec](../ux/capture-task.md).

## 8. Dependencies

Foundation slice (app shell + local store); [ADR-0001](../adr/ADR-0001-stack.md).

## 9. Security, privacy & accessibility

Single-user, local; task text is the only data and never leaves the device. Input is
keyboard-operable and labeled; see the UX spec's accessibility section.

## 10. Test plan

- **Unit:** `createTask` rejects empty/whitespace; trims; sets `active` + `createdAt`.
- **Integration:** a created task persists and reloads from the local store.
- **e2e:** load → type → Enter → task appears at top, input clears and stays focused;
  reload → still present. Includes an a11y check on the screen.

## 11. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Newest-first or oldest-first ordering in the list? | A. Maker | open (UX) |
