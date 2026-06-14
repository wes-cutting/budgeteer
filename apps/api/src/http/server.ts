import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { Kysely } from "kysely";
import { z } from "zod";
import {
  isAccountKind,
  isEnvelopeKind,
  parseMoney,
  validateAccountName,
  validateEnvelopeName,
} from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { makeAccountService } from "../services/accountService";
import { makeEnvelopeService } from "../services/envelopeService";
import { makeTransactionService } from "../services/transactionService";
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

const allocationInput = z.object({ envelopeId: z.string().min(1), amount: z.string() });
const createTransactionBody = z.object({
  kind: z.enum(["deposit", "withdrawal"]),
  amount: z.string(),
  occurredOn: z.string().optional(),
  payee: z.string().optional(),
  memo: z.string().optional(),
  allocations: z.array(allocationInput).default([]),
});
const setAllocationsBody = z.object({ allocations: z.array(allocationInput).default([]) });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayStr = (): string => new Date().toISOString().slice(0, 10);

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

export function buildServer(db: Kysely<DB>, opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  const accounts = makeAccountService(db);
  const envelopes = makeEnvelopeService(db);
  const transactions = makeTransactionService(db);

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    return fail(reply, 500, "Something went wrong.");
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

  app.patch("/accounts/:id", async (req, reply) => {
    const parsed = renameBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateAccountName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    const { id } = req.params as { id: string };
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

  app.patch("/envelopes/:id", async (req, reply) => {
    const parsed = renameBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const nameCheck = validateEnvelopeName(parsed.data.name);
    if (!nameCheck.ok) return fail(reply, 400, nameCheck.reason);
    const { id } = req.params as { id: string };
    try {
      const envelope = await envelopes.rename(id, nameCheck.name);
      return { envelope };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      if (e instanceof DuplicateNameError) return fail(reply, 409, e.message);
      throw e;
    }
  });

  // --- Transactions & allocation (FEAT-003) ---
  app.get("/transactions/needs-allocation", async () => ({
    transactions: await transactions.needsAllocation(),
  }));

  app.get("/accounts/:accountId/transactions", async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    try {
      return { transactions: await transactions.listByAccount(accountId) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  app.post("/accounts/:accountId/transactions", async (req, reply) => {
    const parsed = createTransactionBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an amount greater than 0.");
    const occurredOn = parsed.data.occurredOn ?? todayStr();
    if (!DATE_RE.test(occurredOn)) return fail(reply, 400, "Date must be YYYY-MM-DD.");
    const allocations: { envelopeId: string; magnitudeCents: number }[] = [];
    for (const a of parsed.data.allocations) {
      const m = parsePositiveMagnitude(a.amount);
      if (m === null) return fail(reply, 400, "Each allocation amount must be greater than 0.");
      allocations.push({ envelopeId: a.envelopeId, magnitudeCents: m });
    }
    const { accountId } = req.params as { accountId: string };
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

  app.put("/transactions/:id/allocations", async (req, reply) => {
    const parsed = setAllocationsBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const allocations: { envelopeId: string; magnitudeCents: number }[] = [];
    for (const a of parsed.data.allocations) {
      const m = parsePositiveMagnitude(a.amount);
      if (m === null) return fail(reply, 400, "Each allocation amount must be greater than 0.");
      allocations.push({ envelopeId: a.envelopeId, magnitudeCents: m });
    }
    const { id } = req.params as { id: string };
    try {
      const transaction = await transactions.replaceAllocations(id, allocations);
      return { transaction };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Transaction not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  return app;
}
