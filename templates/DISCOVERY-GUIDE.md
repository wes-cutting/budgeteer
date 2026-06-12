<!--
DISCOVERY GUIDE — carry as-is. This is the agent's playbook for running an intake
conversation with the human BEFORE any project template is filled in. It is read, not
filled in. Its output is captured in docs/01_INTAKE.md (copy from the skeleton there).
See docs/00_WAYS_OF_WORKING.md §9 (Working with the AI agent).
-->

# Discovery Guide — running the intake conversation

| Field   | Value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | Accepted                                                                 |
| Owner   | DrewskiLabs                                                              |
| Purpose | How the agent + human pair turn "I have an idea" into a captured intake. |

This is the **front door** of the kit. Before a PRD, a spec, or a single template is
filled in, the agent runs a discovery conversation with the human to surface the problem,
the people, the core bet, and — most importantly — the **riskiest unproven assumptions**.
The output is recorded in [`docs/01_INTAKE.md`](../docs/01_INTAKE.md), which then seeds the
PRD and names the first spike.

This guide is **carried as-is** and **read, not filled in.** It exists so the act of
"pairing with the agent to write the docs" has an actual starting move.

> **Why this comes first.** *Reality before paper* (see
> [`00_WAYS_OF_WORKING.md` §2](../docs/00_WAYS_OF_WORKING.md)) means the very first
> output is not a polished spec — it's an honest map of what we know, what we're betting
> on, and what we haven't yet looked at. Discovery produces that map.

---

## 1. How to run it

- **Conversation, not a form-dump.** Work one theme at a time (§3). Ask, listen, reflect
  back, then move on. Don't paste the whole question list at the human.
- **Challenge, don't transcribe.** Your job (per [§9](../docs/00_WAYS_OF_WORKING.md)) is to
  catch the flawed plan *before* it's executed flawlessly. When an answer assumes
  something unobserved ("the export has a clean total column", "users will obviously want
  this"), name the assumption and ask how we'd know.
- **Separate problem from solution.** Humans arrive with a solution. Walk it back to the
  problem and the person who has it. The solution is a hypothesis, not a given.
- **Capture as you go.** Fill [`docs/01_INTAKE.md`](../docs/01_INTAKE.md) live or right
  after, in the human's words. Mark anything unverified as a risk, not a fact.
- **Time-box it.** Discovery is a conversation, not a project. An hour or two, not a week.
  Unknowns that need real investigation become **spikes**, not longer meetings.

## 2. Operating principles

1. **Find the riskiest assumption.** Every idea rests on one or two things that, if false,
   sink it. Your single most valuable question is "what has to be true for this to work,
   and have we actually looked?"
2. **Name the cheapest validation.** For each risky assumption, what's the smallest, real
   test that would confirm or kill it? That's the first spike.
3. **Don't write the PRD yet.** Discovery feeds the PRD; it isn't the PRD. Resist
   designing the system. Stay at problem / people / bet / unknowns.
4. **Don't pick the stack yet.** Note leanings and constraints, but the stack is an ADR
   decision *after* a feasibility/UX spike (see [`ARCHITECTURE.md` §3](../docs/ARCHITECTURE.md)).
5. **Decided ≠ validated.** Everything that comes out of a conversation is `Proposed` at
   best. Reality checks come from spikes.

## 3. The question ladder

Move through these themes in order. Each maps to something the kit does downstream.

### 3.1 Problem & why now → *PRD §1*
- What problem, for whom, and why is it worth solving **now**?
- Who feels the pain today, and what do they do instead?
- What changes if this never gets built?

### 3.2 Users & context → *PRD §2*
- Who are the actual users? What's their context (device, environment, expertise)?
- Who else is affected (admins, reviewers, downstream consumers)?

### 3.3 The value hypothesis (the core bet) → *PRD §5, value-hypothesis spike*
- Finish this sentence: "If we ship **X**, users will be able to **Y**, which is worth it
  because **Z**." That is the bet the whole project rests on.
- How would we *know* the bet paid off? What's the observable signal?
- **This is the assumption most often never tested** (failure #4 in
  [`ORIGIN.md`](../ORIGIN.md)). If it can be cheaply exercised before building around it,
  that's the **value-hypothesis spike**.

### 3.4 Riskiest assumptions & unknowns → *spikes, sequencing*
- What does this depend on that **nobody has directly looked at** — a legacy/external data
  source, a third-party API's real behavior, a performance assumption, a regulatory
  constraint?
- For each: what do we *believe*, and what's the cheapest way to check it against reality?
- Which unknown, if it turns out wrong, would invalidate the most work? (That one runs
  **first** — *front-load risk*, [§7](../docs/00_WAYS_OF_WORKING.md).)

### 3.5 Scope & non-goals → *PRD §3, §4, §7*
- What are the few capability areas in scope?
- **What is explicitly out of scope?** Non-goals keep scope honest — push for them.
- Roughly, what order delivers value soonest while retiring risk?

### 3.6 Constraints → *ADR-0001/0002, SECURITY, NFR*
- **Data sensitivity:** is there confidential/regulated data? (Drives
  [`SECURITY.md`](../docs/SECURITY.md) and the `.gitignore` guardrails.)
- **Compliance / legal:** any regime that constrains the design?
- **Stack leanings & constraints:** existing systems, team skills, hosting, integrations
  that bound the choice (record as input to `ADR-0001`, not as a decision).
- **Timeline, team, budget:** what's the real shape of the effort?
- **Non-functional needs:** latency, volume, availability expectations (seed the NFR doc).

### 3.7 The first usable slice → *foundation slice, ROADMAP*
- What's the thinnest end-to-end thing (data → API → UI) that a human could actually
  *use* and react to? (See "usable at every step",
  [§2](../docs/00_WAYS_OF_WORKING.md).)
- What foundation (auth, shell, navigation) does everything else build into?

## 4. Turning unknowns into spikes

Discovery's most valuable product is a short list of **named spikes**. As assumptions
surface in §3.3–3.4, convert each into a one-line spike candidate:

> *SPIKE (value-hypothesis): will users <do the thing> with the cheapest version? — blocks
> PRD §5*
> *SPIKE (data-profiling): does the legacy export reconcile from its own line items? —
> blocks the data model*

Rules of thumb (full detail in [§6](../docs/00_WAYS_OF_WORKING.md)):
- The first spike of a **data-driven** project is a **data-profiling** spike on the real
  source.
- The first spike of a **product bet** is a **value-hypothesis** spike.
- A spike answers **one** falsifiable question. More than one question is more than one
  spike.

Each candidate becomes a [Spike Report](SPIKE-REPORT-TEMPLATE.md) when it runs.

## 5. Exit criteria — when discovery is "done enough"

Stop the conversation and write up the intake when **all** of these hold:

- [ ] The **problem** and **users** are stated in the human's own words.
- [ ] The **value hypothesis** is written as one falsifiable sentence.
- [ ] The **riskiest assumptions** are listed, each with a cheapest-validation idea.
- [ ] At least the **first spike** is named (type + the question it answers).
- [ ] **Non-goals** exist (scope has an edge).
- [ ] Material **constraints** (data sensitivity, compliance, stack leanings) are noted.
- [ ] A rough idea of the **first usable slice** exists.

You do **not** need answers to everything. Gaps are fine — record them as open questions.
Discovery ends when you know *what to investigate first*, not when you know everything.

## 6. What the intake feeds

The captured [`docs/01_INTAKE.md`](../docs/01_INTAKE.md) is the source material for, in
order:

1. **The first spike(s)** — run before the PRD is `Accepted`
   ([SPIKE-REPORT-TEMPLATE](SPIKE-REPORT-TEMPLATE.md)).
2. **The PRD** ([PRD-TEMPLATE](PRD-TEMPLATE.md)) — written *after* the first spike
   de-risks the core bet.
3. **The roadmap** ([ROADMAP-TEMPLATE](ROADMAP-TEMPLATE.md)) — the ordered slice plan,
   sequenced by the uncertainty discovery surfaced.
4. **`ADR-0001` (stack)** — chosen after a feasibility/UX spike, informed by the
   constraints captured here.

Discovery is the only step where it's correct to have written almost nothing down yet.
Everything after it is `Proposed` until a spike says otherwise.

## 7. Anti-patterns (catch yourself doing these)

- **Transcribing without challenge** — writing down answers as facts instead of testing
  the assumptions inside them. (You're a reviewer, not a stenographer.)
- **Solutioning first** — designing the system before the problem and the bet are clear.
- **Accepting the first stack idea** — letting an offhand "let's use X" become a decision
  instead of an `ADR-0001` input.
- **Skipping the riskiest-assumption question** — the one question that prevents
  *Risk-Last* and *Spec-Ahead-of-Reality* ([§10](../docs/00_WAYS_OF_WORKING.md)).
- **Turning discovery into a phase** — a long meeting instead of a short conversation that
  ends in named spikes.
