import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { type ReactNode } from "react";
import { AppShell, useSetPageTitle } from "./AppShell";
import { ApiProvider } from "./api-context";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

/**
 * FEAT-UXR1 — the sidebar app shell. The shell uses `useMatches()` for route-handle titles, so the
 * tests drive it through a data router (`createMemoryRouter` + `RouterProvider`), not the plain
 * `<MemoryRouter>` component.
 */
function renderShell({
  api = makeFakeApi(),
  path = "/",
  homeTitle = "Home",
  homeElement = <p>home content</p>,
  dynamicElement = <p>account content</p>,
}: {
  api?: Api;
  path?: string;
  homeTitle?: string;
  homeElement?: ReactNode;
  dynamicElement?: ReactNode;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: homeElement, handle: { title: homeTitle } },
          { path: "accounts/:id", element: dynamicElement, handle: { title: "Account" } },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <ApiProvider value={api}>
      <RouterProvider router={router} />
    </ApiProvider>,
  );
}

/** A child view that publishes a page title through the shell context (the dynamic-route path). */
function TitlePublisher({ title }: { title: string | null | undefined }) {
  useSetPageTitle(title);
  return <p>register</p>;
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("AppShell (FEAT-UXR1 — sidebar shell)", () => {
  test("renders the grouped primary nav, brand, footer action, and backup link", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const name of [
      "Home",
      "Insights",
      "Accounts",
      "Envelopes",
      "Needs allocation",
      "Templates",
      "Recurring",
      "Pay periods",
      "Manage",
      "Download backup",
      "Add transaction",
    ]) {
      expect(within(nav).getByRole("link", { name })).toBeTruthy();
    }
    // The four group headings label their lists.
    for (const group of ["Budget", "Ledgers", "Planning", "Administration"]) {
      expect(within(nav).getByText(group)).toBeTruthy();
    }
    // The global quick-add is the footer's primary action, pointing at the modal route.
    expect(within(nav).getByRole("link", { name: "Add transaction" }).getAttribute("href")).toBe(
      "/transactions/new",
    );
    // Download backup is the export file link (GET /export), not a route.
    expect(within(nav).getByRole("link", { name: "Download backup" }).getAttribute("href")).toMatch(
      /\/export$/,
    );
    // Brand tops the sidebar and links home.
    expect(screen.getByRole("link", { name: "Budgeteer — home" }).getAttribute("href")).toBe("/");
  });

  test("renders the route-handle title as the single page <h1>", () => {
    renderShell({ homeTitle: "Home" });
    // getByRole (singular) throws if there's more than one <h1> — so this asserts exactly one.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Home");
    expect(document.title).toBe("Home — Budgeteer");
  });

  test("a dynamic route publishes its resolved name to the shell <h1> (useSetPageTitle)", async () => {
    renderShell({
      path: "/accounts/a1",
      dynamicElement: <TitlePublisher title="My Checking" />,
    });
    expect(await screen.findByRole("heading", { level: 1, name: "My Checking" })).toBeTruthy();
    expect(document.title).toBe("My Checking — Budgeteer");
  });

  test("a dynamic route with no resolved name yet falls back to the route-handle kind label", () => {
    renderShell({
      path: "/accounts/a1",
      dynamicElement: <TitlePublisher title={undefined} />,
    });
    // Until the view publishes a name, the handle's "Account" kind label is the <h1>.
    expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeTruthy();
  });

  test("needs-allocation badge carries the count in the link's accessible name (R2)", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    for (const amount of ["10.00", "20.00", "30.00"]) {
      await api.createTransaction(acct.id, {
        kind: "deposit",
        amount,
        payee: "x",
        allocations: [],
      });
    }
    renderShell({ api });
    // The count lives in the accessible NAME (not colour/visual only).
    expect(await screen.findByRole("link", { name: "Needs allocation (3)" })).toBeTruthy();
  });

  test("the badge is absent when nothing needs allocation (R2)", async () => {
    renderShell();
    expect(await screen.findByRole("link", { name: "Needs allocation" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Needs allocation \(/ })).toBeNull();
  });

  test("the collapse toggle switches to the rail and persists the choice", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    await user.click(toggle);

    // Rail mode: the toggle now offers to expand, aria-expanded flips, and the choice is persisted.
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded"),
    ).toBe("false");
    expect(localStorage.getItem("budgeteer.sidebar")).toBe("rail");
  });

  test("the persisted rail choice is read on mount", () => {
    localStorage.setItem("budgeteer.sidebar", "rail");
    renderShell();
    // Starts collapsed — the toggle offers to expand.
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });

  test("the hamburger opens a focus-trapped nav drawer that Esc closes", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    // The drawer carries the same nav (an Accounts link) plus a close affordance.
    expect(within(drawer).getByRole("link", { name: "Accounts" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
  });
});
