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
const CROSSWALK = join(DOCS, "reviews", "2026-07-12-roadmap-artifact-crosswalk.md");
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
function build(): { markdown: string; problems: Problem[]; covered: number; total: number } {
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
  const markdown = `<!--
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
  return { markdown, problems, covered, total };
}

/** Validate core docs' frontmatter: a recognized `type`, and `id` for ADR instances. */
function checkCore(): { problems: Problem[]; total: number } {
  const problems: Problem[] = [];
  const files = [
    ...readdirSync(DOCS).filter((f) => f.endsWith(".md")),
    ...readdirSync(join(DOCS, "adr"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `adr/${f}`),
  ];
  for (const rel of files) {
    const fm = parseFrontmatter(readFileSync(join(DOCS, rel), "utf8"));
    if (!fm) {
      problems.push({ file: `docs/${rel}`, msg: "no frontmatter" });
      continue;
    }
    if (typeof fm.type !== "string" || !CORE_TYPES.has(fm.type))
      problems.push({ file: `docs/${rel}`, msg: `unknown/missing core type "${fm.type ?? ""}"` });
    if (fm.type === "adr" && !fm.id) problems.push({ file: `docs/${rel}`, msg: "adr missing id" });
  }
  return { problems, total: files.length };
}

function main() {
  const write = process.argv.includes("--write");
  const { markdown, problems, covered, total } = build();

  if (write) {
    writeFileSync(CROSSWALK, markdown);
    console.log(`docs:crosswalk — wrote ${CROSSWALK} (${covered}/${total} artifacts)`);
    return;
  }

  const drift = readFileSync(CROSSWALK, "utf8") !== markdown;
  if (drift)
    problems.push({
      file: CROSSWALK,
      msg: "crosswalk is stale — run `npm run docs:crosswalk` and commit",
    });

  const core = checkCore();
  problems.push(...core.problems);

  if (problems.length === 0) {
    console.log(
      `docs:check — OK (${covered}/${total} artifacts + ${core.total} core docs self-describing, crosswalk in sync)`,
    );
    return;
  }
  console.error(`docs:check — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p.file}: ${p.msg}`);
  process.exit(1);
}

main();
