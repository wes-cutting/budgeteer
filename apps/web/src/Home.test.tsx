import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Home } from "./Home";
import { makeFakeApi } from "./test/fakeApi";

// The home renders the UX5 Cockpit (React Router <Link>s) → it needs a router in tests. The cockpit
// panels are covered in Cockpit.test.tsx; this guards the UX6 contract: the home is cockpit-only.
function renderHome() {
  return render(
    <MemoryRouter>
      <Home api={makeFakeApi()} />
    </MemoryRouter>,
  );
}

describe("Home (UX6 — cockpit-only)", () => {
  test("renders the Budgeteer h1 and the cockpit Overview region", async () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "Budgeteer", level: 1 })).toBeTruthy();
    expect(await screen.findByRole("region", { name: "Overview" })).toBeTruthy();
  });

  test("no longer renders the demoted management surfaces", () => {
    renderHome();
    // Add-forms, the net-worth table, and Move-money all moved to /accounts · /envelopes · /manage.
    expect(screen.queryByRole("form", { name: "Add account" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Add envelope" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Move money between envelopes" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Net worth summary" })).toBeNull();
  });
});
