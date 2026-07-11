#!/usr/bin/env python3
"""
Bank statements (PDF) -> Budgeteer statement-era rows  (roadmap #20, unblocked by SPIKE-11).

Deterministic extractor on the `extract.py` pattern (UUIDv5 ids, integer cents, a validation
report). Parses the 20 gitignored statement PDFs (two institutions), applies the era cut at
2025-10-03 (D1 — workbook authoritative on/before it), and emits BudgeteerBackup-shaped tables
for every statement row dated *after* the cut. No amounts, merchants or account numbers live in
this file — it parses them at runtime; its outputs are gitignored (K27 / SECURITY.md).

Decisions realized (SPIKE-11 §4, owner-confirmed 2026-07-10):
  D1  era cut 2025-10-03; import only rows dated > cut.
  D2  three new real accounts + a computed opening-balance anchor at the cut (a `kind:'opening'`
      transaction; created only when the anchor is non-zero — two of three compute to exactly $0).
  D3  merchant->envelope rules (a gitignored, owner-reviewed file) attribute the head of spend;
      everything else imports unallocated -> the app's needs-allocation flow is the triage surface.
  D4  intra-Capital-One pairs (same-day, equal magnitude, counterpart is a *covered* account) ->
      ADR-0004 transfers (a `transfers` parent + two `kind:'transfer'` legs, no allocations);
      external-source deposits and moves to uncovered accounts stay plain.

  NOTE (correction to SPIKE-11 F5's evidence figure): F5 counted 23 intra-CO pairs, but that was
  the savings->checking direction only. Filtering by the *covered* account numbers finds transfers
  in BOTH directions (savings->checking AND checking->savings). Modelling only one direction would
  leave the other as plain rows, misreporting internal money movement as spend/income — the exact
  failure ADR-0004 exists to prevent. This extractor pairs both directions; the count is reported
  live. D4's *decision* is unchanged; only F5's count was one-directional.

Reconciliation is the spine (as in the spike parser): per account, opening-anchor + Σ(post-cut
rows) must equal the last statement's stated closing balance, to the penny — a mismatch aborts.

Reconstruct/merge/load: see merge_statements.py and the status report. Requires `pdfplumber`.
"""
from __future__ import annotations

import json
import re
import sys
import uuid
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import pdfplumber

HERE = Path(__file__).resolve().parent
STMTS = HERE / "bank-statements"
WORKBOOK_BACKUP = HERE / "budgeteer_import.json"   # gitignored; source of valid envelope names
RULES_FILE = HERE / "merchant_rules.json"          # gitignored; owner-reviewed (D3)
OUT_TABLES = HERE / "statement_import.json"         # gitignored output
OUT_REPORT = HERE / "STATEMENT_EXTRACTION_REPORT.md"  # gitignored output (carries real amounts)

# --- identity: MUST match extract.py so envelope/household ids line up on merge ---------------
DEFAULT_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001"
NS = uuid.UUID("11111111-2222-3333-4444-555555555555")
CUT = "2025-10-03"       # D1 — the era boundary (workbook authoritative on/before)
ANCHOR_DATE = CUT        # opening anchors are dated at the cut

# Account display names (deterministic; no account numbers embedded).
BOFA_CHECKING = "Bank of America Checking"
CO_CHECKING = "Capital One 360 Checking"
CO_SAVINGS = "Capital One 360 Performance Savings"


def uid(*parts) -> str:
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def cents(s: str) -> int:
    neg = s.strip().startswith("-")
    digits = s.replace(",", "").replace("$", "").replace("-", "").strip()
    whole, frac = digits.split(".")
    v = int(whole) * 100 + int(frac)
    return -v if neg else v


def env_norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip()).lower()


def envelope_id(name: str) -> str:
    return uid("envelope", env_norm(name))


def iso_ts(d: str) -> str:
    return d + "T00:00:00Z"


def pdf_lines(path: Path) -> list[str]:
    with pdfplumber.open(path) as pdf:
        lines: list[str] = []
        for page in pdf.pages:
            lines.extend((page.extract_text() or "").splitlines())
    return lines


# =============================================================================================
# Parsing (ported verbatim in behaviour from the SPIKE-11 parser, which reconciled 30/30).
# Each parser returns account-statement dicts: {account, kind, last4, opening, closing, rows[],
# reconciles, anomalies}. A row is {date, desc, amount(cents, signed)}.
# =============================================================================================

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
MONTHS_FULL = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"])}

BOFA_ROW = re.compile(r"^(\d{2})/(\d{2})/(\d{2}) (.+?) (-?[\d,]+\.\d{2})$")
BOFA_SECTIONS = {
    "Deposits and other additions": "deposits",
    "ATM and debit card subtractions": "atm_debit",
    "Other subtractions": "other_sub",
    "Checks": "checks",
    "Service fees": "fees",
}
BOFA_TOTAL = re.compile(
    r"^Total (deposits and other additions|ATM and debit card subtractions|"
    r"other subtractions|checks|service fees)\s+(-?)\$(-?[\d,]+\.\d{2})$", re.I)
BOFA_FURNITURE = (
    "continued on the next page", "Page ", "Date Description Amount",
    "Date Transaction description Amount",
)


def parse_bofa(path: Path) -> list[dict]:
    lines = pdf_lines(path)
    beginning = ending = None
    summary: dict[str, int] = {}
    rows: list[dict] = []
    anomalies: list[str] = []
    section = None
    in_summary = False

    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if ln == "Account summary":
            in_summary = True
            continue
        if in_summary:
            m = re.match(r"^Beginning balance on .+ (-?)\$(-?[\d,]+\.\d{2})$", ln)
            if m:
                beginning = -cents(m[2]) if m[1] else cents(m[2])
                continue
            m = re.match(r"^Ending balance on .+ (-?)\$(-?[\d,]+\.\d{2})$", ln)
            if m:
                ending = -cents(m[2]) if m[1] else cents(m[2])
                in_summary = False
                continue
            for label, key in BOFA_SECTIONS.items():
                m = re.match(rf"^{re.escape(label)} (-?[\d,]+\.\d{{2}})$", ln)
                if m:
                    summary[key] = cents(m[1])
                    break
            continue
        base = ln.removesuffix(" - continued")
        if base in ("Withdrawals and other subtractions",):
            continue
        if base in BOFA_SECTIONS:
            section = BOFA_SECTIONS[base]
            continue
        m = BOFA_TOTAL.match(ln)
        if m:
            key = BOFA_SECTIONS[
                {"deposits and other additions": "Deposits and other additions",
                 "atm and debit card subtractions": "ATM and debit card subtractions",
                 "other subtractions": "Other subtractions",
                 "checks": "Checks",
                 "service fees": "Service fees"}[m[1].lower()]]
            stated = -cents(m[3]) if m[2] else cents(m[3])
            got = sum(r["amount"] for r in rows if r["section"] == key)
            if got != stated:
                anomalies.append(f"section {key}: rows sum {got} != stated total {stated}")
            section = None
            continue
        if section:
            m = BOFA_ROW.match(ln)
            if m:
                d = date(2000 + int(m[3]), int(m[1]), int(m[2]))
                rows.append({"date": d.isoformat(), "desc": m[4],
                             "amount": cents(m[5]), "section": section})
            elif rows and not any(f in ln for f in BOFA_FURNITURE) and not ln.startswith("Total "):
                rows[-1]["desc"] += " " + ln  # wrapped description continuation

    total = sum(r["amount"] for r in rows)
    recon = beginning is not None and ending is not None and beginning + total == ending
    for key, stated in summary.items():
        got = sum(r["amount"] for r in rows if r["section"] == key)
        if got != stated:
            anomalies.append(f"summary {key}: rows sum {got} != summary {stated}")
    for r in rows:
        r.pop("section", None)
    return [{"institution": "bofa", "file": path.name, "account": BOFA_CHECKING,
             "kind": "checking", "last4": None, "opening": beginning, "closing": ending,
             "rows": rows, "reconciles": recon, "anomalies": anomalies}]


CAP1_SECTION = re.compile(r"^360 (Checking|Performance Savings) - (\d+)$")
CAP1_ROW = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) (.*?) ?"
    r"(Credit|Debit) ([+-]) \$([\d,]+\.\d{2}) (- ?)?\$([\d,]+\.\d{2})$")
CAP1_OPEN = re.compile(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) "
                       r"(Opening|Closing) Balance (- ?)?\$([\d,]+\.\d{2})$")
CAP1_DATED = re.compile(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) (.+)$")
# Capital One wraps long merchant descriptions across up to three physical lines: a card-purchase
# PREFIX line (no date/amount), the amount line (date + Debit/Credit; merchant text may be empty),
# then an all-caps location/id SUFFIX tail. We reassemble all three so no row imports blank-payee.
CO_PREFIX = ("Debit Card Purchase -", "Digital Card Purchase -")
CO_FURNITURE = re.compile(r"^(Page \d+ of \d+|DATE DESCRIPTION CATEGORY AMOUNT BALANCE)$")
CO_SUFFIX = re.compile(r"^[A-Z0-9][A-Z0-9 ,.&'#/-]*$")


def parse_cap1(path: Path) -> list[dict]:
    lines = pdf_lines(path)
    year = None
    for ln in lines:
        m = re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} - "
                      r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, (\d{4})", ln)
        if m:
            year = int(m[3])
            break
    if year is None:
        raise ValueError(f"{path.name}: no statement period found")

    accounts: list[dict] = []
    cur: dict | None = None
    bal: int | None = None
    pending = ""          # accumulated wrapped-description PREFIX for the next amount line
    last: dict | None = None  # the last amount row, for SUFFIX-tail attachment
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        m = CAP1_SECTION.match(ln)
        if m:
            name = CO_CHECKING if m[1] == "Checking" else CO_SAVINGS
            cur = {"institution": "capitalone", "file": path.name, "account": name,
                   "kind": "checking" if m[1] == "Checking" else "savings",
                   "last4": m[2][-4:], "opening": None, "closing": None, "rows": [],
                   "reconciles": True, "anomalies": []}
            accounts.append(cur)
            bal = None
            pending, last = "", None
            continue
        if cur is None or cur["closing"] is not None:
            continue
        if CO_FURNITURE.match(ln):
            last = None  # a wrapped tail never crosses a page header
            continue
        m = CAP1_OPEN.match(ln)
        if m:
            v = -cents(m[5]) if m[4] else cents(m[5])
            if m[3] == "Opening":
                cur["opening"] = bal = v
            else:
                cur["closing"] = v
                if bal != cur["closing"]:
                    cur["reconciles"] = False
                    cur["anomalies"].append(f"chain ends {bal} != closing {cur['closing']}")
            pending, last = "", None
            continue
        if ln.startswith(CO_PREFIX) and not CAP1_ROW.match(ln):
            pending = f"{pending} {ln}".strip()  # a wrapped-description head; amount is on a later line
            last = None
            continue
        m = CAP1_ROW.match(ln)
        if m:
            amt = cents(m[6])
            signed = amt if m[5] == "+" else -amt
            new_bal = -cents(m[8]) if m[7] else cents(m[8])
            d = date(year, MONTHS[m[1]], int(m[2]))
            if bal is not None and bal + signed != new_bal:
                cur["reconciles"] = False
                cur["anomalies"].append(
                    f"{d}: balance chain break ({bal} {'+' if signed >= 0 else ''}{signed} != {new_bal})")
            bal = new_bal
            row = {"date": d.isoformat(), "desc": f"{pending} {m[3].strip()}".strip(),
                   "amount": signed}
            cur["rows"].append(row)
            last, pending = row, ""
            continue
        if CAP1_DATED.match(ln):
            last = None  # amount-less dated line (e.g. a rejected movement); balance-neutral — skip
            continue
        if last is not None and CO_SUFFIX.match(ln):
            last["desc"] = f"{last['desc']} {ln}".strip()  # wrapped location/id tail
    for acc in accounts:
        total = sum(r["amount"] for r in acc["rows"])
        if acc["opening"] is None or acc["closing"] is None:
            acc["reconciles"] = False
            acc["anomalies"].append("missing opening/closing balance")
        elif acc["opening"] + total != acc["closing"]:
            acc["reconciles"] = False
            acc["anomalies"].append(
                f"opening {acc['opening']} + rows {total} != closing {acc['closing']}")
    return accounts


def parse_all() -> list[dict]:
    """All account-statements across the 20 PDFs, with reconciliation enforced."""
    out: list[dict] = []
    for f in sorted((STMTS / "bank-of-america").glob("*.pdf")):
        out.extend(parse_bofa(f))
    for f in sorted((STMTS / "capital-one").glob("*.pdf")):
        out.extend(parse_cap1(f))
    if not out:
        sys.exit(f"No statements parsed under {STMTS} — is the (gitignored) folder present?")
    bad = [f"{r['account']} [{r['file']}]: {'; '.join(r['anomalies'])}"
           for r in out if not r["reconciles"] or r["anomalies"]]
    if bad:
        sys.exit("Reconciliation failed — aborting:\n  " + "\n  ".join(bad))
    return out


# =============================================================================================
# Per-account assembly: opening anchor + post-cut classification.
# =============================================================================================

def account_view(statements: list[dict]) -> dict[str, dict]:
    """Group statements per account; compute the cut anchor and post-cut rows, reconciled."""
    by_acc: dict[str, list[dict]] = defaultdict(list)
    for s in statements:
        by_acc[s["account"]].append(s)

    view: dict[str, dict] = {}
    for name, stmts in by_acc.items():
        stmts.sort(key=lambda r: min((row["date"] for row in r["rows"]), default=r["file"]))
        first_opening = stmts[0]["opening"]
        last_closing = stmts[-1]["closing"]
        rows = [dict(row, account=name) for s in stmts for row in s["rows"]]
        anchor = first_opening + sum(r["amount"] for r in rows if r["date"] <= CUT)
        post = sorted((r for r in rows if r["date"] > CUT), key=lambda r: r["date"])
        if anchor + sum(r["amount"] for r in post) != last_closing:
            sys.exit(f"{name}: anchor {anchor} + post-cut rows != closing {last_closing}")
        view[name] = {
            "kind": stmts[0]["kind"], "last4": stmts[0]["last4"],
            "anchor": anchor, "closing": last_closing, "post": post,
        }
    return view


# Intra-institution transfer legs reference the counterpart's product name + last-4 (D4).
CO_COUNTERPART = re.compile(
    r"(Withdrawal to|Deposit from) 360 (?:Checking|Performance Savings) X*(\d{4})")


def transfer_pairs(view: dict[str, dict]) -> tuple[list[tuple[dict, dict]], set[int]]:
    """Pair covered intra-Capital-One debits<->credits (both directions), same-day equal magnitude.

    Returns (pairs, consumed_row_ids). A row is a transfer leg iff its counterpart last-4 belongs
    to another *covered* account; movements to uncovered accounts stay plain (D4)."""
    covered_last4 = {v["last4"]: name for name, v in view.items() if v["last4"]}
    legs = [r for name, v in view.items() for r in v["post"]
            if (m := CO_COUNTERPART.search(r["desc"])) and m[2] in covered_last4]
    debits = [r for r in legs if r["amount"] < 0]
    credits = [dict(id=id(r), row=r, matched=False) for r in legs if r["amount"] > 0]

    pairs: list[tuple[dict, dict]] = []
    consumed: set[int] = set()
    for d in sorted(debits, key=lambda r: r["date"]):
        src_last4 = view[d["account"]]["last4"]
        dst_last4 = CO_COUNTERPART.search(d["desc"])[2]
        hit = next((c for c in credits if not c["matched"]
                    and c["row"]["amount"] == -d["amount"]
                    and c["row"]["date"] == d["date"]
                    and view[c["row"]["account"]]["last4"] == dst_last4
                    and CO_COUNTERPART.search(c["row"]["desc"])[2] == src_last4), None)
        if hit is None:
            sys.exit(f"Unpaired intra-CO transfer leg {d['date']} {d['amount']} '{d['desc']}'")
        hit["matched"] = True
        pairs.append((d, hit["row"]))
        consumed.add(id(d))
        consumed.add(id(hit["row"]))
    unpaired = [c for c in credits if not c["matched"]]
    if unpaired:
        sys.exit(f"{len(unpaired)} unpaired intra-CO credit legs — investigate before load")
    return pairs, consumed


# =============================================================================================
# Merchant attribution (D3).
# =============================================================================================

def merchant_key(desc: str) -> str:
    """Normalize a statement description to a stable merchant key (matches the SPIKE-11 profile)."""
    s = re.sub(r"(Debit|Digital) Card Purchase - ", "", desc)
    s = re.sub(r"[^A-Za-z ]", " ", s.upper())
    s = re.sub(r"\b(RECURRING|PURCHASE|CHECKCARD|MOBILE|DES|ID|INDN|CO|WEB|PPD|CCD)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()[:28]


def load_rules(valid_envelopes: set[str], rules_path: Path | None) -> dict[str, str]:
    """Load the owner-reviewed merchant->envelope rules (D3), only when explicitly requested.

    The DEFAULT load applies NO rules — every statement spend row imports unallocated into the
    needs-allocation triage flow (the explicit #20 deliverable). Attribution is opt-in AFTER the
    owner reviews the rules file (`--rules merchant_rules.json`), keeping unreviewed guesses out of
    the store. A rule naming an envelope that does not exist in the workbook era fails loudly."""
    if rules_path is None:
        print("  (no --rules — all spend imports unallocated into needs-allocation)")
        return {}
    if not rules_path.exists():
        sys.exit(f"--rules {rules_path} not found (run build_merchant_rules.py first)")
    raw = json.loads(rules_path.read_text())
    rules = raw["rules"] if isinstance(raw, dict) and "rules" in raw else raw
    resolved: dict[str, str] = {}
    for key, env in rules.items():
        if env in (None, ""):
            continue
        if env not in valid_envelopes:
            sys.exit(f"Rule '{key}' -> unknown envelope '{env}' (not one of the workbook envelopes)")
        resolved[key] = env
    return resolved


# =============================================================================================
# Build the BudgeteerBackup-shaped statement tables.
# =============================================================================================

def valid_envelope_names() -> set[str]:
    if not WORKBOOK_BACKUP.exists():
        return set()
    tables = json.loads(WORKBOOK_BACKUP.read_text())["tables"]
    return {e["name"] for e in tables["envelopes"]}


def build(rules_path: Path | None = None) -> tuple[dict, dict]:
    statements = parse_all()
    view = account_view(statements)
    pairs, consumed = transfer_pairs(view)
    valid_env = valid_envelope_names()
    rules = load_rules(valid_env, rules_path)

    accounts, transactions, allocations, transfers = [], [], [], []
    seq = 0

    def new_txn(account_id, amount, occurred, kind, payee, memo, transfer_id=None):
        nonlocal seq
        seq += 1
        tid = uid("stmt-txn", seq)
        transactions.append({
            "id": tid, "household_id": DEFAULT_HOUSEHOLD_ID, "account_id": account_id,
            "amount_cents": amount, "kind": kind, "occurred_on": occurred,
            "payee": payee or None, "memo": memo or None,
            "transfer_id": transfer_id, "recurring_id": None, "created_at": iso_ts(occurred),
        })
        return tid

    def add_alloc(tid, env_name, amount):
        allocations.append({"id": uid("stmt-alloc", tid, len(allocations)),
                            "transaction_id": tid, "envelope_id": envelope_id(env_name),
                            "amount_cents": amount})

    acct_id = {name: uid("account", env_norm(name)) for name in view}
    for name, v in view.items():
        accounts.append({"id": acct_id[name], "household_id": DEFAULT_HOUSEHOLD_ID,
                         "name": name, "kind": v["kind"],
                         "created_at": iso_ts(ANCHOR_DATE), "archived_at": None})

    # D2 — opening anchor (one 'opening' txn per account; only when non-zero).
    anchors = {}
    for name, v in view.items():
        anchors[name] = v["anchor"]
        if v["anchor"] != 0:
            new_txn(acct_id[name], v["anchor"], ANCHOR_DATE, "opening",
                    "Opening balance", "Reconciled statement balance at the 2025-10-03 era cut")

    # D4 — transfer pairs (parent + two legs, no allocations).
    for i, (debit, credit) in enumerate(pairs):
        tr_id = uid("stmt-transfer", i)
        transfers.append({"id": tr_id, "household_id": DEFAULT_HOUSEHOLD_ID,
                          "occurred_on": debit["date"], "memo": "Account transfer",
                          "created_at": iso_ts(debit["date"])})
        new_txn(acct_id[debit["account"]], debit["amount"], debit["date"], "transfer",
                debit["desc"], None, transfer_id=tr_id)
        new_txn(acct_id[credit["account"]], credit["amount"], credit["date"], "transfer",
                credit["desc"], None, transfer_id=tr_id)

    # Everything else — plain normal txns; spend attributed by the rules head (D3), rest unallocated.
    attributed = unallocated_spend = 0
    for name, v in view.items():
        for r in v["post"]:
            if id(r) in consumed:
                continue
            tid = new_txn(acct_id[name], r["amount"], r["date"], "normal", r["desc"], None)
            if r["amount"] < 0:
                env = rules.get(merchant_key(r["desc"]))
                if env:
                    add_alloc(tid, env, r["amount"])
                    attributed += 1
                else:
                    unallocated_spend += 1

    tables = {
        "households": [], "accounts": accounts, "envelopes": [],
        "transfers": transfers, "envelope_transfers": [],
        "templates": [], "template_lines": [],
        "recurring_transactions": [], "recurring_lines": [],
        "transactions": transactions, "allocations": allocations,
        "reconciliations": [], "envelope_targets": [], "credit_limits": [], "loan_principals": [],
    }
    stats = {"view": view, "anchors": anchors, "pairs": len(pairs),
             "attributed": attributed, "unallocated_spend": unallocated_spend,
             "rules": len(rules)}
    return tables, stats


def write_report(tables: dict, stats: dict) -> None:
    view = stats["view"]
    lines = ["# Statement Extraction Report — bank PDFs → Budgeteer (statement era)", "",
             f"Cut (D1): rows dated **after {CUT}** imported. Source: `bank-statements/` (20 PDFs).",
             "", "## Per-account reconciliation (integer cents)", "",
             "| Account | Kind | Anchor@cut | Post-cut rows | Closing | Anchor+Σpost == Closing |",
             "| --- | --- | ---: | ---: | ---: | :---: |"]
    for name, v in view.items():
        post_sum = sum(r["amount"] for r in v["post"])
        ok = "✅" if v["anchor"] + post_sum == v["closing"] else "❌"
        lines.append(f"| {name} | {v['kind']} | {v['anchor']} | {len(v['post'])} | "
                     f"{v['closing']} | {ok} |")
    txns = tables["transactions"]
    kinds = Counter(t["kind"] for t in txns)
    lines += ["", "## Generated rows", "",
              f"- accounts: **{len(tables['accounts'])}**",
              f"- transactions: **{len(txns)}** "
              f"({kinds.get('opening', 0)} opening + {kinds.get('normal', 0)} normal + "
              f"{kinds.get('transfer', 0)} transfer legs)",
              f"- transfers (parents): **{len(tables['transfers'])}** "
              f"(= {stats['pairs']} intra-CO pairs; both directions — see D4 note)",
              f"- allocations: **{len(tables['allocations'])}**",
              "", "## Attribution (D3)", "",
              f"- rules loaded: **{stats['rules']}** merchant keys",
              f"- spend rows attributed: **{stats['attributed']}**",
              f"- spend rows left unallocated (needs-allocation): **{stats['unallocated_spend']}**",
              "", "_Gitignored — carries real amounts (SECURITY.md / K27)._", ""]
    OUT_REPORT.write_text("\n".join(lines))


def main() -> None:
    rules_path = None
    if "--rules" in sys.argv:
        i = sys.argv.index("--rules")
        rules_path = Path(sys.argv[i + 1]) if i + 1 < len(sys.argv) else RULES_FILE
    tables, stats = build(rules_path)
    OUT_TABLES.write_text(json.dumps({"meta": {
        "schema_name": "budgeteer", "schema_version": "V1",
        "source": "bank-statements (20 PDFs)", "cut": CUT,
        "money_unit": "integer minor units (US cents)",
        "household_id": DEFAULT_HOUSEHOLD_ID}, "tables": tables}, indent=2))
    write_report(tables, stats)
    print(f"wrote {OUT_TABLES.name} and {OUT_REPORT.name}")
    print(f"  accounts={len(tables['accounts'])} transactions={len(tables['transactions'])} "
          f"transfers={len(tables['transfers'])} allocations={len(tables['allocations'])}")
    for name, v in stats["view"].items():
        print(f"  {name}: anchor={v['anchor']} post={len(v['post'])} closing={v['closing']}")


if __name__ == "__main__":
    main()
