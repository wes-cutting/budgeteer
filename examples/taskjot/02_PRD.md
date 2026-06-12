# Product Requirements — TaskJot

> **Example** — a filled [`PRD-TEMPLATE`](../../templates/PRD-TEMPLATE.md) for *TaskJot*.
> See [`examples/README.md`](../README.md).

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Validated                              |
| Owner        | A. Maker                               |
| Last updated | 2026-06-11                             |

## 1. Problem & why now

People abandon todo apps because *capturing* a task is slow enough that thoughts are lost
and the list goes stale, breaking trust. TaskJot tests whether near-frictionless capture
fixes that — proven worth pursuing by [`SPIKE-01`](spikes/01-quick-capture-value.md).

## 2. Users

A single keyboard-driven individual capturing tasks mid-work at a desk. No collaborators,
no mobile use in v1.

## 3. Goals

- Capture a task in one input, no mouse, perceptibly instant.
- Keep the list trustworthy: what you add stays, what you finish clears.
- Stay out of the way — zero setup, local-first.

## 4. Non-goals (explicit)

Collaboration/sharing · cloud sync · mobile app · due dates/reminders · projects/tags ·
a global system-wide capture hotkey (spike showed inline capture suffices). Each may return
*after* the core loop proves out.

## 5. Success metrics / value hypothesis

> If we ship single-input, no-mouse capture, users keep their list current past week one.

Measured by: daily capture continuing into week 2; user reports trusting the list.
**`Validated`** by [`SPIKE-01`](spikes/01-quick-capture-value.md) (4/5 testers still
capturing on day 3; inline capture preferred 6:1 over a hotkey).

## 6. User journeys

These drive the e2e tests:

1. **Capture** — focus the input, type, Enter; the task appears instantly.
2. **Complete** — one keystroke marks the focused task done; it clears from the active list.
3. **Review** — see the current list of active tasks at a glance.

## 7. Scope (high level)

Ordered by value/uncertainty, per the spike:

1. Foundation: app shell + local store.
2. **Capture a task** (slice 1).
3. **Complete a task**, one-key (slice 2 — pulled forward by the spike).
4. Review/list with basic filtering (slice 3).

## 8. Risks & assumptions

- Week-2 retention measured with ~5 testers is directional, not conclusive — treat as a
  signal, re-test if the loop expands. (Spike 1.)
- Local-first means no backup unless we add export; flagged for the NFR/hardening phase.

## 9. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Do we need an export/backup before "real" daily use? | A. Maker | open → NFR |
| Does list filtering earn its slice, or is a flat list enough for v1? | A. Maker | open |
