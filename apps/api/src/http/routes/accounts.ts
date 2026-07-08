import { z } from "zod";
import { isAccountKind, parseMoney, validateAccountName } from "@budgeteer/domain";
import { DuplicateNameError, NotFoundError } from "../../services/errors";
import { DATE_RE, type IdParams, type RoutePlugin, fail } from "./shared";

const createAccountBody = z.object({
  name: z.string(),
  kind: z.string(),
  startingBalance: z.string().default("0"),
  openedOn: z.string(), // caller-local date for the opening-balance row (EH8)
});
const renameBody = z.object({ name: z.string() });

// --- Accounts (FEAT-001) ---
export const accountRoutes: RoutePlugin = async (app, opts) => {
  const { accounts } = opts.services;

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
    if (!DATE_RE.test(parsed.data.openedOn))
      return fail(reply, 400, "openedOn is required, YYYY-MM-DD.");
    try {
      const account = await accounts.create({
        name: nameCheck.name,
        kind: parsed.data.kind,
        startingBalanceCents,
        openedOn: parsed.data.openedOn,
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

  app.post<IdParams>("/accounts/:id/archive", async (req, reply) => {
    const { id } = req.params;
    try {
      return { account: await accounts.setArchived(id, true) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  app.post<IdParams>("/accounts/:id/unarchive", async (req, reply) => {
    const { id } = req.params;
    try {
      return { account: await accounts.setArchived(id, false) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });
};
