<!--
SPIKE REPORT TEMPLATE
A spike is a time-boxed, throwaway investigation that answers ONE question against
reality before we commit to a spec/ADR or build on an assumption (see
docs/00_WAYS_OF_WORKING.md §6). Copy this file to docs/spikes/<id>-<slug>.md.
The spike's CODE is disposable; this report is the deliverable. Keep it short.
-->

# SPIKE-<id>: <one-line title>

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Status     | Open · Done                                                 |
| Type       | Data-profiling · Value-hypothesis · Technical/feasibility · UX · Integration |
| Owner      | <name>                                                      |
| Time-box   | <e.g. 4 hours / 1 day> — state it up front and honor it     |
| Date       | <YYYY-MM-DD>                                                |
| Blocks     | <which spec/ADR/slice this must answer before it can start> |

## 1. The question

State the single, falsifiable question this spike answers. Good questions are sharp:
- "Does the legacy data source's totals column reconcile from its own line items?"
- "Will users actually <do the thing> if we ship <the cheapest version>?"
- "Can library <Y> read <the real file/endpoint> correctly?"

A spike with more than one question is two spikes.

## 2. Method

How you'll answer it, against **real** inputs (real data sample, real API, real users).
**Name the concrete reality source** (which file, which endpoint, which store) and **state
how you'll confirm it actually contains the reality you need** (e.g. "N real rows covering
the real date range") *before* running the spike — a source that turns out empty or
synthetic doesn't fail loudly, it just validates vacuously and ships a wrong conclusion with
a confident report around it (SPIKE-10, K25). Note what you will deliberately *not* do (this
is throwaway, not production).

## 3. Findings

What you actually observed. Be concrete — paste the real numbers, shapes, errors,
screenshots. Distinguish facts from interpretation.

- …

### Confirmed
- Assumptions that held. (These can move a spec toward `Validated`.)

### Invalidated
- Assumptions that were **wrong**. (These are the gold — they're why we spike.)
- …

### Surprises / unknowns uncovered
- New questions this raised (each may need its own spike).

## 4. Recommendation / decision

The concrete call this spike enables:
- What to build / not build, or what the spec/ADR should say.
- What to change about the plan, scope, or sequencing.
- Whether a follow-up spike is needed before deciding.

## 5. Impact on the plan

- **Specs/ADRs affected:** <list> → promote to `Validated`, rewrite, or reject.
- **Scope changes:** <added / removed / deferred>.
- **Sequencing changes:** <what should now happen earlier/later>.

## 6. Follow-ups

- [ ] <new spikes, spec edits, or slices created from this>
