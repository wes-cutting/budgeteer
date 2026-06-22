import { z } from "zod";
import { isRecurringFrequency } from "@budgeteer/domain";
import { NotFoundError, ValidationError } from "../../services/errors";
import { DATE_RE, type IdParams, type RoutePlugin, fail, parsePositiveMagnitude } from "./shared";

const allocationInput = z.object({
  envelopeId: z.string().min(1),
  amount: z.string(),
  refund: z.boolean().optional(),
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

// --- Recurring transactions (FEAT-009) ---
export const recurringRoutes: RoutePlugin = async (app, opts) => {
  const { recurring } = opts.services;

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
};
