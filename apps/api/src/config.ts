import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default("info"),
  // Unset in dev/test → in-process PGlite; set in production → real PostgreSQL (ADR-0002).
  DATABASE_URL: z.string().optional(),
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
