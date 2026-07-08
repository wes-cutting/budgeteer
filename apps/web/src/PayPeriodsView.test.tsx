import { describe, expect, test } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
// Mirror the view's deterministic short-date format ("2026-07-24" → "Jul 24").
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-");
  return `${SHORT_MONTHS[Number(m) - 1]} ${Number(d)}`;
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

const billsPane = () => within(screen.getByRole("region", { name: "Bills" }));
const paychecksPane = () => within(screen.getByRole("region", { name: "Paychecks" }));
/** Resolve once the plan has loaded and the ledgers have rendered. */
const loaded = () => screen.findByRole("region", { name: "Paychecks" });

describe("PayPeriodsView (FEAT-UXR2 — the two-ledger planner)", () => {
  test("renders the two ledgers with the join readable before any interaction", async () => {
    view(await seeded());
    await loaded();
    // The +10 check (cutoff: rent +25 − 7 = +18) covers the +25 rent — the "Covered by" text names
    // it with zero interaction (the permanent structural join). (Monthly rent recurs, so pick the
    // first occurrence's row: the one whose Covered-by names the +10 check.)
    const rentRow = billsPane()
      .getAllByRole("rowheader", { name: "Rent" })
      .map((th) => th.closest("tr") as HTMLElement)
      .find((tr) => within(tr).queryByText(`${shortDate(plus(10))} check`) !== null) as HTMLElement;
    expect(rentRow).toBeTruthy();
    // Amount and (single-bill month) left-to-pay both read $1,500.00.
    expect(within(rentRow).getAllByText("$1,500.00").length).toBeGreaterThanOrEqual(1);

    // The +10 paycheck row: income · committed · per-check headroom (2000 − 1500 = +500) · projected
    // balance (1000 + 2000 = 3000 on payday) · reserve (1000 + 500 = 1500) · Covered.
    const payBtn = paychecksPane().getByRole("button", {
      name: `Highlight bills covered by ${shortDate(plus(10))} check`,
    });
    const payRow = payBtn.closest("tr") as HTMLElement;
    expect(within(payRow).getByText("+$2,000.00")).toBeTruthy();
    expect(within(payRow).getByText("+$500.00")).toBeTruthy();
    expect(within(payRow).getByText("$3,000.00")).toBeTruthy();
    // Committed and Reserve both read $1,500.00 here.
    expect(within(payRow).getAllByText("$1,500.00").length).toBe(2);
    expect(within(payRow).getByText("Covered")).toBeTruthy();
  });

  test("shows both left-to-pay scopes: the 90-day pane figure and a month subtotal row", async () => {
    view(await seeded());
    await loaded();
    expect(billsPane().getByText(/Left to pay, next 90 days:/)).toBeTruthy();
    expect(billsPane().getAllByText(/remaining$/).length).toBeGreaterThanOrEqual(1);
  });

  test("selecting a payday toggles aria-pressed and announces its covered bills", async () => {
    view(await seeded());
    await loaded();
    const payBtn = paychecksPane().getByRole("button", {
      name: `Highlight bills covered by ${shortDate(plus(10))} check`,
    });
    expect(payBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(payBtn);
    expect(payBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toMatch(/covers 1 bill/);
    // Toggling off clears the announcement.
    fireEvent.click(payBtn);
    expect(payBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("a bill before any feasible check reads 'Current balance' and breaks the plan", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "100.00",
    });
    const env = await api.createEnvelope({ name: "Utilities", kind: "standard" });
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
    // Power (−$150 at +3) is due sooner than leadDays after the first check (+10) → balance bucket.
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
    await loaded();
    // Some bill is covered by the current balance (the join text, no interaction).
    expect(billsPane().getAllByText("Current balance").length).toBeGreaterThanOrEqual(1);
    // The balance row in the paycheck ledger: reserve 100 − 150 = −$50 → Plan breaks here.
    const balanceBtn = paychecksPane().getByRole("button", {
      name: "Highlight bills covered by Current balance",
    });
    const balanceRow = balanceBtn.closest("tr") as HTMLElement;
    expect(within(balanceRow).getByText("-$50.00")).toBeTruthy(); // reserve
    expect(within(balanceRow).getByText("$100.00")).toBeTruthy(); // projected balance = start
    expect(within(balanceRow).getByText("Plan breaks here")).toBeTruthy();
  });

  test("no recurring deposit rule → the No-expected-paychecks empty state linking to /recurring", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "500.00" });
    view(api);
    expect(await screen.findByText("No expected paychecks")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recurring" })).toBeTruthy();
  });

  test("a load failure shows the inline alert with the page heading intact", async () => {
    const api = makeFakeApi({
      getPayPeriodPlan: async () => {
        throw new ApiError("Couldn't load the plan.");
      },
    });
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "0" });
    view(api);
    expect(await screen.findByRole("alert")).toBeTruthy();
    // FEAT-UXR1/UXR2 — the shell owns the page <h1> and this view drops its own title, so "chrome
    // intact" is the account control still rendering alongside the inline alert.
    expect(screen.getByRole("combobox", { name: "Account" })).toBeTruthy();
  });
});
