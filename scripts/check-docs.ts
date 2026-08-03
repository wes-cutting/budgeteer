/**
 * Docs frontmatter tooling (K30 Part A + Part B).
 *
 * Every artifact under docs/{status-reports,spikes,features,ux} carries YAML frontmatter
 * (`id` · `type` · `roadmap-item` · `status`); the core docs (docs/*.md + adr/ + reviews/)
 * carry `id` + `type` but no `roadmap-item`. This tool:
 *   - `npm run docs:crosswalk` (--write) — regenerates docs/reviews/2026-07-12-roadmap-artifact-crosswalk.md
 *     FROM that frontmatter, so the index is derived from the docs, not hand-maintained.
 *   - `npm run docs:check` (default) — validates the frontmatter, the stable `id` of every
 *     doc, and that every inter-doc link resolves; fails if the committed crosswalk is
 *     stale. Wired into the gate so the metadata and the cross-references can't silently rot.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, dirname, relative, resolve } from "node:path";

const DOCS = "docs";
const PLAN = join(DOCS, "03_ROADMAP.md");
const HIST = join(DOCS, "03_ROADMAP-HISTORY.md");
const CROSSWALK = join(DOCS, "reviews", "2026-07-12-roadmap-artifact-crosswalk.md");
const DONE_MARKER = "## 2. Done / shipped";
// Where each generated file lives, as a docs-relative directory — the generator emits links
// into BOTH, so the `../` prefix has to come from the output file, not be hardcoded (K30
// Part B: hardcoding it broke all 89 report links in the history's §2 while the gate said OK).
const CROSSWALK_DIR = "reviews";
const HIST_DIR = "";
const TYPE_DIR: Record<string, string> = {
  features: "feature-spec",
  ux: "ux-spec",
  spikes: "spike",
  "status-reports": "status-report",
};
// Core reference/standard/process docs (docs/*.md + docs/adr/*.md) — not per-roadmap-item;
// they just need a recognized `type` (+ `id` for ADRs).
const CORE_TYPES = new Set([
  "process",
  "intake",
  "prd",
  "roadmap",
  "reference",
  "standard",
  "index",
  "adr",
  "template",
  "feedback-log",
]);
// reviews/ genre taxonomy (K32): point-in-time audit · multi-item initiative · advisory
// working-note · machine-generated.
const REVIEW_TYPES = new Set(["audit", "initiative", "working-note", "generated"]);
const EPIC_TITLES: Record<string, string> = {
  "BUD-E1": "Foundation & stack",
  "BUD-E2": "Core budgeting domain",
  "BUD-E3": "Analysis & Insights data",
  "BUD-E4": "Engineering health",
  "BUD-E5": "Security hardening",
  "BUD-E6": "UX polish",
  "BUD-E7": "Developer experience",
  "BUD-E8": "UX Uplift",
  "BUD-E9": "Sheet parity",
  "BUD-E10": "UX Redesign",
  "BUD-E11": "Hardening",
  "BUD-E12": "Data & history import",
  "BUD-E13": "Multi-user / household scoping",
  "BUD-E14": "Hub deployment readiness",
};

type Meta = { type: string; title: string; was: string; epic: string };
type Frontmatter = Record<string, string | string[]>;

function listMd(dir: string): string[] {
  return readdirSync(join(DOCS, dir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `${dir}/${f}`);
}

function parseFrontmatter(text: string): Frontmatter | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const fm: Frontmatter = {};
  for (const line of text.slice(4, end).split("\n")) {
    const m = /^([\w-]+):\s*(.+)$/.exec(line);
    const k = m?.[1];
    const raw = m?.[2];
    if (k === undefined || raw === undefined) continue;
    fm[k] =
      raw.startsWith("[") && raw.endsWith("]")
        ? raw
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : raw.trim();
  }
  return fm;
}

function items(fm: Frontmatter): string[] {
  const v = fm["roadmap-item"];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** Parse the roadmap's §2 crosswalk for id metadata + the set of valid ids. */
function parsePlan(): { meta: Map<string, Meta>; valid: Set<string> } {
  const meta = new Map<string, Meta>();
  const valid = new Set<string>(Object.keys(EPIC_TITLES));
  let inCw = false;
  for (const l of readFileSync(PLAN, "utf8").split("\n")) {
    if (l.startsWith("## 2.")) inCw = true;
    else if (inCw && l.startsWith("## 3.")) break;
    else if (inCw && l.startsWith("| `")) {
      const c = l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((x) => x.trim());
      // Five cells, the first a backticked id — the `undefined` checks are what `c.length >= 5`
      // used to assert (split() never leaves holes), stated per-cell so each one narrows.
      const [rawId, type, title, rawWas, epic] = c;
      if (
        rawId !== undefined &&
        type !== undefined &&
        title !== undefined &&
        rawWas !== undefined &&
        epic !== undefined &&
        rawId.startsWith("`")
      ) {
        const id = rawId.replace(/`/g, "");
        meta.set(id, { type, title, was: rawWas.replace(/`/g, ""), epic });
        valid.add(id);
      }
    }
  }
  for (const [id, t] of Object.entries(EPIC_TITLES))
    if (!meta.has(id)) meta.set(id, { type: "epic", title: t, was: "—", epic: t });
  return { meta, valid };
}

const kindOf = (p: string): string => p.split("/")[0] ?? p;

/** Docs-relative artifact path → a link target relative to the generated file that carries it.
 *  `fromDir` is the output file's own docs-relative directory ("" for docs/*.md). */
const linkTarget = (fromDir: string, p: string): string => (fromDir ? relative(fromDir, p) : p);

function idSort(a: string, b: string): number {
  const rank = (n: string): [number, number] => {
    const m = /^BUD-([EST])(\d+)/.exec(n);
    if (m) return [{ E: 0, S: 1, T: 2 }[m[1] ?? ""] ?? 9, Number(m[2])];
    const s = /^SPIKE-(\d+)/.exec(n);
    return [3, s ? Number(s[1]) : 0];
  };
  const [ra, na] = rank(a);
  const [rb, nb] = rank(b);
  return ra - rb || na - nb;
}

type Problem = { file: string; msg: string };

/** Read every artifact's frontmatter; build the crosswalk markdown + any problems. */
function build(): {
  markdown: string;
  problems: Problem[];
  covered: number;
  total: number;
  idToArts: Map<string, Set<string>>;
  meta: Map<string, Meta>;
} {
  const { meta, valid } = parsePlan();
  const artToIds = new Map<string, string[]>();
  const idToArts = new Map<string, Set<string>>();
  const status = new Map<string, string>();
  const problems: Problem[] = [];
  let total = 0;

  for (const [dir, expectedType] of Object.entries(TYPE_DIR)) {
    for (const rel of listMd(dir)) {
      total++;
      const fm = parseFrontmatter(readFileSync(join(DOCS, rel), "utf8"));
      if (!fm) {
        problems.push({ file: rel, msg: "no frontmatter" });
        continue;
      }
      if (fm.type !== expectedType)
        problems.push({ file: rel, msg: `type "${fm.type ?? ""}" != "${expectedType}"` });
      const ids = items(fm);
      if (ids.length === 0) problems.push({ file: rel, msg: "no roadmap-item" });
      for (const id of ids) {
        if (!valid.has(id))
          problems.push({ file: rel, msg: `roadmap-item "${id}" not in roadmap §2` });
        (idToArts.get(id) ?? idToArts.set(id, new Set()).get(id)!).add(rel);
      }
      if (ids.length) artToIds.set(rel, ids);
      if (typeof fm.status === "string") status.set(rel, fm.status);
    }
  }

  const arts = (id: string, ...kinds: string[]) => {
    const out = [...(idToArts.get(id) ?? [])]
      .filter((p) => kinds.includes(kindOf(p)))
      .sort()
      .map((p) => `[${basename(p)}](${linkTarget(CROSSWALK_DIR, p)})`);
    return out.join(" · ") || "—";
  };
  const label = (id: string) => (meta.has(id) ? `\`${id}\` (${meta.get(id)!.was})` : `\`${id}\``);

  const fwd = [
    "| New ID | Was | Title | Feature/UX spec | Spike | Status report(s) |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const id of [...idToArts.keys()].sort(idSort)) {
    const m = meta.get(id) ?? { was: "", title: "" };
    fwd.push(
      `| \`${id}\` | \`${m.was}\` | ${m.title} | ${arts(id, "features", "ux")} | ${arts(id, "spikes")} | ${arts(id, "status-reports")} |`,
    );
  }

  const rev = ["| Artifact | Status | → Roadmap id(s) |", "| --- | --- | --- |"];
  for (const p of [...artToIds.keys()].sort(
    (a, b) => kindOf(a).localeCompare(kindOf(b)) || a.localeCompare(b),
  )) {
    const ids = [...artToIds.get(p)!].sort(idSort).map(label).join(" · ");
    rev.push(`| [\`${p}\`](${linkTarget(CROSSWALK_DIR, p)}) | ${status.get(p) ?? "—"} | ${ids} |`);
  }

  const covered = artToIds.size;
  const bad = problems.filter((p) => p.msg === "no frontmatter" || p.msg === "no roadmap-item");
  const markdown = `---
id: REV-2026-07-12-roadmap-artifact-crosswalk
type: generated
status: Generated
---
<!--
Artifact crosswalk — Follow-up B of the 2026-07-12 restructure initiative, now GENERATED
FROM DOC FRONTMATTER (K30 Part A) by scripts/check-docs.ts. Each artifact declares its own
type/roadmap-item/status; this file is regenerated from that (\`npm run docs:crosswalk\`) and
validated in the gate (\`npm run docs:check\`). Do not hand-edit. Id metadata from 03_ROADMAP.md §2.
-->

# Artifact crosswalk — reports · spikes · specs ↔ BUD-* ids

| Field   | Value          |
| ------- | -------------- |
| Status  | Generated (do not hand-edit — \`npm run docs:crosswalk\`) |
| Owner   | Wesley Cutting |
| Date    | 2026-07-12     |
| Parent  | [2026-07-12 restructure initiative](2026-07-12-roadmap-restructure-initiative.md) (Follow-up B) |
| Source  | **doc frontmatter** (\`type\` · \`roadmap-item\` · \`status\`) across \`status-reports/ · spikes/ · features/ · ux/\`; id metadata from [\`03_ROADMAP.md\`](../03_ROADMAP.md) §2 |

## What this is

The back-reference bridge, **self-describing and generated**: every artifact carries
\`roadmap-item:\` frontmatter (K30 Part A), so this index is *derived from the docs themselves*.
Add a doc with correct frontmatter and it appears here on the next \`npm run docs:crosswalk\`;
\`npm run docs:check\` (in the gate) fails if any artifact's frontmatter is missing/dangling or
if this file drifts from the docs.

**Additive/reversible:** the artifact files keep their legacy names and old-id headers; only a
small frontmatter block was prepended. Filename/id renames stay a **cutover** task.

## 1. Forward — each roadmap item → its artifacts

${fwd.join("\n")}

## 2. Reverse — each artifact → its roadmap id (and its declared status)

${rev.join("\n")}

## 3. Coverage

- **${covered}** of **${total}** artifact files carry a \`roadmap-item\` in their frontmatter
  and appear above — **self-describing**, no supplement, no roadmap-link dependency.
- **${bad.length}** with a frontmatter problem (see \`npm run docs:check\`).
`;
  return { markdown, problems, covered, total, idToArts, meta };
}

/** Newest YYYY-MM-DD found across a set of dated status-report filenames. */
function shippedDate(reports: string[]): string {
  const dates = reports
    .map((r) => /(\d{4}-\d{2}-\d{2})/.exec(r)?.[1] ?? "")
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? "";
}

/** Generate history §2 (Done/shipped) from the plan's Done stories, newest first.
 *  A story ships when its plan row's status cell begins with "Done" / "✅ Done"; the shipped
 *  date is its newest linked status report. Regenerated, not hand-maintained. */
function doneLedger(idToArts: Map<string, Set<string>>, meta: Map<string, Meta>): string {
  let inPlan = false;
  const shipped: string[] = [];
  for (const l of readFileSync(PLAN, "utf8").split("\n")) {
    if (l.startsWith("## 3.")) inPlan = true;
    else if (inPlan && l.startsWith("## 4.")) break;
    else if (inPlan && l.startsWith("| **BUD-S")) {
      const id = /BUD-S\d+/.exec(l)?.[0];
      const done = /\|\s*\*{0,2}(?:✅\s*)?\*{0,2}Done\b/.test(l);
      if (id && done) shipped.push(id);
    }
  }
  const rows = shipped
    .map((id) => {
      const reports = [...(idToArts.get(id) ?? [])]
        .filter((p) => p.startsWith("status-reports/"))
        .sort();
      const m = meta.get(id);
      return {
        id,
        date: shippedDate(reports),
        was: m?.was ?? "",
        title: m?.title ?? "",
        report: reports.at(-1) ? `[report](${linkTarget(HIST_DIR, reports.at(-1)!)})` : "—",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || idSort(b.id, a.id));
  const body = rows
    .map((r) => `| ${r.date || "—"} | \`${r.id}\` | \`${r.was}\` | ${r.title} | ${r.report} |`)
    .join("\n");
  return `${DONE_MARKER} (generated)

Every shipped story (plan status **Done**), newest first — **generated from the plan** by
\`npm run docs:crosswalk\`, so it can't drift; do not hand-edit. Shipped date = the item's
newest linked status report. Full detail lives in the plan (${"`03_ROADMAP.md`"} §3) and the
§1 log above.

| Shipped | ID | Was | Item | Report |
| --- | --- | --- | --- | --- |
${body}
`;
}

/** History with a freshly generated §2 spliced in (§0/§1 untouched). */
function historyWith(ledger: string): string {
  const text = readFileSync(HIST, "utf8");
  return text.slice(0, text.indexOf(DONE_MARKER)) + ledger;
}

/** Validate a set of docs' frontmatter against an allowed `type` set (+ `id` for ADRs). */
function checkDocs(files: string[], allowed: Set<string>): Problem[] {
  const problems: Problem[] = [];
  for (const rel of files) {
    const fm = parseFrontmatter(readFileSync(join(DOCS, rel), "utf8"));
    if (!fm) {
      problems.push({ file: `docs/${rel}`, msg: "no frontmatter" });
      continue;
    }
    if (typeof fm.type !== "string" || !allowed.has(fm.type))
      problems.push({ file: `docs/${rel}`, msg: `unknown/missing type "${fm.type ?? ""}"` });
    if (fm.type === "adr" && !fm.id) problems.push({ file: `docs/${rel}`, msg: "adr missing id" });
  }
  return problems;
}

/** Non-artifact docs: core reference/standard docs (+ ADRs) and reviews (genre taxonomy). */
function checkNonArtifact(): { problems: Problem[]; total: number } {
  const core = [
    ...readdirSync(DOCS).filter((f) => f.endsWith(".md")),
    ...readdirSync(join(DOCS, "adr"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `adr/${f}`),
  ];
  const reviews = readdirSync(join(DOCS, "reviews"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `reviews/${f}`);
  const problems = [...checkDocs(core, CORE_TYPES), ...checkDocs(reviews, REVIEW_TYPES)];
  return { problems, total: core.length + reviews.length };
}

// ---------------------------------------------------------------------------
// K30 Part B — stable typed ids + link integrity
// ---------------------------------------------------------------------------

/** Each doc `type` maps to exactly one id prefix, so an id announces its own kind of doc.
 *  Ids are STABLE: they survive a rename, which is the whole point — the file can move
 *  without every reference to the doc cascading (K30 Part B, and what `BUD-S94` needs). */
const ID_PREFIX: Record<string, string> = {
  adr: "ADR",
  spike: "SPIKE",
  "feature-spec": "FEAT",
  "ux-spec": "UX",
  "status-report": "SR",
  audit: "REV",
  initiative: "REV",
  "working-note": "REV",
  generated: "REV",
  process: "DOC",
  intake: "DOC",
  prd: "DOC",
  roadmap: "DOC",
  reference: "DOC",
  standard: "DOC",
  index: "DOC",
  template: "DOC",
  "feedback-log": "DOC",
};
const ID_RE = /^[A-Z]+-[A-Za-z0-9][A-Za-z0-9-]*$/;
/** Dated records — status reports and spike reports (snapshots), reviews (point-in-time), and
 *  ADRs (append-only). Code moves underneath them, and rewriting a 2026-06-22 snapshot to chase
 *  a later refactor falsifies the record, so a link to a path OUTSIDE docs/ is allowed to have
 *  moved (it is counted and listed on every run, never silent). Doc→doc links stay strict
 *  everywhere: every .md in this repo exists, so a broken one is always rot. */
const HISTORICAL_TYPES = new Set([
  "status-report",
  "spike",
  "adr",
  "audit",
  "initiative",
  "working-note",
]);

const LINK_RE = /\[(?:[^\]\\]|\\.)*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FENCE_RE = /^\s*(?:```|~~~)/;

function walkMd(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walkMd(p) : e.name.endsWith(".md") ? [p] : [];
  });
}

/** Markdown link targets in a file, skipping fenced code — a fenced kickoff prompt or a
 *  template example is sample text, not a live reference. */
function linksIn(text: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (FENCE_RE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const m of line.matchAll(LINK_RE)) if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

/** A link target as a repo path, or null when it addresses no file (external URL, in-page
 *  anchor). A trailing `:227` is this repo's line-reference convention (`api.ts:227` means
 *  "line 227 of that file") — prose, not part of the filename, so it is stripped before the
 *  file is checked. Unknown URL schemes deliberately fall through and fail as paths. */
function targetPath(raw: string): string | null {
  if (/^(?:https?|mailto|tel|ftp):/i.test(raw) || raw.startsWith("//") || raw.startsWith("#"))
    return null;
  const path = (raw.split("#")[0] ?? "").replace(/(\.[A-Za-z0-9]+):\d+$/, "$1");
  return path || null;
}

/** Every doc under docs/ carries a stable, unique, well-formed, type-matching `id`. */
function checkIds(): { problems: Problem[]; total: number } {
  const problems: Problem[] = [];
  const seen = new Map<string, string>();
  const files = walkMd(DOCS);
  for (const file of files) {
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    if (!fm) {
      // This walk is the only recursive one, so it is the net that catches a doc no other
      // check looks at (docs/ux/assets/README.md was exactly that until 2026-08-02).
      problems.push({ file, msg: "no frontmatter" });
      continue;
    }
    const id = fm.id;
    const type = typeof fm.type === "string" ? fm.type : "";
    if (typeof id !== "string" || !id) {
      problems.push({ file, msg: "missing id" });
      continue;
    }
    if (!ID_RE.test(id)) {
      problems.push({
        file,
        msg: `malformed id "${id}" (want e.g. ADR-0003 · SR-2026-08-02-slug)`,
      });
      continue;
    }
    const want = ID_PREFIX[type];
    if (want !== undefined && !id.startsWith(`${want}-`))
      problems.push({ file, msg: `id "${id}" should start with "${want}-" for type "${type}"` });
    const first = seen.get(id);
    if (first !== undefined) problems.push({ file, msg: `duplicate id "${id}" (also ${first})` });
    else seen.set(id, file);
  }
  return { problems, total: files.length };
}

/** Every inter-doc link resolves. Sources: docs/** plus the repo-root docs that point into it. */
function checkLinks(): { problems: Problem[]; stale: Problem[]; total: number } {
  const problems: Problem[] = [];
  const stale: Problem[] = [];
  const docsRoot = resolve(DOCS);
  const sources = [...readdirSync(".").filter((f) => f.endsWith(".md")), ...walkMd(DOCS)];
  let total = 0;
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    const type = typeof fm?.type === "string" ? fm.type : "";
    for (const raw of linksIn(text)) {
      const p = targetPath(raw);
      if (p === null) continue;
      total++;
      const abs = resolve(dirname(file), p);
      if (existsSync(abs)) continue;
      const insideDocs = !relative(docsRoot, abs).startsWith("..");
      const isDocRef = p.endsWith(".md") || insideDocs;
      if (!isDocRef && HISTORICAL_TYPES.has(type)) stale.push({ file, msg: `moved → ${raw}` });
      else problems.push({ file, msg: `broken link → ${raw}` });
    }
  }
  return { problems, stale, total };
}

function main() {
  const write = process.argv.includes("--write");
  const { markdown, problems, covered, total, idToArts, meta } = build();
  const history = historyWith(doneLedger(idToArts, meta));

  if (write) {
    writeFileSync(CROSSWALK, markdown);
    writeFileSync(HIST, history);
    console.log(`docs:crosswalk — wrote ${CROSSWALK} + ${HIST} §2 (${covered}/${total} artifacts)`);
    return;
  }

  if (readFileSync(CROSSWALK, "utf8") !== markdown)
    problems.push({
      file: CROSSWALK,
      msg: "crosswalk is stale — run `npm run docs:crosswalk` and commit",
    });
  if (readFileSync(HIST, "utf8") !== history)
    problems.push({
      file: HIST,
      msg: "history §2 (Done/shipped) is stale — run `npm run docs:crosswalk` and commit",
    });

  const nonArt = checkNonArtifact();
  const ids = checkIds();
  const links = checkLinks();
  problems.push(...nonArt.problems, ...ids.problems, ...links.problems);

  if (problems.length === 0) {
    console.log(
      `docs:check — OK (${covered}/${total} artifacts + ${nonArt.total} core/review docs self-describing, crosswalk in sync)`,
    );
    console.log(`  ids   — ${ids.total} docs, every one a unique typed id`);
    console.log(
      `  links — ${links.total} inter-doc links resolve; ${links.stale.length} moved code path(s) in dated records (allowed — see 00_WAYS_OF_WORKING §4)`,
    );
    for (const s of links.stale) console.log(`          ${s.file}: ${s.msg}`);
    return;
  }
  console.error(`docs:check — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p.file}: ${p.msg}`);
  process.exit(1);
}

main();
