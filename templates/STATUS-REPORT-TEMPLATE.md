<!--
STATUS REPORT TEMPLATE — copy to docs/status-reports/<YYYY-MM-DD>-NN.md. A point-in-time
snapshot for clean hand-offs between work sessions / context windows. Optimized for a
fresh reader (or agent) to resume cold.
-->

# Status Report — <YYYY-MM-DD> (#NN)

| Field  | Value                                  |
| ------ | -------------------------------------- |
| Status | Snapshot                               |
| Date   | <YYYY-MM-DD>                           |
| Author | <name / agent>                         |
| Scope  | <what this report covers / delta since last> |

**Resume here:** one paragraph telling a cold reader exactly where things stand and what
to do next.

## 1. What landed since the last report

| Item | Notes | Source (spec/slice) |
| ---- | ----- | ------------------- |
| …    | …     | …                   |

## 2. Definition of Done — current state

| Check | State | Evidence |
| ----- | ----- | -------- |
| Acceptance criteria met & tested | ✅ / ⚠ / ❌ | … |
| Gate green (types/lint/format/tests/e2e/build) | … | … |
| Usable end-to-end (data→API→UI) | … | … |
| Docs updated in same change | … | … |
| Security (input/authz/secrets) | … | … |

## 3. Test totals

| Surface | Prev | Now | Δ |
| ------- | ---- | --- | - |
| Unit + integration | … | … | … |
| E2E | … | … | … |

## 4. Manual carries / deferred

| Item | Why | Owner / when |
| ---- | --- | ------------ |
| …    | …   | …            |

## 5. Outstanding & next steps

- …

## 6. Commands & gotchas (cold-start)

```sh
# install / run / test / build — the project's exact commands
```
- Gotchas a fresh session needs to know.
