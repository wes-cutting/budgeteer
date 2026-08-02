/**
 * SPIKE-13 — auth vertical seam (THROWAWAY; findings → docs/spikes/13-auth-seam.md).
 *
 * Proves the riskiest assumptions of BUD-E13 shape A (one household, many members) on ONE slice,
 * with ZERO new dependencies, on the dev PGlite path:
 *   1. SEAM — a request-derived principal {userId, householdId, role} scopes a query by the
 *      caller's household instead of the DEFAULT_HOUSEHOLD_ID constant (the architectural bet).
 *   2. SESSION — an HMAC-signed httpOnly cookie (stateless, same-origin per ADR-0008); no cookie
 *      or a tampered cookie → 401 (default-deny).
 *   3. KDF — node's built-in scrypt (memory-hard, SECURITY.md §3) hashes + verifies passwords with
 *      a constant-time compare; NO native/wasm dep.
 *   4. ENUMERATION-SAFE — unknown user and wrong password return the identical 401 (SECURITY.md §3).
 *   5. CROSS-HOUSEHOLD — a member of household A never sees household B's rows (scoping is real).
 *
 * Run: `npx tsx spikes/13-auth-seam/seam.ts` from the repo root. Uses Fastify `inject` (no ports).
 */
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import Fastify from "fastify";
import { Kysely } from "kysely";
import { KyselyPGlite } from "kysely-pglite";

// ---------------------------------------------------------------------------
// KDF — node built-in scrypt. Format: scrypt$N$r$p$saltHex$hashHex (self-describing params).
// ---------------------------------------------------------------------------
const N = 16384,
  R = 8,
  P = 1;
function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, 32, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${dk.toString("hex")}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt") return false;
  const dk = scryptSync(pw, Buffer.from(saltHex, "hex"), 32, { N: +n, r: +r, p: +p });
  const expected = Buffer.from(hashHex, "hex");
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

// ---------------------------------------------------------------------------
// Session — HMAC-signed stateless cookie: `<userId>.<hmac>`. (Prod would use a vetted lib +
// env secret + expiry; the spike proves the SEAM, not the final cookie library.)
// ---------------------------------------------------------------------------
const SESSION_SECRET = "spike-only-secret-never-ship";
function signSession(userId: string): string {
  const mac = createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
  return `${userId}.${mac}`;
}
function verifySession(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const userId = token.slice(0, i);
  const got = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(createHmac("sha256", SESSION_SECRET).update(userId).digest("hex"));
  return got.length === want.length && timingSafeEqual(got, want) ? userId : null;
}
function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// ---------------------------------------------------------------------------
// DB (in-memory PGlite — the dev path). Minimal users + accounts, TWO households to prove scoping.
// ---------------------------------------------------------------------------
interface DB {
  users: { id: string; username: string; password_hash: string; household_id: string; role: string };
  accounts: { id: string; name: string; household_id: string };
}
const HH_A = "hh-aaaa";
const HH_B = "hh-bbbb";

async function makeDb(): Promise<Kysely<DB>> {
  const { dialect } = await KyselyPGlite.create("memory://");
  const db = new Kysely<DB>({ dialect });
  await db.schema
    .createTable("users")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("username", "text", (c) => c.notNull().unique())
    .addColumn("password_hash", "text", (c) => c.notNull())
    .addColumn("household_id", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .execute();
  await db.schema
    .createTable("accounts")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("household_id", "text", (c) => c.notNull())
    .execute();
  await db
    .insertInto("users")
    .values([
      { id: "u-admin", username: "wes", password_hash: hashPassword("correct horse"), household_id: HH_A, role: "admin" },
    ])
    .execute();
  await db
    .insertInto("accounts")
    .values([
      { id: "a1", name: "Everyday Checking", household_id: HH_A },
      { id: "a2", name: "Emergency Savings", household_id: HH_A },
      { id: "b1", name: "OTHER-HOUSEHOLD Account", household_id: HH_B }, // must never appear for a HH_A member
    ])
    .execute();
  return db;
}

// ---------------------------------------------------------------------------
// The scoped service call — the SEAM. Takes householdId as a parameter (derived from the
// principal), NOT a constant. This is the pattern the real refactor threads through.
// ---------------------------------------------------------------------------
function listAccounts(db: Kysely<DB>, householdId: string) {
  return db.selectFrom("accounts").select(["id", "name"]).where("household_id", "=", householdId).orderBy("name").execute();
}

interface Principal {
  userId: string;
  householdId: string;
  role: string;
}

async function buildApp(db: Kysely<DB>) {
  const app = Fastify();
  app.decorateRequest("principal", null);

  // Enumeration-safe login: identical 401 for unknown user OR bad password.
  app.post("/login", async (req, reply) => {
    const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
    const user = username
      ? await db.selectFrom("users").selectAll().where("username", "=", username).executeTakeFirst()
      : undefined;
    const ok = user ? verifyPassword(password ?? "", user.password_hash) : verifyPassword(password ?? "", hashPassword("decoy")); // hash even when user missing → equalize timing
    if (!user || !ok) return reply.code(401).send({ error: { message: "Invalid username or password." } });
    const cookie = `sid=${signSession(user.id)}; HttpOnly; SameSite=Strict; Path=/`;
    return reply.header("set-cookie", cookie).send({ ok: true });
  });

  // Default-deny auth gate for everything under this encapsulated plugin.
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", async (req, reply) => {
      const token = readCookie(req.headers.cookie, "sid");
      const userId = token ? verifySession(token) : null;
      const user = userId
        ? await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst()
        : undefined;
      if (!user) return reply.code(401).send({ error: { message: "Authentication required." } });
      (req as { principal?: Principal }).principal = { userId: user.id, householdId: user.household_id, role: user.role };
    });

    protectedRoutes.get("/accounts", async (req) => {
      const principal = (req as { principal: Principal }).principal;
      return { accounts: await listAccounts(db, principal.householdId) };
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Assertions via inject (no ports).
// ---------------------------------------------------------------------------
let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const db = await makeDb();
const app = await buildApp(db);

// 1. Default-deny: no cookie → 401
const noCookie = await app.inject({ method: "GET", url: "/accounts" });
check("unauthenticated GET /accounts → 401", noCookie.statusCode === 401, `got ${noCookie.statusCode}`);

// 2. Wrong password → 401
const badPw = await app.inject({ method: "POST", url: "/login", payload: { username: "wes", password: "nope" } });
check("wrong password → 401", badPw.statusCode === 401, `got ${badPw.statusCode}`);

// 3. Unknown user → identical 401 (enumeration-safe)
const unknown = await app.inject({ method: "POST", url: "/login", payload: { username: "ghost", password: "whatever" } });
check("unknown user → 401 (same as wrong pw)", unknown.statusCode === 401 && unknown.body === badPw.body, `codes ${unknown.statusCode}/${badPw.statusCode}, bodies match=${unknown.body === badPw.body}`);

// 4. Correct login → 200 + httpOnly cookie
const good = await app.inject({ method: "POST", url: "/login", payload: { username: "wes", password: "correct horse" } });
const setCookie = String(good.headers["set-cookie"] ?? "");
check("correct login → 200", good.statusCode === 200, `got ${good.statusCode}`);
check("session cookie is HttpOnly + SameSite", /HttpOnly/i.test(setCookie) && /SameSite/i.test(setCookie), setCookie);

// 5. Authenticated GET → 200 and ONLY the caller's household (scoping is principal-derived)
const sid = setCookie.split(";")[0];
const authed = await app.inject({ method: "GET", url: "/accounts", headers: { cookie: sid } });
const rows = authed.statusCode === 200 ? (authed.json() as { accounts: { name: string }[] }).accounts : [];
check("authenticated GET /accounts → 200", authed.statusCode === 200, `got ${authed.statusCode}`);
check("scoped to caller's household (2 rows)", rows.length === 2, `got ${rows.length}`);
check("cross-household row excluded", !rows.some((r) => r.name.includes("OTHER-HOUSEHOLD")), JSON.stringify(rows.map((r) => r.name)));

// 6. Tampered cookie → 401
const tampered = await app.inject({ method: "GET", url: "/accounts", headers: { cookie: "sid=u-admin.deadbeef" } });
check("tampered cookie → 401", tampered.statusCode === 401, `got ${tampered.statusCode}`);

// 7. KDF round-trip + rejects wrong pw
const h = hashPassword("s3cret");
check("scrypt verify: correct pw true", verifyPassword("s3cret", h));
check("scrypt verify: wrong pw false", !verifyPassword("s3cret!", h));

await app.close();
await db.destroy();
console.log(failures === 0 ? "\nSPIKE-13: ALL GREEN" : `\nSPIKE-13: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
