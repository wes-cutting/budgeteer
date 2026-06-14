import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type TestApp, closeTestApp, createTestApp } from "./helpers";

let ctx: TestApp;
beforeEach(async () => {
  ctx = await createTestApp();
});
afterEach(async () => {
  await closeTestApp(ctx);
});

const post = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "POST", url, payload: body });
const put = (url: string, body: Record<string, unknown>) =>
  ctx.app.inject({ method: "PUT", url, payload: body });
const del = (url: string) => ctx.app.inject({ method: "DELETE", url });
const get = (url: string) => ctx.app.inject({ method: "GET", url });

async function makeEnvelope(name: string): Promise<string> {
  return (await post("/envelopes", { name })).json().envelope.id as string;
}

describe("templates API (FEAT-004)", () => {
  test("create a template with fixed lines, then list it", async () => {
    const rent = await makeEnvelope("Rent");
    const savings = await makeEnvelope("Savings");
    const res = await post("/templates", {
      name: "Paycheck",
      lines: [
        { envelopeId: rent, amount: "1400.00" },
        { envelopeId: savings, amount: "800.00" },
      ],
    });
    expect(res.statusCode).toBe(201);
    const tpl = res.json().template;
    expect(tpl.name).toBe("Paycheck");
    expect(tpl.lines).toHaveLength(2);
    expect(tpl.lines[0].amountCents).toBe(140000);
    expect(tpl.lines[0].envelopeName).toBe("Rent");

    expect((await get("/templates")).json().templates).toHaveLength(1);
  });

  test("duplicate name → 409; zero lines → 400; bad envelope → 400; amount ≤ 0 → 400", async () => {
    const rent = await makeEnvelope("Rent");
    await post("/templates", {
      name: "Paycheck",
      lines: [{ envelopeId: rent, amount: "1400.00" }],
    });
    expect(
      (
        await post("/templates", {
          name: "paycheck",
          lines: [{ envelopeId: rent, amount: "1.00" }],
        })
      ).statusCode,
    ).toBe(409);
    expect((await post("/templates", { name: "Empty", lines: [] })).statusCode).toBe(400);
    expect(
      (
        await post("/templates", {
          name: "Bad",
          lines: [{ envelopeId: "00000000-0000-0000-0000-0000000000aa", amount: "1.00" }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await post("/templates", { name: "Zero", lines: [{ envelopeId: rent, amount: "0" }] }))
        .statusCode,
    ).toBe(400);
  });

  test("update replaces name + lines; delete removes; missing → 404", async () => {
    const rent = await makeEnvelope("Rent");
    const gas = await makeEnvelope("Gas");
    const tpl = (
      await post("/templates", { name: "P", lines: [{ envelopeId: rent, amount: "1400.00" }] })
    ).json().template;

    const upd = await put(`/templates/${tpl.id}`, {
      name: "P2",
      lines: [{ envelopeId: gas, amount: "50.00" }],
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().template.name).toBe("P2");
    expect(upd.json().template.lines).toHaveLength(1);
    expect(upd.json().template.lines[0].envelopeName).toBe("Gas");

    expect((await del(`/templates/${tpl.id}`)).statusCode).toBe(204);
    expect((await get("/templates")).json().templates).toHaveLength(0);

    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect(
      (
        await put(`/templates/${ghost}`, {
          name: "X",
          lines: [{ envelopeId: rent, amount: "1.00" }],
        })
      ).statusCode,
    ).toBe(404);
    expect((await del(`/templates/${ghost}`)).statusCode).toBe(404);
  });

  test("delete tolerates an application/json content-type with an empty body", async () => {
    const rent = await makeEnvelope("Rent");
    const tpl = (
      await post("/templates", { name: "P", lines: [{ envelopeId: rent, amount: "1.00" }] })
    ).json().template;
    const res = await ctx.app.inject({
      method: "DELETE",
      url: `/templates/${tpl.id}`,
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(204);
  });
});
