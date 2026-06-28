import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Remove the throwaway PGlite store(s) that playwright.config.ts created for the e2e run. We sweep
// every dir matching the prefix rather than a single path so a store left behind by an interrupted
// run (where this teardown never ran) is reaped on the next run. This is safe because the stack
// binds fixed ports (3001/5173), so only one e2e run can exist at a time — there is never a live
// store from a concurrent run to delete out from under it.
export default function globalTeardown(): void {
  const tmp = os.tmpdir();
  for (const entry of fs.readdirSync(tmp)) {
    if (entry.startsWith("budgeteer-e2e-pglite-")) {
      fs.rmSync(path.join(tmp, entry), { recursive: true, force: true });
    }
  }
}
