import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsersAdmin } from "./UsersAdmin";
import { ApiError, type Api, type UserView } from "./api";
import { makeFakeApi } from "./test/fakeApi";
import { ToastProvider } from "./ui";

const USERS: UserView[] = [
  { id: "u1", username: "wes", role: "admin", disabledAt: null },
  { id: "u2", username: "sam", role: "member", disabledAt: null },
];

function renderUsers(overrides: Partial<Api> = {}) {
  const api = makeFakeApi(overrides);
  render(
    <ToastProvider>
      <UsersAdmin api={api} />
    </ToastProvider>,
  );
  return api;
}

describe("UsersAdmin (BUD-S88)", () => {
  test("lists users with their username and role", async () => {
    renderUsers({ listUsers: async () => USERS });
    expect(await screen.findByText("wes")).toBeTruthy();
    expect(screen.getByText("sam")).toBeTruthy();
  });

  test("adds a member via the progressive form", async () => {
    const createUser = vi.fn().mockResolvedValue(undefined);
    renderUsers({ listUsers: async () => [], createUser });
    await userEvent.click(await screen.findByRole("button", { name: "Add member" }));
    await userEvent.type(screen.getByLabelText("Username"), "sam");
    await userEvent.type(screen.getByLabelText("Password"), "sam-password");
    await userEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(createUser).toHaveBeenCalledWith("sam", "sam-password", "member");
  });

  test("disables a user via its row action", async () => {
    const setUserDisabled = vi.fn().mockResolvedValue(undefined);
    renderUsers({ listUsers: async () => USERS, setUserDisabled });
    await userEvent.click(await screen.findByRole("button", { name: "Disable sam" }));
    expect(setUserDisabled).toHaveBeenCalledWith("u2", true);
  });

  test("shows a permission notice for non-admins (403)", async () => {
    renderUsers({
      listUsers: async () => {
        throw new ApiError("Admin access required.");
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/admin access/i);
  });
});
