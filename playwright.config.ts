import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

// The e2e suite must run against an empty, deterministic store. But the repo-root .env may set
// PGLITE_DIR to persist the developer's dev store on disk, and the API auto-loads that .env
// (apps/api/src/index.ts) — so a plain local run would read/write (and pollute, and be slowed by)
// that shared store. To stay isolated without touching the developer's PGLITE_DIR or their data, we
// boot the API with its own throwaway PGlite dir for this run. A real env var wins over .env (dotenv
// never overrides existing vars), so this override sticks. mkdtempSync gives a guaranteed-fresh,
// unique, EMPTY path — the store must already be clean *here*, because Playwright starts the
// webServer before any globalSetup hook (createGlobalSetupTasks in playwright's runner), so there is
// no earlier place to reset it.
//
// Playwright evaluates this config in several processes (the main runner plus each worker). The
// `??=` makes the dir once in the runner and lets the workers reuse it via the inherited env var,
// instead of each worker leaking its own unused dir; global-teardown.ts removes it after the run.
const E2E_PGLITE_DIR = (process.env.E2E_PGLITE_DIR ??= fs.mkdtempSync(
  path.join(os.tmpdir(), "budgeteer-e2e-pglite-"),
));

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
  // the tests, then tears them down. The API is booted with a per-run throwaway PGLITE_DIR (see
  // above), so each run starts from an empty, deterministic store regardless of the local .env.
  //
  // reuseExistingServer is OFF everywhere (K20/K24). The throwaway-store isolation above only takes
  // effect when Playwright actually *starts* the API — its `env` override cannot reach a server it
  // merely attaches to. Any server already holding :3001/:5173 is a *dev* server (started from the
  // local .env → the persistent dev store), so reusing it would run the suite against — and pollute
  // — the developer's real data. That is exactly the K24 incident: a "stopped" dev API left an
  // orphaned node child on :3001, `reuseExistingServer: true` silently attached, and three runs
  // wrote fixtures into the dev store. With reuse off, Playwright FAILS FAST if either port is held
  // (telling the developer to free it) and otherwise always starts its own isolated stack. CI
  // already ran with reuse off (PGLITE_DIR unset → in-memory); this makes local runs match.
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: [
    {
      command: "npm run start --workspace @budgeteer/api",
      url: `http://localhost:${API_PORT}/health`,
      // Override PGLITE_DIR for the spawned API only; merged over process.env by Playwright. dotenv
      // (apps/api) won't override this real env var, so the e2e API uses the throwaway store.
      env: { PGLITE_DIR: E2E_PGLITE_DIR },
      reuseExistingServer: false, // K24: own the stack or fail fast — never attach to a dev server
      timeout: 60_000,
    },
    {
      command: "npm run dev --workspace @budgeteer/web",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false, // K24: own the stack or fail fast — never attach to a dev server
      timeout: 60_000,
    },
  ],
});
