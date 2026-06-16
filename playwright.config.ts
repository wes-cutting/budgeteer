import { defineConfig, devices } from "@playwright/test";

// EH5 — the project's first real browser→API test layer. It boots the REAL Fastify API and the
// REAL Vite-served web app, then drives Chromium against them, so it exercises the browser→API
// seam the other three layers skip (API tests use Fastify `inject`; web tests use a jsdom fake
// API). This is the layer that would have caught the CORS bug (docs/reviews/2026-06-15-repo-review
// EH5 · docs/KIT_FEEDBACK K3).
//
// The web MUST be served from :5173 — that origin is the API's CORS allowlist default
// (apps/api/src/config.ts). Serving it from any other origin makes the dashboard's initial load
// fail, which is exactly the failure mode this layer exists to catch.
const API_PORT = 3001;
const WEB_PORT = 5173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Playwright owns the stack for the run: it starts both servers, waits for each to answer, runs
  // the tests, then tears them down. The API uses its default in-process PGlite (no DATABASE_URL),
  // so each run starts from an empty, deterministic store; the test uses unique names so it is also
  // robust against a server you already had running locally (reuseExistingServer).
  webServer: [
    {
      command: "npm run start --workspace @budgeteer/api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev --workspace @budgeteer/web",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
