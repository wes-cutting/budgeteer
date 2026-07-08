import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { AnalysisSection } from "./AnalysisSection";
import { makeFakeApi } from "./test/fakeApi";

// FEAT-UXR6 — the five category tabs (primary row). Each targets its category's default sub-view.
const CATEGORY_LABELS = ["Spending", "Budget", "Cash flow", "Debt", "Net worth"];

// UX3 — the Insights area is URL-driven (`/insights/:view`). Render it inside a router at a
// given view so useParams resolves, with a `/` stub for the boundary's recovery target.
function renderAt(view: string, api = makeFakeApi()) {
  return render(
    <MemoryRouter initialEntries={[`/insights/${view}`]}>
      <Routes>
        <Route path="/insights/:view" element={<AnalysisSection api={api} />} />
        <Route path="/" element={<h1>Budgeteer</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AnalysisSection (UXR6 — Insights category IA)", () => {
  test("renders the requested view and the five category tabs, active category marked current", async () => {
    renderAt("spend");

    expect(
      await screen.findByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
    ).toBeTruthy();

    const categories = screen.getByRole("navigation", { name: "Insights categories" });
    for (const label of CATEGORY_LABELS) {
      expect(within(categories).getByRole("link", { name: label })).toBeTruthy();
    }
    // aria-current marks the active category (not colour/visual only), and only it.
    expect(
      within(categories).getByRole("link", { name: "Spending" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(categories).getByRole("link", { name: "Budget" }).getAttribute("aria-current"),
    ).toBe(null);

    // Its category link targets the default sub-view.
    expect(within(categories).getByRole("link", { name: "Spending" }).getAttribute("href")).toBe(
      "/insights/spend",
    );
  });

  test("a multi-view category renders the segment row with renamed labels; active sub-view marked", async () => {
    renderAt("spend");
    await screen.findByRole("heading", { name: "Insights — spend by envelope", level: 2 });

    // The Spending segment row: `spend` reads as "By envelope" (owner-ratified rename).
    const segments = screen.getByRole("navigation", { name: "Spending views" });
    for (const label of ["By envelope", "Breakdown", "Trends"]) {
      expect(within(segments).getByRole("link", { name: label })).toBeTruthy();
    }
    expect(
      within(segments).getByRole("link", { name: "By envelope" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(within(segments).getByRole("link", { name: "By envelope" }).getAttribute("href")).toBe(
      "/insights/spend",
    );
  });

  test("the category tab stays active on a non-default sub-view (breakdown → Spending)", async () => {
    renderAt("breakdown");
    await screen.findByRole("heading", { name: "Insights — spending breakdown", level: 2 });

    const categories = screen.getByRole("navigation", { name: "Insights categories" });
    expect(
      within(categories).getByRole("link", { name: "Spending" }).getAttribute("aria-current"),
    ).toBe("page");

    const segments = screen.getByRole("navigation", { name: "Spending views" });
    expect(
      within(segments).getByRole("link", { name: "Breakdown" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(segments).getByRole("link", { name: "By envelope" }).getAttribute("aria-current"),
    ).toBe(null);
  });

  test("a single-view category renders no segment row", async () => {
    renderAt("forecast");
    await screen.findByRole("heading", { name: "Insights — cash-flow forecast", level: 2 });

    const categories = screen.getByRole("navigation", { name: "Insights categories" });
    expect(
      within(categories).getByRole("link", { name: "Cash flow" }).getAttribute("aria-current"),
    ).toBe("page");
    // Cash flow has one view (Forecast) — no secondary segmented row is rendered.
    expect(screen.queryByRole("navigation", { name: "Cash flow views" })).toBeNull();
  });

  test("clicking a category navigates to its default sub-view and swaps the page in place", async () => {
    renderAt("spend");
    await screen.findByRole("heading", { name: "Insights — spend by envelope", level: 2 });

    const categories = screen.getByRole("navigation", { name: "Insights categories" });
    await userEvent.click(within(categories).getByRole("link", { name: "Net worth" }));

    expect(
      await screen.findByRole("heading", { name: "Insights — net worth over time", level: 2 }),
    ).toBeTruthy();
    // Only the active view is mounted — the spend view is gone (its fetch only runs while shown).
    expect(
      screen.queryByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
    ).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "Insights categories" }))
        .getByRole("link", { name: "Net worth" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  test("clicking a sub-view segment swaps the page within the same category", async () => {
    renderAt("credit");
    await screen.findByRole("heading", { name: "Insights — credit utilization", level: 2 });

    const segments = screen.getByRole("navigation", { name: "Debt views" });
    await userEvent.click(within(segments).getByRole("link", { name: "Payoff" }));

    expect(
      await screen.findByRole("heading", { name: "Insights — debt payoff", level: 2 }),
    ).toBeTruthy();
    // Still in the Debt category.
    expect(
      within(screen.getByRole("navigation", { name: "Insights categories" }))
        .getByRole("link", { name: "Debt" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  test("an unknown view falls back to the default (spend) view", async () => {
    renderAt("bogus");
    expect(
      await screen.findByRole("heading", { name: "Insights — spend by envelope", level: 2 }),
    ).toBeTruthy();
  });
});
