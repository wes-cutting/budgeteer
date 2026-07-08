import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Home } from "./Home";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// The home renders React Router <Link>s (cockpit deep-links / onboarding CTAs) → it needs a router.
function renderHome(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <Home api={api} />
    </MemoryRouter>,
  );
}

describe("Home (UX6 cockpit-only + UX14 first-run onboarding)", () => {
  test("a completely empty app shows first-run onboarding, not the cockpit", async () => {
    renderHome(); // default fake API starts with no accounts and no envelopes
    // FEAT-UXR1 — the page <h1> ("Home") now lives in the shell top bar, not this view.
    // Derived first-run state → the guided onboarding region, and NOT the cockpit Overview.
    expect(await screen.findByRole("region", { name: "Get started" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add an account" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Overview" })).toBeNull();
  });

  test("once any data exists the home renders the cockpit, not onboarding", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "0.00" });
    renderHome(api);
    expect(await screen.findByRole("region", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Get started" })).toBeNull();
  });

  test("the home never renders the demoted management surfaces (UX6)", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Groceries", kind: "standard" });
    renderHome(api);
    await screen.findByRole("region", { name: "Overview" });
    // Add-forms, the net-worth table, and Move-money all moved to /accounts · /envelopes · /manage.
    expect(screen.queryByRole("form", { name: "Add account" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Add envelope" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Move money between envelopes" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Net worth summary" })).toBeNull();
  });
});
