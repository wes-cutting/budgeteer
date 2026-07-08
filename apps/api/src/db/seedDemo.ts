/**
 * Demo-grade synthetic seed (UXR8) — run via `npm run seed:demo` from apps/api.
 *
 * A *standalone* rich dataset for design/dev: ~6 months of dated history across every surface
 * so Insights, the pay-period planner, Templates, and the cockpit all show real patterns. It is
 * NOT the baseline `seed` (which stays lean and byte-identical for e2e/K24 isolation) — this is
 * a separate dev tool that populates its own store.
 *
 * Non-destructive (the EH10 / restore.ts precedent): refuses any store that already contains
 * user data. The flow is `npm run db:reset && npm run seed:demo` (or point PGLITE_DIR at a fresh
 * directory). e2e never touches the demo store.
 *
 * STRICTLY SYNTHETIC (SECURITY.md): every payee, amount, and account name is invented — never a
 * real creditor or figure. Committed code = committed data, all synthetic by construction. The
 * durable unlock for real-data richness remains the deferred history import (#17/#18); this is
 * the cheap dev-time proxy.
 *
 * Deterministic: all week-to-week variance is drawn from a fixed-seed PRNG, so the charts look
 * the same on every machine and every run.
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { Kysely } from "kysely";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";
import { migrateToLatest } from "./migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";
import type { DB } from "./schema.js";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../../.env") });

const cfg = loadConfig();

if (!cfg.DATABASE_URL && !cfg.PGLITE_DIR) {
  console.error(
    "\nseed:demo requires a persistent store.\n" +
      "Add one of these to your .env (see .env.example):\n" +
      "  PGLITE_DIR=../../data/budgeteer-demo   (file-based PGlite, no PostgreSQL needed)\n" +
      "  DATABASE_URL=postgres://...            (real PostgreSQL)\n" +
      "Then: npm run db:reset && npm run seed:demo\n",
  );
  process.exit(1);
}

const db = await createDb(cfg.DATABASE_URL, cfg.PGLITE_DIR);
await migrateToLatest(db);

const HH = DEFAULT_HOUSEHOLD_ID;

// ── Non-destructive guard (EH10 precedent) ───────────────────────────────────
// Refuse a store that already holds data — this is a dev seeder, not an importer, and it must
// never overwrite a real store. Only a fresh store (nothing but the migration-seeded household)
// is accepted.
const OCCUPANCY_TABLES = [
  "accounts",
  "envelopes",
  "transactions",
  "transfers",
  "envelope_transfers",
  "templates",
  "recurring_transactions",
  "reconciliations",
  "envelope_targets",
  "credit_limits",
  "loan_principals",
] as const;

const occupied: string[] = [];
for (const table of OCCUPANCY_TABLES) {
  const row = await db.selectFrom(table).select("id").limit(1).executeTakeFirst();
  if (row !== undefined) occupied.push(table);
}
if (occupied.length > 0) {
  console.error(
    `\nStore already contains data (${occupied.sort().join(", ")}) — seed:demo never overwrites.\n` +
      "Run `npm run db:reset` (or point PGLITE_DIR at a fresh directory), then retry.\n",
  );
  await db.destroy();
  process.exit(1);
}

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
// Fixed seed → identical data on every machine and every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x5eed_da7a);

/** A synthetic amount around `base`, jittered by ±`pct`, rounded to whole cents. */
function jitter(base: number, pct: number): number {
  const factor = 1 + (rng() * 2 - 1) * pct;
  return Math.round(base * factor);
}

/** Linear interpolate between a and b as t goes 0 → 1 (used for a slow spending trend). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Date helpers (all in UTC to stay stable across machines) ─────────────────
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(date: string, n: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** A day within `month`, clamped to the month's last day (so day 29 lands on Feb 28). */
function dom(month: number, day: number): string {
  const last = new Date(Date.UTC(YEAR, month, 0)).getUTCDate();
  return iso(YEAR, month, Math.min(day, last));
}

// Six full prior months of history: Jan–Jun 2026. Openings sit on the eve of the window; the
// recurring rules point at the upcoming (July+) occurrences so the planner has live pay periods.
const YEAR = 2026;
const MONTHS = [1, 2, 3, 4, 5, 6];
const OPENING_ON = "2025-12-31";

// ── Envelopes & the monthly budget (drives the paycheck split + targets) ─────
// Standard first, sinking funds last (mirrors the baseline seed's ordering convention).
type EnvKind = "standard" | "sinking_fund";
const BUDGET: { name: string; kind: EnvKind; monthly: number; target: boolean }[] = [
  // Standard — bills
  { name: "Rent", kind: "standard", monthly: 140_000, target: true },
  { name: "Insurance", kind: "standard", monthly: 12_000, target: true },
  { name: "Electric", kind: "standard", monthly: 11_500, target: true },
  { name: "Water", kind: "standard", monthly: 4_500, target: true },
  { name: "Internet", kind: "standard", monthly: 7_500, target: true },
  { name: "Phone", kind: "standard", monthly: 8_900, target: true },
  { name: "Streaming Services", kind: "standard", monthly: 2_800, target: true },
  // Standard — variable
  { name: "Groceries", kind: "standard", monthly: 52_000, target: true },
  { name: "Dining Out", kind: "standard", monthly: 24_000, target: true },
  { name: "Gas", kind: "standard", monthly: 20_000, target: true },
  { name: "Household Supplies", kind: "standard", monthly: 8_000, target: true },
  { name: "Personal Care", kind: "standard", monthly: 6_000, target: true },
  { name: "Entertainment", kind: "standard", monthly: 10_000, target: true },
  { name: "Medical", kind: "standard", monthly: 6_000, target: false },
  { name: "Clothing", kind: "standard", monthly: 8_000, target: false },
  { name: "Pet Care", kind: "standard", monthly: 5_000, target: false },
  { name: "Miscellaneous", kind: "standard", monthly: 6_000, target: false },
  // Sinking funds
  { name: "Emergency Fund", kind: "sinking_fund", monthly: 10_000, target: false },
  { name: "Vacation", kind: "sinking_fund", monthly: 8_000, target: false },
  { name: "Car Maintenance", kind: "sinking_fund", monthly: 6_000, target: false },
  { name: "Christmas / Holidays", kind: "sinking_fund", monthly: 4_000, target: false },
  { name: "New Car Fund", kind: "sinking_fund", monthly: 8_000, target: false },
];

// ── Accounts ─────────────────────────────────────────────────────────────────
const accountRows = await db
  .insertInto("accounts")
  .values([
    { household_id: HH, name: "Everyday Checking", kind: "checking" },
    { household_id: HH, name: "Emergency Savings", kind: "savings" },
    { household_id: HH, name: "Rewards Credit Card", kind: "credit" },
    { household_id: HH, name: "Auto Loan", kind: "loan" },
  ])
  .returning(["id"])
  .execute();
const checking = accountRows[0]!.id;
const savings = accountRows[1]!.id;
const card = accountRows[2]!.id;
const loan = accountRows[3]!.id;

// ── Envelopes ─────────────────────────────────────────────────────────────────
const envRows = await db
  .insertInto("envelopes")
  .values(BUDGET.map((e) => ({ household_id: HH, name: e.name, kind: e.kind })))
  .returning(["id"])
  .execute();
const env = Object.fromEntries(BUDGET.map((b, i) => [b.name, envRows[i]!.id])) as Record<
  string,
  string
>;

// ── Insert helpers ────────────────────────────────────────────────────────────
type Db = Kysely<DB>;

/** A single-envelope transaction (outflow if amount < 0, refund/inflow if > 0). */
async function addSingle(
  d: Db,
  account: string,
  date: string,
  payee: string,
  envelope: string,
  amountCents: number,
): Promise<void> {
  const txn = await d
    .insertInto("transactions")
    .values({
      household_id: HH,
      account_id: account,
      amount_cents: amountCents,
      kind: "normal",
      occurred_on: date,
      payee,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await d
    .insertInto("allocations")
    .values({ transaction_id: txn.id, envelope_id: env[envelope]!, amount_cents: amountCents })
    .execute();
}

/** A deposit split across envelopes (the paycheck). Lines must sum to `amountCents`. */
async function addDeposit(
  d: Db,
  account: string,
  date: string,
  payee: string,
  memo: string,
  amountCents: number,
  lines: { envelope: string; amount: number }[],
): Promise<void> {
  const txn = await d
    .insertInto("transactions")
    .values({
      household_id: HH,
      account_id: account,
      amount_cents: amountCents,
      kind: "normal",
      occurred_on: date,
      payee,
      memo,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await d
    .insertInto("allocations")
    .values(
      lines.map((l) => ({
        transaction_id: txn.id,
        envelope_id: env[l.envelope]!,
        amount_cents: l.amount,
      })),
    )
    .execute();
}

/** An account↔account transfer: a parent row + two signed `kind:'transfer'` legs (ADR-0004). */
async function addTransfer(
  d: Db,
  from: string,
  to: string,
  date: string,
  magnitude: number,
  memo: string,
): Promise<void> {
  const transfer = await d
    .insertInto("transfers")
    .values({ household_id: HH, occurred_on: date, memo })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await d
    .insertInto("transactions")
    .values([
      {
        household_id: HH,
        account_id: from,
        amount_cents: -magnitude,
        kind: "transfer",
        occurred_on: date,
        memo,
        transfer_id: transfer.id,
      },
      {
        household_id: HH,
        account_id: to,
        amount_cents: magnitude,
        kind: "transfer",
        occurred_on: date,
        memo,
        transfer_id: transfer.id,
      },
    ])
    .execute();
}

/** Integer apportionment: split `total` across `weights`, summing to exactly `total`. */
function proportionalSplit(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  const remainder = total - out.reduce((a, b) => a + b, 0);
  const byFrac = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) out[byFrac[k]!.i]!++;
  return out;
}

// The per-paycheck budget split (biweekly $1,600 = 160,000¢), proportional to the monthly plan.
const PAYCHECK_CENTS = 160_000;
const paycheckSplitAmounts = proportionalSplit(
  PAYCHECK_CENTS,
  BUDGET.map((b) => b.monthly),
);
const PAYCHECK_LINES = BUDGET.map((b, i) => ({
  envelope: b.name,
  amount: paycheckSplitAmounts[i]!,
}));

// ── Opening balances ──────────────────────────────────────────────────────────
const openingRows = await db
  .insertInto("transactions")
  .values([
    {
      household_id: HH,
      account_id: checking,
      amount_cents: 450_000,
      kind: "opening",
      occurred_on: OPENING_ON,
    },
    {
      household_id: HH,
      account_id: savings,
      amount_cents: 820_000,
      kind: "opening",
      occurred_on: OPENING_ON,
    },
    {
      household_id: HH,
      account_id: card,
      amount_cents: -28_000,
      kind: "opening",
      occurred_on: OPENING_ON,
    },
    {
      household_id: HH,
      account_id: loan,
      amount_cents: -1_600_000,
      kind: "opening",
      occurred_on: OPENING_ON,
    },
  ])
  .returning(["id"])
  .execute();
// The savings opening funds the Emergency Fund envelope, so it shows a live balance.
await db
  .insertInto("allocations")
  .values({
    transaction_id: openingRows[1]!.id,
    envelope_id: env["Emergency Fund"]!,
    amount_cents: 820_000,
  })
  .execute();

// ── Biweekly paychecks (13 across the window) ────────────────────────────────
// Anchored on the first Friday, every 14 days, while inside the Jan–Jun window.
let payday = "2026-01-02"; // a Friday
while (payday < iso(YEAR, 7, 1)) {
  await addDeposit(
    db,
    checking,
    payday,
    "Northwind Payroll",
    "Paycheck",
    PAYCHECK_CENTS,
    PAYCHECK_LINES,
  );
  payday = addDays(payday, 14);
}

// ── Monthly history ──────────────────────────────────────────────────────────
for (let m = 0; m < MONTHS.length; m++) {
  const month = MONTHS[m]!;
  const t = m / (MONTHS.length - 1); // 0 → 1 across the window, for trends

  // Bills paid from checking (the month-boundary cluster the planner exists for: 1/2/7/15/29).
  await addSingle(db, checking, dom(month, 1), "Cedar Ridge Apartments", "Rent", -140_000);
  await addSingle(db, checking, dom(month, 2), "Northstar Insurance", "Insurance", -12_000);
  await addSingle(
    db,
    checking,
    dom(month, 7),
    "Municipal Power Co.",
    "Electric",
    -jitter(11_500, 0.18),
  );
  await addSingle(db, checking, dom(month, 15), "FiberStream ISP", "Internet", -7_500);
  await addSingle(db, checking, dom(month, 15), "Cellwave Mobile", "Phone", -8_900);
  await addSingle(
    db,
    checking,
    dom(month, 29),
    "City Water & Sewer",
    "Water",
    -jitter(4_500, 0.22),
  );

  // Groceries — 7 trips/month, per-trip cost drifting UP across the window (a visible trend).
  const perTrip = lerp(9_500, 13_500, t);
  for (const day of [3, 7, 11, 15, 19, 23, 27]) {
    const payee = rng() < 0.5 ? "Harvest Market" : "GreenGrocer";
    await addSingle(db, checking, dom(month, day), payee, "Groceries", -jitter(perTrip, 0.22));
  }

  // Gas — 4 fill-ups/month from checking.
  for (const day of [5, 12, 19, 26]) {
    await addSingle(db, checking, dom(month, day), "QuickFuel", "Gas", -jitter(5_000, 0.2));
  }

  // Dining Out — 4/month on the credit card.
  for (const day of [6, 13, 20, 27]) {
    const payee = rng() < 0.5 ? "The Corner Bistro" : "Noodle House";
    await addSingle(db, card, dom(month, day), payee, "Dining Out", -jitter(6_000, 0.35));
  }

  // Recurring card subscriptions + card discretionary.
  await addSingle(db, card, dom(month, 29), "StreamFlix", "Streaming Services", -2_800);
  await addSingle(db, card, dom(month, 16), "Cineplex", "Entertainment", -jitter(10_000, 0.3));
  await addSingle(db, card, dom(month, 22), "Trend Threads", "Clothing", -jitter(8_000, 0.4));

  // Discretionary from checking; Medical has a one-month spike in March (m === 2).
  await addSingle(
    db,
    checking,
    dom(month, 8),
    "HomeMart",
    "Household Supplies",
    -jitter(8_000, 0.3),
  );
  await addSingle(
    db,
    checking,
    dom(month, 10),
    "Clip & Style",
    "Personal Care",
    -jitter(6_000, 0.25),
  );
  const medical = m === 2 ? 45_000 : jitter(5_000, 0.3);
  await addSingle(
    db,
    checking,
    dom(month, 18),
    m === 2 ? "Regional Clinic" : "Corner Pharmacy",
    "Medical",
    -medical,
  );
  await addSingle(db, checking, dom(month, 24), "Paws & Claws", "Pet Care", -jitter(5_000, 0.25));
  await addSingle(
    db,
    checking,
    dom(month, 26),
    "Sundry Store",
    "Miscellaneous",
    -jitter(6_000, 0.4),
  );

  // Debt payments (transfers): loan every month, card Jan–May.
  await addTransfer(db, checking, loan, dom(month, 5), 40_000, "Auto loan payment");
  if (m < 5) await addTransfer(db, checking, card, dom(month, 20), 30_000, "Credit card payment");
}

// A one-off account transfer to savings, and a refund back into an envelope — so those ledger
// shapes appear.
await addTransfer(db, checking, savings, "2026-03-15", 50_000, "Top up savings");
await addSingle(db, checking, "2026-04-12", "Trend Threads (refund)", "Clothing", 4_000);

// An envelope↔envelope reallocation (re-budget, no account movement) — Manage/reallocation shape.
await db
  .insertInto("envelope_transfers")
  .values({
    household_id: HH,
    from_envelope_id: env["Miscellaneous"]!,
    to_envelope_id: env["Vacation"]!,
    amount_cents: 5_000,
    occurred_on: "2026-05-10",
    memo: "Move leftover to the vacation fund",
  })
  .execute();

// ── Targets ──────────────────────────────────────────────────────────────────
await db
  .insertInto("envelope_targets")
  .values(
    BUDGET.filter((b) => b.target).map((b) => ({
      household_id: HH,
      envelope_id: env[b.name]!,
      monthly_target_cents: b.monthly,
    })),
  )
  .execute();

// ── Credit limit & loan principal ─────────────────────────────────────────────
await db
  .insertInto("credit_limits")
  .values({ household_id: HH, account_id: card, credit_limit_cents: 500_000 })
  .execute();
await db
  .insertInto("loan_principals")
  .values({ household_id: HH, account_id: loan, original_principal_cents: 1_800_000 })
  .execute();

// ── Recurring rules (the planner's upcoming pay periods + bill cluster) ───────
// Biweekly paycheck — next future occurrence after 2026-07-07.
const paycheckRule = await db
  .insertInto("recurring_transactions")
  .values({
    household_id: HH,
    account_id: checking,
    direction: "deposit",
    amount_cents: PAYCHECK_CENTS,
    payee: "Northwind Payroll",
    memo: "Paycheck",
    frequency: "biweekly",
    anchor_on: "2026-01-02",
    next_occurrence_on: "2026-07-17",
  })
  .returning(["id"])
  .executeTakeFirstOrThrow();
await db
  .insertInto("recurring_lines")
  .values(
    PAYCHECK_LINES.map((l, i) => ({
      recurring_id: paycheckRule.id,
      envelope_id: env[l.envelope]!,
      amount_cents: l.amount,
      position: i + 1,
    })),
  )
  .execute();

// Monthly bills as withdrawal rules — anchored across the month boundary (1/2/7/15/29).
const BILL_RULES: { payee: string; envelope: string; amount: number; day: number; next: string }[] =
  [
    {
      payee: "Cedar Ridge Apartments",
      envelope: "Rent",
      amount: 140_000,
      day: 1,
      next: iso(YEAR, 8, 1),
    },
    {
      payee: "Northstar Insurance",
      envelope: "Insurance",
      amount: 12_000,
      day: 2,
      next: iso(YEAR, 8, 2),
    },
    {
      payee: "Municipal Power Co.",
      envelope: "Electric",
      amount: 11_500,
      day: 7,
      next: iso(YEAR, 8, 7),
    },
    {
      payee: "FiberStream ISP",
      envelope: "Internet",
      amount: 7_500,
      day: 15,
      next: iso(YEAR, 7, 15),
    },
    { payee: "Cellwave Mobile", envelope: "Phone", amount: 8_900, day: 15, next: iso(YEAR, 7, 15) },
    {
      payee: "City Water & Sewer",
      envelope: "Water",
      amount: 4_500,
      day: 29,
      next: iso(YEAR, 7, 29),
    },
    {
      payee: "StreamFlix",
      envelope: "Streaming Services",
      amount: 2_800,
      day: 29,
      next: iso(YEAR, 7, 29),
    },
  ];
for (const bill of BILL_RULES) {
  const rule = await db
    .insertInto("recurring_transactions")
    .values({
      household_id: HH,
      account_id: bill.envelope === "Streaming Services" ? card : checking,
      direction: "withdrawal",
      amount_cents: bill.amount,
      payee: bill.payee,
      frequency: "monthly",
      anchor_on: iso(YEAR, 1, bill.day),
      next_occurrence_on: bill.next,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await db
    .insertInto("recurring_lines")
    .values({
      recurring_id: rule.id,
      envelope_id: env[bill.envelope]!,
      amount_cents: bill.amount,
      position: 1,
    })
    .execute();
}

// ── Templates (the Templates page finally has sample data) ────────────────────
async function addTemplate(
  name: string,
  lines: { envelope: string; amount: number }[],
): Promise<void> {
  const tpl = await db
    .insertInto("templates")
    .values({ household_id: HH, name })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  await db
    .insertInto("template_lines")
    .values(
      lines.map((l, i) => ({
        template_id: tpl.id,
        envelope_id: env[l.envelope]!,
        amount_cents: l.amount,
        position: i + 1,
      })),
    )
    .execute();
}
await addTemplate("Monthly Bills", [
  { envelope: "Rent", amount: 140_000 },
  { envelope: "Electric", amount: 11_500 },
  { envelope: "Water", amount: 4_500 },
  { envelope: "Internet", amount: 7_500 },
  { envelope: "Phone", amount: 8_900 },
  { envelope: "Insurance", amount: 12_000 },
]);
await addTemplate("Paycheck Split", PAYCHECK_LINES);
await addTemplate("Weekly Grocery Run", [{ envelope: "Groceries", amount: 12_000 }]);

console.log("Demo seed complete (strictly synthetic).");
console.log("  4 accounts · 22 envelopes · ~6 months of dated history (Jan–Jun 2026)");
console.log(
  "  targets · credit limit · loan principal · biweekly paycheck + 7 bill rules · 3 templates",
);
console.log("  Insights, the pay-period planner, and the Templates page now show real patterns.");

await db.destroy();
