import { z } from "zod";
import { todayStr } from "../../util/dates";
import { NotFoundError, ValidationError } from "../../services/errors";
import { DATE_RE, type IdParams, type RoutePlugin, fail, parsePositiveMagnitude } from "./shared";

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

// --- Transfers (FEAT-007, account↔account double-entry) + envelope reallocation (#7b) ---
export const transferRoutes: RoutePlugin = async (app, opts) => {
  const { transfers, envelopeTransfers } = opts.services;

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

  app.delete<IdParams>("/transfers/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await transfers.remove(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Transfer not found.");
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
};
