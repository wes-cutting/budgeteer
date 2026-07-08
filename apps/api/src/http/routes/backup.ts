import { todayStr } from "../../util/dates";
import { type RoutePlugin } from "./shared";

// --- Backup / export (FEAT-015a) ---
export const backupRoutes: RoutePlugin = async (app, opts) => {
  const { backup } = opts.services;

  // Returns a household JSON snapshot for download. Content-Disposition: attachment causes the
  // browser to save the file rather than display it. Body is never logged (financial data).
  app.get("/export", async (_req, reply) => {
    const snapshot = await backup.snapshot();
    const filename = `budgeteer-backup-${todayStr(opts.clock)}.json`;
    return reply
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .type("application/json")
      .send(JSON.stringify(snapshot, null, 2));
  });
};
