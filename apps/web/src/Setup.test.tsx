import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { Setup } from "./Setup";
import { ApiError, type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";

// BUD-S92 — first-run setup. Rendered through a data router (Setup uses `useNavigate` and
// `Navigate`), with stub "/" and "/login" routes so both destinations are observable as content.
// The stub login route also renders whatever handoff message it was given, which is how the
// setup-succeeded-but-sign-in-failed path is asserted without pulling in the real Login.
function renderSetup(api: Api) {
  const router = createMemoryRouter(
    [
      { path: "/setup", element: <Setup api={api} /> },
      { path: "/", element: <p>home content</p> },
      { path: "/login", element: <LoginStub /> },
    ],
    { initialEntries: ["/setup"] },
  );
  render(<RouterProvider router={router} />);
}

function LoginStub() {
  const message = (useLocation().state as { message?: string } | null)?.message;
  return (
    <>
      <p>sign-in page</p>
      {message !== undefined ? <p>{message}</p> : null}
    </>
  );
}

/** Fill the form. `confirm` defaults to matching, since the mismatch is the exception. */
async function fillForm(username: string, password: string, confirm = password) {
  await userEvent.type(await screen.findByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("Setup (BUD-S92)", () => {
  test("creates the first admin, signs in, and lands home — no second sign-in", async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockResolvedValue(undefined);
    renderSetup(makeFakeApi({ needsSetup: async () => true, setup, login }));

    await fillForm("wes", "a-long-enough-password");

    expect(setup).toHaveBeenCalledWith("wes", "a-long-enough-password");
    expect(login).toHaveBeenCalledWith("wes", "a-long-enough-password");
    expect(await screen.findByText("home content")).toBeTruthy();
  });

  test("mismatched passwords block submission — nothing is sent", async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    renderSetup(makeFakeApi({ needsSetup: async () => true, setup }));

    await fillForm("wes", "a-long-enough-password", "a-different-password");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Passwords do not match.");
    expect(setup).not.toHaveBeenCalled();
  });

  test("a too-short password is caught here, not by the round trip", async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    renderSetup(makeFakeApi({ needsSetup: async () => true, setup }));

    await fillForm("wes", "short");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("at least 8 characters");
    expect(setup).not.toHaveBeenCalled();
  });

  test("a failed setup is reported and keeps you on the form", async () => {
    const setup = vi.fn().mockRejectedValue(new ApiError("Setup is already complete."));
    renderSetup(makeFakeApi({ needsSetup: async () => true, setup }));

    await fillForm("wes", "a-long-enough-password");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Setup is already complete.");
    expect(screen.queryByText("home content")).toBeNull();
  });

  /**
   * The account EXISTS at this point, so calling it a setup failure would be a lie with a
   * consequence: the user retries setup, meets a 409, and concludes their account was never
   * created. Hand off to sign-in with an explanation instead.
   */
  test("setup succeeding but auto-login failing goes to sign-in, not to an error", async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const login = vi.fn().mockRejectedValue(new ApiError("Invalid username or password."));
    renderSetup(makeFakeApi({ needsSetup: async () => true, setup, login }));

    await fillForm("wes", "a-long-enough-password");

    expect(await screen.findByText("sign-in page")).toBeTruthy();
    expect(screen.getByText("Your account was created. Sign in to continue.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("redirects to sign-in once the install has a user", async () => {
    renderSetup(makeFakeApi({ needsSetup: async () => false }));

    expect(await screen.findByText("sign-in page")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Create the first account" })).toBeNull();
  });

  test("an unreachable probe sends you to sign-in, never offers to claim the instance", async () => {
    const needsSetup = vi.fn().mockRejectedValue(new Error("network down"));
    renderSetup(makeFakeApi({ needsSetup }));

    expect(await screen.findByText("sign-in page")).toBeTruthy();
  });
});
