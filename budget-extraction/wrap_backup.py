#!/usr/bin/env python3
"""
Wrap the extractor's `budgeteer_import.json` (meta + tables) in the `BudgeteerBackup`
envelope that `npm run db:restore` validates (apps/api/src/services/restoreService.ts):

  { version: 1, exportedAt, householdId, schema: { migrations: [...] }, tables: {...} }

The `tables` payload passes through untouched. Output goes to the repo-root /data/
directory (gitignored — the backup is the owner's complete financial history).

Usage: python3 wrap_backup.py [in.json] [out.json]
  defaults: budgeteer_import.json -> ../data/budgeteer-backup-<today>.json
"""
import json, sys
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "budgeteer_import.json"
OUT = (
    Path(sys.argv[2])
    if len(sys.argv) > 2
    else HERE.parent / "data" / f"budgeteer-backup-{date.today().isoformat()}.json"
)

# Must match the registry in apps/api/src/db/migrate.ts — restore refuses a file
# stamped with migrations the target store lacks.
MIGRATIONS = ["0001-baseline", "0002-recurring-occurrence-idempotency"]

with SRC.open() as f:
    src = json.load(f)

backup = {
    "version": 1,
    "exportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "householdId": src["meta"]["household_id"],
    "schema": {"migrations": MIGRATIONS},
    "tables": src["tables"],
}

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w") as f:
    json.dump(backup, f)

counts = {k: len(v) for k, v in backup["tables"].items() if v}
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
print("row counts:", counts)
