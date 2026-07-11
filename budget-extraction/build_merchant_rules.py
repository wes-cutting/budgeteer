#!/usr/bin/env python3
"""
Draft the merchant->envelope rules the owner reviews before load (D3, roadmap #20).

Attribution has a strong head and a long tail (SPIKE-11 F6): the top merchants cover ~69% of
post-cut spend rows, and ~60% of spend rows carry a payee already recurring in the 12-year
workbook ledger. This script proposes a rule for each head merchant, seeding the envelope from
the owner's *own historical categorization* (the workbook's payee->envelope allocations) — not a
guess. Anything without a confident history match is left `null` for the owner to fill; unlisted
(one-off) merchants import unallocated by design.

Output: `merchant_rules.json` (gitignored — real merchants). Shape:

    { "_meta": {... coverage/counts ...},
      "rules": { "<MERCHANT KEY>": "<Envelope name>" | null, ... } }

Review it, adjust envelopes, then re-run `extract_statements.py` + `merge_statements.py`. The
whole pipeline is idempotent, so re-running after edits simply rebuilds the store.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from extract_statements import (
    CUT, RULES_FILE, WORKBOOK_BACKUP, account_view, merchant_key, parse_all, transfer_pairs,
)

# Head = merchants seen at least this many times post-cut (the recurring head; one-offs stay
# unallocated). Coverage lands near SPIKE-11 F6's ~69% figure and is reported in _meta.
MIN_COUNT = 2


def workbook_payee_to_envelope() -> dict[str, str]:
    """normalized workbook payee -> its dominant envelope, from the 12-yr ledger's own allocations."""
    if not WORKBOOK_BACKUP.exists():
        return {}
    tables = json.loads(WORKBOOK_BACKUP.read_text())["tables"]
    env_name = {e["id"]: e["name"] for e in tables["envelopes"]}
    alloc_by_txn: dict[str, Counter] = defaultdict(Counter)
    for a in tables["allocations"]:
        alloc_by_txn[a["transaction_id"]][a["envelope_id"]] += abs(int(a["amount_cents"]))
    payee_env: dict[str, Counter] = defaultdict(Counter)
    for t in tables["transactions"]:
        if int(t["amount_cents"]) >= 0 or not t.get("payee"):
            continue
        env_weights = alloc_by_txn.get(t["id"])
        if not env_weights:
            continue
        dominant = env_weights.most_common(1)[0][0]
        payee_env[merchant_key(t["payee"])][env_name.get(dominant, "")] += 1
    return {p: c.most_common(1)[0][0] for p, c in payee_env.items() if c and c.most_common(1)[0][0]}


# Keys that describe money movement, not a merchant — never candidates for a spend rule.
NON_MERCHANT = re.compile(r"\b(WITHDRAWAL|DEPOSIT|TRANSFER)\b")


def suggest(key: str, history: dict[str, str]) -> str | None:
    """Suggest an envelope for a statement merchant key via the owner's workbook history.

    Match when a recurring workbook payee (>=4 chars) appears as a *whole word* in the merchant
    key — a word boundary avoids false hits like a 'CAMP' payee inside 'BASECAMP'. Prefer the
    longest (most specific) matching payee. These are review suggestions, not ground truth."""
    if key in history:
        return history[key]
    best = None
    for payee, env in history.items():
        if len(payee) < 4:
            continue
        if re.search(rf"\b{re.escape(payee)}\b", key):
            if best is None or len(payee) > len(best[0]):
                best = (payee, env)
    return best[1] if best else None


def main() -> None:
    statements = parse_all()
    view = account_view(statements)
    _, consumed = transfer_pairs(view)
    spend = [r for v in view.values() for r in v["post"]
             if r["amount"] < 0 and id(r) not in consumed]

    freq = Counter(merchant_key(r["desc"]) for r in spend)
    history = workbook_payee_to_envelope()

    # Drop empties and money-movement descriptors — only real merchants become rules.
    head = [(k, n) for k, n in freq.most_common()
            if n >= MIN_COUNT and k and not NON_MERCHANT.search(k)]
    covered = sum(n for _, n in head)
    rules: dict[str, str | None] = {}
    suggested = 0
    for key, _ in head:
        env = suggest(key, history)
        rules[key] = env
        if env:
            suggested += 1

    # Preserve any envelopes the owner already assigned in a prior review of this file.
    if RULES_FILE.exists():
        prior = json.loads(RULES_FILE.read_text()).get("rules", {})
        for key, env in prior.items():
            if env:
                rules[key] = env

    out = {
        "_meta": {
            "cut": CUT,
            "spend_rows_post_cut": len(spend),
            "distinct_merchants": len(freq),
            "head_merchants": len(head),
            "head_coverage_pct": round(100 * covered / max(len(spend), 1), 1),
            "history_derived_suggestions": suggested,
            "note": "SUGGESTIONS ONLY — seeded by heuristic history matching; expect several to be "
                    "wrong. Review every envelope: correct mistakes, fill nulls, delete rows you'd "
                    "rather triage in-app. Then load with `extract_statements.py --rules "
                    "merchant_rules.json` + merge_statements.py. Unlisted/deleted merchants import "
                    "unallocated (the needs-allocation triage flow).",
        },
        "rules": dict(sorted(rules.items())),
    }
    RULES_FILE.write_text(json.dumps(out, indent=2))
    print(f"wrote {RULES_FILE.name}")
    print(f"  post-cut spend rows: {len(spend)}  distinct merchants: {len(freq)}")
    print(f"  head (>= {MIN_COUNT}x): {len(head)} merchants covering "
          f"{out['_meta']['head_coverage_pct']}% of spend rows")
    print(f"  history-derived envelope suggestions: {suggested}/{len(head)}  "
          f"(the rest are null for owner review)")


if __name__ == "__main__":
    main()
