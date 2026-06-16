// Credit utilization (FEAT-014a) — the analysis area's debt-side aggregate. Pure math over integer
// cents: no I/O, no Date.now, so it is unit-testable in isolation. The impure shell
// (analysisService) gathers the inputs (a credit account's derived balance, its stored limit, and
// its per-month net flows) and feeds them here.
//
// Sign convention (ADR-0003 + v_account_balances): a credit account's derived balance is signed —
// spending on the card is a withdrawal (negative), payments are deposits (positive), so a balance
// ≤ 0 means money OWED. We expose `owed = −balance` (positive = debt). Utilization = owed / limit,
// reported in integer BASIS POINTS (owed/limit × 10000; 3750 bps = 37.50%) to stay integer-exact;
// the UI divides by 100 to display a percentage. The numerator is floored at 0 (a credit balance /
// overpayment reads as 0% used) but NOT clamped at the top (over-limit > 100% is meaningful, shown).
//
// V1 simplification: the credit limit is current config, NOT effective-dated, so the trend applies
// the CURRENT limit to every historical period's owed balance (FEAT-014a §11). Payoff-% for
// installment loans (original principal) is the deferred sibling #14b.

/** A credit account's net balance flow for one period (signed cents; card spend is negative). */
export interface CreditFlow {
  period: string; // "YYYY-MM"
  netCents: number; // signed Σ of the account's transactions in the period
}

/** One credit account's inputs, gathered by the read service. */
export interface CreditAccountInput {
  accountId: string;
  accountName: string;
  archived: boolean;
  /** Current derived balance (signed; ≤ 0 means debt owed). */
  balanceCents: number;
  /** The stored credit limit (positive cents), or null when none is set. */
  limitCents: number | null;
  /** Per-period net flows, ascending by period. Σ over all flows reconstructs `balanceCents`. */
  flows: readonly CreditFlow[];
}

/** One point in a utilization trend: the owed balance at a period's end and its utilization. */
export interface UtilizationPoint {
  period: string; // "YYYY-MM"
  /** −(cumulative balance through this period); positive = debt, ≤ 0 = no debt. */
  owedCents: number;
  /** owed/limit in basis points (numerator floored at 0; top not clamped), or null when no limit. */
  utilizationBps: number | null;
}

/** Utilization for one credit account: the current headline + an over-time trend. */
export interface CreditAccountUtilization {
  accountId: string;
  accountName: string;
  archived: boolean;
  limitCents: number | null;
  /** Current owed = −balance (positive = debt; ≤ 0 = no debt / a credit balance). */
  owedCents: number;
  /** limit − owed (signed: negative = over limit; > limit when overpaid), or null when no limit. */
  availableCents: number | null;
  /** Current utilization in basis points, or null when no limit. */
  utilizationBps: number | null;
  /** Ascending; one point per period with activity. Final point's owed = `owedCents`. */
  trend: UtilizationPoint[];
}

/** The portfolio report: per-account utilization + a roll-up over accounts that have a limit. */
export interface CreditUtilizationReport {
  accounts: CreditAccountUtilization[];
  /** Σ owed (floored at 0 per account) over accounts WITH a limit. */
  totalOwedCents: number;
  /** Σ limit over accounts WITH a limit. */
  totalLimitCents: number;
  /** Aggregate utilization (totalOwed/totalLimit) in basis points, or null when no limited accounts. */
  utilizationBps: number | null;
}

/**
 * Utilization in integer basis points: `round(max(0, owed) / limit × 10000)`. Returns null when no
 * limit. The numerator floors at 0 (overpayment → 0%); the result is NOT clamped above 10000
 * (over-limit is meaningful). A non-positive limit is treated as "no limit" (defensive; the store
 * enforces limit > 0).
 */
export function utilizationBps(owedCents: number, limitCents: number | null): number | null {
  if (limitCents === null || limitCents <= 0) return null;
  return Math.round((Math.max(0, owedCents) / limitCents) * 10000);
}

/** Per-account utilization + trend, then a portfolio roll-up over the accounts that have a limit. */
export function creditUtilization(
  accounts: readonly CreditAccountInput[],
): CreditUtilizationReport {
  const out: CreditAccountUtilization[] = [];
  let totalOwedCents = 0;
  let totalLimitCents = 0;

  for (const a of accounts) {
    const owedCents = -a.balanceCents;
    const limitCents = a.limitCents;

    // Trend: cumulate the (ascending) per-period flows into the period-end balance, then owe/utilize.
    let cumulativeBalance = 0;
    const trend: UtilizationPoint[] = [];
    for (const f of a.flows) {
      cumulativeBalance += f.netCents;
      const owedAtPeriod = -cumulativeBalance;
      trend.push({
        period: f.period,
        owedCents: owedAtPeriod,
        utilizationBps: utilizationBps(owedAtPeriod, limitCents),
      });
    }

    out.push({
      accountId: a.accountId,
      accountName: a.accountName,
      archived: a.archived,
      limitCents,
      owedCents,
      availableCents: limitCents === null ? null : limitCents - owedCents,
      utilizationBps: utilizationBps(owedCents, limitCents),
      trend,
    });

    if (limitCents !== null && limitCents > 0) {
      totalOwedCents += Math.max(0, owedCents);
      totalLimitCents += limitCents;
    }
  }

  return {
    accounts: out,
    totalOwedCents,
    totalLimitCents,
    utilizationBps:
      totalLimitCents > 0 ? Math.round((totalOwedCents / totalLimitCents) * 10000) : null,
  };
}
