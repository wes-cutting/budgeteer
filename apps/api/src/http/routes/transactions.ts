import { z } from "zod";
import { currentMonthRange, todayStr } from "../../util/dates";
import { ConflictError, NotFoundError, ValidationError } from "../../services/errors";
import {
  DATE_RE,
  type AccountIdParams,
  type IdParams,
  type RoutePlugin,
  fail,
  parsePositiveMagnitude,
} from "./shared";

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

type AccountTxnsRoute = {
  Params: { accountId: string };
  Querystring: { from?: string; to?: string };
};

// --- Transactions & allocation (FEAT-003) ---
export const transactionRoutes: RoutePlugin = async (app, opts) => {
  const { transactions } = opts.services;

  app.get("/transactions/needs-allocation", async () => ({
    transactions: await transactions.needsAllocation(),
  }));

  app.get<AccountTxnsRoute>("/accounts/:accountId/transactions", async (req, reply) => {
    const { accountId } = req.params;
    // Default the register to the current calendar month (R8); `opening` rows always show.
    const def = currentMonthRange();
    const from = req.query.from ?? def.from;
    const to = req.query.to ?? def.to;
    if (!DATE_RE.test(from) || !DATE_RE.test(to))
      return fail(reply, 400, "from/to must be YYYY-MM-DD.");
    try {
      return { transactions: await transactions.listByAccount(accountId, { from, to }) };
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

  app.delete<IdParams>("/transactions/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await transactions.remove(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Transaction not found.");
      if (e instanceof ConflictError) return fail(reply, 409, e.message);
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
};
