# Intake — TaskJot

> **Example** — a filled [`docs/01_INTAKE.md`](../../docs/01_INTAKE.md) for the *TaskJot*
> toy project. See [`examples/README.md`](../README.md).

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Proposed                               |
| Owner        | A. Maker                               |
| Facilitated  | A. Maker + agent                       |
| Last updated | 2026-06-12                             |

**Resume here:** TaskJot is a keyboard-first personal task list. The bet is that making
*capture* near-frictionless (no mouse, one input, instant) is what makes people keep using
a todo app past the first week. The single most important unknown: **is low-friction
capture actually the thing that drives sustained use, or is it something else?** That's the
first spike.

---

## 1. Problem & why now

People start todo apps and abandon them within days. The recurring complaint isn't missing
features — it's that *adding* a task is slow enough that thoughts get lost before they're
captured, so the list goes stale and trust in it collapses. Now: the maker keeps abandoning
their own tools for exactly this reason and wants to test whether removing capture friction
fixes it.

## 2. Users & context

A single individual (initially the maker), keyboard-driven, at a desk, capturing tasks in
the middle of other work. No collaborators. No mobile context in v1.

## 3. The value hypothesis (the core bet)

> If we ship **single-input, no-mouse task capture**, users will **keep their list current
> past week one**, which is worth it because **a trusted list is the whole value of a todo
> app**.

- **How we'd know it paid off:** tasks are still being captured daily in week 2; the user
  reports trusting the list.
- **Validation status:** ☑ spike named below (unproven until then).

## 4. Riskiest assumptions & the spikes they imply

| # | Assumption (what we believe) | Have we looked? | Cheapest way to check (→ spike) | Spike type |
| - | ---------------------------- | --------------- | ------------------------------- | ---------- |
| 1 | Low-friction *capture* is the differentiator that drives sustained use | No | 3-day prototype test with ~5 people; measure capture rate + week-2 retention | value-hypothesis |
| 2 | A global system-wide hotkey is needed for capture to feel frictionless | No | Include both inline and global-hotkey capture in the prototype; see which they use | (folded into spike 1) |

**First spike to run:** value-hypothesis — *"Does near-frictionless capture make people
keep their list current?"* — see
[`spikes/01-quick-capture-value.md`](spikes/01-quick-capture-value.md).

## 5. Scope sketch & explicit non-goals

- **In scope (value/uncertainty-ordered):** capture a task · see the list · complete a task.
- **Non-goals:** collaboration/sharing · cloud sync · a mobile app · due dates/reminders ·
  projects/tags (all deferred until the core loop is proven).

## 6. Constraints

| Area | Notes |
| ---- | ----- |
| Data sensitivity | Task text only; single-user; **local-first** — nothing leaves the device. No accounts, no PII beyond free text. |
| Compliance / legal | None at this scale. |
| Stack leanings & constraints | Local-first, single user → a small runtime + a local store. Decided in `ADR-0001` (illustrative), not here. |
| Non-functional needs | Capture must feel instant (sub-100 ms perceived). Tiny data volumes. |
| Timeline / team / budget | One maker, evenings; aim to prove or kill the bet in ~2 weeks. |

## 7. First usable slice

A single screen: an always-focused capture input above a list of tasks; press a key, type,
Enter to add; the task appears instantly. That's the thinnest end-to-end loop a person can
actually use and react to. The "foundation" is just the app shell + a local store.

## 8. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| Is week-2 retention measurable with ~5 testers, or do we need more? | A. Maker | open |
| Does "complete" need to be as fast as "capture"? | A. Maker | open (spike may answer) |

## 9. Outputs & next steps

- [x] **Run the first spike:** value-hypothesis on quick capture →
      [`spikes/01-quick-capture-value.md`](spikes/01-quick-capture-value.md).
- [x] **Write the PRD** once the bet is de-risked → [`02_PRD.md`](02_PRD.md).
- [x] **Draft the roadmap** → [`03_ROADMAP.md`](03_ROADMAP.md).
- [x] **Open `ADR-0001` (stack)** → [`adr/ADR-0001-stack.md`](adr/ADR-0001-stack.md).

> Pre-PRD map; stays `Proposed` until the spike validates the bet. Produced via
> [`../../templates/DISCOVERY-GUIDE.md`](../../templates/DISCOVERY-GUIDE.md).
