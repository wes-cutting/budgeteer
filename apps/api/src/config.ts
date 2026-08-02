import { z } from "zod";

const schema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    // Interface the API listens on. Still defaults to loopback — a dev machine has no reason to
    // serve the network — but `0.0.0.0` is no longer the loaded opt-in it was under EH11. That
    // warning existed because the API had NO authentication; binding wide meant handing the whole
    // ledger to anything on the LAN. BUD-E13 closed that (default-deny at the resource level,
    // ADR-0009), so the production container binds `0.0.0.0` as a matter of course (SECURITY.md §3).
    HOST: z.string().trim().min(1).default("127.0.0.1"),
    // Pino log levels, most→least severe (`silent` disables output). Validated to a closed set here
    // so a typo fails loudly at startup (spine §8) instead of throwing deep inside pino. Threaded to
    // the Fastify logger in `buildServer` for dev-vs-prod verbosity.
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    // Unset in dev/test → in-process PGlite; set in production → real PostgreSQL (ADR-0002).
    // REQUIRED in production (enforced below): PGlite is a dev dependency and is not present in the
    // production image at all, so there is no in-memory store to fall back to — and silently
    // serving a household's ledger from an ephemeral one would lose every write on restart.
    DATABASE_URL: z.string().optional(),
    // Optional: persist the PGlite store to a directory so data survives restarts and `npm run seed`
    // works without a full PostgreSQL install. Ignored when DATABASE_URL is set. Path is relative to
    // the process working directory (apps/api when running npm scripts). e.g. ../../data/budgeteer-dev
    PGLITE_DIR: z.string().optional(),
    // Browser origins allowed to call the API (comma-separated). Defaults to the Vite dev origin;
    // set explicitly in production. An allowlist, never `*` (SECURITY.md).
    CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
    // Absolute path to the built web assets (`apps/web/dist`). SET → this process also serves the
    // SPA, which is the container shape: one image, one origin (ADR-0008 §1). UNSET → API only
    // (dev, where Vite serves the web on :5173). `index.ts` fails loudly if the path has no
    // index.html, rather than booting a server that 404s every page.
    WEB_STATIC_ROOT: z.string().optional(),
    // Secret that signs the session cookie (ADR-0009 §4). REQUIRED in production (enforced below);
    // dev/test/e2e fall back to a fixed non-secret in `index.ts`/`buildServer` so the flow works
    // without setup. Min length rejects trivially weak secrets.
    SESSION_SECRET: z.string().min(16).optional(),
    // Whether the session cookie carries `Secure` (HTTPS-only). Defaults to ON in production.
    //
    // The decision BUD-S87 flagged for this slice: `Secure` was hard-wired to APP_ENV=production,
    // and a browser DISCARDS a Secure cookie sent over plain HTTP — so a hub serving the LAN
    // without TLS would take the login, set a cookie the browser throws away, and bounce the user
    // back to the login page with nothing to debug. Making it explicit keeps TLS the default and
    // turns the alternative into a conscious, visible choice (`index.ts` warns at startup when it
    // is off in production) rather than a mystery. Terminating TLS at a hub reverse proxy is the
    // recommended shape; disabling this is only defensible on a trusted LAN, because the session
    // token is then readable by anything on that network.
    SESSION_COOKIE_SECURE: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.APP_ENV === "production" && cfg.SESSION_SECRET === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message: "SESSION_SECRET is required in production.",
      });
    }
    if (cfg.APP_ENV === "production" && cfg.DATABASE_URL === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required in production.",
      });
    }
  });

export type Config = z.infer<typeof schema>;

/** Validate config at startup; fail loudly on missing/invalid values (spine §8). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${msg}`);
  }
  return parsed.data;
}
