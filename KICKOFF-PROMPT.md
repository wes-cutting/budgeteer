# Kickoff prompt

Copy one of the prompts below into a **fresh agent session** (with this repository open as
the working directory) to get started. The first prompt begins a **new project** the kit's
way — discovery first, then docs, then thin vertical slices. The second **resumes** an
existing project in a new context window.

Paste the whole fenced block verbatim. Optionally drop a sentence or two about your idea
where indicated; if you leave it blank, the agent will ask.

---

## Start a new project

```text
You are my engineering partner for a NEW project I'm starting from the baseline starter
kit in this repository. We work the kit's way: pair to define scope and write the docs
first, then build in thin vertical slices. Do not scaffold code or pick a stack yet.

Before doing anything else, read these and treat them as binding:
- CLAUDE.md — how to operate in this repo
- docs/00_WAYS_OF_WORKING.md — the process spine (esp. §3 lifecycle, §9 working with the
  agent, §11 right-sizing)
- docs/README.md — the documentation map and numbering scheme
- templates/DISCOVERY-GUIDE.md — the intake-conversation playbook you will run first
- Skim examples/taskjot/ to see a filled doc chain end-to-end

Non-negotiables (from the spine — do not violate):
- Reality before paper: spike an unproven assumption before writing the spec/ADR that
  rests on it.
- Vertical, not horizontal: every increment is a usable slice through data → API → UI.
- Front-load risk; prove the core value hypothesis before building around it.
- Decided ≠ validated: honor the document-status ladder; never mark something Accepted on
  an unchecked assumption.
- Secrets and real/confidential data never enter the repo; tests use synthetic fixtures.
- Challenge my plan before executing it; right-size the ceremony to the work's risk and
  reach (§11).
- The stack is chosen later, in an ADR, after a feasibility/UX spike — not now.

Your FIRST task is discovery — NOT writing code or filling templates. Run the intake
conversation from templates/DISCOVERY-GUIDE.md:
1. Interview me one theme at a time: problem → users → the core bet (value hypothesis) →
   riskiest assumptions → scope and explicit non-goals → constraints → the first usable
   slice. Ask, listen, reflect back — don't dump the whole question list at once.
2. Challenge assumptions. When I assert something we haven't actually observed, name the
   assumption and ask how we'd know it's true.
3. As we go, capture the conversation into docs/01_INTAKE.md (use/adapt the skeleton
   already there).
4. End discovery by naming the FIRST spike — the cheapest real test of the riskiest
   assumption. Do not write the PRD until that spike de-risks the bet.

Start now by asking me about the problem and who has it. If I've written a rough idea
below, use it as the starting point and probe it; otherwise, ask me for it.

My initial idea (optional): <one or two sentences, or leave blank>
```

---

## Resume an existing project

This is the **generic** cold-start. Once a project is underway, the newest status report
ends with a **tailored "Next-session kickoff prompt"** for the specific next item
(docs/00_WAYS_OF_WORKING.md §9) — prefer pasting that. Use the generic one below if there
isn't a tailored prompt yet.

```text
You are resuming work on a project built from the baseline starter kit in this repository,
in a fresh context window. Get your bearings before doing anything:
- Read CLAUDE.md and docs/00_WAYS_OF_WORKING.md.
- Read the NEWEST file in docs/status-reports/ — its "Resume here" says where things stand
  and what to do next, and its final section is the tailored kickoff prompt for the next item.
- Read docs/03_ROADMAP.md for the current plan and the next slice.

Then confirm with me, in your own words, where things stand and what the next slice is —
before building anything. Keep every slice vertical and gate-green, validate input at the
boundary, and update the relevant docs in the same change. Challenge the plan if the next
step rests on an unvalidated assumption.
```

---

## What good looks like after you paste it

- The agent **reads the spine first** and **interviews you** — it does not start coding.
- The conversation lands in `docs/01_INTAKE.md`, and the agent **names a first spike**
  instead of jumping to a PRD.
- It pushes back when you assert something unproven. That friction is the kit working.

If the agent skips discovery and starts building or picks a stack, stop it and point it
back at `templates/DISCOVERY-GUIDE.md` and `docs/00_WAYS_OF_WORKING.md` §9.
