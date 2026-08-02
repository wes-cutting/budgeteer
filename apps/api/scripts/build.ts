/**
 * Production build for the API (BUD-S81 · ADR-0008).
 *
 * Dev runs TypeScript directly under `tsx`, which plain `node` cannot do: sources use
 * extensionless relative imports (`moduleResolution: "Bundler"`) and `@budgeteer/domain` resolves
 * to raw `.ts`. Rather than rewrite every import to satisfy Node's ESM resolver, esbuild bundles
 * OUR source — this workspace plus the domain package — into runnable ESM.
 *
 * Third-party packages stay EXTERNAL (installed as real `node_modules` in the image). That is the
 * deliberate half: bundling Fastify, pino, and `pg` invites resolution bugs that only appear in
 * production, and keeps native/optional deps (`pg`, PGlite's WASM) out of a bundler's reach. The
 * external list is DERIVED from `dependencies`, so a new dep is handled without editing this file.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const apiRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const pkg = JSON.parse(readFileSync(path.join(apiRoot, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

// Every third-party package is resolved by Node at runtime, not inlined — except the workspace
// packages, which are TypeScript source and so must be bundled in.
//
// devDependencies are listed too, and that is load-bearing rather than defensive: PGlite is a dev
// dependency (production runs on real Postgres, ADR-0008 §2) but `db/connection.ts` still names it
// in a dynamic import. Left off this list it would be BUNDLED — dragging a 26 MB WASM Postgres into
// an image that never runs it. External, the import is simply never reached in production.
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)].filter(
  (d) => !d.startsWith("@budgeteer/"),
);

// The server, plus the operational CLIs an operator needs on a deployed box: first-admin bootstrap,
// password reset / account disable (ADR-0009 §8), and the CLI-only restore path (SEC3 — there is no
// HTTP import). Seed scripts are dev/demo-only and deliberately absent from the image.
const entryPoints = [
  "src/index.ts",
  "src/cli/create-admin.ts",
  "src/cli/reset-password.ts",
  "src/cli/disable-user.ts",
  "src/db/reset.ts",
  "src/db/restore.ts",
].map((p) => path.join(apiRoot, p));

await build({
  entryPoints,
  outdir: path.join(apiRoot, "dist"),
  outbase: path.join(apiRoot, "src"),
  bundle: true,
  platform: "node",
  format: "esm",
  // Matches the runtime image's Node (see Dockerfile). Keep the two in step.
  target: "node22",
  sourcemap: true,
  external,
  logLevel: "info",
});
