import { useEffect, useState } from "react";
import { type Api, type EnvelopeSpendRollup, type SpendGrain } from "./api";
import { formatCents } from "./format";
import { BarChart, Skeleton } from "./ui";
import styles from "./Insights.module.css";

/**
 * Insights — spend by envelope over time (FEAT-011, charted in UX8). A generated grid
 * (envelope × period) of net signed allocation flow: `+` = funded, `−` = spent. A grain toggle
 * switches monthly ⇄ annual. UX8 adds a hand-rolled accessible bar chart (ADR-0007) of each
 * envelope's net total above the grid — sign reads from the bar direction (above/below the zero
 * baseline) and the table figures, never colour alone. The grid is the chart's data-table fallback.
 */
export function AnalysisView({ api }: { api: Api }) {
  const [grain, setGrain] = useState<SpendGrain>("month");
  const [rollup, setRollup] = useState<EnvelopeSpendRollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRollup(null);
    setError(null);
    api
      .getEnvelopeSpend(grain)
      .then((r) => {
        if (active) setRollup(r);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the analysis.");
      });
    return () => {
      active = false;
    };
  }, [api, grain]);

  const grid =
    rollup === null ? null : (
      <table className={styles.table}>
        <caption>Net flow by envelope over time (positive = funded, negative = spent)</caption>
        <thead>
          <tr>
            <th scope="col">Envelope</th>
            {rollup.periods.map((p) => (
              <th key={p} scope="col" className={styles.numeric}>
                {p}
              </th>
            ))}
            <th scope="col" className={styles.numeric}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rollup.rows.map((row) => (
            <tr key={row.envelopeId}>
              <th scope="row">
                {row.envelopeName}
                {row.archived ? " (archived)" : ""}
              </th>
              {row.amounts.map((c, i) => (
                <td key={`${row.envelopeId}-${i}`} className={styles.numeric}>
                  {formatCents(c)}
                </td>
              ))}
              <td className={styles.numeric}>{formatCents(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {rollup.periodTotals.map((c, i) => (
              <td key={i} className={styles.numeric}>
                {formatCents(c)}
              </td>
            ))}
            <td className={styles.numeric}>{formatCents(rollup.grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    );

  return (
    <main>
      <header>
        <h2>Insights — spend by envelope</h2>
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
      {error ? null : rollup === null ? (
        <Skeleton />
      ) : rollup.rows.length === 0 ? (
        <p>No spending to analyze yet — enter and allocate some transactions first.</p>
      ) : (
        <BarChart
          caption="Net flow by envelope"
          summary={
            `Net flow by envelope over ${rollup.periods.length} ${rollup.periods.length === 1 ? "period" : "periods"}: ` +
            `${rollup.rows.length} ${rollup.rows.length === 1 ? "envelope" : "envelopes"}, ` +
            `net total ${formatCents(rollup.grandTotal)} (bars above the baseline are funded, below are spent).`
          }
          categories={rollup.rows.map((r) => r.envelopeName + (r.archived ? " (archived)" : ""))}
          series={[
            {
              label: "Net flow",
              token: "var(--chart-1)",
              values: rollup.rows.map((r) => r.total),
            },
          ]}
          formatY={formatCents}
          table={grid}
        />
      )}
    </main>
  );
}
