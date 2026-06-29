import { AccessibleChart, type NetWorthPoint } from "./AccessibleChart";

// Synthetic net-worth trend (mirrors the V1 getNetWorth shape). Six months, assets rising,
// liabilities (a loan) paying down, net climbing. Integer minor units (cents), per ADR-0003.
const DATA: NetWorthPoint[] = [
  { period: "2026-01", assetsCents: 1_820_000, liabilitiesCents: -940_000, netCents: 880_000 },
  { period: "2026-02", assetsCents: 1_905_000, liabilitiesCents: -905_000, netCents: 1_000_000 },
  { period: "2026-03", assetsCents: 1_960_000, liabilitiesCents: -870_000, netCents: 1_090_000 },
  { period: "2026-04", assetsCents: 2_040_000, liabilitiesCents: -835_000, netCents: 1_205_000 },
  { period: "2026-05", assetsCents: 2_115_000, liabilitiesCents: -800_000, netCents: 1_315_000 },
  { period: "2026-06", assetsCents: 2_210_000, liabilitiesCents: -765_000, netCents: 1_445_000 },
];

export function App() {
  return (
    <main style={{ padding: "var(--space-6)", maxWidth: 820, margin: "0 auto" }}>
      <h1>Net worth over time</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        SPIKE-07 — hand-rolled SVG chart with an accessible name and a data-table fallback. Toggle
        the table with the keyboard; a screen reader hears the chart summary and can read every
        figure from the table.
      </p>
      <AccessibleChart data={DATA} title="Net worth over time (assets, liabilities, net)" />
    </main>
  );
}
