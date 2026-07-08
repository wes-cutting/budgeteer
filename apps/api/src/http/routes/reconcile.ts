import { z } from "zod";
import { parseMoney } from "@budgeteer/domain";
import { todayStr } from "../../util/dates";
import { NotFoundError } from "../../services/errors";
import { DATE_RE, type AccountIdParams, type RoutePlugin, fail } from "./shared";

const createReconciliationBody = z.object({
  statementBalance: z.string(),
  reconciledOn: z.string().optional(),
});

// --- Reconcile to bank (FEAT-010, manual balance compare) ---
export const reconcileRoutes: RoutePlugin = async (app, opts) => {
  const { reconcile } = opts.services;

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
    const reconciledOn = parsed.data.reconciledOn ?? todayStr(opts.clock);
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
};
