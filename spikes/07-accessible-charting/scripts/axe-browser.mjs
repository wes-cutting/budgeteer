/*
 * Real-Chromium axe scan of the built chart, in LIGHT and DARK, with the data table both shown
 * and hidden. Reuses the repo-root Playwright + @axe-core/playwright (no install in the spike).
 * Serve the build first:  npm run preview   (port 4317), then:  npm run axe
 *
 * WCAG 2.2 AA tag set, same filter as the app's e2e/a11y.spec.ts (serious/critical only).
 */
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const URL = process.env.SPIKE_URL ?? "http://localhost:4317/";

async function scan(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  const mark = blocking.length === 0 ? "PASS" : "FAIL";
  console.log(`## ${label.padEnd(34)} violations: ${blocking.length}  [${mark}]`);
  for (const v of blocking) {
    console.log(`   [${v.impact}] ${v.id}: ${v.description}`);
    for (const n of v.nodes) console.log(`      ${n.html}`);
  }
  return blocking.length;
}

let total = 0;
for (const scheme of /** @type {const} */ (["light", "dark"])) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: scheme });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  // table shown (default)
  await page.getByRole("img").waitFor();
  total += await scan(page, `${scheme} · table shown`);

  // table hidden (disclosure collapsed) — scan the chart-only state too
  await page.getByRole("button", { name: /data table/i }).click();
  total += await scan(page, `${scheme} · table hidden`);

  await browser.close();
}

console.log(`\n=== TOTAL blocking violations across all targets: ${total} ===`);
process.exit(total === 0 ? 0 : 1);
