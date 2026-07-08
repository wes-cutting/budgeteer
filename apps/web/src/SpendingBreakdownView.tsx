import { useEffect, useState } from "react";
import { type Api, type BudgetVsActualReport } from "./api";
import { formatCents } from "./format";
import { BreakdownBars, Field, Input, type BreakdownSlice } from "./ui";
import styles from "./Insights.module.css";

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

/**
 * Insights — spending breakdown (FEAT-UX9): "where did the money go" for a chosen month. Each
 * envelope's SHARE of the month's total OUTFLOW, ranked, so the user sees proportion at a glance.
 *
 * It COMPOSES THE EXISTING `getBudgetVsActual(month)` READ (no new endpoint — R4/R5/UX5 fan-out
 * precedent): that report already carries each envelope's `spentCents` = pure outflow (withdrawal
 * allocations only; funding excluded; refunds netted), which is exactly the breakdown's numerator —
 * unlike the spend-by-envelope net flow, which would conflate funding with spend. Shares are taken
 * over the displayed positive-outflow slices, so they total 100% and stay truthful.
 *
 * Rendered as ranked horizontal bars on the shared `ui/Chart` primitive (ADR-0007): role="img" + a
 * one-line summary, aria-hidden innards, and the table (envelope · outflow · % share) as the
 * keyboard/SR source of truth. Colour is NEVER the sole signal — every bar shares one colour, and
 * each category reads from its direct text label + rank order + bar length.
 */
export function SpendingBreakdownView({ api }: { api: Api }) {
  const [month, setMonth] = useState<string>(thisMonth);
  const [report, setReport] = useState<BudgetVsActualReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getBudgetVsActual(month)
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the breakdown.");
      });
    return () => {
      active = false;
    };
  }, [api, month]);

  // Only envelopes with positive outflow make a meaningful slice; rank them largest-first.
  const spent = (report?.rows ?? [])
    .filter((r) => r.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);
  // Share denominator = the displayed slices' outflow, so shares total 100% (a refund could net a
  // row to <= 0 and drop it; basing the total on what we show keeps the percentages honest).
  const totalOutflow = spent.reduce((s, r) => s + r.spentCents, 0);
  const share = (cents: number): number => (totalOutflow === 0 ? 0 : cents / totalOutflow);
  const pct = (cents: number): string => `${(share(cents) * 100).toFixed(1)}%`;

  const slices: BreakdownSlice[] = spent.map((r) => ({
    label: r.envelopeName + (r.archived ? " (archived)" : ""),
    fraction: share(r.spentCents),
    valueLabel: formatCents(r.spentCents),
    shareLabel: pct(r.spentCents),
  }));

  const breakdownTable = (
    <table className={styles.table}>
      <caption>
        Share of {month} outflow by envelope (ranked; share = envelope ÷ total outflow)
      </caption>
      <thead>
        <tr>
          <th scope="col">Envelope</th>
          <th scope="col" className={styles.numeric}>
            Outflow
          </th>
          <th scope="col" className={styles.numeric}>
            Share
          </th>
        </tr>
      </thead>
      <tbody>
        {spent.map((r) => (
          <tr key={r.envelopeId}>
            <th scope="row">
              {r.envelopeName}
              {r.archived ? " (archived)" : ""}
            </th>
            <td className={styles.numeric}>{formatCents(r.spentCents)}</td>
            <td className={styles.numeric}>{pct(r.spentCents)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td className={styles.numeric}>{formatCents(totalOutflow)}</td>
          <td className={styles.numeric}>100.0%</td>
        </tr>
      </tfoot>
    </table>
  );

  const top = spent
    .slice(0, 3)
    .map((r) => `${r.envelopeName} ${pct(r.spentCents)}`)
    .join(", ");
  const summary =
    `Spending breakdown for ${month}: ${spent.length} ${spent.length === 1 ? "envelope" : "envelopes"}, ` +
    `total outflow ${formatCents(totalOutflow)}. Top: ${top}.`;

  return (
    <main>
      <header>
        <h1>Insights — spending breakdown</h1>
      </header>

      <div className={styles.controls}>
        <Field label="Month" htmlFor="breakdown-month">
          <Input
            id="breakdown-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            max={thisMonth()}
          />
        </Field>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error && report === null ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : spent.length === 0 ? (
        <p>
          No spending recorded for {month} yet — enter some withdrawals allocated to envelopes, then
          come back to see where the money went.
        </p>
      ) : (
        <BreakdownBars
          caption={`Where the money went — ${month}`}
          summary={summary}
          slices={slices}
          table={breakdownTable}
        />
      )}
    </main>
  );
}
