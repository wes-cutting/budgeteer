import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { z } from "zod";
import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { makeServices } from "../services/container";
import { makeAuthService, type Principal } from "../services/authService";
import { DuplicateNameError, NotFoundError, ValidationError } from "../services/errors";
import { type Clock, systemClock } from "../util/dates";
import { type IdParams, fail } from "./routes/shared";

/** The session cookie name (opaque signed token; ADR-0009 §4). */
const SESSION_COOKIE = "budgeteer_session";
import { accountRoutes } from "./routes/accounts";
import { envelopeRoutes } from "./routes/envelopes";
import { transactionRoutes } from "./routes/transactions";
import { reconcileRoutes } from "./routes/reconcile";
import { transferRoutes } from "./routes/transfers";
import { recurringRoutes } from "./routes/recurring";
import { analysisRoutes } from "./routes/analysis";
import { templateRoutes } from "./routes/templates";
import { backupRoutes } from "./routes/backup";

export function buildServer(
  db: Kysely<DB>,
  opts: {
    logger?: FastifyServerOptions["logger"];
    corsOrigins?: string[];
    /**
     * The injected clock (EH7 — the clock is I/O, passed in, never reached for). Since EH8,
     * user-facing calendar dates come from the caller (client-local, required at the boundary);
     * the clock remains only for operational stamps (the backup filename) and tests.
     */
    clock?: Clock;
    /**
     * Authentication (ADR-0009 · BUD-S87). PRESENT → real session gating: every route except the
     * public auth/health endpoints is default-deny and the request scope comes from the session's
     * principal. ABSENT → open bootstrap mode (the single seeded household, no gate) for
     * business-logic tests (`createTestApp`); the auth suite passes it to exercise the real gate.
     * Production (`index.ts`) ALWAYS passes it. `secureCookie` adds `Secure` (HTTPS only) in prod.
     */
    auth?: { sessionSecret: string; secureCookie?: boolean };
  } = {},
): FastifyInstance {
  const clock = opts.clock ?? systemClock;
  // Structured request/response/error logging via Fastify's bundled pino (R13). `index.ts` passes
  // `{ logger: { level } }` (level from the validated `LOG_LEVEL`); tests omit it → `false` → quiet
  // and deterministic. We deliberately keep pino's DEFAULT serializers: they log only
  // method/url/status/responseTime + the error type/message/stack — never request bodies or
  // headers. So financial bodies (transaction memo/payee/amount, the /export snapshot) never reach
  // the logs; adding a body serializer here would leak them (SECURITY.md §1/§5). Do not.
  const app = Fastify({ logger: opts.logger ?? false });

  // Browsers call this API cross-origin (web on :5173, API on :3001), so it must send CORS
  // headers or the browser blocks every response ("Failed to fetch"). Allowlist only — the
  // configured origins, never `*` (SECURITY.md). Default covers the Vite dev origin.
  // `methods` must list every verb the API uses: @fastify/cors otherwise defaults the preflight's
  // Access-Control-Allow-Methods to GET,HEAD,POST, which silently blocks cross-origin PUT/PATCH/
  // DELETE (rename, edit-split, template/recurring delete, budget targets) in the browser.
  // Registered at the root before the route plugins, so the hook applies to every encapsulated
  // child plugin's routes.
  void app.register(cors, {
    origin: opts.corsOrigins ?? ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    // The browser must send the session cookie on cross-origin API calls (web:5173 → api:3001 in
    // dev/e2e), so credentials are allowed. Safe only because `origin` is an allowlist, never `*`.
    credentials: true,
  });

  // Tolerate an empty body on application/json requests (e.g. a bodyless DELETE) rather than
  // erroring; still reject malformed JSON with a 400.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (body === "" || body == null) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      const err = new Error("Invalid JSON body.") as Error & { statusCode?: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // --- Authentication & the per-request scope (ADR-0009 · BUD-S87, on BUD-S86's seam) ---
  const authEnabled = opts.auth !== undefined;
  const sessionSecret = opts.auth?.sessionSecret ?? "dev-only-insecure-session-secret-unset";
  const secureCookie = opts.auth?.secureCookie ?? false;
  const authService = makeAuthService(db, clock);
  void app.register(cookie, { secret: sessionSecret });

  // The public surface — reachable without a session. Everything else is default-deny.
  const PUBLIC_PATHS = new Set(["/health", "/auth/login", "/auth/logout", "/auth/setup"]);

  // Resolve the caller and bind the per-request, household-scoped service container (BUD-S86's seam).
  // AUTH ON: a valid signed session cookie → the principal; no/invalid session → 401 for any
  // non-public route (SECURITY.md §3 default-deny). AUTH OFF (tests): a bootstrap admin principal on
  // the single seeded household, no gate — behaviour identical to the pre-auth app.
  app.addHook("onRequest", async (req, reply) => {
    let principal: Principal | null = null;
    if (authEnabled) {
      const raw = req.cookies[SESSION_COOKIE];
      if (raw !== undefined) {
        const unsigned = req.unsignCookie(raw);
        if (unsigned.valid && unsigned.value !== null)
          principal = await authService.resolvePrincipal(unsigned.value);
      }
      if (principal === null) {
        const path = req.url.split("?")[0] ?? req.url;
        if (!PUBLIC_PATHS.has(path)) return fail(reply, 401, "Authentication required.");
        return; // public route, unauthenticated — no scoped services needed
      }
    } else {
      principal = { userId: "bootstrap", householdId: DEFAULT_HOUSEHOLD_ID, role: "admin" };
    }
    req.principal = principal;
    req.services = makeServices(db, { householdId: principal.householdId });
  });

  // Single error envelope for the whole API: `{ error: { message } }`. Set on the root so it is
  // inherited by every route plugin (children don't override it). 5xx detail is never leaked.
  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) app.log.error(e);
    return fail(reply, status, status >= 500 ? "Something went wrong." : e.message);
  });

  app.get("/health", async () => ({ status: "ok" }));

  // --- Auth routes (ADR-0009 · BUD-S87). login/logout/setup are public; /auth/me is gated. ---
  const credsBody = z.object({ username: z.string().min(1), password: z.string().min(1) });

  // First-run onboarding: create the first admin, allowed ONLY while zero users exist (a dead
  // endpoint thereafter). The out-of-band `create-admin` CLI does the same job.
  app.post("/auth/setup", async (req, reply) => {
    const body = credsBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, "Username and password are required.");
    if ((await authService.countUsers()) > 0) return fail(reply, 409, "Setup is already complete.");
    try {
      await authService.createUser({
        username: body.data.username,
        password: body.data.password,
        role: "admin",
        householdId: DEFAULT_HOUSEHOLD_ID,
      });
    } catch (e) {
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
    return reply.code(201).send({ ok: true });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = credsBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, "Username and password are required.");
    const result = await authService.login(body.data.username, body.data.password);
    if (result === null) return fail(reply, 401, "Invalid username or password.");
    reply.setCookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookie,
      path: "/",
      signed: true,
      expires: result.expiresAt,
    });
    return { ok: true };
  });

  app.post("/auth/logout", async (req, reply) => {
    const raw = req.cookies[SESSION_COOKIE];
    if (raw !== undefined) {
      const unsigned = req.unsignCookie(raw);
      if (unsigned.valid && unsigned.value !== null) await authService.logout(unsigned.value);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  // Who am I — gated (not public), so the SPA gets 401 when logged out, the principal when logged in.
  app.get("/auth/me", async (req) => ({
    user: req.principal ? { userId: req.principal.userId, role: req.principal.role } : null,
  }));

  // --- User management (BUD-S88 · ADR-0009 §7). Admin-only within the caller's household. ---
  const createUserBody = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    role: z.enum(["admin", "member"]).default("member"),
  });
  const resetPasswordBody = z.object({ password: z.string().min(1) });

  app.get("/users", async (req, reply) => {
    const principal = req.principal;
    if (!principal || principal.role !== "admin") return fail(reply, 403, "Admin access required.");
    return { users: await authService.listUsers(principal.householdId) };
  });

  app.post("/users", async (req, reply) => {
    const principal = req.principal;
    if (!principal || principal.role !== "admin") return fail(reply, 403, "Admin access required.");
    const body = createUserBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, "Username, password, and role are required.");
    try {
      const user = await authService.createUser({
        username: body.data.username,
        password: body.data.password,
        role: body.data.role,
        householdId: principal.householdId,
      });
      return reply.code(201).send({ user });
    } catch (e) {
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  const setUserDisabled = async (
    req: { principal?: Principal; params: { id: string } },
    reply: Parameters<typeof fail>[0],
    disabled: boolean,
  ) => {
    const principal = req.principal;
    if (!principal || principal.role !== "admin") return fail(reply, 403, "Admin access required.");
    // Guard against self-lockout: an admin can't disable their own account.
    if (disabled && req.params.id === principal.userId)
      return fail(reply, 400, "You can't disable your own account.");
    try {
      return {
        user: await authService.setDisabled(req.params.id, disabled, principal.householdId),
      };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "User not found.");
      throw e;
    }
  };
  app.post<IdParams>("/users/:id/disable", (req, reply) => setUserDisabled(req, reply, true));
  app.post<IdParams>("/users/:id/enable", (req, reply) => setUserDisabled(req, reply, false));

  app.post<IdParams>("/users/:id/reset-password", async (req, reply) => {
    const principal = req.principal;
    if (!principal || principal.role !== "admin") return fail(reply, 403, "Admin access required.");
    const body = resetPasswordBody.safeParse(req.body);
    if (!body.success) return fail(reply, 400, "A new password is required.");
    try {
      await authService.resetPassword(req.params.id, body.data.password, principal.householdId);
      return { ok: true };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "User not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // Per-domain route plugins. Paths are full literals (no Fastify `prefix`), because several
  // domains share URL roots that cross boundaries (e.g. credit-limit/target setters live under
  // /accounts and /envelopes but belong to the analysis area).
  void app.register(accountRoutes, { clock });
  void app.register(envelopeRoutes, { clock });
  void app.register(transactionRoutes, { clock });
  void app.register(reconcileRoutes, { clock });
  void app.register(transferRoutes, { clock });
  void app.register(recurringRoutes, { clock });
  void app.register(analysisRoutes, { clock });
  void app.register(templateRoutes, { clock });
  void app.register(backupRoutes, { clock });

  return app;
}
