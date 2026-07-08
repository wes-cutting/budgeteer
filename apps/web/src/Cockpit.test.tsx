import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Cockpit } from "./Cockpit";
import { type Api } from "./api";
import { makeFakeApi } from "./test/fakeApi";
import styles from "./Cockpit.module.css";

function renderCockpit(api: Api = makeFakeApi()) {
  return render(
    <MemoryRouter>
      <Cockpit api={api} />
    </MemoryRouter>,
  );
}

/** Resolve a panel by its h3 heading, then scope queries to that panel's Card section. */
async function panel(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: title, level: 3 });
  const section = heading.closest("section");
  if (!section) throw new Error(`No section for panel "${title}"`);
  return section as HTMLElement;
}

/** Parse a formatted money string ("$1,200.00" / "-$300.00") back to integer cents. */
function cents(text: string): number {
  const negative = text.trim().startsWith("-");
  const digits = text.replace(/[^0-9.]/g, "");
  return Math.round(Number(digits) * 100) * (negative ? -1 : 1);
}

/** The panel's figure values, in render order (each `<dd>` has role "definition"). */
function figureCents(p: HTMLElement): number[] {
  return within(p)
    .getAllByRole("definition")
    .map((dd) => cents(dd.textContent ?? ""));
}

describe("Cockpit (UX5 — budget + future-planning home)", () => {
  test("renders the Overview region with all five panels", async () => {
    renderCockpit();
    expect(screen.getByRole("region", { name: "Overview" })).toBeTruthy();
    for (const title of [
      "This month's budget",
      "Needs allocation",
      "Upcoming",
      "Cash-flow forecast",
      "Net worth",
    ]) {
      expect(await screen.findByRole("heading", { name: title, level: 3 })).toBeTruthy();
    }
  });

  test("budget panel figures reconcile to the ledger (target − spent = remaining)", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    const env = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(env.id, "200.00");
    await api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount: "40.00",
      payee: "Store",
      allocations: [{ envelopeId: env.id, amount: "40.00" }],
    });
    // An UNTARGETED envelope with spend — its spend must NOT inflate the budget panel's "Spent",
    // or the three figures stop reconciling (the bug the cockpit visual check caught).
    const untargeted = await api.createEnvelope({ name: "Fun", kind: "standard" });
    await api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount: "100.00",
      payee: "Movies",
      allocations: [{ envelopeId: untargeted.id, amount: "100.00" }],
    });

    renderCockpit(api);
    const p = await panel("This month's budget");
    await within(p).findByText("$200.00");

    const figures = figureCents(p); // Budgeted · Spent · Remaining
    expect(figures).toHaveLength(3);
    const [budgeted, spent, remaining] = [figures[0]!, figures[1]!, figures[2]!];
    expect(budgeted).toBe(20000);
    expect(spent).toBe(4000); // only the targeted envelope's spend (untargeted $100 excluded)
    expect(remaining).toBe(16000);
    expect(remaining).toBe(budgeted - spent); // reconciles
    expect(within(p).getByText("On track")).toBeTruthy();
    expect(within(p).getByRole("link", { name: "Review budget" }).getAttribute("href")).toBe(
      "/insights/budget",
    );
  });

  test("budget panel flags over-budget envelopes", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    const env = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.setEnvelopeTarget(env.id, "200.00");
    await api.createTransaction(acct.id, {
      kind: "withdrawal",
      amount: "250.00",
      payee: "Store",
      allocations: [{ envelopeId: env.id, amount: "250.00" }],
    });

    renderCockpit(api);
    const p = await panel("This month's budget");
    expect(await within(p).findByText("1 envelope over budget")).toBeTruthy();
    // UX13: a decorative spent-of-target summary bar, and the negative remaining is weighted
    // (the "-$50.00" text keeps its minus sign — colour is never the sole signal).
    expect(p.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(within(p).getByText("-$50.00").className).toContain(styles.negative);
  });

  test("budget panel shows an empty state when no targets are set", async () => {
    const api = makeFakeApi();
    await api.createEnvelope({ name: "Groceries", kind: "standard" });

    renderCockpit(api);
    const p = await panel("This month's budget");
    expect(await within(p).findByText(/No monthly targets yet/)).toBeTruthy();
    expect(within(p).queryByRole("link", { name: "Review budget" })).toBeNull();
  });

  test("net worth panel reconciles: net = assets + liabilities (kind-based, R4/R9 convention)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "1000.00" });
    await api.createAccount({ name: "Card", kind: "credit", startingBalance: "-300.00" });

    renderCockpit(api);
    const p = await panel("Net worth");
    await within(p).findByText("$1,000.00");

    const figures = figureCents(p); // Assets · Liabilities · Net worth
    expect(figures).toHaveLength(3);
    const [assets, liabilities, net] = [figures[0]!, figures[1]!, figures[2]!];
    expect(assets).toBe(100000);
    expect(liabilities).toBe(-30000);
    expect(net).toBe(70000);
    expect(net).toBe(assets + liabilities); // reconciles
    expect(within(p).getByRole("link", { name: "Net worth over time" }).getAttribute("href")).toBe(
      "/insights/networth",
    );
  });

  test("net worth panel weights negative liabilities and a negative net worth (UX13)", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "200.00" });
    await api.createAccount({ name: "Card", kind: "credit", startingBalance: "-500.00" });

    renderCockpit(api);
    const p = await panel("Net worth");
    await within(p).findByText("$200.00");
    // assets 200 (not weighted), liabilities −500 and net −300 (both weighted).
    expect(within(p).getByText("$200.00").className).not.toContain(styles.negative);
    expect(within(p).getByText("-$500.00").className).toContain(styles.negative);
    expect(within(p).getByText("-$300.00").className).toContain(styles.negative);
  });

  test("net worth panel is an empty state with no accounts", async () => {
    renderCockpit();
    const p = await panel("Net worth");
    expect(await within(p).findByText(/Track your net worth/)).toBeTruthy();
  });

  test("needs-allocation panel shows the count and unallocated total", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    // Two unallocated deposits ($30 + $20) → 2 transactions, $50 unallocated.
    await api.createTransaction(acct.id, { kind: "deposit", amount: "30.00", allocations: [] });
    await api.createTransaction(acct.id, { kind: "deposit", amount: "20.00", allocations: [] });

    renderCockpit(api);
    const p = await panel("Needs allocation");
    expect(await within(p).findByText("2")).toBeTruthy();
    expect(within(p).getByText("$50.00 unallocated")).toBeTruthy();
    expect(within(p).getByRole("link", { name: "Allocate now" }).getAttribute("href")).toBe(
      "/needs-allocation",
    );
  });

  test("needs-allocation panel is all-clear (no link) when nothing is pending", async () => {
    renderCockpit();
    const p = await panel("Needs allocation");
    expect(await within(p).findByText(/Everything is allocated/)).toBeTruthy();
    expect(within(p).queryByRole("link")).toBeNull();
  });

  test("forecast panel follows the checking account and links to the detail", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Checking", kind: "checking", startingBalance: "500.00" });

    renderCockpit(api);
    const p = await panel("Cash-flow forecast");
    expect(await within(p).findByText(/Checking · next \d+ days/)).toBeTruthy();
    // No recurring activity → ending balance equals the starting balance (projection unchanged).
    const figures = figureCents(p); // Now · Projected end · Lowest
    expect(figures[0]).toBe(50000); // Now
    expect(figures[1]).toBe(50000); // Projected end (unchanged with no recurring activity)
    expect(within(p).getByText("Stays positive")).toBeTruthy();
    expect(within(p).getByRole("link", { name: "View forecast" }).getAttribute("href")).toBe(
      "/insights/forecast",
    );
  });

  test("forecast panel is an empty state with no cash account", async () => {
    const api = makeFakeApi();
    await api.createAccount({ name: "Card", kind: "credit", startingBalance: "-100.00" });

    renderCockpit(api);
    const p = await panel("Cash-flow forecast");
    expect(await within(p).findByText(/Add a checking account/)).toBeTruthy();
  });

  test("upcoming panel lists recurring rules and links to manage them", async () => {
    const api = makeFakeApi();
    const acct = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "0.00",
    });
    const env = await api.createEnvelope({ name: "Rent", kind: "standard" });
    await api.createRecurring({
      accountId: acct.id,
      kind: "withdrawal",
      amount: "1200.00",
      payee: "Landlord",
      frequency: "monthly",
      anchorOn: "2026-07-01",
      lines: [{ envelopeId: env.id, amount: "1200.00" }],
    });

    renderCockpit(api);
    const p = await panel("Upcoming");
    expect(await within(p).findByText("Landlord")).toBeTruthy();
    expect(within(p).getByRole("link", { name: "Manage recurring" }).getAttribute("href")).toBe(
      "/recurring",
    );
  });

  test("upcoming panel derives 'Still owed this month' from unposted withdrawals (FEAT-S9)", async () => {
    // Pin the clock (BudgetBurndownView precedent) so month-end and the expected sum are exact.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 3)); // 2026-07-03 local
    try {
      const api = makeFakeApi();
      const acct = await api.createAccount({
        name: "Checking",
        kind: "checking",
        startingBalance: "0.00",
      });
      const env = await api.createEnvelope({ name: "Bills", kind: "standard" });
      const mk = (over: {
        kind: "deposit" | "withdrawal";
        amount: string;
        frequency: "weekly" | "biweekly" | "monthly";
        anchorOn: string;
      }) =>
        api.createRecurring({
          accountId: acct.id,
          kind: over.kind,
          amount: over.amount,
          payee: over.kind,
          frequency: over.frequency,
          anchorOn: over.anchorOn,
          lines: [{ envelopeId: env.id, amount: over.amount }],
        });
      // Monthly rent on the 15th: 1 July occurrence. Weekly $25 from the 10th: 10/17/24/31 = 4.
      // June 1 bill never posted: June 1 + July 1 both still owed. The paycheck deposit: excluded.
      await mk({
        kind: "withdrawal",
        amount: "1200.00",
        frequency: "monthly",
        anchorOn: "2026-07-15",
      });
      await mk({
        kind: "withdrawal",
        amount: "25.00",
        frequency: "weekly",
        anchorOn: "2026-07-10",
      });
      await mk({
        kind: "withdrawal",
        amount: "60.00",
        frequency: "monthly",
        anchorOn: "2026-06-01",
      });
      await mk({
        kind: "deposit",
        amount: "1500.00",
        frequency: "biweekly",
        anchorOn: "2026-07-03",
      });

      renderCockpit(api);
      const p = await panel("Upcoming");
      expect(await within(p).findByText("Still owed this month")).toBeTruthy();
      // 1200 + 4×25 + 2×60 = $1,420.00
      expect(figureCents(p)).toEqual([142_000]);
      // FEAT-UXR2 — the Upcoming panel deep-links the next payday into the pay-period planner.
      const nextLink = await within(p).findByRole("link", { name: /Next paycheck/ });
      expect(nextLink.getAttribute("href")).toBe("/pay-periods");
    } finally {
      vi.useRealTimers();
    }
  });

  test("upcoming panel is an empty state with no recurring rules", async () => {
    renderCockpit();
    const p = await panel("Upcoming");
    expect(await within(p).findByText(/No recurring transactions/)).toBeTruthy();
  });

  test("a panel whose read fails shows an inline note, not a blank cockpit", async () => {
    const api = makeFakeApi({
      async listNeedsAllocation() {
        throw new Error("boom");
      },
    });
    renderCockpit(api);
    const p = await panel("Needs allocation");
    expect(await within(p).findByText(/Couldn't load this panel/)).toBeTruthy();
    // The rest of the cockpit still renders.
    expect(screen.getByRole("heading", { name: "Net worth", level: 3 })).toBeTruthy();
  });
});
