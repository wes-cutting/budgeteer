import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { FirstRunOnboarding } from "./FirstRunOnboarding";

// The onboarding CTAs are React Router <Link>s → they need a router in tests.
function renderOnboarding() {
  return render(
    <MemoryRouter>
      <FirstRunOnboarding />
    </MemoryRouter>,
  );
}

describe("FirstRunOnboarding (UX14 — first-run guidance)", () => {
  test("renders a named region with the welcome title", () => {
    renderOnboarding();
    expect(screen.getByRole("region", { name: "Get started" })).toBeTruthy();
    expect(screen.getByText("Welcome to Budgeteer")).toBeTruthy();
  });

  test("presents the two guided steps as an ordered list", () => {
    renderOnboarding();
    const steps = screen.getByRole("list");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(2);
    // Order (step 1 = account, step 2 = envelopes) is conveyed by the list + copy, not colour.
    expect(within(steps).getByText(/Add your first account/)).toBeTruthy();
    expect(within(steps).getByText(/Set up your envelopes/)).toBeTruthy();
  });

  test("the CTAs deep-link to the management surfaces that own creation", () => {
    renderOnboarding();
    expect(screen.getByRole("link", { name: "Add an account" }).getAttribute("href")).toBe(
      "/accounts",
    );
    expect(screen.getByRole("link", { name: "Add envelopes" }).getAttribute("href")).toBe(
      "/envelopes",
    );
  });
});
