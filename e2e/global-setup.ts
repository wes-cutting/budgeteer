import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "@playwright/test";

// BUD-S87 — auth is ON for the e2e API (index.ts always enables it). The existing 121 specs drive
// the app as an authenticated user, so we sign in ONCE here and share the session via storageState
// (config `use.storageState`). The store is a fresh throwaway per run (see playwright.config.ts), so
// the first-run `POST /auth/setup` creates the admin; `POST /auth/login` mints the session cookie.
const API = "http://localhost:3001";
const dir = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_STATE = path.join(dir, ".auth", "state.json");
/** The e2e admin. Exported so the auth spec can drive a real UI sign-in with its OWN session
 *  (it must never consume the shared storageState session — its logout would revoke it for the
 *  whole serial suite). */
export const E2E_ADMIN = { username: "e2e-admin", password: "e2e-password-123" };

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext();
  // First-run admin. A fresh store returns 201; a 409 (already set up) is harmless — login is the
  // real gate below.
  await api.post(`${API}/auth/setup`, { data: E2E_ADMIN });
  const login = await api.post(`${API}/auth/login`, { data: E2E_ADMIN });
  if (!login.ok()) {
    throw new Error(`e2e sign-in failed (${login.status()}): ${await login.text()}`);
  }
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await api.storageState({ path: STORAGE_STATE });
  await api.dispose();
}
