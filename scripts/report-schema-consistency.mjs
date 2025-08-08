import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const outPath = path.join(
  projectRoot,
  "content",
  "report-schema-consistency.json"
);

// Expected keys and types
const EXPECTED = {
  chapter: "number",
  title: "string",
  subtitle: "string",
  pattern: "string",
  example: "string",
  exampleEn: "string",
  description: "string",
  tip: "string",
  resources: "array",
};

// Legacy keys we want to eliminate (should be migrated into resources)
const LEGACY_KEYS = [
  "videoUrl",
  "videoTitle",
  "resourceUrl",
  "resourceTitle",
  "resourceType",
  "resourceNote",
  "videos",
];

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items)
    ? data.items.map((it, idx) => ({ ...it, __index: idx }))
    : [];

  const schemaIssues = [];
  const legacyHits = [];

  for (const it of items) {
    // Type checks
    for (const [key, type] of Object.entries(EXPECTED)) {
      if (it[key] === undefined) continue; // field can be absent
      const isArray = Array.isArray(it[key]);
      const actualType = isArray ? "array" : typeof it[key];
      if (actualType !== type) {
        schemaIssues.push({
          __index: it.__index,
          chapter: it.chapter,
          pattern: it.pattern,
          field: key,
          expected: type,
          got: actualType,
        });
      }
    }
    // Legacy fields
    for (const k of LEGACY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(it, k)) {
        legacyHits.push({
          __index: it.__index,
          chapter: it.chapter,
          pattern: it.pattern,
          field: k,
          value: it[k],
        });
      }
    }
  }

  const report = {
    totalItems: items.length,
    schemaIssuesCount: schemaIssues.length,
    legacyFieldInstances: legacyHits.length,
    schemaIssues,
    legacyHits,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
