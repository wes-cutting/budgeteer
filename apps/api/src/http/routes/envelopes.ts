import { z } from "zod";
import { isEnvelopeKind, validateEnvelopeName } from "@budgeteer/domain";
import { DuplicateNameError, NotFoundError } from "../../services/errors";
import { type IdParams, type RoutePlugin, fail } from "./shared";

const createEnvelopeBody = z.object({
  name: z.string(),
  kind: z.string().default("standard"),
});
const renameBody = z.object({ name: z.string() });

// --- Envelopes (FEAT-002) ---
export const envelopeRoutes: RoutePlugin = async (app, opts) => {
  const { envelopes } = opts.services;

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

  app.get<IdParams>("/envelopes/:id/ledger", async (req, reply) => {
    const { id } = req.params;
    try {
      return { rows: await envelopes.ledger(id) };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
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
};
