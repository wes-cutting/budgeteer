/**
 * Docs frontmatter tooling (K30 Part A).
 *
 * Every artifact under docs/{status-reports,spikes,features,ux} carries YAML frontmatter
 * (`type` · `roadmap-item` · `status`, +`id` for spikes); the core docs (docs/*.md + adr/)
 * carry `type` (+ `id` for ADRs) but no `roadmap-item`. This tool:
 *   - `npm run docs:crosswalk` (--write) — regenerates docs/reviews/2026-07-12-roadmap-artifact-crosswalk.md
 *     FROM that frontmatter, so the index is derived from the docs, not hand-maintained.
 *   - `npm run docs:check` (default) — validates the frontmatter and fails if the committed
 *     crosswalk is stale. Wired into the gate so the metadata can't silently rot.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const DOCS = "docs";
const V2 = join(DOCS, "03_ROADMAP-v2.md");
const HIST = join(DOCS, "03_ROADMAP-HISTORY-v2.md");
const CROSSWALK = join(DOCS, "reviews", "2026-07-12-roadmap-artifact-crosswalk.md");
const DONE_MARKER = "## 2. Done / shipped";
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
    if (!m) continue;
    const [, k, raw] = m;
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
function parseV2(): { meta: Map<string, Meta>; valid: Set<string> } {
  const meta = new Map<string, Meta>();
  const valid = new Set<string>(Object.keys(EPIC_TITLES));
  let inCw = false;
  for (const l of readFileSync(V2, "utf8").split("\n")) {
    if (l.startsWith("## 2.")) inCw = true;
    else if (inCw && l.startsWith("## 3.")) break;
    else if (inCw && l.startsWith("| `")) {
      const c = l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((x) => x.trim());
      if (c.length >= 5 && c[0].startsWith("`")) {
        const id = c[0].replace(/`/g, "");
        meta.set(id, { type: c[1], title: c[2], was: c[3].replace(/`/g, ""), epic: c[4] });
        valid.add(id);
      }
    }
  }
  for (const [id, t] of Object.entries(EPIC_TITLES))
    if (!meta.has(id)) meta.set(id, { type: "epic", title: t, was: "—", epic: t });
  return { meta, valid };
}

const kindOf = (p: string) => p.split("/")[0];
function idSort(a: string, b: string): number {
  const rank = (n: string): [number, number] => {
    const m = /^BUD-([EST])(\d+)/.exec(n);
    if (m) return [{ E: 0, S: 1, T: 2 }[m[1]] ?? 9, Number(m[2])];
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
  const { meta, valid } = parseV2();
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
      .map((p) => `[${basename(p)}](../${p})`);
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
    rev.push(`| [\`${p}\`](../${p}) | ${status.get(p) ?? "—"} | ${ids} |`);
  }

  const covered = artToIds.size;
  const bad = problems.filter((p) => p.msg === "no frontmatter" || p.msg === "no roadmap-item");
  const markdown = `---
type: generated
status: Generated
---
<!--
Artifact crosswalk — Follow-up B of the 2026-07-12 restructure initiative, now GENERATED
FROM DOC FRONTMATTER (K30 Part A) by scripts/check-docs.ts. Each artifact declares its own
type/roadmap-item/status; this file is regenerated from that (\`npm run docs:crosswalk\`) and
validated in the gate (\`npm run docs:check\`). Do not hand-edit. Id metadata from 03_ROADMAP-v2.md §2.
-->

# Artifact crosswalk — reports · spikes · specs ↔ BUD-* ids

| Field   | Value          |
| ------- | -------------- |
| Status  | Generated (do not hand-edit — \`npm run docs:crosswalk\`) |
| Owner   | Wesley Cutting |
| Date    | 2026-07-12     |
| Parent  | [2026-07-12 restructure initiative](2026-07-12-roadmap-restructure-initiative.md) (Follow-up B) |
| Source  | **doc frontmatter** (\`type\` · \`roadmap-item\` · \`status\`) across \`status-reports/ · spikes/ · features/ · ux/\`; id metadata from [\`03_ROADMAP-v2.md\`](../03_ROADMAP-v2.md) §2 |

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
  for (const l of readFileSync(V2, "utf8").split("\n")) {
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
        report: reports.at(-1) ? `[report](../${reports.at(-1)})` : "—",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || idSort(b.id, a.id));
  const body = rows
    .map((r) => `| ${r.date || "—"} | \`${r.id}\` | \`${r.was}\` | ${r.title} | ${r.report} |`)
    .join("\n");
  return `${DONE_MARKER} (generated)

Every shipped story (plan status **Done**), newest first — **generated from the plan** by
\`npm run docs:crosswalk\`, so it can't drift; do not hand-edit. Shipped date = the item's
newest linked status report. Full detail lives in the plan (${"`03_ROADMAP-v2.md`"} §3) and the
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
  problems.push(...nonArt.problems);

  if (problems.length === 0) {
    console.log(
      `docs:check — OK (${covered}/${total} artifacts + ${nonArt.total} core/review docs self-describing, crosswalk in sync)`,
    );
    return;
  }
  console.error(`docs:check — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p.file}: ${p.msg}`);
  process.exit(1);
}

main();
