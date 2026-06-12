<!--
UX SPEC TEMPLATE
Every user-facing capability gets one BEFORE it is built (see
docs/00_WAYS_OF_WORKING.md §5 Definition of Ready). Its existence is what forces the
UI to be part of the slice — a prior project had no UX spec, and the absence of a UI
went unnoticed for a long time. Copy to docs/ux/<feature-slug>.md. Pair it with the
matching feature spec. Keep it concrete; wireframes can be ASCII or links.
-->

# UX Spec — <Feature / Capability>

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | Draft · Proposed · Validated · Accepted |
| Feature      | <FEAT-xxx / capability name>           |
| Owner        | <name>                                 |
| Last updated | <YYYY-MM-DD>                           |

## 1. User & job

Who is using this and what are they trying to get done? One or two sentences. Tie to a
PRD goal / user journey.

## 2. Entry points & navigation

- How does the user reach this? (nav item, link, deep link, redirect)
- Where can they go from here?

## 3. Primary flow

The happy path, step by step (user action → system response). Keep it to the spine.

1. …
2. …

## 4. Screens & states

For each screen/view, specify **every state** — this is the part most often skipped and
most often the source of "looks done but isn't."

| Screen / view | Purpose | Key elements |
| ------------- | ------- | ------------ |
| <name>        | …       | …            |

For each screen, define these states explicitly:

- **Empty** — no data yet (first-run). What does the user see / do?
- **Loading** — while fetching/working.
- **Populated** — the normal, data-present state.
- **Error** — request failed / validation failed (message text, recovery path).
- **Success / confirmation** — after a successful action.
- **Permission-limited** — what a read-only / lower-privilege user sees (if applicable).

## 5. Wireframe / layout

ASCII sketch or link. Doesn't need to be pretty — needs to be unambiguous.

```
+--------------------------------------------------+
|  <title>                                          |
|  [form / table / actions ...]                     |
+--------------------------------------------------+
```

## 6. Interactions & inputs

- Forms: fields, validation rules (mirror the spec/schema), inline error placement.
- Actions: buttons, destructive-action confirmations, optimistic vs. pending states.
- Edge inputs: long text, zero/empty, very large/small numbers, etc.

## 7. Content & copy

Key labels, button text, empty-state copy, and error messages. Write the actual words.

## 8. Accessibility

Baseline is **WCAG 2.2 AA** on user-facing surfaces:
- Semantic structure (headings, labels tied to inputs, table headers).
- State conveyed by **text/icon, not color alone**.
- Keyboard operable; visible focus; respects `prefers-reduced-motion`.
- Specific concerns for this feature: <…>

## 9. Acceptance criteria (UX)

Concrete, testable statements that map to e2e/interaction tests:

- **Given** <state>, **when** <action>, **then** <observable UI result>.
- The empty / error / loading states render as specified.
- The accessibility checks above pass on changed UI.

## 10. Out of scope / later

What this UX deliberately does not cover yet.
