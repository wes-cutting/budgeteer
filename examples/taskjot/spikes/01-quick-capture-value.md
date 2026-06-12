# SPIKE-01: Does near-frictionless capture make people keep their list current?

> **Example** — a filled
> [`SPIKE-REPORT-TEMPLATE`](../../../templates/SPIKE-REPORT-TEMPLATE.md) for *TaskJot*.
> See [`examples/README.md`](../../README.md).

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Status     | Done                                                        |
| Type       | Value-hypothesis                                            |
| Owner      | A. Maker                                                    |
| Time-box   | 3 days (5 testers) — honored                                |
| Date       | 2026-06-10                                                  |
| Blocks     | The PRD's value hypothesis; the roadmap sequencing          |

## 1. The question

**Will single-input, no-mouse capture make people keep their task list current past the
first few days — and is a *global* hotkey necessary for it to feel frictionless?**

## 2. Method

A clickable prototype (not production) with two capture paths: (a) an always-focused inline
input on the list screen, and (b) a global system hotkey that pops a capture box over any
app. Five people used it for their real tasks for three days. We logged tasks captured per
day and which path they used, and asked each on day 3 whether they still trusted the list.
Deliberately **not** built: storage durability, completion flows, any styling polish.

## 3. Findings

- 4 of 5 were still capturing tasks on day 3 (median 6 tasks/day); the 5th dropped out
  citing "nothing to add this week," not friction.
- Capture path usage: **inline 86%, global hotkey 14%.** Most testers forgot the hotkey
  existed after day 1; the always-present inline input was where capture actually happened.
- Unprompted, 3 of 5 asked "how do I *check things off* quickly?" — completing felt as
  urgent to them as capturing.

### Confirmed
- Low-friction capture drives sustained capture: people kept using it past day 1 because
  adding was instant. (Moves the PRD value hypothesis toward `Validated`.)

### Invalidated
- **A global system hotkey is not the differentiator.** Inline, always-focused capture was
  sufficient and is where ~6/7 captures happened. Building the global hotkey first would
  have been wasted, higher-risk work.

### Surprises / unknowns uncovered
- **One-key complete** matters nearly as much as capture. Not in the original first slice —
  may deserve its own small follow-up once the loop exists.

## 4. Recommendation / decision

- **Build:** inline always-focused capture + the list, then **one-key complete** as the
  very next slice.
- **Don't build (now):** the global system hotkey — defer; it's a small fraction of use.
- No follow-up spike needed before the PRD; the bet is sufficiently de-risked to write it.

## 5. Impact on the plan

- **Specs/ADRs affected:** PRD value hypothesis → `Validated`; capture is the foundation
  slice.
- **Scope changes:** global hotkey **deferred** (out of v1 scope); one-key complete
  **pulled forward** to slice 2.
- **Sequencing changes:** complete-a-task moves ahead of list filtering/sorting.

## 6. Follow-ups

- [x] Write [`../02_PRD.md`](../02_PRD.md) with the validated hypothesis.
- [x] Re-sequence [`../03_ROADMAP.md`](../03_ROADMAP.md): complete-a-task to slice 2;
      hotkey to "later".
