import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

// Regression guard: the browser calls this API cross-origin (web :5173 → API :3001), so it must
// send CORS headers or every fetch fails with "Failed to fetch". (Previously missing.)
let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const ORIGIN = "http://localhost:5173";

describe("CORS", () => {
  test("an allowed origin gets access-control-allow-origin on a normal request", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/accounts",
      headers: { origin: ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
  });

  test("a preflight (OPTIONS) for a JSON POST is answered with the allow headers", async () => {
    const res = await ctx.app.inject({
      method: "OPTIONS",
      url: "/accounts",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(res.statusCode).toBeLessThan(300); // 204/200
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGIN);
    expect(String(res.headers["access-control-allow-methods"])).toContain("POST");
  });

  test("a disallowed origin is not granted access", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/accounts",
      headers: { origin: "http://evil.example" },
    });
    // The request still returns data server-side, but the browser-facing allow header is absent
    // (or does not echo the bad origin), so a real browser would block it.
    expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
  });
});
