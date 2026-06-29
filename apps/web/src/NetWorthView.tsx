import { useEffect, useState } from "react";
import { type Api, type NetWorthReport, type SpendGrain } from "./api";
import { formatCents } from "./format";
import { LineChart, type LineSeries } from "./ui";
import styles from "./Insights.module.css";

/**
 * Insights — net worth over time (FEAT-R9, charted in UX8). The account-level "how am I doing
 * overall?" picture: a derived monthly (or annual) Σ of account balances, decomposed into Assets,
 * Liabilities (credit/loan, carried negative), and Net worth (= assets + liabilities). A grain toggle
 * switches monthly ⇄ annual. UX8 adds a hand-rolled accessible line chart (ADR-0007) above the
 * over-time table — the table is its data-table fallback (the keyboard/SR source of truth).
 */

const SERIES_DEFS = [
  { key: "assetsCents", label: "Assets", token: "var(--chart-1)", dash: "0", marker: "circle" },
  {
    key: "liabilitiesCents",
    label: "Liabilities",
    token: "var(--chart-2)",
    dash: "6 4",
    marker: "square",
  },
  { key: "netCents", label: "Net worth", token: "var(--chart-3)", dash: "2 3", marker: "triangle" },
] as const;

function buildChart(report: NetWorthReport): {
  axis: string[];
  series: LineSeries[];
  summary: string;
} {
  const axis = report.trend.map((p) => p.period);
  const series: LineSeries[] = SERIES_DEFS.map((d) => ({
    label: d.label,
    token: d.token,
    dash: d.dash,
    marker: d.marker,
    values: report.trend.map((p) => p[d.key]),
  }));
  const first = report.trend[0];
  const last = report.trend[report.trend.length - 1];
  const summary =
    first && last
      ? `Net worth over ${report.trend.length} ${report.trend.length === 1 ? "period" : "periods"}, ` +
        `${first.period} to ${last.period}: assets ${formatCents(first.assetsCents)} to ${formatCents(last.assetsCents)}, ` +
        `liabilities ${formatCents(first.liabilitiesCents)} to ${formatCents(last.liabilitiesCents)}, ` +
        `net worth ${formatCents(first.netCents)} to ${formatCents(last.netCents)}.`
      : "No net-worth data yet.";
  return { axis, series, summary };
}

export function NetWorthView({ api }: { api: Api }) {
  const [grain, setGrain] = useState<SpendGrain>("month");
  const [report, setReport] = useState<NetWorthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    api
      .getNetWorth(grain)
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the analysis.");
      });
    return () => {
      active = false;
    };
  }, [api, grain]);

  return (
    <main>
      <header>
        <h1>Insights — net worth over time</h1>
      </header>

      <div className={styles.controls}>
        <div className={styles.segmented} role="radiogroup" aria-label="Grain">
          <label>
            <input
              type="radio"
              name="grain"
              checked={grain === "month"}
              onChange={() => setGrain("month")}
            />{" "}
            Monthly
          </label>
          <label>
            <input
              type="radio"
              name="grain"
              checked={grain === "year"}
              onChange={() => setGrain("year")}
            />{" "}
            Annual
          </label>
        </div>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {error ? null : report === null ? (
        <p role="status">Loading…</p>
      ) : report.trend.length === 0 ? (
        <p>No account activity to analyze yet — open an account with a starting balance first.</p>
      ) : (
        <>
          <table className={styles.table}>
            <caption>Current totals</caption>
            <tbody>
              <tr>
                <th scope="row">Assets</th>
                <td className={styles.numeric}>{formatCents(report.assetsCents)}</td>
              </tr>
              <tr>
                <th scope="row">Liabilities</th>
                <td className={styles.numeric}>{formatCents(report.liabilitiesCents)}</td>
              </tr>
              <tr>
                <th scope="row">Net worth</th>
                <td className={styles.numeric}>{formatCents(report.netCents)}</td>
              </tr>
            </tbody>
          </table>

          {(() => {
            const { axis, series, summary } = buildChart(report);
            return (
              <LineChart
                caption="Net worth over time"
                summary={summary}
                axis={axis}
                series={series}
                formatY={formatCents}
                table={
                  <table className={styles.table}>
                    <caption>
                      Net worth over time (assets + liabilities; liabilities are negative = owed)
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Period</th>
                        <th scope="col" className={styles.numeric}>
                          Assets
                        </th>
                        <th scope="col" className={styles.numeric}>
                          Liabilities
                        </th>
                        <th scope="col" className={styles.numeric}>
                          Net worth
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.trend.map((p) => (
                        <tr key={p.period}>
                          <th scope="row">{p.period}</th>
                          <td className={styles.numeric}>{formatCents(p.assetsCents)}</td>
                          <td className={styles.numeric}>{formatCents(p.liabilitiesCents)}</td>
                          <td className={styles.numeric}>{formatCents(p.netCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              />
            );
          })()}
        </>
      )}
    </main>
  );
}
