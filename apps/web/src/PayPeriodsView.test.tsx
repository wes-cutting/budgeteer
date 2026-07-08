import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PayPeriodsView } from "./PayPeriodsView";
import { type Api, ApiError } from "./api";
import { localToday } from "./dates";
import { makeFakeApi } from "./test/fakeApi";

// Anchor rules relative to the user's LOCAL today (EH8), as in ForecastView.test.tsx.
const TODAY = localToday();
const plus = (n: number): string => {
  const [y, m, d] = TODAY.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + n);
  const pad = (x: number): string => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const view = (api: Api) =>
  render(
    <MemoryRouter>
      <PayPeriodsView api={api} />
    </MemoryRouter>,
  );

/** $1,000 checking; paycheck +$2,000 at +10 days (monthly); rent −$1,500 at +25 days. */
async function seeded(): Promise<Api> {
  const api = makeFakeApi();
  const acct = await api.createAccount({
    name: "Checking",
    kind: "checking",
    startingBalance: "1000.00",
  });
  const rent = await api.createEnvelope({ name: "Rent", kind: "standard" });
  const salary = await api.createEnvelope({ name: "Salary", kind: "standard" });
  await api.createRecurring({
    accountId: acct.id,
    kind: "deposit",
    amount: "2000.00",
    payee: "Paycheck",
    frequency: "monthly",
    anchorOn: plus(10),
    lines: [{ envelopeId: salary.id, amount: "2000.00" }],
  });
  await api.createRecurring({
    accountId: acct.id,
    kind: "withdrawal",
    amount: "1500.00",
    payee: "Rent",
    frequency: "monthly",
    anchorOn: plus(25),
    lines: [{ envelopeId: rent.id, amount: "1500.00" }],
  });
  return api;
}

describe("PayPeriodsView (FEAT-S7)", () => {
  test("each expected paycheck is a section covering its bills, with figures and a Covered badge", async () => {
    view(await seeded());
    // The +10 check (cutoff: rent at +25 − 7 = +18) covers the rent with 15 days of float.
    const heading = `Paycheck · ${plus(10)} · +$2,000.00`;
    const section = within(await screen.findByRole("region", { name: heading }));
    expect(section.getByRole("heading", { level: 3, name: heading })).toBeTruthy();
    expect(section.getByText(`Covers 1 bill due ${plus(25)}.`)).toBeTruthy();
    const row = section.getByRole("rowheader", { name: "Rent" }).closest("tr") as HTMLElement;
    expect(within(row).getByText(plus(25))).toBeTruthy();
    expect(within(row).getByText("$1,500.00")).toBeTruthy();
    // Figures: bucket total and commitment-time headroom (1000 + 2000 − 1500 = 1500), Covered.
    expect(section.getByText("Bucket total")).toBeTruthy();
    expect(section.getAllByText("$1,500.00").length).toBeGreaterThanOrEqual(2);
    expect(section.getByText("Covered")).toBeTruthy();
  });

  test("a bill due before any feasible check comes 'From current balance', breaking the plan when short", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "100.00",
    });
    const env = await api.createEnvelope({ name: "Utilities", kind: "standard" });
    const salary = await api.createEnvelope({ name: "Salary", kind: "standard" });
    // Power (−$150 at +3) is due sooner than leadDays after the first check (+10).
    await api.createRecurring({
      accountId: acct.id,
      kind: "deposit",
      amount: "2000.00",
      payee: "Paycheck",
      frequency: "monthly",
      anchorOn: plus(10),
      lines: [{ envelopeId: salary.id, amount: "2000.00" }],
    });
    await api.createRecurring({
      accountId: acct.id,
      kind: "withdrawal",
      amount: "150.00",
      payee: "Power",
      frequency: "monthly",
      anchorOn: plus(3),
      lines: [{ envelopeId: env.id, amount: "150.00" }],
    });
    view(api);
    const zero = within(await screen.findByRole("region", { name: "From current balance" }));
    expect(zero.getByRole("rowheader", { name: "Power" })).toBeTruthy();
    // 100 − 150 = −$50 headroom: the first negative bucket names the break.
    expect(zero.getByText("-$50.00")).toBeTruthy();
    expect(zero.getByText("Plan breaks here")).toBeTruthy();
    // Later buckets that stay negative-free read Covered (income recovers the plan).
    const check = within(
      screen.getByRole("region", { name: `Paycheck · ${plus(10)} · +$2,000.00` }),
    );
    expect(check.getByText("Covered")).toBeTruthy();
  });

  test("no recurring deposit rule → the No-expected-paychecks empty state linking to /recurring", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "500.00" });
    view(api);
    expect(await screen.findByText("No expected paychecks")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recurring" })).toBeTruthy();
  });

  test("a check with nothing assigned renders 'No bills assigned.' and stays meaningful", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    });
    const salary = await api.createEnvelope({ name: "Salary", kind: "standard" });
    await api.createRecurring({
      accountId: acct.id,
      kind: "deposit",
      amount: "2000.00",
      payee: "Paycheck",
      frequency: "monthly",
      anchorOn: plus(10),
      lines: [{ envelopeId: salary.id, amount: "2000.00" }],
    });
    view(api);
    const section = within(
      await screen.findByRole("region", { name: `Paycheck · ${plus(10)} · +$2,000.00` }),
    );
    expect(section.getByText("No bills assigned.")).toBeTruthy();
  });

  test("a load failure shows the inline alert with the view chrome intact", async () => {
    const api = makeFakeApi({
      getPayPeriodPlan: async () => {
        throw new ApiError("Couldn't load the plan.");
      },
    });
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "0" });
    view(api);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Insights — pay periods" })).toBeTruthy();
  });
});
