import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const contentDir = path.join(projectRoot, "content");
const outAPath = path.join(contentDir, "missing-exampleEn.json");
const outBPath = path.join(contentDir, "missing-by-chapter.json");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  ensureDir(contentDir);
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items) ? data.items : [];

  const missing = items
    .map((it, idx) => ({ ...it, __index: idx }))
    .filter((it) => !it.exampleEn || String(it.exampleEn).trim() === "");

  const listTemplate = missing
    .sort(
      (a, b) =>
        (a.chapter || 0) - (b.chapter || 0) ||
        String(a.pattern).localeCompare(String(b.pattern))
    )
    .map(({ __index, chapter, title, subtitle, pattern, example }) => ({
      __index,
      chapter,
      title,
      subtitle,
      pattern,
      example,
      exampleEn: "",
    }));

  const grouped = {};
  for (const it of missing) {
    const chapter = it.chapter ?? "unknown";
    if (!grouped[chapter]) grouped[chapter] = [];
    grouped[chapter].push({
      __index: it.__index,
      pattern: it.pattern,
      example: it.example,
      exampleEn: "",
    });
  }

  fs.writeFileSync(
    outAPath,
    JSON.stringify(listTemplate, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(outBPath, JSON.stringify(grouped, null, 2) + "\n", "utf8");

  console.log(`Missing exampleEn: ${missing.length}`);
  console.log(`Wrote list: ${outAPath}`);
  console.log(`Wrote grouped: ${outBPath}`);
}

main();
