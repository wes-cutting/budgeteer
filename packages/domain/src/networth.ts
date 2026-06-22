// Net worth over time (FEAT-R9) — the analysis area's account-level "how am I doing overall?"
// aggregate. Pure math over integer cents: no I/O, no Date.now, so it is unit-testable in isolation.
// The impure shell (analysisService) gathers the inputs (every account's per-period net balance
// flow, tagged with the account's kind) and feeds them here.
//
// Sign convention (ADR-0003 + v_account_balances): every account's balance is signed. Asset kinds
// (checking/savings/cash/other) carry a positive balance; liability kinds (credit/loan) carry their
// debt as a NEGATIVE balance — the same `owed = −balance` convention #14a/#14b use. So net worth is
// simply Σ of all signed balances: assets pull it up, liabilities pull it down, and account↔account
// transfer legs net to zero across the two accounts. We decompose it into Assets / Liabilities / Net
// by KIND (stable over time, unlike a sign-based split), keeping the invariant net = assets +
// liabilities (liabilities carried signed, ≤ 0 normally).
//
// The trend cumulates ascending per-period net flows into the period-end balance — exactly the
// pattern creditUtilization/debtPayoff use — so a point is the running net worth AT that period's
// end. Only periods with activity get a point; between them net worth is flat (it carries forward).

import { type AccountKind, isLiabilityKind } from "./account";

/** One account-kind's net balance flow for one period (signed cents). */
export interface NetWorthFlow {
  period: string; // "YYYY-MM" (month grain) or "YYYY" (year grain)
  kind: AccountKind;
  netCents: number; // signed Σ of that kind's transactions in the period
}

/** One point in the net-worth trend: cumulative balances through the period's end. */
export interface NetWorthPoint {
  period: string;
  /** Cumulative Σ of asset-account balances through this period (≥ 0 normally). */
  assetsCents: number;
  /** Cumulative Σ of liability-account balances through this period (≤ 0 normally; debt). */
  liabilitiesCents: number;
  /** assets + liabilities — the running net worth at this period's end. */
  netCents: number;
}

/** Net worth: a current headline (= the final trend point, or 0 when empty) + an over-time trend. */
export interface NetWorthReport {
  /** Ascending; one point per period with activity. Final point reconciles to the headline. */
  trend: NetWorthPoint[];
  /** Current Σ asset-account balances. */
  assetsCents: number;
  /** Current Σ liability-account balances (≤ 0 normally). */
  liabilitiesCents: number;
  /** Current net worth = assetsCents + liabilitiesCents. */
  netCents: number;
}

/**
 * Decompose per-period account-kind flows into an Assets / Liabilities / Net trend by cumulating
 * (ascending) each side independently, then summing. Flows may arrive in any order and may carry
 * several kinds per period; this buckets and sorts them. The headline is the final cumulative value
 * (0/0/0 when there is no activity at all).
 */
export function netWorthOverTime(flows: readonly NetWorthFlow[]): NetWorthReport {
  // Bucket each period's flow into an asset delta and a liability delta.
  const byPeriod = new Map<string, { assetDelta: number; liabilityDelta: number }>();
  for (const f of flows) {
    const bucket = byPeriod.get(f.period) ?? { assetDelta: 0, liabilityDelta: 0 };
    if (isLiabilityKind(f.kind)) bucket.liabilityDelta += f.netCents;
    else bucket.assetDelta += f.netCents;
    byPeriod.set(f.period, bucket);
  }

  // Ascending — lexicographic order is chronological for "YYYY-MM" / "YYYY".
  const periods = [...byPeriod.keys()].sort();

  let assetsCents = 0;
  let liabilitiesCents = 0;
  const trend: NetWorthPoint[] = [];
  for (const period of periods) {
    const { assetDelta, liabilityDelta } = byPeriod.get(period) as {
      assetDelta: number;
      liabilityDelta: number;
    };
    assetsCents += assetDelta;
    liabilitiesCents += liabilityDelta;
    trend.push({
      period,
      assetsCents,
      liabilitiesCents,
      netCents: assetsCents + liabilitiesCents,
    });
  }

  return { trend, assetsCents, liabilitiesCents, netCents: assetsCents + liabilitiesCents };
}
