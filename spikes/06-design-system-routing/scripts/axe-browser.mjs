// Real-browser axe scan of the lead screen + both dialog implementations.
// Run from the REPO ROOT so `@playwright/test` resolves from the root node_modules:
//   BASE=http://localhost:5199 node spikes/06-design-system-routing/scripts/axe-browser.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const AXE = path.resolve(here, "../node_modules/axe-core/axe.min.js");
const BASE = process.env.BASE ?? "http://localhost:5199";

// WCAG 2.2 AA tag set — the project's a11y standard.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const targets = [
  ["Account Register (lead screen)", "/accounts/chk", "table"],
  ["React Aria dialog", "/aria-demo", '[role="dialog"]'],
  ["Radix dialog", "/radix-demo", '[role="dialog"]'],
];

const browser = await chromium.launch();
let totalViolations = 0;
for (const [name, route, waitFor] of targets) {
  const page = await browser.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async (tags) => {
    // eslint-disable-next-line no-undef
    return await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
  }, TAGS);
  const v = res.violations;
  totalViolations += v.length;
  console.log(`\n## ${name}  (${route})`);
  console.log(`   violations: ${v.length}`);
  for (const x of v) {
    console.log(`   - [${x.impact}] ${x.id}: ${x.help} (${x.nodes.length} node[s])`);
  }
  await page.close();
}
await browser.close();
console.log(`\n=== TOTAL violations across all targets: ${totalViolations} ===`);
process.exit(totalViolations === 0 ? 0 : 1);
