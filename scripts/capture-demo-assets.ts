/**
 * Capture demo screenshots + a golden-path video for sharing/marketing use.
 *
 * Fully self-contained and idempotent: resets + reseeds the synthetic demo store
 * (data/budgeteer-demo — never api-ledger or budgeteer-dev), spawns its own throwaway
 * api-demo server for the duration of the run, and tears it down after. This matters
 * because the golden-path capture performs a REAL "Save transaction" against the store —
 * without a reset first, re-running this script would pile up duplicate transactions and
 * the demo numbers would drift further from the clean baseline on every run.
 *
 * Each run writes into its own datetime-stamped folder under data/demo-assets/ (gitignored)
 * so past captures stay around as history instead of being overwritten.
 *
 * Prereq: the "web" dev server running on :5173 (this script does not manage it — it's
 * stateless, so it doesn't need resetting between runs). Port 3001 must be free; this
 * script owns the api-demo server for its own duration and fails loudly if something else
 * is already listening there.
 *
 * Usage: npm run capture:demo             — screenshots only (default; faster)
 *        npm run capture:demo:video       — screenshots + the golden-path video
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const API_DIR = path.join(ROOT, "apps/api");
const TSX = path.join(ROOT, "node_modules/.bin/tsx");
const WEB_BASE = "http://localhost:5173";
const API_PORT = 3001;
const API_BASE = `http://localhost:${API_PORT}`;
// Relative to apps/api's cwd (the convention every other script in apps/api/src/db uses).
const PGLITE_DIR = "../../data/budgeteer-demo";
const VIEWPORT = { width: 1920, height: 1080 };
const SKIP_VIDEO = process.argv.includes("--no-video");

const stamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
const OUT = path.resolve(ROOT, "data/demo-assets", stamp);
mkdirSync(path.join(OUT, "screenshots"), { recursive: true });
if (!SKIP_VIDEO) mkdirSync(path.join(OUT, "video"), { recursive: true });

function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. capture:demo needs to own the api-demo server for ` +
              "the duration of the run (so it can reset + reseed to a clean baseline first). " +
              `Stop whatever's listening on ${port} and retry.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    srv.once("listening", () => srv.close(() => resolve()));
    srv.listen(port, "127.0.0.1");
  });
}

function run(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX, args, { cwd: API_DIR, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`tsx ${args.join(" ")} exited with code ${code}`)),
    );
    child.on("error", reject);
  });
}

function startApiServer() {
  const child = spawn(TSX, ["src/index.ts"], {
    cwd: API_DIR,
    env: { ...process.env, PGLITE_DIR, PORT: String(API_PORT), HOST: "127.0.0.1", LOG_LEVEL: "warn" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d: Buffer) => (output += d.toString()));
  child.stderr.on("data", (d: Buffer) => (output += d.toString()));
  const crashed = new Promise<never>((_, reject) => {
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`api-demo server exited early (code ${code}):\n${output}`));
      }
    });
  });
  return { child, crashed };
}

async function waitForReady(url: string, crashed: Promise<never>, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await Promise.race([
      fetch(url).then((r) => r.ok).catch(() => false),
      new Promise<false>((r) => setTimeout(() => r(false), 200)),
    ]);
    if (ready) return;
    await Promise.race([new Promise((r) => setTimeout(r, 200)), crashed]);
  }
  throw new Error(`${url} did not become ready within ${timeoutMs}ms`);
}

const webReachable = await fetch(WEB_BASE)
  .then((r) => r.ok)
  .catch(() => false);
if (!webReachable) {
  throw new Error(`${WEB_BASE} is not reachable. Start the "web" dev server first (npm run dev --workspace apps/web).`);
}

await assertPortFree(API_PORT);

console.log("Resetting + reseeding the demo store...");
await run(["src/db/reset.ts"], { PGLITE_DIR });
await run(["src/db/seedDemo.ts"], { PGLITE_DIR });

console.log("Starting a throwaway api-demo server...");
const { child: apiServer, crashed } = startApiServer();

try {
  await waitForReady(`${API_BASE}/health`, crashed);

  const browser = await chromium.launch();

  // --- Static screens (2x device scale for crisp/retina output) ---
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  async function shot(route: string, file: string) {
    await page.goto(`${WEB_BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "screenshots", file), fullPage: true });
    console.log("saved", file);
  }

  await shot("/", "01-dashboard-overview.png");

  await page.getByRole("link", { name: "Pay periods" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "screenshots", "02-dashboard-pay-periods.png"),
    fullPage: true,
  });
  console.log("saved 02-dashboard-pay-periods.png");

  // Every Insights sub-view (apps/web/src/AnalysisSection.tsx CATEGORIES) — each is its own
  // route, no client-only navigation required.
  await shot("/insights/spend", "03-insights-spending-by-envelope.png");
  await shot("/insights/breakdown", "04-insights-spending-breakdown.png");
  await shot("/insights/trends", "05-insights-spending-trends.png");
  await shot("/insights/budget", "06-insights-budget-vs-actual.png");
  await shot("/insights/burndown", "07-insights-budget-burndown.png");
  await shot("/insights/forecast", "08-insights-cashflow-forecast.png");
  await shot("/insights/credit", "09-insights-debt-credit.png");
  await shot("/insights/payoff", "10-insights-debt-payoff.png");
  await shot("/insights/networth", "11-insights-networth.png");

  await shot("/accounts", "12-accounts.png");

  // Account register — a representative example (Everyday Checking), not every account. The
  // list route renders real <Link>s, so click through rather than guessing the seeded UUID.
  await page.getByRole("link", { name: "Everyday Checking", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "screenshots", "13-account-register.png"),
    fullPage: true,
  });
  console.log("saved 13-account-register.png");

  await shot("/envelopes", "14-envelopes.png");

  // Envelope ledger — a representative example (Groceries has activity from the split-allocation
  // demo transaction below), not every envelope.
  await page.getByRole("link", { name: "Groceries", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, "screenshots", "15-envelope-ledger.png"),
    fullPage: true,
  });
  console.log("saved 15-envelope-ledger.png");

  await shot("/needs-allocation", "16-needs-allocation.png");
  await shot("/templates", "17-templates.png");
  await shot("/recurring", "18-recurring.png");
  await shot("/manage", "19-manage.png");

  // Hero shot: split-allocation form filled out, remaining = $0.00
  // The form is a client-routed modal — it must be opened via in-app navigation,
  // not a fresh page load, or the dialog never mounts.
  await page.goto(`${WEB_BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Add transaction" }).click();
  await page.getByRole("combobox", { name: "Account" }).selectOption({ label: "Everyday Checking" });
  await page.getByRole("textbox", { name: "Transaction amount" }).fill("126.40");
  await page.getByRole("textbox", { name: "Payee" }).fill("Trader Joe's");
  await page.getByRole("radio", { name: "Split" }).click();
  await page.getByRole("combobox", { name: "Envelope for row 1" }).selectOption({ label: "Groceries" });
  await page.getByRole("textbox", { name: "Amount for row 1" }).fill("80");
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("combobox", { name: "Envelope for row 2" }).selectOption({ label: "Household Supplies" });
  await page.getByRole("button", { name: "use remaining" }).nth(1).click();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT, "screenshots", "20-split-allocation.png"),
    fullPage: true,
  });
  console.log("saved 20-split-allocation.png");

  await context.close();

  // --- Golden-path video (1x scale — 2x would roughly 4x the file size) ---
  if (SKIP_VIDEO) {
    console.log("skipped video (--no-video)");
  } else {
    const videoContext = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: path.join(OUT, "video"), size: VIEWPORT },
    });
    const vp = await videoContext.newPage();
    await vp.goto(`${WEB_BASE}/`, { waitUntil: "networkidle" });
    await vp.waitForTimeout(800);
    await vp.getByRole("link", { name: "Add transaction" }).click();
    await vp.waitForTimeout(500);
    await vp.getByRole("combobox", { name: "Account" }).selectOption({ label: "Everyday Checking" });
    await vp.waitForTimeout(300);
    await vp.getByRole("textbox", { name: "Transaction amount" }).fill("126.40");
    await vp.waitForTimeout(300);
    await vp.getByRole("textbox", { name: "Payee" }).fill("Trader Joe's");
    await vp.waitForTimeout(300);
    await vp.getByRole("radio", { name: "Split" }).click();
    await vp.waitForTimeout(400);
    await vp.getByRole("combobox", { name: "Envelope for row 1" }).selectOption({ label: "Groceries" });
    await vp.getByRole("textbox", { name: "Amount for row 1" }).fill("80");
    await vp.waitForTimeout(400);
    await vp.getByRole("button", { name: "Add row" }).click();
    await vp.waitForTimeout(300);
    await vp.getByRole("combobox", { name: "Envelope for row 2" }).selectOption({ label: "Household Supplies" });
    await vp.getByRole("button", { name: "use remaining" }).nth(1).click();
    await vp.waitForTimeout(1200);
    await vp.getByRole("button", { name: "Save transaction" }).click();
    await vp.waitForTimeout(1500);
    await videoContext.close();
  }

  await browser.close();
  console.log(`\nSaved to ${OUT}`);
} finally {
  apiServer.kill("SIGTERM");
}
