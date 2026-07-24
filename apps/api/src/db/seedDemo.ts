/**
 * Demo-grade synthetic seed (UXR8) — run via `npm run seed:demo` from apps/api.
 *
 * A *standalone* rich dataset for design/dev: 6 months of dated history plus the current month
 * (through today) across every surface, so Insights, the pay-period planner, Templates, and the
 * cockpit all show real patterns. It is NOT the baseline `seed` (which stays lean and
 * byte-identical for e2e/K24 isolation) — this is a separate dev tool that populates its own
 * store.
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
 * Deterministic per day: all week-to-week variance is drawn from a fixed-seed PRNG, so two runs
 * on the same calendar day produce byte-identical output. The history window itself is relative
 * to *today* (util/dates.ts's `systemClock` convention) rather than a fixed calendar range, so it
 * rolls forward automatically as real time passes — a fixed range goes stale the moment a demo is
 * captured after it, leaving every current-month view (Breakdown, Budget vs. Actual, Burn-down,
 * the dashboard's "This month's budget" card) empty. Rolling forward daily is the fix, not a
 * determinism break.
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { Kysely } from "kysely";
import { loadConfig } from "../config.js";
import { createDb } from "./connection.js";
import { migrateToLatest } from "./migrate.js";
import { DEFAULT_HOUSEHOLD_ID } from "../constants.js";
import { systemClock, todayStr } from "../util/dates.js";
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
// Fixed seed → identical data on every machine, for every run on the same calendar day.
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
/** A day within `year`/`month`, clamped to the month's last day (so day 29 lands on Feb 28). */
function dom(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return iso(year, month, Math.min(day, last));
}
/** `{ year, month }` shifted by `delta` calendar months (may be negative or span years). */
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
/** The first Friday on or after `date` — the biweekly paycheck's anchor weekday. */
function firstFridayOnOrAfter(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat, Friday=5
  return addDays(date, (5 - weekday + 7) % 7);
}

// A rolling window anchored on today rather than a fixed calendar range: 6 full prior months of
// history, plus the current month populated up through today. MONTHS[6] (the last entry) is that
// partial current month; every dated insert below is additionally gated on `<= TODAY` so nothing
// lands in the future. The opening balance sits on the eve of the window.
const TODAY = todayStr(systemClock);
const todayParts = TODAY.split("-").map(Number);
const TODAY_YEAR = todayParts[0]!;
const TODAY_MONTH = todayParts[1]!;
const MONTHS = Array.from({ length: 7 }, (_, i) => shiftMonth(TODAY_YEAR, TODAY_MONTH, i - 6));
const OPENING_ON = addDays(dom(MONTHS[0]!.year, MONTHS[0]!.month, 1), -1);

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
// All four openings are left unallocated (like the checking/card/loan ones already were) — the
// Emergency Fund envelope instead earns its balance from its ongoing paycheck line below, so it
// shows a modest, *growing* balance rather than a one-time lump that dwarfs every other envelope's
// net flow on the by-envelope chart.
await db
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
  .execute();

// ── Biweekly paychecks ────────────────────────────────────────────────────────
// Anchored on the first Friday on/after the opening date, every 14 days, through today. The first
// occurrence after today becomes the recurring rule's next_occurrence_on below.
const firstPayday = firstFridayOnOrAfter(OPENING_ON);
let payday = firstPayday;
while (payday <= TODAY) {
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
const nextPayday = payday;

// ── Monthly history ──────────────────────────────────────────────────────────
for (let m = 0; m < MONTHS.length; m++) {
  const { year, month } = MONTHS[m]!;
  const t = m / (MONTHS.length - 1); // 0 → 1 across the window, for trends
  const dateOn = (day: number) => dom(year, month, day);
  // Every date is additionally gated on `<= TODAY` — a no-op for the 6 full history months
  // (always in the past) and what keeps the current (last, partial) month from inserting
  // not-yet-happened transactions.
  const past = (date: string) => date <= TODAY;

  // Bills paid from checking (the month-boundary cluster the planner exists for: 1/2/7/15/29).
  if (past(dateOn(1)))
    await addSingle(db, checking, dateOn(1), "Cedar Ridge Apartments", "Rent", -140_000);
  if (past(dateOn(2)))
    await addSingle(db, checking, dateOn(2), "Northstar Insurance", "Insurance", -12_000);
  if (past(dateOn(7)))
    await addSingle(
      db,
      checking,
      dateOn(7),
      "Municipal Power Co.",
      "Electric",
      -jitter(11_500, 0.18),
    );
  if (past(dateOn(15)))
    await addSingle(db, checking, dateOn(15), "FiberStream ISP", "Internet", -7_500);
  if (past(dateOn(15)))
    await addSingle(db, checking, dateOn(15), "Cellwave Mobile", "Phone", -8_900);
  if (past(dateOn(29)))
    await addSingle(db, checking, dateOn(29), "City Water & Sewer", "Water", -jitter(4_500, 0.22));

  // Groceries — 7 trips/month, per-trip cost drifting UP across the window (a visible trend).
  // Kept close to its $520/mo target (average ~$87/trip) so the cumulative funding/spend gap
  // stays in scale with every other envelope's net flow on the by-envelope chart, rather than
  // compounding into a multi-month outlier the way a much higher trend range would.
  const perTrip = lerp(7_200, 10_200, t);
  for (const day of [3, 7, 11, 15, 19, 23, 27]) {
    if (!past(dateOn(day))) continue;
    const payee = rng() < 0.5 ? "Harvest Market" : "GreenGrocer";
    await addSingle(db, checking, dateOn(day), payee, "Groceries", -jitter(perTrip, 0.22));
  }

  // Gas — 4 fill-ups/month from checking.
  for (const day of [5, 12, 19, 26]) {
    if (past(dateOn(day)))
      await addSingle(db, checking, dateOn(day), "QuickFuel", "Gas", -jitter(5_000, 0.2));
  }

  // Dining Out — 4/month on the credit card.
  for (const day of [6, 13, 20, 27]) {
    if (!past(dateOn(day))) continue;
    const payee = rng() < 0.5 ? "The Corner Bistro" : "Noodle House";
    await addSingle(db, card, dateOn(day), payee, "Dining Out", -jitter(6_000, 0.35));
  }

  // Recurring card subscriptions + card discretionary.
  if (past(dateOn(29)))
    await addSingle(db, card, dateOn(29), "StreamFlix", "Streaming Services", -2_800);
  if (past(dateOn(16)))
    await addSingle(db, card, dateOn(16), "Cineplex", "Entertainment", -jitter(10_000, 0.3));
  if (past(dateOn(22)))
    await addSingle(db, card, dateOn(22), "Trend Threads", "Clothing", -jitter(8_000, 0.4));

  // Discretionary from checking; Medical has a one-month spike partway through the window.
  if (past(dateOn(8)))
    await addSingle(db, checking, dateOn(8), "HomeMart", "Household Supplies", -jitter(8_000, 0.3));
  if (past(dateOn(10)))
    await addSingle(
      db,
      checking,
      dateOn(10),
      "Clip & Style",
      "Personal Care",
      -jitter(6_000, 0.25),
    );
  if (past(dateOn(18))) {
    const medical = m === 2 ? 45_000 : jitter(5_000, 0.3);
    await addSingle(
      db,
      checking,
      dateOn(18),
      m === 2 ? "Regional Clinic" : "Corner Pharmacy",
      "Medical",
      -medical,
    );
  }
  if (past(dateOn(24)))
    await addSingle(db, checking, dateOn(24), "Paws & Claws", "Pet Care", -jitter(5_000, 0.25));
  if (past(dateOn(26)))
    await addSingle(db, checking, dateOn(26), "Sundry Store", "Miscellaneous", -jitter(6_000, 0.4));

  // Debt payments (transfers): loan every month, card in all but the last.
  if (past(dateOn(5)))
    await addTransfer(db, checking, loan, dateOn(5), 40_000, "Auto loan payment");
  if (m < MONTHS.length - 1 && past(dateOn(20)))
    await addTransfer(db, checking, card, dateOn(20), 30_000, "Credit card payment");
}

// A one-off account transfer to savings, and a refund back into an envelope — so those ledger
// shapes appear. Anchored to fully-historical months (indices 2–4 of the 7-month window), well
// clear of the partial current month.
const savingsTopUpMonth = MONTHS[2]!;
const refundMonth = MONTHS[3]!;
const reallocationMonth = MONTHS[4]!;
await addTransfer(
  db,
  checking,
  savings,
  dom(savingsTopUpMonth.year, savingsTopUpMonth.month, 15),
  50_000,
  "Top up savings",
);
await addSingle(
  db,
  checking,
  dom(refundMonth.year, refundMonth.month, 12),
  "Trend Threads (refund)",
  "Clothing",
  4_000,
);

// An envelope↔envelope reallocation (re-budget, no account movement) — Manage/reallocation shape.
await db
  .insertInto("envelope_transfers")
  .values({
    household_id: HH,
    from_envelope_id: env["Miscellaneous"]!,
    to_envelope_id: env["Vacation"]!,
    amount_cents: 5_000,
    occurred_on: dom(reallocationMonth.year, reallocationMonth.month, 10),
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
// Every next_occurrence_on below is strictly after TODAY — computed, not hardcoded — so the
// Recurring page and dashboard "Upcoming" widget always read as current, never overdue.
/** The next occurrence of a given day-of-month, strictly after today. */
function nextMonthlyOccurrence(day: number): string {
  const thisMonth = dom(TODAY_YEAR, TODAY_MONTH, day);
  if (thisMonth > TODAY) return thisMonth;
  const next = shiftMonth(TODAY_YEAR, TODAY_MONTH, 1);
  return dom(next.year, next.month, day);
}

// Biweekly paycheck.
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
    anchor_on: firstPayday,
    next_occurrence_on: nextPayday,
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
const BILL_RULES: { payee: string; envelope: string; amount: number; day: number }[] = [
  { payee: "Cedar Ridge Apartments", envelope: "Rent", amount: 140_000, day: 1 },
  { payee: "Northstar Insurance", envelope: "Insurance", amount: 12_000, day: 2 },
  { payee: "Municipal Power Co.", envelope: "Electric", amount: 11_500, day: 7 },
  { payee: "FiberStream ISP", envelope: "Internet", amount: 7_500, day: 15 },
  { payee: "Cellwave Mobile", envelope: "Phone", amount: 8_900, day: 15 },
  { payee: "City Water & Sewer", envelope: "Water", amount: 4_500, day: 29 },
  { payee: "StreamFlix", envelope: "Streaming Services", amount: 2_800, day: 29 },
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
      anchor_on: dom(MONTHS[0]!.year, MONTHS[0]!.month, bill.day),
      next_occurrence_on: nextMonthlyOccurrence(bill.day),
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
console.log(
  `  4 accounts · 22 envelopes · dated history ${OPENING_ON} → ${TODAY} (6 months + today)`,
);
console.log(
  "  targets · credit limit · loan principal · biweekly paycheck + 7 bill rules · 3 templates",
);
console.log("  Insights, the pay-period planner, and the Templates page now show real patterns.");

await db.destroy();
