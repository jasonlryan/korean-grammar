import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const outPath = path.join(projectRoot, "content", "report-generic-text.json");

// Generic phrases we want to flag in exampleEn, title, subtitle, tips, resource titles
const GENERIC_PATTERNS = [
  /example\s*usage/i,
  /sample\s*sentence/i,
  /tbd|todo|placeholder/i,
  /translate\s*this/i,
  /coming\s*soon/i,
];

function isGeneric(text) {
  const s = String(text || "");
  if (!s) return false;
  return GENERIC_PATTERNS.some((re) => re.test(s));
}

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items)
    ? data.items.map((it, idx) => ({ ...it, __index: idx }))
    : [];

  const findings = [];
  for (const it of items) {
    const hits = [];
    if (isGeneric(it.exampleEn))
      hits.push({ field: "exampleEn", value: it.exampleEn });
    if (isGeneric(it.title)) hits.push({ field: "title", value: it.title });
    if (isGeneric(it.subtitle))
      hits.push({ field: "subtitle", value: it.subtitle });
    if (isGeneric(it.tip)) hits.push({ field: "tip", value: it.tip });
    if (Array.isArray(it.resources)) {
      it.resources.forEach((r, i) => {
        if (isGeneric(r?.title))
          hits.push({ field: `resources[${i}].title`, value: r?.title });
      });
    }
    if (hits.length) {
      findings.push({
        __index: it.__index,
        chapter: it.chapter,
        pattern: it.pattern,
        hits,
      });
    }
  }

  const report = {
    totalItems: items.length,
    flagged: findings.length,
    items: findings,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
