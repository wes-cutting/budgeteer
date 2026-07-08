import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDb } from "../src/db/connection";
import { migrateToLatest } from "../src/db/migrate";
import { buildServer } from "../src/http/server";
import type { DB } from "../src/db/schema";

// R13 — structured request/response logging must surface useful lines (method, url, status) WITHOUT
// leaking request bodies or headers, which on the money routes carry financial data (SECURITY.md
// §1/§5). We build the server with logging enabled and capture Fastify's bundled-pino output via a
// stream, then assert BOTH halves: the access line is present, the secret body/headers are absent.
// (The rest of the suite builds via `createTestApp()` → `logger: false`, so it stays quiet.)
let app: FastifyInstance;
let db: Kysely<DB>;
let lines: string[];

beforeEach(async () => {
  db = await createDb(); // in-memory PGlite, isolated per test
  await migrateToLatest(db);
  lines = [];
  app = buildServer(db, {
    logger: { level: "info", stream: { write: (msg: string) => void lines.push(msg) } },
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await db.destroy();
});

const logOutput = () => lines.join("");

describe("structured API logging (R13)", () => {
  test("emits an inbound + outbound line with method, url, and status for a request", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    const out = logOutput();
    expect(out).toContain("incoming request"); // Fastify's default inbound access line
    expect(out).toContain("request completed"); // …and the outbound one
    expect(out).toContain("/health"); // the url (default `req` serializer)
    expect(out).toContain('"statusCode":200'); // the status (default `res` serializer)
  });

  test("never logs request bodies or headers — financial data stays out of the logs", async () => {
    const accountId = (
      await app.inject({
        method: "POST",
        url: "/accounts",
        payload: {
          openedOn: "2026-07-02",
          name: "Checking",
          kind: "checking",
          startingBalance: "0",
        },
      })
    ).json().account.id as string;
    const envelopeId = (
      await app.inject({ method: "POST", url: "/envelopes", payload: { name: "Rent" } })
    ).json().envelope.id as string;

    // Inspect only the logs produced by the sensitive money-route request below.
    lines.length = 0;
    const SECRET_MEMO = "MEMO-SECRET-1a2b3c";
    const SECRET_TOKEN = "Bearer SECRET-TOKEN-9z8y7x";
    const res = await app.inject({
      method: "POST",
      url: `/accounts/${accountId}/transactions`,
      headers: { authorization: SECRET_TOKEN },
      payload: {
        kind: "withdrawal",
        amount: "1234.56",
        occurredOn: "2026-07-02",
        payee: "Landlord PII",
        memo: SECRET_MEMO,
        allocations: [{ envelopeId, amount: "1234.56" }],
      },
    });
    expect(res.statusCode).toBe(201);

    const out = logOutput();
    // Logging IS on for the money route — the request and its status were recorded …
    expect(out).toContain("/accounts/");
    expect(out).toContain('"statusCode":201');
    // … but nothing from the body or headers leaks (the default serializers omit both).
    expect(out).not.toContain(SECRET_MEMO);
    expect(out).not.toContain("Landlord PII");
    expect(out).not.toContain("1234.56");
    expect(out).not.toContain("SECRET-TOKEN-9z8y7x");
    expect(out.toLowerCase()).not.toContain("authorization");
  });
});
