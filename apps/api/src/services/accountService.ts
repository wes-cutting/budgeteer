import type { Kysely } from "kysely";
import { type AccountKind, nameExists } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../constants";
import { todayStr, toISO } from "../util/dates";
import { asDuplicateName } from "./dbErrors";
import { DuplicateNameError, NotFoundError } from "./errors";

export interface AccountView {
  id: string;
  name: string;
  kind: AccountKind;
  balanceCents: number;
  archivedAt: string | null;
}

export function makeAccountService(db: Kysely<DB>) {
  const selectView = (qb: Kysely<DB>) =>
    qb
      .selectFrom("accounts as a")
      .leftJoin("v_account_balances as b", "b.account_id", "a.id")
      .select(["a.id", "a.name", "a.kind", "a.archived_at", "b.balance_cents"]);

  const toView = (r: {
    id: string;
    name: string;
    kind: string;
    archived_at: Date | null;
    balance_cents: string | null;
  }): AccountView => ({
    id: r.id,
    name: r.name,
    kind: r.kind as AccountKind,
    balanceCents: Number(r.balance_cents ?? 0),
    archivedAt: toISO(r.archived_at),
  });

  return {
    async list(): Promise<AccountView[]> {
      const rows = await selectView(db)
        .where("a.household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .orderBy("a.created_at")
        .execute();
      return rows.map(toView);
    },

    /** Create an account + its opening transaction atomically (the opening balance, unallocated). */
    async create(input: {
      name: string;
      kind: AccountKind;
      startingBalanceCents: number;
    }): Promise<AccountView> {
      const id = await asDuplicateName("An account with that name already exists.", () =>
        db.transaction().execute(async (trx) => {
          const names = await trx
            .selectFrom("accounts")
            .select("name")
            .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
            .execute();
          if (
            nameExists(
              names.map((n) => n.name),
              input.name,
            )
          ) {
            throw new DuplicateNameError("An account with that name already exists.");
          }
          const account = await trx
            .insertInto("accounts")
            .values({
              household_id: DEFAULT_HOUSEHOLD_ID,
              name: input.name,
              kind: input.kind,
              archived_at: null,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
          await trx
            .insertInto("transactions")
            .values({
              household_id: DEFAULT_HOUSEHOLD_ID,
              account_id: account.id,
              amount_cents: input.startingBalanceCents,
              kind: "opening",
              occurred_on: todayStr(),
              payee: null,
              memo: "Opening balance",
            })
            .execute();
          return account.id;
        }),
      );
      const row = await selectView(db).where("a.id", "=", id).executeTakeFirstOrThrow();
      return toView(row);
    },

    async rename(id: string, name: string): Promise<AccountView> {
      return asDuplicateName("An account with that name already exists.", () =>
        db.transaction().execute(async (trx) => {
          const current = await trx
            .selectFrom("accounts")
            .select("id")
            .where("id", "=", id)
            .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
            .executeTakeFirst();
          if (!current) throw new NotFoundError("account");
          const others = await trx
            .selectFrom("accounts")
            .select("name")
            .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
            .where("id", "<>", id)
            .execute();
          if (
            nameExists(
              others.map((n) => n.name),
              name,
            )
          ) {
            throw new DuplicateNameError("An account with that name already exists.");
          }
          await trx.updateTable("accounts").set({ name }).where("id", "=", id).execute();
          const row = await selectView(trx).where("a.id", "=", id).executeTakeFirstOrThrow();
          return toView(row);
        }),
      );
    },

    async setArchived(id: string, archived: boolean): Promise<AccountView> {
      const current = await db
        .selectFrom("accounts")
        .select("id")
        .where("id", "=", id)
        .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .executeTakeFirst();
      if (!current) throw new NotFoundError("account");
      await db
        .updateTable("accounts")
        .set({ archived_at: archived ? new Date() : null })
        .where("id", "=", id)
        .where("household_id", "=", DEFAULT_HOUSEHOLD_ID)
        .execute();
      const row = await selectView(db).where("a.id", "=", id).executeTakeFirstOrThrow();
      return toView(row);
    },
  };
}
