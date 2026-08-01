import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Login } from "./Login";
import { ApiError, type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// BUD-S87 — the sign-in page. Rendered through a data router (Login uses `useNavigate`), with a
// stub "/" route so a successful sign-in is observable as navigation.
function renderLogin(api: Api) {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <Login api={api} /> },
      { path: "/", element: <p>home content</p> },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
}

describe("Login (BUD-S87)", () => {
  test("signs in with valid credentials and navigates home", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLogin(makeFakeApi({ login }));
    await userEvent.type(screen.getByLabelText("Username"), "wes");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledWith("wes", "correct horse");
    expect(await screen.findByText("home content")).toBeTruthy();
  });

  test("shows an error and stays on the page when sign-in fails", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError("Invalid username or password."));
    renderLogin(makeFakeApi({ login }));
    await userEvent.type(screen.getByLabelText("Username"), "wes");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Invalid username or password.");
    expect(screen.queryByText("home content")).toBeNull();
  });
});
