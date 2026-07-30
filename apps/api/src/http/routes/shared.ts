import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { parseMoney } from "@budgeteer/domain";
import type { Clock } from "../../util/dates";
import type { Services } from "../../services/container";

/**
 * Every request carries its own scope-bound service container, built per request in
 * `buildServer`'s `onRequest` hook (ADR-0009 §2 · BUD-S86): each service filters by the request's
 * `scope.householdId`, so a handler can only ever reach its own household's data. Handlers read
 * `req.services.*` — there is no shared, unscoped container.
 */
declare module "fastify" {
  interface FastifyRequest {
    services: Services;
  }
}

/** Options every route plugin receives from `buildServer`. */
export interface RouteOptions {
  /** The injected clock (EH7) — operational stamps only (backup filename); user-facing
   *  calendar dates come from the caller (EH8, 04_DOMAIN_MODEL §6). */
  clock: Clock;
}

/** Every route module is an encapsulated Fastify plugin; services come from `req.services`. */
export type RoutePlugin = FastifyPluginAsync<RouteOptions>;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Route param shapes — supplied as Fastify route generics so `req.params` is typed (no casts). */
export type IdParams = { Params: { id: string } };
export type AccountIdParams = { Params: { accountId: string } };

/** The single error-envelope shape every route returns: `{ error: { message } }`. */
export function fail(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).send({ error: { message } });
}

/** Parse a positive money magnitude; returns null on invalid input or ≤ 0. */
export function parsePositiveMagnitude(s: string): number | null {
  try {
    const c = parseMoney(s);
    return c > 0 ? c : null;
  } catch {
    return null;
  }
}

/** Parse template line magnitudes; null if any amount is invalid or ≤ 0. */
export function parseTemplateLines(
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
