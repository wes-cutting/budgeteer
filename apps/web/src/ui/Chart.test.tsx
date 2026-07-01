import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarChart, BreakdownBars, Gauge, LineChart } from "./index";

const dollars = (n: number) => `$${(n / 100).toFixed(0)}`;

const fallback = (
  <table>
    <caption>Figures</caption>
    <tbody>
      <tr>
        <th scope="row">Jan</th>
        <td>$10</td>
      </tr>
    </tbody>
  </table>
);

describe("Chart primitives (FEAT-UX8 · ADR-0007)", () => {
  test("LineChart: svg is role=img named by the summary, innards are aria-hidden, table is the fallback", () => {
    render(
      <LineChart
        caption="Net worth over time"
        summary="Net worth rose from $0 to $1,000."
        axis={["Jan", "Feb"]}
        series={[
          { label: "Net", token: "var(--chart-3)", dash: "0", marker: "circle", values: [0, 1000] },
        ]}
        formatY={dollars}
        table={fallback}
      />,
    );
    const img = screen.getByRole("img", { name: "Net worth rose from $0 to $1,000." });
    expect(img.tagName.toLowerCase()).toBe("svg");
    // Decorative innards are hidden from the a11y tree (one group wraps them all).
    expect(img.querySelector('g[aria-hidden="true"]')).toBeTruthy();
    // The figures table is the keyboard/SR source of truth and is shown by default.
    expect(screen.getByRole("table", { name: "Figures" })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByRole("rowheader", { name: "Jan" })).toBeTruthy();
  });

  test("the disclosure toggle hides and shows the data table", async () => {
    const user = userEvent.setup();
    render(
      <LineChart
        caption="Trend"
        summary="A trend."
        axis={["Jan"]}
        series={[{ label: "X", token: "var(--chart-1)", dash: "0", marker: "square", values: [1] }]}
        formatY={dollars}
        table={fallback}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Hide data table" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    await user.click(toggle);
    const reToggle = screen.getByRole("button", { name: "Show data table" });
    expect(reToggle.getAttribute("aria-expanded")).toBe("false");
    // hidden via the `hidden` attribute (not opacity) — the table leaves the a11y tree.
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("BarChart: role=img with the summary + a text legend per series (colour not the sole signal)", () => {
    render(
      <BarChart
        caption="Budget vs. actual"
        summary="Target vs spent across 1 envelope."
        categories={["Groceries"]}
        series={[
          { label: "Target", token: "var(--chart-1)", values: [200] },
          { label: "Spent", token: "var(--chart-2)", pattern: true, values: [150] },
        ]}
        formatY={dollars}
        table={fallback}
      />,
    );
    const img = screen.getByRole("img", { name: "Target vs spent across 1 envelope." });
    // Both series are named in the SVG legend so they read without colour.
    expect(within(img).getByText("Target")).toBeTruthy();
    expect(within(img).getByText("Spent")).toBeTruthy();
  });

  test("BreakdownBars: role=img summary + direct per-bar labels carry name/value/share (no colour-only)", () => {
    render(
      <BreakdownBars
        caption="Where the money went — 2026-03"
        summary="Spending breakdown for 2026-03: 2 envelopes, total outflow $510. Top: Groceries 70.6%."
        slices={[
          { label: "Groceries", fraction: 0.706, valueLabel: "$360.00", shareLabel: "70.6%" },
          { label: "Dining", fraction: 0.294, valueLabel: "$150.00", shareLabel: "29.4%" },
        ]}
        table={fallback}
      />,
    );
    const img = screen.getByRole("img", {
      name: "Spending breakdown for 2026-03: 2 envelopes, total outflow $510. Top: Groceries 70.6%.",
    });
    // Each category reads from its direct text label (rank · name · value · share) — not hue.
    expect(within(img).getByText("1. Groceries — $360.00 (70.6%)")).toBeTruthy();
    expect(within(img).getByText("2. Dining — $150.00 (29.4%)")).toBeTruthy();
    // The exact-figures table remains the keyboard/SR source of truth.
    expect(screen.getByRole("table", { name: "Figures" })).toBeTruthy();
  });

  test("Gauge: role=img with the truthful value label carried as text", () => {
    render(
      <Gauge
        caption="Overall utilization"
        summary="Overall credit utilization is 120% — over limit."
        ratio={1.2}
        valueLabel="120.0% over limit"
        threshold={{ at: 1, label: "Limit" }}
        table={fallback}
      />,
    );
    const img = screen.getByRole("img", {
      name: "Overall credit utilization is 120% — over limit.",
    });
    // The figure is truthful in text even though the bar fill clamps to the track.
    expect(within(img).getByText("120.0% over limit")).toBeTruthy();
    expect(within(img).getByText("Limit")).toBeTruthy();
  });
});
