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
import { DuplicateNameError, NotFoundError } from "../services/errors";

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

function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ error: { message } });
}

export function buildServer(db: Kysely<DB>, opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });
  const accounts = makeAccountService(db);
  const envelopes = makeEnvelopeService(db);

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

  return app;
}
