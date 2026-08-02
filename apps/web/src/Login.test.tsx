import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Login } from "./Login";
import { ApiError, type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// BUD-S87 — the sign-in page. Rendered through a data router (Login uses `useNavigate`), with a
// stub "/" route so a successful sign-in is observable as navigation.
//
// BUD-S92 — the form no longer renders synchronously: it waits on the `needs-setup` probe so a
// brand-new install never flashes a sign-in page it has no credential for. Hence `findBy*` on the
// first query, and the "/setup" stub route below.
function renderLogin(api: Api, state?: { message: string }) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <Login api={api} /> },
      { path: "/", element: <p>home content</p> },
      { path: "/setup", element: <p>setup page</p> },
    ],
    { initialEntries: [{ pathname: "/login", state }] },
  );
  render(<RouterProvider router={router} />);
}

describe("Login (BUD-S87)", () => {
  test("signs in with valid credentials and navigates home", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(makeFakeApi({ login }));
    await userEvent.type(await screen.findByLabelText("Username"), "wes");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledWith("wes", "correct horse");
    expect(await screen.findByText("home content")).toBeTruthy();
  });

  test("shows an error and stays on the page when sign-in fails", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError("Invalid username or password."));
    renderLogin(makeFakeApi({ login }));
    await userEvent.type(await screen.findByLabelText("Username"), "wes");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Invalid username or password.");
    expect(screen.queryByText("home content")).toBeNull();
  });

  // --- BUD-S92 ---

  test("redirects to setup while the install has no user", async () => {
    renderLogin(makeFakeApi({ needsSetup: async () => true }));
    expect(await screen.findByText("setup page")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Sign in" })).toBeNull();
  });

  test("shows the handoff message when setup created the account but sign-in did not take", async () => {
    renderLogin(makeFakeApi(), { message: "Your account was created. Sign in to continue." });
    expect(await screen.findByText("Your account was created. Sign in to continue.")).toBeTruthy();
    // Not an error — the account exists. Announced politely, not alarmingly.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
