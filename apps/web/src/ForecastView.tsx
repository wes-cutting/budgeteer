import { useEffect, useState } from "react";
import { type AccountView, type Api, type CashFlowForecast } from "./api";
import { formatCents } from "./format";
import { Button, Field, LineChart, type LineSeries, Select } from "./ui";
import styles from "./Insights.module.css";

const HORIZONS = [30, 60, 90] as const;

/** Signed display for a cash delta: "+$2,100.00" / "-$120.00". */
const signedCents = (c: number): string => (c > 0 ? "+" : "") + formatCents(c);

/** Short "MM-DD" axis label for the event-stepped forecast (dates are irregular). */
const shortDate = (iso: string): string => iso.slice(5);

/**
 * Insights — cash-flow forecast (FEAT-013, charted in UX8). Projects one account's running cash
 * balance forward over a horizon: scheduled recurring events (the firm core) plus, when toggled on,
 * expected discretionary spend from monthly targets (netted to avoid double-counting — see SPIKE-05).
 * UX8 adds a hand-rolled accessible line chart (ADR-0007) of the running balance from today across
 * the projected events, above the running-balance table (its data-table fallback). The negative
 * warning is text, never colour alone; controls are labelled.
 */
export function ForecastView({ api }: { api: Api }) {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [horizonDays, setHorizonDays] = useState<number>(90);
  const [includeExpected, setIncludeExpected] = useState<boolean>(true);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the account list once; default to the first non-archived account.
  useEffect(() => {
    let active = true;
    api
      .listAccounts()
      .then((list) => {
        if (!active) return;
        const open = list.filter((a) => a.archivedAt === null);
        setAccounts(open);
        if (open.length > 0 && open[0]) setAccountId(open[0].id);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load accounts.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  // Reload the projection whenever the account / horizon / toggle changes.
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    setForecast(null);
    setError(null);
    api
      .getCashFlowForecast(accountId, { horizonDays, includeExpected })
      .then((f) => {
        if (active) setForecast(f);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the forecast.");
      });
    return () => {
      active = false;
    };
  }, [api, accountId, horizonDays, includeExpected]);

  const balanceTable =
    forecast === null ? null : (
      <table className={styles.table}>
        <caption>Projected balance after each upcoming event</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Event</th>
            <th scope="col" className={styles.numeric}>
              Amount
            </th>
            <th scope="col" className={styles.numeric}>
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {forecast.points.map((p, i) => (
            <tr key={`${p.date}:${i}`}>
              <th scope="row">{p.date}</th>
              <td>{p.label}</td>
              <td className={styles.numeric}>{signedCents(p.deltaCents)}</td>
              <td className={styles.numeric}>{formatCents(p.balanceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  /** The line starts at today's balance, then steps through each projected event. */
  function buildForecastChart(f: CashFlowForecast): {
    axis: string[];
    series: LineSeries[];
    summary: string;
  } {
    const axis = [shortDate(f.startDate), ...f.points.map((p) => shortDate(p.date))];
    const values = [f.startingBalanceCents, ...f.points.map((p) => p.balanceCents)];
    const series: LineSeries[] = [
      { label: "Balance", token: "var(--chart-1)", dash: "0", marker: "circle", values },
    ];
    const summary =
      `Projected cash balance for ${f.accountName} over ${f.horizonDays} days: ` +
      `${formatCents(f.startingBalanceCents)} today to ${formatCents(f.endingBalanceCents)} on ${f.endDate}, ` +
      `lowest ${formatCents(f.minBalanceCents)} on ${f.minBalanceDate}` +
      (f.firstNegativeDate === null
        ? "; stays positive."
        : `; goes negative on ${f.firstNegativeDate}.`);
    return { axis, series, summary };
  }

  return (
    <main>
      <header>
        <h2>Insights — cash-flow forecast</h2>
      </header>

      {accounts !== null && accounts.length === 0 ? (
        <p>Add an account first, then come back to forecast its cash flow.</p>
      ) : (
        <>
          <div className={styles.controls}>
            <Field label="Account" htmlFor="forecast-account">
              <Select
                id="forecast-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <span className={styles.segmented} role="group" aria-label="Horizon">
              Horizon:{" "}
              {HORIZONS.map((h) => (
                <Button
                  key={h}
                  variant={horizonDays === h ? "accent" : "default"}
                  aria-pressed={horizonDays === h}
                  onClick={() => setHorizonDays(h)}
                >
                  {h}
                </Button>
              ))}{" "}
              days
            </span>
            <label className={styles.segmented}>
              <input
                type="checkbox"
                checked={includeExpected}
                onChange={(e) => setIncludeExpected(e.target.checked)}
              />{" "}
              Include expected spend
            </label>
          </div>
          <p>
            Expected spend is estimated from your monthly targets (net of scheduled bills) and
            assumed paid from this account.
          </p>

          {error ? <p role="alert">{error}</p> : null}
          {error && forecast === null ? null : forecast === null ? (
            <p role="status">Projecting…</p>
          ) : (
            <>
              <dl className={styles.figures}>
                <div>
                  <dt>Starting balance (today, {forecast.startDate})</dt>
                  <dd>{formatCents(forecast.startingBalanceCents)}</dd>
                </div>
                <div>
                  <dt>
                    Projected on {forecast.endDate} ({forecast.horizonDays} days)
                  </dt>
                  <dd>{formatCents(forecast.endingBalanceCents)}</dd>
                </div>
                <div>
                  <dt>Lowest point</dt>
                  <dd>
                    {formatCents(forecast.minBalanceCents)} on {forecast.minBalanceDate}
                  </dd>
                </div>
                <div>
                  <dt>Goes negative</dt>
                  <dd>
                    {forecast.firstNegativeDate === null
                      ? "never"
                      : `⚠ on ${forecast.firstNegativeDate}`}
                  </dd>
                </div>
              </dl>

              {forecast.points.length === 0 ? (
                <p>No upcoming activity in the next {forecast.horizonDays} days.</p>
              ) : (
                (() => {
                  const { axis, series, summary } = buildForecastChart(forecast);
                  return (
                    <LineChart
                      caption={`Projected cash balance — ${forecast.accountName}`}
                      summary={summary}
                      axis={axis}
                      series={series}
                      formatY={formatCents}
                      table={balanceTable}
                    />
                  );
                })()
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
