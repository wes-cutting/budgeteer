<!--
SECURITY REVIEW — a point-in-time, repo-wide security review against the exploited-in-practice
vulnerability classes (injection · broken authn/access-control · secrets/weak-crypto · unsafe
code-exec/deserialization · sensitive-data exposure), read alongside the project standards
(SECURITY.md · ENGINEERING_STANDARDS · ARCHITECTURE). Findings are tracked as "Security review"
items SEC1–SEC3 in docs/03_ROADMAP.md §4; sequencing is the owner's call.
-->

# Security review — Budgeteer

| Field   | Value                                                        |
| ------- | ------------------------------------------------------------ |
| Date    | 2026-07-06                                                    |
| Scope   | Whole repo at `main` (HEAD `24e62fe`, post-S7/K24)           |
| Author  | Wesley Cutting + agent                                        |
| Lens    | Injection (SQL / command / XSS / path traversal) · broken authn/access-control · hardcoded secrets / weak crypto · unsafe code-exec / deserialization · sensitive-data exposure in logs/responses |
| Verdict | **Clean on the classes that actually get exploited.** No SQL/command/XSS/path-traversal injection, no secret in the repo, no unsafe deserialization, and no sensitive data reaching logs. Access control is single-tenant-by-design and consistently scoped. The three findings are all **posture/supply-chain**, not live bugs: one vulnerable-but-unreached runtime dependency whose gate justification is factually wrong (SEC1), dev-tool advisories correctly excluded from what ships (SEC2), and the already-accepted no-auth stance reaffirmed with its exact blast radius (SEC3). |

## Method

Whole-repo audit, not a diff: mapped the API surface (`apps/api/src/http/routes/*`), the datastore
seam (`services/*`, `db/*`), and the web client (`apps/web/src`), then swept each exploited-in-
practice class directly —

- **SQL injection:** every query path through Kysely; grepped `sql.raw`/`sql.lit`/`sql.ref`,
  string-built SQL, and JSON-path builders.
- **Command injection / unsafe exec:** grepped `child_process`/`exec`/`spawn`/`eval`/`new Function`.
- **XSS:** grepped `dangerouslySetInnerHTML`/`innerHTML`/user-controlled `href`; confirmed the
  React-escaping default holds everywhere.
- **Path traversal:** the two filesystem seams (`/export` download, `db:restore` CLI).
- **Secrets:** `git ls-files` for tracked `.env`/keys/backups; `.gitignore` coverage; the on-disk
  `.env`.
- **Authn/authz:** the `DEFAULT_HOUSEHOLD_ID` scoping on every service query; the network-bind and
  CORS posture.
- **Sensitive-data exposure:** the Fastify/pino logger config and the error envelope.
- **Supply chain:** `npm audit` (full + `--omit=dev`), reconciled against the gate's SCA step.

## Strengths (keep)

- **Parameterized end-to-end.** Every query is built through Kysely's query builder or a tagged
  `sql`` `` template; `${…}` interpolations are bind parameters, never string concatenation. The
  only `sql.lit()` calls (`analysisService.ts:219,585`) take a **closed enum** (`grain` → `"YYYY"` /
  `"YYYY-MM"`), never user input. No `sql.raw`, no built-up query strings.
- **Input validated at the boundary, loudly.** Route bodies are zod-parsed (`safeParse` → `400`);
  dates/months are regex-gated (`DATE_RE`/`MONTH_RE`); money goes through the single `parseMoney`
  regex. The restore file is zod-validated before a row is touched. Invalid input fails closed.
- **Access control is scoped, not decorative.** 105 query sites carry an explicit
  `household_id = DEFAULT_HOUSEHOLD_ID` (or an id-scoped `where`); there is exactly one tenant by
  design (roadmap `#19` is where it becomes request-derived), so there is no cross-tenant surface to
  leak through — and the scoping is already in place for when there is.
- **No secret in the tree.** `.env` is gitignored (`.gitignore:24`) and untracked; only
  `.env.example` (templates, no real values) is committed. No backup JSON, no `data/` store, no key
  file is tracked. No password/token/API-key literal in source.
- **No dangerous sinks.** No `child_process`/`exec`/`eval`/`new Function` anywhere; no
  `dangerouslySetInnerHTML`/`innerHTML`; the one user-facing `href` (`AppShell.tsx:75`
  "Download backup") is a build-time `VITE_API_BASE_URL`, not user-controlled. Restore
  deserialization is `JSON.parse` → zod → parameterized inserts (a `__proto__` key becomes an
  unknown column Postgres rejects — no prototype-pollution path into the store).
- **Logs and errors don't leak.** The Fastify logger keeps pino's **default** serializers
  (method/url/status/responseTime + error type/message/stack) — financial bodies and headers never
  reach the logs, asserted by `logging.test.ts` (R13). The single error handler returns
  `"Something went wrong."` for every 5xx; only app-generated 4xx messages pass through.
- **The reachable surface matches the auth story.** The API binds loopback by default (EH11,
  validated `HOST`); CORS is an allowlist, never `*` (`server.ts:60`). Restore is deliberately
  CLI-only — an HTTP restore would be an unauthenticated remote wipe-and-replace primitive.

## Findings

| ID | Pri | Finding | Where | Recommendation |
| -- | --- | ------- | ----- | -------------- |
| SEC1 | P2 | **`kysely` is a vulnerable *direct runtime* dependency — and the gate's SCA comment misstates why that's safe.** `npm audit` reports three **high** advisories against `kysely ≤ 0.28.16`; the repo runs `kysely@0.27.6`, declared as a **direct** dependency (`apps/api/package.json:24`) and used as the runtime query builder for the entire API (`db/connection.ts` + every service). `gate.yml:63-67` justifies `--audit-level=critical` by asserting kysely is only in "the kysely-pglite → kysely-codegen transitive chain… a type-gen tool, not used at runtime." That is **false** — the prod-only audit tree lists `node_modules/kysely` at the top level, separate from the codegen chain. The *conclusion* (not currently exploitable) still holds, but for reasons the comment doesn't state: **(a)** the dialect is PostgreSQL, and the `sql.lit()` backslash advisory ([GHSA-8cpq-38p9-67gx](https://github.com/advisories/GHSA-8cpq-38p9-67gx)) is **MySQL-only**; **(b)** the two `sql.lit()` call sites take a validated closed enum, never user input; **(c)** no `JSONPathBuilder.key()`/`.at()` and no `Kysely<any>` over user input, so the other two advisories have no reachable path. The risk is a wrong mental model: the comment would wave off a *future* kysely advisory that **does** hit runtime Postgres query-building. | `apps/api/package.json:24`, `.github/workflows/gate.yml:60-68`, `apps/api/src/services/analysisService.ts:219,585` | Correct the gate comment to the real reasons (Postgres dialect · enum-fed `sql.lit` · no JSON-path/`Kysely<any>`). Then close the finding for real: bump `kysely` to a patched line once `kysely-pglite` ships a `kysely-codegen ≥ 0.19` peer (or add a `package.json` `overrides` pin on `kysely`), and re-run `npm audit --omit=dev`. Re-check the two `sql.lit` sites stay enum-only. |
| SEC2 | P3 | **Dev-tooling advisories (vitest `critical`, vite/esbuild dev-server) are correctly excluded from the shipped gate — informational, with one operational caveat.** The full audit shows a `critical` on `vitest` (UI-server arbitrary-file read/exec) and `high`/moderate on `vite`/`esbuild`/`vite-node` (the dev server lets any visited website read dev-server responses). None ship: `--omit=dev` excludes them and the web build output carries none of them. The one real-world caveat is operational, not code: the **Vite dev server and the Vitest UI must stay on loopback** — exposing either on an untrusted network turns these into live issues. | `npm audit` (dev tree), `apps/web` (vite), root (vitest) | No code action. Keep `--omit=dev` in the gate; keep dev servers loopback-bound. Fold a `vite`/`vitest` major bump into the next tooling refresh (both are breaking — `npm audit fix --force` would jump `vite@5→8`, `vitest@2→3`); not urgent while dev-only. |
| SEC3 | P2 | **The whole API — including a one-request full-data `/export` — is unauthenticated; the loopback bind is the *only* control.** This is the deliberate, documented V1 stance (no auth until roadmap `#19`), and this review does **not** reopen that decision — it reaffirms it and sharpens the blast radius so the trade-off stays explicit. Any client that can reach `:3001` can read and write the entire ledger, and `GET /export` returns the complete household snapshot (all 15 tables) in a **single unauthenticated request** — total data exfiltration in one call, no enumeration needed. The compensating control is EH11's `HOST=127.0.0.1` default; **CORS does not gate non-browser clients** (`curl` ignores it). Setting `HOST=0.0.0.0` exposes all of the above to every device on the LAN with zero authentication. | `apps/api/src/http/routes/backup.ts:10` (`/export`), `apps/api/src/http/server.ts` (no auth hook), `apps/api/src/config.ts:10` (`HOST`) | None new — this is `#19` (multi-user / household scoping · auth), already tracked as Deferred and already named as the home for the "no authentication" finding. Reaffirm the guardrail: binding `0.0.0.0` is the documented trigger to pull `#19` forward, and `/export`'s single-request totality is the reason the loopback default is load-bearing, not cosmetic. Until `#19`, do not add any HTTP restore/import endpoint (the current CLI-only restore is the right call). |

## What this review did **not** find (checked, clean)

- **SQL injection** — none. Parameterized throughout; the sole `sql.lit()` is enum-fed; `${month}`
  and friends are bind params and are regex-validated at the boundary regardless.
- **Command injection / unsafe code execution** — none. No `child_process`/`exec`/`eval`/
  `new Function` in the codebase.
- **XSS** — none. React escaping holds; no `dangerouslySetInnerHTML`/`innerHTML`; no user-controlled
  `href`/`src`.
- **Path traversal** — none reachable by an attacker. `/export` builds its filename from the injected
  clock (no user input); `db:restore` takes a path from `argv` on the operator's own machine (a local
  CLI, not a network surface).
- **Hardcoded secrets / weak crypto** — none. No secret in the tree; no crypto is rolled here (there
  is no auth yet — `#19` is where a KDF/session mechanism gets chosen, per SECURITY.md §3).
- **Unsafe deserialization** — none. Restore is `JSON.parse` → zod envelope → PG-constraint-validated
  parameterized inserts; no prototype-pollution path into the store.
- **Sensitive-data exposure** — none. Default pino serializers (no bodies/headers), verified by test;
  5xx internals never leak; the error envelope is uniform.
- **Broken access control** — none *within the single-tenant model*. Every query is household-scoped;
  cross-tenant isolation is `#19`'s job and is out of scope by design, not by omission.

## Bottom line

For a single-user, loopback-bound personal-finance app, the exploited-in-practice classes are either
**absent** (injection, XSS, secrets, unsafe exec/deserialization, log leakage) or **explicitly
deferred with a documented, in-place compensating control** (auth → `#19`; loopback default → EH11).
The only net-new action is **SEC1**: correct a factually wrong SCA justification and retire the
vulnerable-but-unreached `kysely`. **SEC2** is informational; **SEC3** is a reaffirmation of `#19`,
not a new item.
