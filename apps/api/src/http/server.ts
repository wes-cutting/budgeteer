import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import type { Kysely } from "kysely";
import { z } from "zod";
import {
  FORECAST_HORIZON_DEFAULT,
  FORECAST_HORIZON_MAX,
  FORECAST_HORIZON_MIN,
  isAccountKind,
  isEnvelopeKind,
  isRecurringFrequency,
  parseMoney,
  validateAccountName,
  validateEnvelopeName,
  validateName,
} from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { todayStr } from "../util/dates";
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
import { DuplicateNameError, NotFoundError, ValidationError } from "../services/errors";

const createAccountBody = z.object({
  name: z.string(),
  kind: z.string(),
  startingBalance: z.string().default("0"),
});
const createEnvelopeBody = z.object({
  name: z.string(),
  kind: z.string().default("standard"),
});
const renameBody = z.object({ name: z.string() });
const setTargetBody = z.object({ amount: z.string() });
const setCreditLimitBody = z.object({ amount: z.string() });
const setOriginalPrincipalBody = z.object({ amount: z.string() });

const allocationInput = z.object({
  envelopeId: z.string().min(1),
  amount: z.string(),
  refund: z.boolean().optional(),
});
const createTransactionBody = z.object({
  kind: z.enum(["deposit", "withdrawal"]),
  amount: z.string(),
  occurredOn: z.string().optional(),
  payee: z.string().optional(),
  memo: z.string().optional(),
  allocations: z.array(allocationInput).default([]),
});
const setAllocationsBody = z.object({ allocations: z.array(allocationInput).default([]) });

const createTransferBody = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.string(),
  occurredOn: z.string().optional(),
  memo: z.string().optional(),
});

const createEnvelopeTransferBody = z.object({
  fromEnvelopeId: z.string().min(1),
  toEnvelopeId: z.string().min(1),
  amount: z.string(),
  occurredOn: z.string().optional(),
  memo: z.string().optional(),
});

const createRecurringBody = z.object({
  accountId: z.string().min(1),
  kind: z.enum(["deposit", "withdrawal"]),
  amount: z.string(),
  payee: z.string().optional(),
  memo: z.string().optional(),
  frequency: z.string(),
  anchorOn: z.string(),
  lines: z.array(allocationInput).default([]),
});

const createReconciliationBody = z.object({
  statementBalance: z.string(),
  reconciledOn: z.string().optional(),
});

const templateLineInput = z.object({ envelopeId: z.string().min(1), amount: z.string() });
const upsertTemplateBody = z.object({
  name: z.string(),
  lines: z.array(templateLineInput).default([]),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ error: { message } });
}

/** Parse a positive money magnitude; returns null on invalid input or ≤ 0. */
function parsePositiveMagnitude(s: string): number | null {
  try {
    const c = parseMoney(s);
    return c > 0 ? c : null;
  } catch {
    return null;
  }
}

/** Parse template line magnitudes; null if any amount is invalid or ≤ 0. */
function parseTemplateLines(
  raw: { envelopeId: string; amount: string }[],
): { envelopeId: string; amountCents: number }[] | null {
  const lines: { envelopeId: string; amountCents: number }[] = [];
  for (const l of raw) {
    const m = parsePositiveMagnitude(l.amount);
    if (m === null) return null;
    lines.push({ envelopeId: l.envelopeId, amountCents: m });
  }
  return lines;
}

/** Route param shapes — supplied as Fastify route generics so `req.params` is typed (no casts). */
type IdParams = { Params: { id: string } };
type AccountIdParams = { Params: { accountId: string } };
type SpendQuery = { Querystring: { grain?: string } };
type MonthQuery = { Querystring: { month?: string } };
type ForecastQuery = {
  Querystring: { accountId?: string; horizonDays?: string; includeExpected?: string };
};

export function buildServer(
  db: Kysely<DB>,
  opts: { logger?: boolean; corsOrigins?: string[] } = {},
): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  // Browsers call this API cross-origin (web on :5173, API on :3001), so it must send CORS
  // headers or the browser blocks every response ("Failed to fetch"). Allowlist only — the
  // configured origins, never `*` (SECURITY.md). Default covers the Vite dev origin.
  // `methods` must list every verb the API uses: @fastify/cors otherwise defaults the preflight's
  // Access-Control-Allow-Methods to GET,HEAD,POST, which silently blocks cross-origin PUT/PATCH/
  // DELETE (rename, edit-split, template/recurring delete, budget targets) in the browser.
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

  const accounts = makeAccountService(db);
  const envelopes = makeEnvelopeService(db);
  const transactions = makeTransactionService(db);
  const transfers = makeTransferService(db);
  const envelopeTransfers = makeEnvelopeTransferService(db);
  const recurring = makeRecurringService(db);
  const reconcile = makeReconcileService(db);
  const templates = makeTemplateService(db);
  const analysis = makeAnalysisService(db);
  const targets = makeTargetService(db);
  const creditLimits = makeCreditLimitService(db);
  const loanPrincipals = makeLoanPrincipalService(db);
  const backup = makeBackupService(db);

  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) app.log.error(e);
    return fail(reply, status, status >= 500 ? "Something went wrong." : e.message);
  });

  app.get("/health", async () => ({ status: "ok" }));

  // --- Accounts (FEAT-001) ---
  app.get("/accounts", async () => ({ accounts: await accounts.list() }));

  app.post("/accounts", async (req, reply) => {
    const parsed = createAccountBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateAccountName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    if (!isAccountKind(parsed.data.kind)) return fail(reply, 400, "Unknown account kind.");
    let startingBalanceCents: number;
    try {
      startingBalanceCents = parseMoney(parsed.data.startingBalance);
    } catch {
      return fail(reply, 400, "Enter an amount like 1234.56.");
    }
    try {
      const account = await accounts.create({
        name: nameCheck.name,
        kind: parsed.data.kind,
        startingBalanceCents,
      });
      return reply.code(201).send({ account });
    } catch (e) {
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  app.patch<IdParams>("/accounts/:id", async (req, reply) => {
    const parsed = renameBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateAccountName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    const { id } = req.params;
    try {
      const account = await accounts.rename(id, nameCheck.name);
      return { account };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  // --- Envelopes (FEAT-002) ---
  app.get("/envelopes", async () => ({ envelopes: await envelopes.list() }));

  app.post("/envelopes", async (req, reply) => {
    const parsed = createEnvelopeBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateEnvelopeName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    if (!isEnvelopeKind(parsed.data.kind)) return fail(reply, 400, "Unknown envelope kind.");
    try {
      const envelope = await envelopes.create({ name: nameCheck.name, kind: parsed.data.kind });
      return reply.code(201).send({ envelope });
    } catch (e) {
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  app.patch<IdParams>("/envelopes/:id", async (req, reply) => {
    const parsed = renameBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateEnvelopeName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    const { id } = req.params;
    try {
      const envelope = await envelopes.rename(id, nameCheck.name);
      return { envelope };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  app.post<IdParams>("/envelopes/:id/archive", async (req, reply) => {
    const { id } = req.params;
    try {
      return { envelope: await envelopes.setArchived(id, true) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });

  app.post<IdParams>("/envelopes/:id/unarchive", async (req, reply) => {
    const { id } = req.params;
    try {
      return { envelope: await envelopes.setArchived(id, false) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });

  // --- Transactions & allocation (FEAT-003) ---
  app.get("/transactions/needs-allocation", async () => ({
    transactions: await transactions.needsAllocation(),
  }));

  app.get<AccountIdParams>("/accounts/:accountId/transactions", async (req, reply) => {
    const { accountId } = req.params;
    try {
      return { transactions: await transactions.listByAccount(accountId) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  app.post<AccountIdParams>("/accounts/:accountId/transactions", async (req, reply) => {
    const parsed = createTransactionBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an amount greater than 0.");
    const occurredOn = parsed.data.occurredOn ?? todayStr();
    if (!DATE_RE.test(occurredOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    const allocations: { envelopeId: string; magnitudeCents: number; refund: boolean }[] = [];
    for (const a of parsed.data.allocations) {
      const m = parsePositiveMagnitude(a.amount);
      if (m === null) return fail(reply, 400, "Each allocation amount must be greater than 0.");
      allocations.push({ envelopeId: a.envelopeId, magnitudeCents: m, refund: a.refund ?? false });
    }
    const { accountId } = req.params;
    try {
      const transaction = await transactions.create(accountId, {
        direction: parsed.data.kind,
        magnitudeCents: magnitude,
        occurredOn,
        payee: parsed.data.payee ?? null,
        memo: parsed.data.memo ?? null,
        allocations,
      });
      return reply.code(201).send({ transaction });
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.put<IdParams>("/transactions/:id/allocations", async (req, reply) => {
    const parsed = setAllocationsBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const allocations: { envelopeId: string; magnitudeCents: number; refund: boolean }[] = [];
    for (const a of parsed.data.allocations) {
      const m = parsePositiveMagnitude(a.amount);
      if (m === null) return fail(reply, 400, "Each allocation amount must be greater than 0.");
      allocations.push({ envelopeId: a.envelopeId, magnitudeCents: m, refund: a.refund ?? false });
    }
    const { id } = req.params;
    try {
      const transaction = await transactions.replaceAllocations(id, allocations);
      return { transaction };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Transaction not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // --- Reconcile to bank (FEAT-010, manual balance compare) ---
  app.get<AccountIdParams>("/accounts/:accountId/reconciliations", async (req, reply) => {
    const { accountId } = req.params;
    try {
      return { reconciliations: await reconcile.listByAccount(accountId) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  app.post<AccountIdParams>("/accounts/:accountId/reconciliations", async (req, reply) => {
    const parsed = createReconciliationBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    let statementBalanceCents: number;
    try {
      statementBalanceCents = parseMoney(parsed.data.statementBalance);
    } catch {
      return fail(reply, 400, "Enter an amount like 1234.56.");
    }
    const reconciledOn = parsed.data.reconciledOn ?? todayStr();
    if (!DATE_RE.test(reconciledOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    const { accountId } = req.params;
    try {
      const reconciliation = await reconcile.create(accountId, {
        statementBalanceCents,
        reconciledOn,
      });
      return reply.code(201).send({ reconciliation });
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  // --- Transfers (FEAT-007, account↔account double-entry) ---
  app.post("/transfers", async (req, reply) => {
    const parsed = createTransferBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an amount greater than 0.");
    const occurredOn = parsed.data.occurredOn ?? todayStr();
    if (!DATE_RE.test(occurredOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    try {
      const transfer = await transfers.create({
        fromAccountId: parsed.data.fromAccountId,
        toAccountId: parsed.data.toAccountId,
        magnitudeCents: magnitude,
        occurredOn,
        memo: parsed.data.memo ?? null,
      });
      return reply.code(201).send({ transfer });
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // --- Envelope reallocation (FEAT-007 #7b, envelope↔envelope) ---
  app.post("/envelope-transfers", async (req, reply) => {
    const parsed = createEnvelopeTransferBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an amount greater than 0.");
    const occurredOn = parsed.data.occurredOn ?? todayStr();
    if (!DATE_RE.test(occurredOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    try {
      const envelopeTransfer = await envelopeTransfers.create({
        fromEnvelopeId: parsed.data.fromEnvelopeId,
        toEnvelopeId: parsed.data.toEnvelopeId,
        magnitudeCents: magnitude,
        occurredOn,
        memo: parsed.data.memo ?? null,
      });
      return reply.code(201).send({ envelopeTransfer });
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // --- Recurring transactions (FEAT-009) ---
  app.get("/recurring", async () => ({ recurring: await recurring.list() }));

  app.post("/recurring", async (req, reply) => {
    const parsed = createRecurringBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an amount greater than 0.");
    if (!isRecurringFrequency(parsed.data.frequency))
      return fail(reply, 400, "Choose weekly, biweekly, or monthly.");
    if (!DATE_RE.test(parsed.data.anchorOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    if (parsed.data.lines.length === 0) return fail(reply, 400, "Add at least one split line.");
    const lines: { envelopeId: string; magnitudeCents: number; refund: boolean }[] = [];
    for (const l of parsed.data.lines) {
      const m = parsePositiveMagnitude(l.amount);
      if (m === null) return fail(reply, 400, "Each split amount must be greater than 0.");
      lines.push({ envelopeId: l.envelopeId, magnitudeCents: m, refund: l.refund ?? false });
    }
    try {
      const rule = await recurring.create({
        accountId: parsed.data.accountId,
        direction: parsed.data.kind,
        magnitudeCents: magnitude,
        payee: parsed.data.payee ?? null,
        memo: parsed.data.memo ?? null,
        frequency: parsed.data.frequency,
        anchorOn: parsed.data.anchorOn,
        lines,
      });
      return reply.code(201).send({ recurring: rule });
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/recurring/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await recurring.remove(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Recurring rule not found.");
      throw e;
    }
  });

  app.post("/recurring/post-due", async () => ({ result: await recurring.postDue() }));

  // --- Analysis: spend by envelope over time (FEAT-011) ---
  app.get<SpendQuery>("/analysis/envelope-spend", async (req, reply) => {
    const grain = req.query.grain ?? "month";
    if (grain !== "month" && grain !== "year")
      return fail(reply, 400, "grain must be 'month' or 'year'.");
    return { rollup: await analysis.envelopeSpend(grain) };
  });

  // --- Analysis: budget vs. actual (FEAT-012) ---
  app.get<MonthQuery>("/analysis/budget-vs-actual", async (req, reply) => {
    const month = req.query.month ?? todayStr().slice(0, 7);
    if (!MONTH_RE.test(month)) return fail(reply, 400, "month must be 'YYYY-MM'.");
    return { report: await analysis.budgetVsActual(month) };
  });

  // --- Analysis: cash-flow forecast (FEAT-013) ---
  app.get<ForecastQuery>("/analysis/cash-flow-forecast", async (req, reply) => {
    const accountId = req.query.accountId;
    if (!accountId) return fail(reply, 400, "accountId is required.");
    const horizonDays =
      req.query.horizonDays === undefined
        ? FORECAST_HORIZON_DEFAULT
        : Number(req.query.horizonDays);
    if (
      !Number.isInteger(horizonDays) ||
      horizonDays < FORECAST_HORIZON_MIN ||
      horizonDays > FORECAST_HORIZON_MAX
    )
      return fail(
        reply,
        400,
        `horizonDays must be an integer ${FORECAST_HORIZON_MIN}–${FORECAST_HORIZON_MAX}.`,
      );
    const includeExpected = req.query.includeExpected !== "false"; // default true
    try {
      return {
        forecast: await analysis.cashFlowForecast(accountId, { horizonDays, includeExpected }),
      };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  // --- Analysis: credit utilization (FEAT-014a) ---
  app.get("/analysis/credit-utilization", async () => ({
    report: await analysis.creditUtilization(),
  }));

  // Set / clear a credit account's limit (the reference number for FEAT-014a utilization).
  app.put<IdParams>("/accounts/:id/credit-limit", async (req, reply) => {
    const parsed = setCreditLimitBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter a limit greater than 0.");
    const { id } = req.params;
    try {
      const creditLimit = await creditLimits.set(id, magnitude);
      return { creditLimit };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/accounts/:id/credit-limit", async (req, reply) => {
    const { id } = req.params;
    try {
      await creditLimits.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // --- Analysis: debt payoff (FEAT-014b) ---
  app.get("/analysis/debt-payoff", async () => ({
    report: await analysis.debtPayoff(),
  }));

  // Set / clear a loan account's original principal (the reference number for FEAT-014b payoff).
  app.put<IdParams>("/accounts/:id/original-principal", async (req, reply) => {
    const parsed = setOriginalPrincipalBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an original principal greater than 0.");
    const { id } = req.params;
    try {
      const loanPrincipal = await loanPrincipals.set(id, magnitude);
      return { loanPrincipal };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/accounts/:id/original-principal", async (req, reply) => {
    const { id } = req.params;
    try {
      await loanPrincipals.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // Set / clear an envelope's recurring monthly budget target (the "budget" half of FEAT-012).
  app.put<IdParams>("/envelopes/:id/target", async (req, reply) => {
    const parsed = setTargetBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter a target greater than 0.");
    const { id } = req.params;
    try {
      const target = await targets.set(id, magnitude);
      return { target };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });

  app.delete<IdParams>("/envelopes/:id/target", async (req, reply) => {
    const { id } = req.params;
    try {
      await targets.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });

  // --- Allocation templates (FEAT-004) ---
  app.get("/templates", async () => ({ templates: await templates.list() }));

  app.post("/templates", async (req, reply) => {
    const parsed = upsertTemplateBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateName(parsed.data.name, "Template");
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    if (parsed.data.lines.length === 0)
      return fail(reply, 400, "A template needs at least one line.");
    const lines = parseTemplateLines(parsed.data.lines);
    if (lines === null) return fail(reply, 400, "Each line amount must be greater than 0.");
    try {
      const template = await templates.create({ name: nameCheck.name, lines });
      return reply.code(201).send({ template });
    } catch (e) {
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.put<IdParams>("/templates/:id", async (req, reply) => {
    const parsed = upsertTemplateBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateName(parsed.data.name, "Template");
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    if (parsed.data.lines.length === 0)
      return fail(reply, 400, "A template needs at least one line.");
    const lines = parseTemplateLines(parsed.data.lines);
    if (lines === null) return fail(reply, 400, "Each line amount must be greater than 0.");
    const { id } = req.params;
    try {
      const template = await templates.update(id, { name: nameCheck.name, lines });
      return { template };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Template not found.");
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/templates/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await templates.remove(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Template not found.");
      throw e;
    }
  });

  // --- Backup / export (FEAT-015a) ---
  // Returns a household JSON snapshot for download. Content-Disposition: attachment causes the
  // browser to save the file rather than display it. Body is never logged (financial data).
  app.get("/export", async (_req, reply) => {
    const snapshot = await backup.snapshot();
    const filename = `budgeteer-backup-${todayStr()}.json`;
    return reply
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .type("application/json")
      .send(JSON.stringify(snapshot, null, 2));
  });

  return app;
}
