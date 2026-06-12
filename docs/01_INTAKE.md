<!--
INTAKE RECORD — the captured output of the discovery conversation (see
templates/DISCOVERY-GUIDE.md). This is the FIRST thing filled in on a new project, BEFORE
the PRD. It is a pre-PRD map of what we know and what we're betting on — NOT a substitute
for the PRD. Promote its content into 02_PRD.md after the first spike de-risks the bet.
Status starts at Draft. Replace this skeleton's placeholders as the conversation proceeds.
-->

# Intake — <Project>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed                       |
| Owner        | <name>                                 |
| Facilitated  | <human + agent>                        |
| Last updated | <YYYY-MM-DD>                           |

**Resume here:** one paragraph a cold reader (or agent) can start from — what this project
is, the core bet, and the single most important unknown to investigate next.

---

## 1. Problem & why now

What problem, for whom, and why it's worth solving **now**. What people do instead today,
and what happens if it's never built. (Feeds [PRD §1](../templates/PRD-TEMPLATE.md).)

## 2. Users & context

Who actually uses this, the context they're in, and who else is affected. (Feeds PRD §2.)

## 3. The value hypothesis (the core bet)

One falsifiable sentence — the bet the whole project rests on:

> If we ship **<X>**, users will be able to **<Y>**, which is worth it because **<Z>**.

- **How we'd know it paid off:** <the observable signal>.
- **Validation status:** ☐ unproven (needs a value-hypothesis spike) · ☐ spike named
  below · ☐ validated by <spike link>.

## 4. Riskiest assumptions & the spikes they imply

The unknowns this rests on, ordered with **the most plan-invalidating first** (front-load
risk). Each becomes a named spike.

| # | Assumption (what we believe) | Have we looked? | Cheapest way to check (→ spike) | Spike type |
| - | ---------------------------- | --------------- | ------------------------------- | ---------- |
| 1 | …                            | No              | …                               | data-profiling / value-hypothesis / feasibility / UX / integration |
| 2 | …                            | …               | …                               | …          |

**First spike to run:** <type + the one falsifiable question it answers> — see
[`SPIKE-REPORT-TEMPLATE`](../templates/SPIKE-REPORT-TEMPLATE.md).

## 5. Scope sketch & explicit non-goals

- **In scope (capability areas, roughly value/uncertainty-ordered):** …
- **Non-goals (deliberately NOT doing):** … *(as important as the goals — keeps scope honest)*

## 6. Constraints

| Area | Notes |
| ---- | ----- |
| Data sensitivity (confidential/regulated?) | … *(drives [`SECURITY.md`](SECURITY.md) + `.gitignore`)* |
| Compliance / legal | … |
| Stack leanings & constraints | … *(input to `ADR-0001`, **not** a decision yet)* |
| Non-functional needs (latency / volume / availability) | … *(seeds the NFR doc)* |
| Timeline / team / budget | … |

## 7. First usable slice

The thinnest end-to-end (data → API → UI) thing a human could actually **use** and react
to, and the foundation (auth, shell, navigation) it builds into. (Feeds the foundation
slice and [`ROADMAP`](../templates/ROADMAP-TEMPLATE.md).)

## 8. Open questions

| Question | Owner | Status |
| -------- | ----- | ------ |
| …        | …     | open   |

## 9. Outputs & next steps

What this intake hands off to, in order:

- [ ] **Run the first spike:** <which one> → records a
      [Spike Report](../templates/SPIKE-REPORT-TEMPLATE.md).
- [ ] **Write the PRD** ([`02_PRD.md`](../templates/PRD-TEMPLATE.md)) once the bet is
      de-risked.
- [ ] **Draft the roadmap** ([`03_ROADMAP.md`](../templates/ROADMAP-TEMPLATE.md)),
      sequenced by the uncertainty above.
- [ ] **Open `ADR-0001` (stack)** after a feasibility/UX spike.

> This intake is **pre-PRD**. It stays `Proposed` until spikes validate its bets; it is
> not a place to design the system. See
> [`templates/DISCOVERY-GUIDE.md`](../templates/DISCOVERY-GUIDE.md) for how it was produced.
