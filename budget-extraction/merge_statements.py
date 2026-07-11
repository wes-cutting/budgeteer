#!/usr/bin/env python3
"""
Merge the workbook era + the statement era into one BudgeteerBackup (roadmap #20).

EH10 `db:restore` refuses a non-empty store (SPIKE-11 §5), so the statement import cannot append
to `data/budgeteer-ledger`. Instead the store is rebuilt as a pure derivation of its two
gitignored sources: this script folds `budgeteer_import.json` (workbook, `extract.py`) and
`statement_import.json` (statements, `extract_statements.py`) into a single wrapped backup, then:

    npm --prefix apps/api run db:reset      # clears data/budgeteer-ledger (PGLITE_DIR in .env)
    npm --prefix apps/api run db:restore -- data/budgeteer-backup-statements-<today>.json

is run to rebuild it. Idempotent — re-run each month as new statements arrive.

Before wrapping, every cross-era invariant is checked and a mismatch aborts (no half-baked store):
FK integrity, unique ids, ADR-0004 transfer legs (exactly two per parent, summing to zero), and
the allocation split invariant. Output is gitignored (the owner's complete financial history).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKBOOK = HERE / "budgeteer_import.json"
STATEMENTS = HERE / "statement_import.json"
OUT = HERE.parent / "data" / f"budgeteer-backup-statements-{date.today().isoformat()}.json"

# Must match the registry in apps/api/src/db/migrate.ts (restore refuses a file stamped with
# migrations the target store lacks).
MIGRATIONS = ["0001-baseline", "0002-recurring-occurrence-idempotency"]

TABLES = [
    "households", "accounts", "envelopes", "transfers", "envelope_transfers",
    "templates", "template_lines", "recurring_transactions", "recurring_lines",
    "transactions", "allocations", "reconciliations",
    "envelope_targets", "credit_limits", "loan_principals",
]


def load_tables(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"missing {path.name} — run its extractor first")
    return json.loads(path.read_text())["tables"]


def validate(t: dict) -> None:
    fail: list[str] = []

    # 1. Unique ids per table.
    for name in TABLES:
        ids = [r["id"] for r in t.get(name, []) if "id" in r]
        if len(ids) != len(set(ids)):
            fail.append(f"{name}: duplicate ids across eras")

    account_ids = {r["id"] for r in t["accounts"]}
    envelope_ids = {r["id"] for r in t["envelopes"]}
    txn_ids = {r["id"] for r in t["transactions"]}
    transfer_ids = {r["id"] for r in t["transfers"]}

    # 2. FK integrity.
    for tx in t["transactions"]:
        if tx["account_id"] not in account_ids:
            fail.append(f"txn {tx['id']}: account_id not found")
        if tx.get("transfer_id") and tx["transfer_id"] not in transfer_ids:
            fail.append(f"txn {tx['id']}: transfer_id not found")
    for a in t["allocations"]:
        if a["transaction_id"] not in txn_ids:
            fail.append(f"alloc {a['id']}: transaction_id not found")
        if a["envelope_id"] not in envelope_ids:
            fail.append(f"alloc {a['id']}: envelope_id not found")

    # 3. ADR-0004 transfer legs: exactly two per parent, summing to zero, kind='transfer', no allocs.
    legs = defaultdict(list)
    for tx in t["transactions"]:
        if tx.get("transfer_id"):
            legs[tx["transfer_id"]].append(tx)
    alloc_txns = {a["transaction_id"] for a in t["allocations"]}
    for tid in transfer_ids:
        group = legs.get(tid, [])
        if len(group) != 2:
            fail.append(f"transfer {tid}: {len(group)} legs (expected 2)")
        if sum(int(g["amount_cents"]) for g in group) != 0:
            fail.append(f"transfer {tid}: legs do not sum to zero")
        for g in group:
            if g["kind"] != "transfer":
                fail.append(f"transfer leg {g['id']}: kind {g['kind']} != transfer")
            if g["id"] in alloc_txns:
                fail.append(f"transfer leg {g['id']}: carries allocations (ADR-0004 forbids)")

    # 4. Split invariant per transaction: 0 <= |Σalloc| <= |amount|, signs matching.
    by_txn = defaultdict(int)
    for a in t["allocations"]:
        by_txn[a["transaction_id"]] += int(a["amount_cents"])
    amt = {tx["id"]: int(tx["amount_cents"]) for tx in t["transactions"]}
    for tid, s in by_txn.items():
        if abs(s) > abs(amt[tid]) or (s != 0 and (s > 0) != (amt[tid] > 0)):
            fail.append(f"txn {tid}: split invariant violated (Σalloc {s} vs amount {amt[tid]})")

    if fail:
        sys.exit("Merge validation FAILED:\n  " + "\n  ".join(fail[:20]))


def main() -> None:
    wb = load_tables(WORKBOOK)
    st = load_tables(STATEMENTS)
    merged = {name: list(wb.get(name, [])) + list(st.get(name, [])) for name in TABLES}
    validate(merged)

    backup = {
        "version": 1,
        "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "householdId": "00000000-0000-0000-0000-000000000001",
        "schema": {"migrations": MIGRATIONS},
        "tables": merged,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(backup))
    counts = {k: len(v) for k, v in merged.items() if v}
    total = sum(counts.values())
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)  total rows: {total}")
    for k, v in counts.items():
        wb_n, st_n = len(wb.get(k, [])), len(st.get(k, []))
        print(f"  {k}: {v}  (workbook {wb_n} + statements {st_n})")
    print("\nNext (from repo root):")
    print("  npm --prefix apps/api run db:reset")
    print(f"  npm --prefix apps/api run db:restore -- {OUT.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
