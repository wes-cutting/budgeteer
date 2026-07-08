import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { parseMoney } from "@budgeteer/domain";
import type { Clock } from "../../util/dates";
import type { makeAccountService } from "../../services/accountService";
import type { makeEnvelopeService } from "../../services/envelopeService";
import type { makeTransactionService } from "../../services/transactionService";
import type { makeTransferService } from "../../services/transferService";
import type { makeEnvelopeTransferService } from "../../services/envelopeTransferService";
import type { makeRecurringService } from "../../services/recurringService";
import type { makeReconcileService } from "../../services/reconcileService";
import type { makeTemplateService } from "../../services/templateService";
import type { makeAnalysisService } from "../../services/analysisService";
import type { makeTargetService } from "../../services/targetService";
import type { makeCreditLimitService } from "../../services/creditLimitService";
import type { makeLoanPrincipalService } from "../../services/loanPrincipalService";
import type { makeBackupService } from "../../services/backupService";

/**
 * The service container created once in `buildServer` and handed to every route plugin via
 * options. Splitting routes into per-domain plugins does not duplicate service instances —
 * each is constructed exactly once and shared by reference.
 */
export interface Services {
  accounts: ReturnType<typeof makeAccountService>;
  envelopes: ReturnType<typeof makeEnvelopeService>;
  transactions: ReturnType<typeof makeTransactionService>;
  transfers: ReturnType<typeof makeTransferService>;
  envelopeTransfers: ReturnType<typeof makeEnvelopeTransferService>;
  recurring: ReturnType<typeof makeRecurringService>;
  reconcile: ReturnType<typeof makeReconcileService>;
  templates: ReturnType<typeof makeTemplateService>;
  analysis: ReturnType<typeof makeAnalysisService>;
  targets: ReturnType<typeof makeTargetService>;
  creditLimits: ReturnType<typeof makeCreditLimitService>;
  loanPrincipals: ReturnType<typeof makeLoanPrincipalService>;
  backup: ReturnType<typeof makeBackupService>;
}

/** Options every route plugin receives from `buildServer`. */
export interface RouteOptions {
  services: Services;
  /** The injected clock (EH7) — operational stamps only (backup filename); user-facing
   *  calendar dates come from the caller (EH8, 04_DOMAIN_MODEL §6). */
  clock: Clock;
}

/** Every route module is an encapsulated Fastify plugin over the shared service container. */
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
