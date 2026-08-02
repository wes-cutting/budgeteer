/**
 * BUD-S81 — the production container serves the built SPA from the API process (ADR-0008 §1).
 *
 * The security-critical half is the interaction with the default-deny gate: the SPA's own files
 * must load WITHOUT a session (or the login page could never render), while every API route stays
 * gated. These tests pin both halves — a regression that made the static exemption match API paths
 * would silently expose the ledger, which is exactly what ADR-0009 exists to prevent.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { buildServer } from "../src/http/server";
import type { DB } from "../src/db/schema";

const SHELL = "<!doctype html><title>budgeteer</title><div id=root></div>";
const ADMIN = { username: "wes", password: "correct horse battery" };

let app: FastifyInstance;
let db: Kysely<DB>;
let staticRoot: string;

beforeAll(async () => {
  // A stand-in for `apps/web/dist` — the real bundle is a build artifact, and these tests are about
  // the serving contract, not its contents.
  staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), "budgeteer-static-"));
  fs.writeFileSync(path.join(staticRoot, "index.html"), SHELL);
  fs.mkdirSync(path.join(staticRoot, "assets"));
  fs.writeFileSync(path.join(staticRoot, "assets", "app.js"), "export const x = 1;\n");

  db = await createDb();
  await migrateToLatest(db);
  // Auth ENABLED — the production shape. Static serving must coexist with the gate, not bypass it.
  app = buildServer(db, {
    auth: { sessionSecret: "test-only-session-secret-16+chars" },
    staticRoot,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  fs.rmSync(staticRoot, { recursive: true, force: true });
});

describe("serving the SPA from the API process (BUD-S81)", () => {
  test("the shell and its assets load without a session — the login page must be reachable", async () => {
    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");
    expect(root.body).toContain("<div id=root>");

    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain("export const x");
  });

  test("client routes that collide with API paths deep-link to the shell (BUD-S81)", async () => {
    // The reason the API moved under `/api`: every one of these is spelled exactly like an API
    // endpoint. Sharing a root, a refresh on the Accounts page answered with JSON. They must now
    // reach the SPA — this is the regression test for that whole class of bug.
    for (const url of ["/accounts", "/envelopes", "/templates", "/recurring", "/users"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} must serve the app`).toBe(200);
      expect(res.body, `${url} must serve the shell`).toContain("<div id=root>");
    }

    // …including the parameterised forms a bookmark or shared link would use.
    const deep = await app.inject({ method: "GET", url: "/envelopes/abc" });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toContain("<div id=root>");
  });

  test("the static exemption does NOT widen the gate — API routes still default-deny", async () => {
    for (const url of ["/api/accounts", "/api/envelopes", "/api/auth/me", "/api/users"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} must require a session`).toBe(401);
    }
  });

  test("an unknown /api path is refused, not answered with the SPA shell", async () => {
    // Without the `/api/` carve-out in the static check, this would fall through to the shell and
    // hand an unauthenticated caller a 200.
    const res = await app.inject({ method: "GET", url: "/api/not-a-real-endpoint" });
    expect(res.statusCode).toBe(401);
  });

  test("/export stays gated — the whole ledger is behind the session, not served as a file", async () => {
    const res = await app.inject({ method: "GET", url: "/api/export" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { message: "Authentication required." } });
  });

  test("a write to an unknown path keeps the JSON error envelope, not the HTML shell", async () => {
    // Unauthenticated it is 401, not 404 — default-deny answers before routing is revealed, so a
    // stranger can't map the API surface. The JSON 404 is what an authenticated caller sees.
    const anonymous = await app.inject({ method: "POST", url: "/not-a-route" });
    expect(anonymous.statusCode).toBe(401);

    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    const setCookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: ADMIN }))
      .headers["set-cookie"];
    const raw = (Array.isArray(setCookie) ? setCookie[0] : setCookie) as string;
    const cookie = raw.split(";")[0]!;

    const res = await app.inject({ method: "POST", url: "/not-a-route", headers: { cookie } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { message: "Not found." } });
  });

  test("a traversal attempt gets the shell, never a file outside the static root", async () => {
    // The traversal is normalized away, so the path simply misses every file and lands on the SPA
    // fallback. What matters is the negative: repo contents never leave the process.
    for (const url of ["/../package.json", "/assets/../../package.json"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.body, `${url} must not serve a file outside the root`).toBe(SHELL);
      expect(res.body).not.toContain("budgeteer/api");
    }
  });
});
