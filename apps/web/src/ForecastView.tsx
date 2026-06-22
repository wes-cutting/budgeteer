import { useEffect, useState } from "react";
import { type AccountView, type Api, type CashFlowForecast } from "./api";
import { formatCents } from "./format";

const NUM: React.CSSProperties = { textAlign: "right" };
const HORIZONS = [30, 60, 90] as const;

/** Signed display for a cash delta: "+$2,100.00" / "-$120.00". */
const signedCents = (c: number): string => (c > 0 ? "+" : "") + formatCents(c);

/**
 * Analysis — cash-flow forecast (FEAT-013). Projects one account's running cash balance forward over
 * a horizon: scheduled recurring events (the firm core) plus, when toggled on, expected discretionary
 * spend from monthly targets (netted to avoid double-counting — see SPIKE-05). Surfaces the headline
 * answers (ending / lowest point + date / first-negative) and a running-balance table. The projection
 * is a pure domain function fed by the analysis read; this view is thin. a11y: real table with caption
 * + `scope`'d headers; the negative warning is text, never colour alone; controls are labelled.
 */
export function ForecastView({ api, onBack }: { api: Api; onBack: () => void }) {
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

  return (
    <main>
      <header>
        <h1>Analysis — cash-flow forecast</h1>
        <button type="button" onClick={onBack}>
          ← Dashboard
        </button>
      </header>

      {accounts !== null && accounts.length === 0 ? (
        <p>Add an account first, then come back to forecast its cash flow.</p>
      ) : (
        <>
          <div>
            <label>
              Account{" "}
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>{" "}
            <span role="group" aria-label="Horizon">
              Horizon:{" "}
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={horizonDays === h}
                  onClick={() => setHorizonDays(h)}
                >
                  {h}
                </button>
              ))}{" "}
              days
            </span>{" "}
            <label>
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
              <dl>
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
                <table>
                  <caption>Projected balance after each upcoming event</caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Event</th>
                      <th scope="col" style={NUM}>
                        Amount
                      </th>
                      <th scope="col" style={NUM}>
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.points.map((p, i) => (
                      <tr key={`${p.date}:${i}`}>
                        <th scope="row">{p.date}</th>
                        <td>{p.label}</td>
                        <td style={NUM}>{signedCents(p.deltaCents)}</td>
                        <td style={NUM}>{formatCents(p.balanceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
