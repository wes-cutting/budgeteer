import type { Kysely } from "kysely";
import { nameExists } from "@budgeteer/domain";
import type { DB } from "../db/schema";
import { DEFAULT_HOUSEHOLD_ID } from "../db/migrate";
import { DuplicateNameError, NotFoundError } from "./errors";
import { assertEnvelopesUsable } from "./envelopeGuards";

const HH = DEFAULT_HOUSEHOLD_ID;

export interface TemplateLineView {
  id: string;
  envelopeId: string;
  envelopeName: string;
  amountCents: number;
}
export interface TemplateView {
  id: string;
  name: string;
  lines: TemplateLineView[];
}
/** A template line holds a positive magnitude (fixed dollar amount). */
export interface TemplateLineInput {
  envelopeId: string;
  amountCents: number;
}

interface TemplateRow {
  id: string;
  name: string;
}

export function makeTemplateService(db: Kysely<DB>) {
  async function attachLines(exec: Kysely<DB>, templates: TemplateRow[]): Promise<TemplateView[]> {
    const ids = templates.map((t) => t.id);
    const lineRows = ids.length
      ? await exec
          .selectFrom("template_lines as tl")
          .innerJoin("envelopes as e", "e.id", "tl.envelope_id")
          .select([
            "tl.id",
            "tl.template_id",
            "tl.envelope_id",
            "e.name as envelope_name",
            "tl.amount_cents",
          ])
          .where("tl.template_id", "in", ids)
          .orderBy("tl.position")
          .execute()
      : [];
    const byTemplate = new Map<string, TemplateLineView[]>();
    for (const l of lineRows) {
      const list = byTemplate.get(l.template_id) ?? [];
      list.push({
        id: l.id,
        envelopeId: l.envelope_id,
        envelopeName: l.envelope_name,
        amountCents: Number(l.amount_cents),
      });
      byTemplate.set(l.template_id, list);
    }
    return templates.map((t) => ({ id: t.id, name: t.name, lines: byTemplate.get(t.id) ?? [] }));
  }

  async function getView(exec: Kysely<DB>, id: string): Promise<TemplateView> {
    const row = await exec
      .selectFrom("templates")
      .select(["id", "name"])
      .where("id", "=", id)
      .where("household_id", "=", HH)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("template");
    const [view] = await attachLines(exec, [row]);
    if (!view) throw new NotFoundError("template");
    return view;
  }

  async function insertLines(
    trx: Kysely<DB>,
    templateId: string,
    lines: TemplateLineInput[],
  ): Promise<void> {
    if (lines.length === 0) return;
    await trx
      .insertInto("template_lines")
      .values(
        lines.map((l, i) => ({
          template_id: templateId,
          envelope_id: l.envelopeId,
          amount_cents: l.amountCents,
          position: i,
        })),
      )
      .execute();
  }

  return {
    async list(): Promise<TemplateView[]> {
      const rows = await db
        .selectFrom("templates")
        .select(["id", "name"])
        .where("household_id", "=", HH)
        .orderBy("name")
        .execute();
      return attachLines(db, rows);
    },

    async create(input: { name: string; lines: TemplateLineInput[] }): Promise<TemplateView> {
      const id = await db.transaction().execute(async (trx) => {
        const names = await trx
          .selectFrom("templates")
          .select("name")
          .where("household_id", "=", HH)
          .execute();
        if (
          nameExists(
            names.map((n) => n.name),
            input.name,
          )
        ) {
          throw new DuplicateNameError("A template with that name already exists.");
        }
        await assertEnvelopesUsable(
          trx,
          HH,
          input.lines.map((l) => l.envelopeId),
        );
        const tpl = await trx
          .insertInto("templates")
          .values({ household_id: HH, name: input.name })
          .returning("id")
          .executeTakeFirstOrThrow();
        await insertLines(trx, tpl.id, input.lines);
        return tpl.id;
      });
      return getView(db, id);
    },

    async update(
      id: string,
      input: { name: string; lines: TemplateLineInput[] },
    ): Promise<TemplateView> {
      return db.transaction().execute(async (trx) => {
        const current = await trx
          .selectFrom("templates")
          .select("id")
          .where("id", "=", id)
          .where("household_id", "=", HH)
          .executeTakeFirst();
        if (!current) throw new NotFoundError("template");
        const others = await trx
          .selectFrom("templates")
          .select("name")
          .where("household_id", "=", HH)
          .where("id", "<>", id)
          .execute();
        if (
          nameExists(
            others.map((n) => n.name),
            input.name,
          )
        ) {
          throw new DuplicateNameError("A template with that name already exists.");
        }
        await assertEnvelopesUsable(
          trx,
          HH,
          input.lines.map((l) => l.envelopeId),
        );
        await trx.updateTable("templates").set({ name: input.name }).where("id", "=", id).execute();
        await trx.deleteFrom("template_lines").where("template_id", "=", id).execute();
        await insertLines(trx, id, input.lines);
        return getView(trx, id);
      });
    },

    async remove(id: string): Promise<void> {
      const existing = await db
        .selectFrom("templates")
        .select("id")
        .where("id", "=", id)
        .where("household_id", "=", HH)
        .executeTakeFirst();
      if (!existing) throw new NotFoundError("template");
      await db
        .deleteFrom("templates")
        .where("id", "=", id)
        .where("household_id", "=", HH)
        .execute();
    },
  };
}
