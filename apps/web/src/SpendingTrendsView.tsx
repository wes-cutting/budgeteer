import { useEffect, useState } from "react";
import { type Api, type BudgetVsActualReport } from "./api";
import { formatCents } from "./format";
import { Button, Field, Input, LineChart, type LineSeries } from "./ui";
import styles from "./Insights.module.css";

/**
 * Insights — spending trends over time (FEAT-UX10): per-envelope + total spending TRENDS,
 * month-over-month, so direction and momentum are visible (UX9's breakdown showed one month's
 * composition; this shows movement across several).
 *
 * READ DECISION: composes the EXISTING `getBudgetVsActual(month)` read, once per month in the
 * selected trailing window (`Promise.all` — still an existing read, no new endpoint; extends the
 * R4/R5/UX9 fan-out precedent to several calls because `budgetVsActual` is per-month only). NOT
 * `getEnvelopeSpend`: that read's cells are NET flow (funded − spent), so an envelope funded and
 * spent in the same month understates true outflow — the exact problem UX9 already reasoned
 * through for the breakdown numerator. `spentCents` is pure outflow (funding excluded, refunds
 * netted), the correct numerator for a "spending" trend too.
 *
 * CHART DESIGN: a multi-envelope trend risks too many line series to read. This shows a TOTAL
 * outflow line plus the top-2 envelopes by outflow over the window — 3 series total, matching the
 * 3 `--chart-*` tokens 1:1 (no colour reuse), each further distinguished by dash pattern + end
 * marker + direct label per ADR-0007 (colour is never the sole signal). Reuses the existing
 * `LineChart` shape — no new chart shape.
 */

const HORIZONS = [3, 6, 12] as const;
const TOP_N = 2;

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

/** Ascending "YYYY-MM" window of `n` months ending at (and including) `end`. */
function monthsBack(n: number, end: string): string[] {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

interface EnvelopeTrend {
  envelopeId: string;
  envelopeName: string;
  archived: boolean;
  values: number[]; // aligned to `periods`; spentCents, 0-filled
}

interface Trend {
  periods: string[];
  totals: number[]; // aligned to periods; totalSpentCents
  top: EnvelopeTrend[]; // top TOP_N envelopes by outflow over the window, 0-filled per period
}

/** Compose N months of `getBudgetVsActual` into an aligned multi-series outflow trend. */
function buildTrend(reports: BudgetVsActualReport[]): Trend {
  const periods = reports.map((r) => r.month);
  const totals = reports.map((r) => r.totalSpentCents);

  const byEnvelope = new Map<string, EnvelopeTrend>();
  reports.forEach((r, i) => {
    for (const row of r.rows) {
      const entry = byEnvelope.get(row.envelopeId) ?? {
        envelopeId: row.envelopeId,
        envelopeName: row.envelopeName,
        archived: row.archived,
        values: periods.map(() => 0),
      };
      entry.values[i] = row.spentCents;
      byEnvelope.set(row.envelopeId, entry);
    }
  });

  const top = [...byEnvelope.values()]
    .map((envelope) => ({ envelope, sum: envelope.values.reduce((a, b) => a + b, 0) }))
    .filter((e) => e.sum > 0)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, TOP_N)
    .map((e) => e.envelope);

  return { periods, totals, top };
}

// Total gets the primary solid line; each ranked envelope gets its own dash pattern + marker shape
// (rank 0 = chart-2/square, rank 1 = chart-3/triangle), so all 3 series read without relying on
// colour discrimination. A function (not array indexing) keeps this exhaustive under
// noUncheckedIndexedAccess without a synthetic "out of range" fallback.
function rankStyle(rank: number): Pick<LineSeries, "token" | "dash" | "marker"> {
  return rank === 0
    ? { token: "var(--chart-2)", dash: "6 4", marker: "square" }
    : { token: "var(--chart-3)", dash: "2 3", marker: "triangle" };
}

function buildChart(t: Trend): { series: LineSeries[]; summary: string } {
  const series: LineSeries[] = [
    { label: "Total", token: "var(--chart-1)", dash: "0", marker: "circle", values: t.totals },
    ...t.top.map((e, i) => ({
      label: e.envelopeName + (e.archived ? " (archived)" : ""),
      ...rankStyle(i),
      values: e.values,
    })),
  ];
  const first = t.totals[0] ?? 0;
  const last = t.totals[t.totals.length - 1] ?? 0;
  const direction = last > first ? "up" : last < first ? "down" : "flat";
  const topNames = t.top.map((e) => e.envelopeName).join(", ");
  const summary =
    `Spending trend over ${t.periods.length} months, ${t.periods[0] ?? ""} to ${t.periods[t.periods.length - 1] ?? ""}: ` +
    `total outflow ${formatCents(first)} to ${formatCents(last)} (${direction})` +
    (topNames ? `. Top spenders: ${topNames}.` : ".");
  return { series, summary };
}

export function SpendingTrendsView({ api }: { api: Api }) {
  const [endMonth, setEndMonth] = useState<string>(thisMonth);
  const [months, setMonths] = useState<number>(6);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTrend(null);
    setError(null);
    const window = monthsBack(months, endMonth);
    Promise.all(window.map((m) => api.getBudgetVsActual(m)))
      .then((reports) => {
        if (active) setTrend(buildTrend(reports));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the trend.");
      });
    return () => {
      active = false;
    };
  }, [api, endMonth, months]);

  const hasData = trend !== null && trend.totals.some((v) => v !== 0);
  const chart = trend !== null && hasData ? buildChart(trend) : null;

  const trendTable =
    trend === null ? null : (
      <table className={styles.table}>
        <caption>
          Monthly outflow, {trend.periods[0] ?? ""}–{trend.periods[trend.periods.length - 1] ?? ""}:
          total and top {trend.top.length} {trend.top.length === 1 ? "envelope" : "envelopes"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col" className={styles.numeric}>
              Total
            </th>
            {trend.top.map((e) => (
              <th key={e.envelopeId} scope="col" className={styles.numeric}>
                {e.envelopeName}
                {e.archived ? " (archived)" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trend.periods.map((p, i) => (
            <tr key={p}>
              <th scope="row">{p}</th>
              <td className={styles.numeric}>{formatCents(trend.totals[i] ?? 0)}</td>
              {trend.top.map((e) => (
                <td key={e.envelopeId} className={styles.numeric}>
                  {formatCents(e.values[i] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <main>
      <header>
        <h1>Insights — spending trends</h1>
      </header>

      <div className={styles.controls}>
        <Field label="End month" htmlFor="trends-end-month">
          <Input
            id="trends-end-month"
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            max={thisMonth()}
          />
        </Field>
        <span className={styles.segmented} role="group" aria-label="Months back">
          Months:{" "}
          {HORIZONS.map((h) => (
            <Button
              key={h}
              variant={months === h ? "accent" : "default"}
              aria-pressed={months === h}
              onClick={() => setMonths(h)}
            >
              {h}
            </Button>
          ))}
        </span>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error && trend === null ? null : trend === null ? (
        <p role="status">Loading…</p>
      ) : !hasData || chart === null ? (
        <p>
          No outflow in the {months} months ending {endMonth} yet — spend from an envelope, then
          come back to see the trend.
        </p>
      ) : (
        <LineChart
          caption={`Spending trend — ${months} months ending ${endMonth}`}
          summary={chart.summary}
          axis={trend.periods}
          series={chart.series}
          formatY={formatCents}
          table={trendTable}
        />
      )}
    </main>
  );
}
