import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "./config";
import { createDb } from "./db/connection";
import { migrateToLatest } from "./db/migrate";
import { buildServer } from "./http/server";

// Auto-load the repo-root .env (gitignored) so `cp .env.example .env` just works, regardless of
// the workspace cwd. Real process env vars take precedence (dotenv does not override existing).
loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const config = loadConfig();
const db = await createDb(config.DATABASE_URL, config.PGLITE_DIR);
await migrateToLatest(db);

const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
// Serving the SPA is opt-in via WEB_STATIC_ROOT (set in the container image, unset in dev). Resolve
// and verify it here: a path that exists but holds no index.html would boot a server that 404s
// every page, so it fails at startup like any other invalid config (spine §8).
let staticRoot: string | undefined;
if (config.WEB_STATIC_ROOT !== undefined) {
  staticRoot = path.resolve(config.WEB_STATIC_ROOT);
  if (!fs.existsSync(path.join(staticRoot, "index.html")))
    throw new Error(`Invalid configuration: WEB_STATIC_ROOT has no index.html (${staticRoot}).`);
}

// `Secure` cookies default to on in production and off elsewhere (dev/e2e serve plain HTTP on
// localhost), and SESSION_COOKIE_SECURE overrides that either way (BUD-S83).
const secureCookie = config.SESSION_COOKIE_SECURE ?? config.APP_ENV === "production";

const app = buildServer(db, {
  logger: { level: config.LOG_LEVEL },
  corsOrigins,
  ...(staticRoot !== undefined ? { staticRoot } : {}),
  // Auth is ALWAYS on for the real server (ADR-0009 · BUD-S87). SESSION_SECRET is required in
  // production (config enforces it); dev/e2e fall back to a fixed non-secret.
  auth: {
    sessionSecret: config.SESSION_SECRET ?? "dev-only-insecure-session-secret-unset",
    secureCookie,
  },
});

// Say it out loud at boot. Turning Secure off in production is defensible on a trusted LAN, but it
// means the session token crosses the network in the clear — that belongs in the log the operator
// reads, not only in a config file nobody re-reads after setup.
if (config.APP_ENV === "production" && !secureCookie) {
  app.log.warn(
    "SESSION_COOKIE_SECURE=false: session cookies will be sent over plain HTTP. Anything on this network can read them. Terminate TLS at a reverse proxy unless this LAN is trusted.",
  );
}
await app.listen({ port: config.PORT, host: config.HOST });

// Graceful shutdown (BUD-S81). As PID 1 in a container, Node gets no default signal handlers, so
// without these `docker stop` would wait out its grace period and SIGKILL the process mid-request,
// dropping the Postgres pool on the floor. Draining in-flight requests first, then the pool, makes
// a redeploy a clean handoff. `once` — a second signal from an impatient operator should fall
// through to the default (immediate) behaviour rather than queue another drain.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void (async () => {
      app.log.info({ signal }, "shutting down");
      try {
        await app.close();
        await db.destroy();
        process.exit(0);
      } catch (err) {
        app.log.error(err, "shutdown failed");
        process.exit(1);
      }
    })();
  });
}
