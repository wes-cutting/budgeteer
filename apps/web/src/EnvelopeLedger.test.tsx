import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnvelopeLedger } from "./EnvelopeLedger";
import { makeFakeApi } from "./test/fakeApi";

describe("EnvelopeLedger (R15)", () => {
  test("renders rows with date, payee, account, and signed amount", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    });
    const env = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.createTransaction(account.id, {
      kind: "withdrawal",
      amount: "48.70",
      payee: "Whole Foods",
      occurredOn: "2026-06-16",
      allocations: [{ envelopeId: env.id, amount: "48.70" }],
    });

    render(<EnvelopeLedger api={api} envelope={env} />);

    await screen.findByText("Whole Foods");
    expect(screen.getByText("Checking")).toBeTruthy();
    expect(screen.getByText("2026-06-16")).toBeTruthy();
    expect(screen.getByText(/\$48\.70/)).toBeTruthy();
  });

  test("wraps the ledger in a focusable scroll region for reflow (UX15)", async () => {
    const api = makeFakeApi();
    const account = await api.createAccount({
      name: "Checking",
      kind: "checking",
      startingBalance: "500.00",
    });
    const env = await api.createEnvelope({ name: "Groceries", kind: "standard" });
    await api.createTransaction(account.id, {
      kind: "withdrawal",
      amount: "48.70",
      payee: "Whole Foods",
      occurredOn: "2026-06-16",
      allocations: [{ envelopeId: env.id, amount: "48.70" }],
    });

    render(<EnvelopeLedger api={api} envelope={env} />);

    await screen.findByText("Whole Foods");
    // The four-column ledger scrolls within its own focusable region at phone width (WCAG 1.4.10),
    // so the page never scrolls horizontally; the region is keyboard-reachable.
    const region = screen.getByRole("group", { name: "Transactions ledger" });
    expect(region.className).toContain("table-scroll");
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.querySelector("table")).toBeTruthy();
  });

  test("shows empty state when envelope has no allocations", async () => {
    const api = makeFakeApi();
    const env = await api.createEnvelope({ name: "Vacation", kind: "sinking_fund" });

    render(<EnvelopeLedger api={api} envelope={env} />);

    await screen.findByText("No transactions in this envelope yet.");
  });

  test("archived envelope shows (archived) badge", async () => {
    const api = makeFakeApi();
    const env = await api.createEnvelope({ name: "Old Fund", kind: "standard" });
    const archived = await api.archiveEnvelope(env.id);

    render(<EnvelopeLedger api={api} envelope={archived} />);

    await screen.findByText(/archived/);
  });
});
