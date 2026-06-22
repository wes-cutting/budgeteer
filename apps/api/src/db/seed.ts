/**
 * Development seed script — run via `npm run seed` from apps/api.
 *
 * Requires a persistent store: set DATABASE_URL (PostgreSQL) or PGLITE_DIR in .env.
 * Without one the script exits with a clear message — in-memory PGlite loses all data
 * when the process exits, so seeding it would be pointless.
 *
 * Idempotent: exits quietly if accounts already exist for the default household.
 *
 * What gets seeded:
 *   • 4 accounts  (checking · savings · credit · loan)
 *   • 22 envelopes (16 standard + 6 sinking funds)
 *   • 3 months of transactions (April–June 2026) with full allocations
 *   • 8 envelope monthly targets  → powers budget-vs-actual view
 *   • Credit limit on Visa        → powers credit-utilization view
 *   • Loan original principal     → powers debt-payoff view
 *   • 2 recurring rules           → powers cash-flow forecast view
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";
import { migrateToLatest } from "./migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });

const cfg = loadConfig();

if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error(
    "\nSeed requires a persistent store.\n" +
      "Add one of these to your .env (see .env.example):\n" +
      "  PGLITE_DIR=../../data/budgeteer-dev   (file-based PGlite, no PostgreSQL needed)\n" +
      "  DATABASE_URL=postgres://...            (real PostgreSQL)\n" +
      "Then restart: npm run seed\n",
  );
  process.exit(1);
}

const db = await createDb(cfg.DATABASE_URL, cfg.PGLITE_DIR);
await migrateToLatest(db);

const HH = DEFAULT_HOUSEHOLD_ID;

const existing = await db
  .selectFrom("accounts")
  .where("household_id", "=", HH)
  .select("id")
  .limit(1)
  .execute();

if (existing.length > 0) {
  console.log("Seed data already present — skipping. Run `npm run db:fresh` to reset and re-seed.");
  await db.destroy();
  process.exit(0);
}

// ── Accounts ─────────────────────────────────────────────────────────────────

const accountRows = await db
  .insertInto("accounts")
  .values([
    { household_id: HH, name: "Everyday Checking", kind: "checking" },
    { household_id: HH, name: "Emergency Savings", kind: "savings" },
    { household_id: HH, name: "Visa Rewards", kind: "credit" },
    { household_id: HH, name: "Auto Loan", kind: "loan" },
  ])
  .returning(["id"])
  .execute();

const checking = accountRows[0]!;
const savings = accountRows[1]!;
const visa = accountRows[2]!;
const autoLoan = accountRows[3]!;

// ── Envelopes ─────────────────────────────────────────────────────────────────

const ENVELOPE_DEFS = [
  // Standard (16)
  { name: "Groceries", kind: "standard" },
  { name: "Dining Out", kind: "standard" },
  { name: "Gas", kind: "standard" },
  { name: "Electric", kind: "standard" },
  { name: "Internet", kind: "standard" },
  { name: "Phone", kind: "standard" },
  { name: "Streaming Services", kind: "standard" },
  { name: "Medical", kind: "standard" },
  { name: "Clothing", kind: "standard" },
  { name: "Household Supplies", kind: "standard" },
  { name: "Personal Care", kind: "standard" },
  { name: "Entertainment", kind: "standard" },
  { name: "Gifts", kind: "standard" },
  { name: "Pet Care", kind: "standard" },
  { name: "Home Maintenance", kind: "standard" },
  { name: "Miscellaneous", kind: "standard" },
  // Sinking funds (6)
  { name: "Emergency Fund", kind: "sinking_fund" },
  { name: "Vacation", kind: "sinking_fund" },
  { name: "Car Maintenance", kind: "sinking_fund" },
  { name: "Christmas / Holidays", kind: "sinking_fund" },
  { name: "Home Projects", kind: "sinking_fund" },
  { name: "New Car Fund", kind: "sinking_fund" },
] as const;

const envRows = await db
  .insertInto("envelopes")
  .values(ENVELOPE_DEFS.map((e) => ({ household_id: HH, ...e })))
  .returning(["id"])
  .execute();

const env = Object.fromEntries(ENVELOPE_DEFS.map((def, i) => [def.name, envRows[i]!.id]));

// ── Paycheck split definition ($3,200 = 320,000 cents) ───────────────────────
// Reused for both transaction allocations (same-sign as the deposit: positive)
// and recurring rule lines (always positive magnitude per the schema).

const PAYCHECK_LINES: { envelope: string; amount_cents: number }[] = [
  { envelope: "Groceries", amount_cents: 60_000 },
  { envelope: "Dining Out", amount_cents: 20_000 },
  { envelope: "Gas", amount_cents: 15_000 },
  { envelope: "Electric", amount_cents: 12_000 },
  { envelope: "Internet", amount_cents: 8_000 },
  { envelope: "Phone", amount_cents: 9_000 },
  { envelope: "Streaming Services", amount_cents: 2_000 },
  { envelope: "Medical", amount_cents: 20_000 },
  { envelope: "Clothing", amount_cents: 15_000 },
  { envelope: "Household Supplies", amount_cents: 10_000 },
  { envelope: "Personal Care", amount_cents: 9_000 },
  { envelope: "Entertainment", amount_cents: 12_000 },
  { envelope: "Gifts", amount_cents: 5_000 },
  { envelope: "Pet Care", amount_cents: 5_000 },
  { envelope: "Home Maintenance", amount_cents: 8_000 },
  { envelope: "Miscellaneous", amount_cents: 10_000 },
  { envelope: "Emergency Fund", amount_cents: 25_000 },
  { envelope: "Vacation", amount_cents: 20_000 },
  { envelope: "Car Maintenance", amount_cents: 15_000 },
  { envelope: "Christmas / Holidays", amount_cents: 5_000 },
  { envelope: "Home Projects", amount_cents: 5_000 },
  { envelope: "New Car Fund", amount_cents: 30_000 },
  // Sum: 320,000 ✓
];

// ── Opening balances ──────────────────────────────────────────────────────────
// Partial allocation is valid (0 ≤ |Σ allocations| ≤ |amount|), so most are
// unallocated.  Savings opening is allocated to Emergency Fund so it shows a
// live balance on the envelope list.

const openingRows = await db
  .insertInto("transactions")
  .values([
    {
      household_id: HH,
      account_id: checking.id,
      amount_cents: 350_000,
      kind: "opening",
      occurred_on: "2026-03-31",
    },
    {
      household_id: HH,
      account_id: savings.id,
      amount_cents: 820_000,
      kind: "opening",
      occurred_on: "2026-03-31",
    },
    {
      household_id: HH,
      account_id: visa.id,
      amount_cents: -42_000,
      kind: "opening",
      occurred_on: "2026-03-31",
    },
    {
      household_id: HH,
      account_id: autoLoan.id,
      amount_cents: -1_450_000,
      kind: "opening",
      occurred_on: "2026-03-31",
    },
  ])
  .returning(["id"])
  .execute();

await db
  .insertInto("allocations")
  .values([
    {
      transaction_id: openingRows[1]!.id,
      envelope_id: env["Emergency Fund"]!,
      amount_cents: 820_000,
    },
  ])
  .execute();

// ── Monthly transaction helper ────────────────────────────────────────────────

async function seedMonth(dates: {
  paycheck: string;
  grocery1: string;
  grocery2: string;
  electric: string;
  internet: string;
  phone: string;
  gas: string;
  credit: string;
}) {
  // Paycheck deposit — fully allocated across all 22 envelopes
  const paycheck = await db
    .insertInto("transactions")
    .values({
      household_id: HH,
      account_id: checking.id,
      amount_cents: 320_000,
      kind: "normal",
      occurred_on: dates.paycheck,
      payee: "Employer Direct Deposit",
      memo: "Paycheck",
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await db
    .insertInto("allocations")
    .values(
      PAYCHECK_LINES.map((l) => ({
        transaction_id: paycheck.id,
        envelope_id: env[l.envelope]!,
        amount_cents: l.amount_cents,
      })),
    )
    .execute();

  // Grocery runs
  for (const [date, payee, amount_cents] of [
    [dates.grocery1, "Trader Joe's", -17_800],
    [dates.grocery2, "Whole Foods", -16_500],
  ] as [string, string, number][]) {
    const txn = await db
      .insertInto("transactions")
      .values({
        household_id: HH,
        account_id: checking.id,
        amount_cents,
        kind: "normal",
        occurred_on: date,
        payee,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    await db
      .insertInto("allocations")
      .values([{ transaction_id: txn.id, envelope_id: env["Groceries"]!, amount_cents }])
      .execute();
  }

  // Monthly bills from checking
  const checkingBills: [string, string, number, string][] = [
    [dates.electric, "City Electric", -11_500, "Electric"],
    [dates.internet, "Comcast", -7_500, "Internet"],
    [dates.phone, "T-Mobile", -8_900, "Phone"],
    [dates.gas, "Shell", -5_400, "Gas"],
  ];
  for (const [date, payee, amount_cents, envName] of checkingBills) {
    const txn = await db
      .insertInto("transactions")
      .values({
        household_id: HH,
        account_id: checking.id,
        amount_cents,
        kind: "normal",
        occurred_on: date,
        payee,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    await db
      .insertInto("allocations")
      .values([{ transaction_id: txn.id, envelope_id: env[envName]!, amount_cents }])
      .execute();
  }

  // Credit card charges
  const creditCharges: [string, number, string][] = [
    ["Netflix", -2_800, "Streaming Services"],
    ["Local Bistro", -7_800, "Dining Out"],
    ["Great Clips", -4_500, "Personal Care"],
  ];
  for (const [payee, amount_cents, envName] of creditCharges) {
    const txn = await db
      .insertInto("transactions")
      .values({
        household_id: HH,
        account_id: visa.id,
        amount_cents,
        kind: "normal",
        occurred_on: dates.credit,
        payee,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    await db
      .insertInto("allocations")
      .values([{ transaction_id: txn.id, envelope_id: env[envName]!, amount_cents }])
      .execute();
  }
}

await seedMonth({
  paycheck: "2026-04-01",
  grocery1: "2026-04-05",
  grocery2: "2026-04-18",
  electric: "2026-04-10",
  internet: "2026-04-12",
  phone: "2026-04-14",
  gas: "2026-04-20",
  credit: "2026-04-22",
});
await seedMonth({
  paycheck: "2026-05-01",
  grocery1: "2026-05-04",
  grocery2: "2026-05-17",
  electric: "2026-05-09",
  internet: "2026-05-11",
  phone: "2026-05-13",
  gas: "2026-05-21",
  credit: "2026-05-22",
});
await seedMonth({
  paycheck: "2026-06-01",
  grocery1: "2026-06-05",
  grocery2: "2026-06-16",
  electric: "2026-06-09",
  internet: "2026-06-11",
  phone: "2026-06-13",
  gas: "2026-06-19",
  credit: "2026-06-20",
});

// ── Envelope targets ──────────────────────────────────────────────────────────

await db
  .insertInto("envelope_targets")
  .values([
    { household_id: HH, envelope_id: env["Groceries"]!, monthly_target_cents: 60_000 },
    { household_id: HH, envelope_id: env["Dining Out"]!, monthly_target_cents: 20_000 },
    { household_id: HH, envelope_id: env["Gas"]!, monthly_target_cents: 15_000 },
    { household_id: HH, envelope_id: env["Electric"]!, monthly_target_cents: 12_000 },
    { household_id: HH, envelope_id: env["Internet"]!, monthly_target_cents: 8_000 },
    { household_id: HH, envelope_id: env["Phone"]!, monthly_target_cents: 9_000 },
    { household_id: HH, envelope_id: env["Entertainment"]!, monthly_target_cents: 12_000 },
    { household_id: HH, envelope_id: env["Personal Care"]!, monthly_target_cents: 9_000 },
  ])
  .execute();

// ── Credit limit & loan principal ─────────────────────────────────────────────

await db
  .insertInto("credit_limits")
  .values({ household_id: HH, account_id: visa.id, credit_limit_cents: 500_000 })
  .execute();

await db
  .insertInto("loan_principals")
  .values({ household_id: HH, account_id: autoLoan.id, original_principal_cents: 1_800_000 })
  .execute();

// ── Recurring rules ───────────────────────────────────────────────────────────

// Monthly paycheck — next due 2026-07-01
const paycheckRule = await db
  .insertInto("recurring_transactions")
  .values({
    household_id: HH,
    account_id: checking.id,
    direction: "deposit",
    amount_cents: 320_000,
    payee: "Employer Direct Deposit",
    memo: "Paycheck",
    frequency: "monthly",
    anchor_on: "2026-04-01",
    next_occurrence_on: "2026-07-01",
  })
  .returning(["id"])
  .executeTakeFirstOrThrow();

await db
  .insertInto("recurring_lines")
  .values(
    PAYCHECK_LINES.map((l, i) => ({
      recurring_id: paycheckRule.id,
      envelope_id: env[l.envelope]!,
      amount_cents: l.amount_cents,
      position: i + 1,
    })),
  )
  .execute();

// Monthly Netflix — next due 2026-07-22
const netflixRule = await db
  .insertInto("recurring_transactions")
  .values({
    household_id: HH,
    account_id: visa.id,
    direction: "withdrawal",
    amount_cents: 2_800,
    payee: "Netflix",
    frequency: "monthly",
    anchor_on: "2026-04-22",
    next_occurrence_on: "2026-07-22",
  })
  .returning(["id"])
  .executeTakeFirstOrThrow();

await db
  .insertInto("recurring_lines")
  .values([
    {
      recurring_id: netflixRule.id,
      envelope_id: env["Streaming Services"]!,
      amount_cents: 2_800,
      position: 1,
    },
  ])
  .execute();

console.log("Seed complete.");
console.log("  4 accounts · 22 envelopes · 3 months of transactions");
console.log("  8 envelope targets · credit limit · loan principal · 2 recurring rules");

await db.destroy();
