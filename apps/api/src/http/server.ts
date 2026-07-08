import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { makeAccountService } from "../services/accountService";
import { makeEnvelopeService } from "../services/envelopeService";
import { makeTransactionService } from "../services/transactionService";
import { makeTransferService } from "../services/transferService";
import { makeEnvelopeTransferService } from "../services/envelopeTransferService";
import { makeRecurringService } from "../services/recurringService";
import { makeReconcileService } from "../services/reconcileService";
import { makeTemplateService } from "../services/templateService";
import { makeAnalysisService } from "../services/analysisService";
import { makeTargetService } from "../services/targetService";
import { makeCreditLimitService } from "../services/creditLimitService";
import { makeLoanPrincipalService } from "../services/loanPrincipalService";
import { makeBackupService } from "../services/backupService";
import { type Clock, systemClock } from "../util/dates";
import { type Services, fail } from "./routes/shared";
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

  // One service container, constructed once and shared (by reference) with every route plugin —
  // modularizing the routes does not duplicate service instances or DB wiring.
  const services: Services = {
    accounts: makeAccountService(db),
    envelopes: makeEnvelopeService(db),
    transactions: makeTransactionService(db),
    transfers: makeTransferService(db),
    envelopeTransfers: makeEnvelopeTransferService(db),
    recurring: makeRecurringService(db),
    reconcile: makeReconcileService(db),
    templates: makeTemplateService(db),
    analysis: makeAnalysisService(db),
    targets: makeTargetService(db),
    creditLimits: makeCreditLimitService(db),
    loanPrincipals: makeLoanPrincipalService(db),
    backup: makeBackupService(db),
  };

  // Single error envelope for the whole API: `{ error: { message } }`. Set on the root so it is
  // inherited by every route plugin (children don't override it). 5xx detail is never leaked.
  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) app.log.error(e);
    return fail(reply, status, status >= 500 ? "Something went wrong." : e.message);
  });

  app.get("/health", async () => ({ status: "ok" }));

  // Per-domain route plugins. Paths are full literals (no Fastify `prefix`), because several
  // domains share URL roots that cross boundaries (e.g. credit-limit/target setters live under
  // /accounts and /envelopes but belong to the analysis area).
  void app.register(accountRoutes, { services, clock });
  void app.register(envelopeRoutes, { services, clock });
  void app.register(transactionRoutes, { services, clock });
  void app.register(reconcileRoutes, { services, clock });
  void app.register(transferRoutes, { services, clock });
  void app.register(recurringRoutes, { services, clock });
  void app.register(analysisRoutes, { services, clock });
  void app.register(templateRoutes, { services, clock });
  void app.register(backupRoutes, { services, clock });

  return app;
}
