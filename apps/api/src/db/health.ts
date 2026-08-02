import { type Kysely, sql } from "kysely";
import type { DB } from "./schema";

/** How long a readiness probe waits for the database before calling it unreachable. */
const PING_TIMEOUT_MS = 2000;

/**
 * Probe that the datastore is actually reachable (BUD-S82 · SPIKE-12 finding #2).
 *
 * THROWS on failure — the caller decides what an unreachable database means. `/health` turns it
 * into a 503 and logs the cause; nothing swallows it silently.
 *
 * The timeout is the point of the exercise. A Postgres container that is up but wedged accepts the
 * TCP connection and never answers, so an un-bounded `select 1` would hang the probe until the
 * orchestrator's own timeout fired — the health endpoint would stop responding rather than report
 * unhealthy, which is the failure mode a readiness check exists to catch.
 */
export async function pingDb(db: Kysely<DB>, timeoutMs: number = PING_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sql`select 1`.execute(db),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Database did not respond within ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    // The losing promise keeps the event loop alive until its timer fires, which would hold the
    // process open for the full timeout on every probe.
    if (timer !== undefined) clearTimeout(timer);
  }
}
