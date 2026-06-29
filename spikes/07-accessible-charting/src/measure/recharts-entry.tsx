/*
 * Bundle-cost probe for the REJECTED alternative. A minimal Recharts line chart of the same
 * net-worth data — built React-externalized (vite.recharts.config.ts) so the emitted gzip is
 * only Recharts' own code: i.e. "what adding a charting library would cost the app bundle".
 * This module is never shipped or imported by the harness app; it exists only to be measured.
 */
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

const DATA = [
  { period: "2026-01", assets: 18200, liabilities: -9400, net: 8800 },
  { period: "2026-06", assets: 22100, liabilities: -7650, net: 14450 },
];

export function RechartsProbe() {
  return (
    <LineChart width={640} height={320} data={DATA}>
      <CartesianGrid />
      <XAxis dataKey="period" />
      <YAxis />
      <Tooltip />
      <Line dataKey="assets" />
      <Line dataKey="liabilities" />
      <Line dataKey="net" />
    </LineChart>
  );
}
