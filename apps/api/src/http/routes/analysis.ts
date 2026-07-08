import { z } from "zod";
import {
  FORECAST_HORIZON_DEFAULT,
  FORECAST_HORIZON_MAX,
  FORECAST_HORIZON_MIN,
} from "@budgeteer/domain";
import { NotFoundError, ValidationError } from "../../services/errors";
import {
  DATE_RE,
  MONTH_RE,
  type IdParams,
  type RoutePlugin,
  fail,
  parsePositiveMagnitude,
} from "./shared";

const setCreditLimitBody = z.object({ amount: z.string() });
const setOriginalPrincipalBody = z.object({ amount: z.string() });
const setTargetBody = z.object({ amount: z.string() });

type SpendQuery = { Querystring: { grain?: string } };
type MonthQuery = { Querystring: { month?: string } };
type ForecastQuery = {
  Querystring: {
    accountId?: string;
    horizonDays?: string;
    includeExpected?: string;
    today?: string;
  };
};

// --- Analysis (FEAT-011 … FEAT-014b, R9) + the reference-number setters those reports read ---
export const analysisRoutes: RoutePlugin = async (app, opts) => {
  const { analysis, creditLimits, loanPrincipals, targets } = opts.services;

  // --- Analysis: spend by envelope over time (FEAT-011) ---
  app.get<SpendQuery>("/analysis/envelope-spend", async (req, reply) => {
    const grain = req.query.grain ?? "month";
    if (grain !== "month" && grain !== "year")
      return fail(reply, 400, "grain must be 'month' or 'year'.");
    return { rollup: await analysis.envelopeSpend(grain) };
  });

  // --- Analysis: budget vs. actual (FEAT-012) ---
  // Calendar dates are user-local (EH8): the caller supplies the month; no server-derived default.
  app.get<MonthQuery>("/analysis/budget-vs-actual", async (req, reply) => {
    const month = req.query.month;
    if (month === undefined || !MONTH_RE.test(month))
      return fail(reply, 400, "month is required, 'YYYY-MM'.");
    return { report: await analysis.budgetVsActual(month) };
  });

  // --- Analysis: cash-flow forecast (FEAT-013) ---
  app.get<ForecastQuery>("/analysis/cash-flow-forecast", async (req, reply) => {
    const accountId = req.query.accountId;
    if (!accountId) return fail(reply, 400, "accountId is required.");
    const horizonDays =
      req.query.horizonDays === undefined
        ? FORECAST_HORIZON_DEFAULT
        : Number(req.query.horizonDays);
    if (
      !Number.isInteger(horizonDays) ||
      horizonDays < FORECAST_HORIZON_MIN ||
      horizonDays > FORECAST_HORIZON_MAX
    )
      return fail(
        reply,
        400,
        `horizonDays must be an integer ${FORECAST_HORIZON_MIN}–${FORECAST_HORIZON_MAX}.`,
      );
    const includeExpected = req.query.includeExpected !== "false"; // default true
    // The forecast projects forward from the caller's local "today" (EH8).
    const today = req.query.today;
    if (today === undefined || !DATE_RE.test(today))
      return fail(reply, 400, "today is required, YYYY-MM-DD.");
    try {
      return {
        forecast: await analysis.cashFlowForecast(accountId, {
          horizonDays,
          includeExpected,
          today,
        }),
      };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      throw e;
    }
  });

  // --- Analysis: credit utilization (FEAT-014a) ---
  app.get("/analysis/credit-utilization", async () => ({
    report: await analysis.creditUtilization(),
  }));

  // Set / clear a credit account's limit (the reference number for FEAT-014a utilization).
  app.put<IdParams>("/accounts/:id/credit-limit", async (req, reply) => {
    const parsed = setCreditLimitBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter a limit greater than 0.");
    const { id } = req.params;
    try {
      const creditLimit = await creditLimits.set(id, magnitude);
      return { creditLimit };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/accounts/:id/credit-limit", async (req, reply) => {
    const { id } = req.params;
    try {
      await creditLimits.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // --- Analysis: debt payoff (FEAT-014b) ---
  app.get("/analysis/debt-payoff", async () => ({
    report: await analysis.debtPayoff(),
  }));

  // --- Analysis: net worth over time (FEAT-R9) ---
  app.get<SpendQuery>("/analysis/net-worth", async (req, reply) => {
    const grain = req.query.grain ?? "month";
    if (grain !== "month" && grain !== "year")
      return fail(reply, 400, "grain must be 'month' or 'year'.");
    return { report: await analysis.netWorth(grain) };
  });

  // Set / clear a loan account's original principal (the reference number for FEAT-014b payoff).
  app.put<IdParams>("/accounts/:id/original-principal", async (req, reply) => {
    const parsed = setOriginalPrincipalBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter an original principal greater than 0.");
    const { id } = req.params;
    try {
      const loanPrincipal = await loanPrincipals.set(id, magnitude);
      return { loanPrincipal };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  app.delete<IdParams>("/accounts/:id/original-principal", async (req, reply) => {
    const { id } = req.params;
    try {
      await loanPrincipals.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Account not found.");
      if (e instanceof ValidationError) return fail(reply, 400, e.message);
      throw e;
    }
  });

  // Set / clear an envelope's recurring monthly budget target (the "budget" half of FEAT-012).
  app.put<IdParams>("/envelopes/:id/target", async (req, reply) => {
    const parsed = setTargetBody.safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, "Invalid request body.");
    const magnitude = parsePositiveMagnitude(parsed.data.amount);
    if (magnitude === null) return fail(reply, 400, "Enter a target greater than 0.");
    const { id } = req.params;
    try {
      const target = await targets.set(id, magnitude);
      return { target };
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });

  app.delete<IdParams>("/envelopes/:id/target", async (req, reply) => {
    const { id } = req.params;
    try {
      await targets.clear(id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return fail(reply, 404, "Envelope not found.");
      throw e;
    }
  });
};
