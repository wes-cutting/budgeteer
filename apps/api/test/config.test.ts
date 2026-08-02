import { describe, expect, test } from "vitest";
import { loadConfig } from "../src/config";

// R13 — LOG_LEVEL is read and validated at the config boundary (spine §8): a closed enum of pino
// levels, so a typo fails loudly at startup rather than throwing deep inside pino at the first log.
describe("config — LOG_LEVEL boundary validation (R13)", () => {
  test("defaults to info when unset", () => {
    expect(loadConfig({}).LOG_LEVEL).toBe("info");
  });

  test("accepts a valid pino level", () => {
    expect(loadConfig({ LOG_LEVEL: "debug" }).LOG_LEVEL).toBe("debug");
  });

  test("rejects an unknown level loudly", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
  });
});

// EH11 — the API binds loopback unless explicitly told otherwise: with no auth (#19), the
// reachable surface must stay as small as the auth story (SECURITY.md §3). Exposing the API to
// the network is a deliberate, validated opt-in, never the default.
describe("config — HOST boundary validation (EH11)", () => {
  test("defaults to loopback when unset", () => {
    expect(loadConfig({}).HOST).toBe("127.0.0.1");
  });

  test("accepts an explicit opt-in to a wider bind", () => {
    expect(loadConfig({ HOST: "0.0.0.0" }).HOST).toBe("0.0.0.0");
  });

  test("rejects a blank host loudly", () => {
    expect(() => loadConfig({ HOST: "   " })).toThrow(/HOST/);
  });
});

// BUD-S81/S83 — the production profile has two hard requirements the dev profile does not, and both
// must fail at STARTUP rather than at the first request that needs them.
describe("config — production profile", () => {
  const PROD = { APP_ENV: "production", DATABASE_URL: "postgres://u:p@db:5432/budgeteer" };

  test("accepts a complete production profile", () => {
    const cfg = loadConfig({ ...PROD, SESSION_SECRET: "a-long-enough-session-secret" });
    expect(cfg.APP_ENV).toBe("production");
    expect(cfg.DATABASE_URL).toBe("postgres://u:p@db:5432/budgeteer");
  });

  test("requires SESSION_SECRET — an unsigned session cookie is forgeable", () => {
    expect(() => loadConfig(PROD)).toThrow(/SESSION_SECRET/);
  });

  test("rejects a trivially short SESSION_SECRET", () => {
    expect(() => loadConfig({ ...PROD, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  test("requires DATABASE_URL — there is no PGlite in the production image to fall back to", () => {
    // Without this the container would boot, find no DATABASE_URL, and reach for a dev-only
    // dependency that isn't installed. Worse than the crash would be it succeeding: a household's
    // ledger served from an in-memory store that empties on every restart (ADR-0008 §2).
    expect(() =>
      loadConfig({ APP_ENV: "production", SESSION_SECRET: "a-long-enough-session-secret" }),
    ).toThrow(/DATABASE_URL/);
  });

  test("neither is required outside production — dev runs with zero setup", () => {
    expect(() => loadConfig({ APP_ENV: "development" })).not.toThrow();
  });
});

// BUD-S83 — the Secure-cookie decision BUD-S87 deferred. A browser discards a `Secure` cookie that
// arrives over plain HTTP, so a TLS-less LAN deployment needs a way to say so explicitly.
describe("config — SESSION_COOKIE_SECURE", () => {
  test("is unset by default, leaving the APP_ENV-derived default in force", () => {
    expect(loadConfig({}).SESSION_COOKIE_SECURE).toBeUndefined();
  });

  test("parses to a boolean, not the string that came out of the environment", () => {
    expect(loadConfig({ SESSION_COOKIE_SECURE: "false" }).SESSION_COOKIE_SECURE).toBe(false);
    expect(loadConfig({ SESSION_COOKIE_SECURE: "true" }).SESSION_COOKIE_SECURE).toBe(true);
  });

  test("rejects anything that isn't true/false — `0` must not silently read as false", () => {
    expect(() => loadConfig({ SESSION_COOKIE_SECURE: "0" })).toThrow(/SESSION_COOKIE_SECURE/);
  });
});

// BUD-S81 — serving the SPA is opt-in, and a wrong path must fail at startup rather than boot a
// server that 404s every page.
describe("config — WEB_STATIC_ROOT", () => {
  test("is optional — dev serves the web from Vite instead", () => {
    expect(loadConfig({}).WEB_STATIC_ROOT).toBeUndefined();
  });

  test("is carried through when set", () => {
    expect(loadConfig({ WEB_STATIC_ROOT: "/app/apps/web/dist" }).WEB_STATIC_ROOT).toBe(
      "/app/apps/web/dist",
    );
  });
});
