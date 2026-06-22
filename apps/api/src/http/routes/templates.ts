import { z } from "zod";
import { validateName } from "@budgeteer/domain";
import { DuplicateNameError, NotFoundError, ValidationError } from "../../services/errors";
import { type IdParams, type RoutePlugin, fail, parseTemplateLines } from "./shared";

const templateLineInput = z.object({ envelopeId: z.string().min(1), amount: z.string() });
const upsertTemplateBody = z.object({
  name: z.string(),
  lines: z.array(templateLineInput).default([]),
});

// --- Allocation templates (FEAT-004) ---
export const templateRoutes: RoutePlugin = async (app, opts) => {
  const { templates } = opts.services;

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
};
