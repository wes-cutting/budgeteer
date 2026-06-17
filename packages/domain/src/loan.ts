// Debt payoff (FEAT-014b) — the debt-side sibling of credit utilization (#14a). Pure math over
// integer cents: no I/O, no Date.now, so it is unit-testable in isolation. The impure shell
// (analysisService) gathers the inputs (a loan account's derived balance, its stored original
// principal, and its per-month net flows) and feeds them here.
//
// Sign convention (shared with #14a): a loan account's derived balance is signed — the debt is
// carried as a negative balance (open the loan with its principal as a negative opening balance;
// payments are deposits/transfers in that move it toward 0), so `owed = −balance` (positive = still
// owed; ≤ 0 = paid off / overpaid). PAYOFF = paid-down ÷ original = `1 − owed/original`, reported in
// integer BASIS POINTS (`(1 − owed/original) × 10000`; 3000 bps = 30.0% paid off). It is TRUTHFUL,
// not clamped: a brand-new loan reads 0% (owed = original), a settled loan reads 100% (owed = 0),
// overpayment reads > 100%, and owing more than the original (fees / negative amortization) reads
// < 0% — each is meaningful and shown as text.
//
// V1 simplification: the original principal is current config, NOT effective-dated, so the trend
// applies the CURRENT original to every historical period's owed balance (FEAT-014b §11). Loans are
// the new `kind='loan'` account type; revolving-credit utilization (vs. a limit) is the sibling #14a.

import type { CreditFlow } from "./credit"; // reuse the per-period net-flow shape (period + netCents)

/** One loan account's inputs, gathered by the read service. */
export interface LoanAccountInput {
  accountId: string;
  accountName: string;
  archived: boolean;
  /** Current derived balance (signed; ≤ 0 means debt still owed). */
  balanceCents: number;
  /** The stored original loan principal (positive cents), or null when none is set. */
  originalPrincipalCents: number | null;
  /** Per-period net flows, ascending by period. Σ over all flows reconstructs `balanceCents`. */
  flows: readonly CreditFlow[];
}

/** One point in a payoff trend: the owed balance at a period's end and the payoff-% reached. */
export interface PayoffPoint {
  period: string; // "YYYY-MM"
  /** −(cumulative balance through this period); positive = still owed, ≤ 0 = paid off. */
  owedCents: number;
  /** `(1 − owed/original) × 10000`, truthful (not clamped), or null when no original principal. */
  payoffBps: number | null;
}

/** Payoff for one loan account: the current headline + an over-time trend. */
export interface LoanAccountPayoff {
  accountId: string;
  accountName: string;
  archived: boolean;
  originalPrincipalCents: number | null;
  /** Current owed = −balance (positive = still owed; ≤ 0 = paid off / overpaid). */
  owedCents: number;
  /** original − owed (how much has been paid down), or null when no original principal. */
  paidDownCents: number | null;
  /** Current payoff in basis points (truthful, not clamped), or null when no original principal. */
  payoffBps: number | null;
  /** Ascending; one point per period with activity. Final point's owed = `owedCents`. */
  trend: PayoffPoint[];
}

/** The portfolio report: per-loan payoff + a roll-up over loans that have an original principal. */
export interface DebtPayoffReport {
  accounts: LoanAccountPayoff[];
  /** Σ original over loans WITH an original principal. */
  totalOriginalCents: number;
  /** Σ owed (signed) over loans WITH an original principal. */
  totalOwedCents: number;
  /** Σ (original − owed) over loans WITH an original principal. */
  totalPaidDownCents: number;
  /** Aggregate payoff ((total paid-down)/(total original)) in bps, or null when no such loans. */
  payoffBps: number | null;
}

/**
 * Payoff in integer basis points: `round((1 − owed / original) × 10000)`. Returns null when no
 * original principal. TRUTHFUL — not clamped: 0% at origination (owed = original), 100% when settled
 * (owed = 0), > 100% if overpaid, < 0% if owing more than the original. A non-positive original is
 * treated as "no original" (defensive; the store enforces original > 0).
 */
export function payoffBps(owedCents: number, originalCents: number | null): number | null {
  if (originalCents === null || originalCents <= 0) return null;
  return Math.round((1 - owedCents / originalCents) * 10000);
}

/** Per-loan payoff + trend, then a portfolio roll-up over the loans that have an original principal. */
export function debtPayoff(accounts: readonly LoanAccountInput[]): DebtPayoffReport {
  const out: LoanAccountPayoff[] = [];
  let totalOriginalCents = 0;
  let totalOwedCents = 0;

  for (const a of accounts) {
    const owedCents = -a.balanceCents;
    const originalCents = a.originalPrincipalCents;

    // Trend: cumulate the (ascending) per-period flows into the period-end balance, then owe/payoff.
    let cumulativeBalance = 0;
    const trend: PayoffPoint[] = [];
    for (const f of a.flows) {
      cumulativeBalance += f.netCents;
      const owedAtPeriod = -cumulativeBalance;
      trend.push({
        period: f.period,
        owedCents: owedAtPeriod,
        payoffBps: payoffBps(owedAtPeriod, originalCents),
      });
    }

    out.push({
      accountId: a.accountId,
      accountName: a.accountName,
      archived: a.archived,
      originalPrincipalCents: originalCents,
      owedCents,
      paidDownCents: originalCents === null ? null : originalCents - owedCents,
      payoffBps: payoffBps(owedCents, originalCents),
      trend,
    });

    if (originalCents !== null && originalCents > 0) {
      totalOriginalCents += originalCents;
      totalOwedCents += owedCents;
    }
  }

  const totalPaidDownCents = totalOriginalCents - totalOwedCents;
  return {
    accounts: out,
    totalOriginalCents,
    totalOwedCents,
    totalPaidDownCents,
    payoffBps:
      totalOriginalCents > 0 ? Math.round((totalPaidDownCents / totalOriginalCents) * 10000) : null,
  };
}
