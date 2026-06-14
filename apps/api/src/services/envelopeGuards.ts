import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import { ValidationError } from "./errors";

/**
 * Reject any envelope id that doesn't exist in the household or is archived. Shared by the
 * transaction and template services so the "usable envelope" rule lives in one place.
 */
export async function assertEnvelopesUsable(
  exec: Kysely<DB>,
  householdId: string,
  envelopeIds: string[],
): Promise<void> {
  const unique = [...new Set(envelopeIds)];
  if (unique.length === 0) return;
  const rows = await exec
    .selectFrom("envelopes")
    .select(["id", "archived_at"])
    .where("household_id", "=", householdId)
    .where("id", "in", unique)
    .execute();
  const usable = new Set(rows.filter((r) => r.archived_at === null).map((r) => r.id));
  for (const id of unique) {
    if (!usable.has(id)) throw new ValidationError("Unknown or archived envelope.");
  }
}
