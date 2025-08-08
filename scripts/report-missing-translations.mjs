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
  "report-missing-translations.json"
);

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items)
    ? data.items.map((it, idx) => ({ ...it, __index: idx }))
    : [];

  const missing = items.filter(
    (it) => !it.exampleEn || String(it.exampleEn).trim() === ""
  );

  const report = {
    totalItems: items.length,
    missingCount: missing.length,
    items: missing.map(({ __index, chapter, pattern, example }) => ({
      __index,
      chapter,
      pattern,
      example,
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
