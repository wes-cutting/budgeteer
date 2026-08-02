/**
 * BUD-S82 — `/api/health` is a READINESS probe, not a liveness one.
 *
 * SPIKE-12 (finding #2) caught the old endpoint answering `{status:"ok"}` from the process alone,
 * while the database behind it was unreachable. The hub's healthcheck would have kept a container
 * in service that could not answer a single real request, so the negative case below — 503 once the
 * store is gone — is the test that actually matters.
 */
import { afterEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
afterEach(async () => {
  if (ctx) await closeTestApp(ctx).catch(() => {});
});

describe("GET /health — readiness (BUD-S82)", () => {
  test("reports ok with the database reachable", async () => {
    ctx = await createTestApp();
    const res = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "ok" });
  });

  test("reports 503 once the database is unreachable", async () => {
    ctx = await createTestApp();
    // Destroying the Kysely instance is the in-process stand-in for the container losing its
    // Postgres: the pool is gone, so the probe's `select 1` can no longer be served.
    await ctx.db.destroy();

    const res = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "degraded", db: "unreachable" });
  });

  test("stays public — a probe has no session to present", async () => {
    // The gate is default-deny, so an unauthenticated 200 here is what keeps the orchestrator's
    // healthcheck working without handing it credentials.
    const { createDb } = await import("../src/db/connection");
    const { migrateToLatest } = await import("../src/db/migrate");
    const { buildServer } = await import("../src/http/server");
    const db = await createDb();
    await migrateToLatest(db);
    const app = buildServer(db, { auth: { sessionSecret: "test-only-session-secret-16+chars" } });
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "ok" });

    await app.close();
    await db.destroy();
  });
});
