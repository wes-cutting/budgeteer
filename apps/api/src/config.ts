import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default("info"),
  // Unset in dev/test → in-process PGlite; set in production → real PostgreSQL (ADR-0002).
  DATABASE_URL: z.string().optional(),
  // Optional: persist the PGlite store to a directory so data survives restarts and `npm run seed`
  // works without a full PostgreSQL install. Ignored when DATABASE_URL is set. Path is relative to
  // the process working directory (apps/api when running npm scripts). e.g. ../../data/budgeteer-dev
  PGLITE_DIR: z.string().optional(),
  // Browser origins allowed to call the API (comma-separated). Defaults to the Vite dev origin;
  // set explicitly in production. An allowlist, never `*` (SECURITY.md).
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
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
