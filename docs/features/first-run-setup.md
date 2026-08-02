---
type: feature-spec
roadmap-item: BUD-S92
status: Implemented
---
<!--
FEATURE SPEC — scopes BUD-S92: the browser path for creating the first admin on a brand-new
install. Full-ish ceremony despite being a small surface (§11): it touches auth, it is public
(pre-session), and it widens the reachability of a race SECURITY.md §3 records as accepted.
NOT the same thing as features/first-run-onboarding.md — see §1.1.
-->

# Feature Spec — First-run setup (BUD-S92)

| Field        | Value                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------- |
| Feature ID   | FEAT-BUD-S92                                                                              |
| Status       | **Implemented** 2026-08-02 — built and gate-green ([status report](../status-reports/2026-08-02-bud-s92-first-run-setup.md)) |
| Owner        | Wesley Cutting                                                                            |
| Last updated | 2026-08-02                                                                                |
| Related      | [ADR-0009](../adr/ADR-0009-authentication-household-scoping.md) (auth) · [`BUD-S87`](../03_ROADMAP-v2.md) (created `/auth/setup`, built no UI for it) · [`BUD-S91`](../status-reports/2026-08-02-bud-s91-auth-a11y.md) (the a11y precedent for the auth surfaces) · [SECURITY.md §3](../SECURITY.md) · [06_API_CONTRACT §Authentication](../06_API_CONTRACT.md) · [DEPLOY_CONTRACT §7](../DEPLOY_CONTRACT.md) |
| Gated by     | — (`BUD-S87` is Done; this needs no new dependency, table, or migration)                   |

## 1. Summary

Authentication is default-deny and **always on**, but nothing in the web app can create the first
user. A brand-new store — a fresh `npm run dev`, a `db:fresh`, a newly deployed container, or a
backup restored onto a different box — presents a `/login` page for which no credential exists and
none can be made from the browser. The only ways in are the `create-admin` CLI (which additionally
refuses the default in-memory dev store) or a hand-made `POST /api/auth/setup`.

This slice ships the missing surface: a **`/setup`** route that creates the first admin, signs them
in, and drops them on the dashboard.

The endpoint has existed since `BUD-S87` and is already exercised by `e2e/global-setup.ts` and
`scripts/capture-demo-assets.ts`. **That is precisely why the gap survived:** every automated
consumer provisions its admin out of band, so the suite has never once walked the path a human
walks, and the gate stayed green over a product that could not be opened.

### 1.1 Not to be confused with `first-run-onboarding.md`

Two different "first run"s, and the names collide:

| | [`first-run-onboarding.md`](first-run-onboarding.md) (`BUD-S59`/UX14, **shipped**) | **This spec** (`BUD-S92`) |
| --- | --- | --- |
| Question answered | "I'm logged in, my ledger is empty — what now?" | "There is no account at all — how do I get in?" |
| Precondition | Authenticated; `accounts` **and** `envelopes` both empty | **Unauthenticated**; `users` empty |
| Surface | `FirstRunOnboarding` inside the app shell, on `/` | Standalone `/setup`, **outside** the shell (like `/login`) |
| State | **Derived** from ledger reads | **Derived** from a user count |

They compose: finish `/setup` and you land on `/`, which — having no ledger yet — shows the UX14
onboarding. That is the intended full first-run story, and it has never actually run end to end.

## 2. Scope

**In scope**

- **`GET /auth/needs-setup`** *(public)* → `{ needsSetup: boolean }` — `true` only while zero users
  exist. The SPA needs this **before** it has a session, and `/login` cannot infer it (a userless
  store and a wrong password both yield `401`, deliberately — enumeration-safety, `BUD-S89`).
- **`/setup` route** — standalone, outside the app shell: username · password · confirm-password,
  submitting to the existing `POST /auth/setup`.
- **Redirects, both ways.** `/login` → `/setup` while `needsSetup`; `/setup` → `/login` once a user
  exists. Neither is a dead end and neither lingers.
- **Auto-login on success** — `201` is followed by `POST /auth/login` with the same credentials, then
  navigate to `/`. Making someone type the password they just chose, into a form that looks like the
  one that just rejected them, is a needless cliff at the least forgiving moment.
- **Atomic first-user creation** — see §5.
- **Accessibility from the start** — axe-gated light and dark, per `BUD-S91`.
- **Doc updates in the same change** — `06_API_CONTRACT` (new endpoint), `SECURITY.md` §3 (the race
  note), `DEPLOY_CONTRACT` §7 (drop the "API call, not a screen" warning), README.

**Out of scope**

- Password-strength meters, recovery questions, email verification (no SMTP on a CGNAT LAN box —
  ADR-0009 §8; recovery stays CLI).
- Any second-user flow — admins already add members at `/users` (`BUD-S88`).
- Household naming or branding during setup — one implicit household (shape **A**).
- Retiring `create-admin`. It stays: it is the recovery path when nobody can log in, and it is the
  only option when the box is unreachable by browser.

### 2.1 Enrollment model — ratified 2026-08-02 (owner)

**Bootstrap one admin from the browser; that admin provisions everyone else.** There is no
self-service registration, and this slice does not add one — `/setup` is a one-shot that goes inert
the moment a user exists, and the only other way to create a user stays `POST /users`, admin-only
(`BUD-S88`).

Recorded as a **decision, not an omission**, because the two are indistinguishable from the code and
the next person to read this will otherwise assume sign-up was forgotten. It is the correct default
for a self-hosted, single-household budget app: the set of people who should ever have an account is
small, known, and already in the room, so an open registration surface would be pure attack surface
on a LAN box with no email to verify against (ADR-0009 §8 — no SMTP).

**If coverage ever needs to expand**, the ladder from here is additive and does not invalidate this
slice — `/setup` bootstraps the first principal regardless of how later ones arrive:

1. **Admin-issued invite links** — a signed, single-use, expiring token that lets an invitee set
   their own password without an admin handling it. The natural next rung, and the one that removes
   the "admin types someone else's password" wrinkle in `POST /users` today.
2. **Self-service registration** — only ever meaningful alongside a real multi-household story
   (shape **B**, deferred in ADR-0009 in favour of a container per household). Registration without
   tenant isolation would enroll strangers into *this* household's ledger.

Neither is on the roadmap, and neither should be scoped until there is a concrete second user with
a concrete need. Noted here so that the decision is re-openable with its reasoning intact.

## 3. User stories

| ID   | Story | Priority |
| ---- | ----- | -------- |
| US-1 | As someone opening a freshly installed Budgeteer, I want to create my account from the page in front of me, so that I can use the app without a terminal. | Must |
| US-2 | As the owner deploying to labs-hub, I want to finish setup in the browser, so that standing up a box does not mean `docker compose exec`. | Must |
| US-3 | As a returning user, I never want to see the setup screen, so that the app cannot suggest my instance is unclaimed. | Must |
| US-4 | As a developer running `db:fresh`, I want the app to walk me back in, so that resetting the dev store is not a chore. | Should |

## 4. Acceptance criteria

- **Given** a store with zero users, **when** I load any app URL, **then** I land on `/setup`.
- **Given** `/setup`, **when** I submit a valid username and a password of ≥ 8 characters,
  **then** an **admin** is created, I am signed in, and I land on `/` — with no second sign-in.
- **Given** `/setup`, **when** the two password fields differ, **then** submission is blocked
  client-side with an inline, screen-reader-announced error, and no request is sent.
- **Given** a store that already has a user, **when** I navigate to `/setup`, **then** I am
  redirected to `/login` and cannot create a user.
- **Given** a store that already has a user, **when** `GET /auth/needs-setup` is called,
  **then** it returns `{ needsSetup: false }` and reveals nothing else.
- **Given** two concurrent `POST /auth/setup` calls on an empty store, **then** exactly one
  returns `201` and the other returns `409` — never two admins (§5).
- **Given** `/setup` in light **and** dark, **then** axe reports zero violations, including the
  error state.

## 5. Edge cases & error handling

| Scenario | Expected behavior |
| -------- | ----------------- |
| **Race: two setups at once** | Exactly one wins. `SECURITY.md` §3 currently records the check-then-insert race as *accepted* on the grounds that it is a narrow window on a trusted LAN reachable only by someone who knows the endpoint. Putting it behind a discoverable screen weakens that reasoning, so this slice closes it rather than inheriting it: enforce at the **database**, not in application logic — a partial unique index admitting one row where `role = 'admin'` is the first row, or `INSERT … SELECT … WHERE NOT EXISTS` in one statement — and map the constraint violation to the existing `409`. **The winner must be decided by Postgres, not by a `countUsers()` that raced.** |
| Password < 8 chars | `400` from the existing validator, surfaced inline. Client-side check first, so the round trip is not the teacher. |
| Username already taken | Not reachable (zero users), but the `409` is still mapped rather than swallowed. |
| Setup succeeds, auto-login fails | Do **not** report failure — the account exists. Redirect to `/login` with an explanatory message. Anything else invites a second setup attempt that will now `409`, and the user concludes their account was not created. |
| `needs-setup` unreachable (API down) | Fall through to `/login` and let the existing error path speak. Never assume `needsSetup: true` on error — a transient blip must not offer to claim an instance that already belongs to someone. |
| User is mid-`/setup` when someone else completes it | The `409` is surfaced as "This instance has already been set up" with a link to `/login`. |
| Browser hits `/setup` on a **restored** box | Correct and intended: `GET /api/export` carries the ledger but not users (DEPLOY_CONTRACT §7), so a restore onto a new box legitimately has zero users. |

## 6. Data changes

**As built (2026-08-02) — one additive column, not "none".** `users` and `sessions` already existed
(`0003-auth`), and this section originally expected the atomicity fix to be a bare constraint. It
could not be: §5's two options are an **and**, not an **or**. `INSERT … SELECT … WHERE NOT EXISTS`
alone does not close the race — under READ COMMITTED both transactions take a snapshot, neither sees
the other's uncommitted row, and both insert — and a partial unique index needs something to key on
that identifies the *bootstrap* row (it may not key on `role = 'admin'`, because a household may have
several admins). So migration **`0004-first-run-bootstrap`** adds `users.bootstrap boolean not null
default false` plus `unique (bootstrap) where bootstrap`, and the route uses the single statement on
top of it. Additive and safe on a populated store; recorded in
[`05_DATA_MODEL.md`](../05_DATA_MODEL.md) in the same change.

## 7. Interface changes

**API** — one addition, documented in [`06_API_CONTRACT.md`](../06_API_CONTRACT.md):

- `GET /auth/needs-setup` *(public)* → `200 { needsSetup: boolean }`. Public because it must answer
  before a session exists; it leaks strictly one bit, and that bit is already observable by anyone
  who can `POST /auth/setup` and read `201`-vs-`409`.

`POST /auth/setup` is **unchanged** on the wire; only its concurrency guarantee tightens.

**UI** — a new `/setup` route outside the shell, and redirect logic on `/login`. It reuses the
`Login` card layout, `Field`/`Input`/`Button` from `ui`, and `Login.module.css`; a UX spec is not
warranted for a three-field form on an existing pattern (§11), and this section is its record.

## 8. Dependencies

`BUD-S87` (Done — endpoint, sessions, `/login`). No new package. `BUD-S93` (demo instance) depends
on **this**: standing up a demo box should not require `exec`-ing a CLI.

## 9. Security, privacy & accessibility

- **The endpoint stays a one-shot.** `/auth/setup` must remain inert once any user exists — the UI
  makes it discoverable, so the server-side gate is the only thing that matters. Test the `409`
  path, not just the happy path.
- **Nothing sensitive in the probe.** `{ needsSetup }` — no counts, no usernames, no timestamps.
- **The first user is an `admin`.** Unchanged from `create-admin`, and the reason `/setup` may never
  be reachable a second time.
- **Passwords never logged**, never in a query string, `autoComplete="new-password"` on both fields.
- **Throttling.** The login throttle (`BUD-S89`) covers the auto-login leg. `/setup` self-limits by
  going inert after one success; the atomicity fix means a flood cannot produce two admins.
- **Accessibility.** Axe-gated light and dark **in this slice, not a follow-up** — `BUD-S91` is the
  cautionary precedent, and it found a real contrast defect that had shipped unnoticed. Confirm-field
  mismatch must be announced (`role="alert"`), not just coloured.

## 10. Test plan

| Layer | Coverage |
| ----- | -------- |
| API integration | `needs-setup` true on empty / false once populated · `setup` `201` then `409` · **concurrent setup ⇒ exactly one admin** · password-length `400` |
| Web component | `/setup` renders on `needsSetup` · confirm-mismatch blocks submit and announces · success calls setup then login then navigates · setup-ok/login-fail redirects to `/login` with a message |
| Browser e2e | **The one that would have caught this:** against a store with **no user**, load `/`, get routed to `/setup`, create an admin, and arrive at an authenticated dashboard — with no out-of-band provisioning. This test must be unable to pass by way of `global-setup`'s shared `storageState`. |
| a11y (axe) | `/setup` light + dark, clean and error states. Each scan verified to fail on an injected defect before being trusted (`BUD-S91` method). |

> **Reality before paper.** The e2e above is the acceptance test for the whole slice: it is the
> first automated proof that a person can go from a blank store to a usable app unaided. Write it
> first and watch it fail.
