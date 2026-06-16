<!--
STATUS REPORT TEMPLATE — copy to docs/status-reports/<YYYY-MM-DD>-NN.md. A point-in-time
snapshot for clean hand-offs between work sessions / context windows. Optimized for a
fresh reader (or agent) to resume cold.

WHEN: write one at the END OF EVERY EXECUTED BLOCK — a spike, a vertical slice, or a phase
(see docs/00_WAYS_OF_WORKING.md §9). Its SPINE is the Definition of Done (§2 below, mirroring
00 §5 / ENGINEERING_STANDARDS §2): report each DoD check as ✅/⚠/❌ WITH EVIDENCE; keep
deferred checks visible (⚠ + reason + owner) so the snapshot never overstates "done." Close
with the test-count delta and a one-line Conventional-Commit summary.

HANDOFF: at a roadmap milestone the project must be resumable cold — so END THE REPORT WITH
§7, a copy-pasteable "Next-session kickoff prompt" for the next item (00 §9). The newest
status report is both the handoff record and the launch pad for the next context window.
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

## 7. Next-session kickoff prompt

<!-- Required at a roadmap milestone. Paste-ready text to start the NEXT session on the NEXT
item — a specialization of the "Resume" prompt in KICKOFF-PROMPT.md. Name the next item, its
risks/unknowns, any new setup, and the current gate command. Omit only for a mid-block report
where the next step is obvious and same-session. -->

```text
You are resuming <PROJECT> (built from the baseline starter kit) in a fresh context window.
Get your bearings first:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST file in docs/status-reports/ (this report) — its "Resume here" has state.
- Read docs/03_ROADMAP.md — the next item is <#/ID + one-line goal>.

Next milestone: <ID — what it delivers, vertically>. Watch out for: <risks / unknowns /
new setup, e.g. a new dependency or running stack>. Gate: <exact gate command(s)>.

Confirm, in your own words, where things stand and the plan (and its risks) before building.
Keep it vertical and gate-green; update docs in the same change; and at the end, leave the
project handoff-ready with the next-session kickoff prompt (for <following item>) in the
status report.
```
