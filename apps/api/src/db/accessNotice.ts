import type { Kysely } from "kysely";
import type { DB } from "./schema";

/**
 * Tell the operator how to get into a store that has no accounts yet (BUD-S90).
 *
 * Seeding populates the ledger and deliberately never creates a user: a credential in a seed
 * script is a credential in the repo, and these scripts are run against real stores. Without this
 * notice a `db:fresh` looked like it had succeeded and then answered 401 to everything, with the
 * SPA bouncing to `/login` and no hint as to why.
 */
export async function printAccessNotice(db: Kysely<DB>): Promise<void> {
  const existing = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
  if (existing !== undefined) return;
  console.log(
    "\nNo user accounts in this store — seeding fills the ledger, never credentials.\n" +
      "Two ways in:\n" +
      "  • ADMIN_USERNAME=<u> ADMIN_PASSWORD=<p> npm run create-admin --workspace @budgeteer/api\n" +
      "  • start the app and complete first-run onboarding in the browser (POST /api/auth/setup)\n",
  );
}
