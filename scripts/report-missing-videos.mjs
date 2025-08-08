import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const outPath = path.join(projectRoot, "content", "report-missing-videos.json");

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items)
    ? data.items.map((it, idx) => ({ ...it, __index: idx }))
    : [];

  const missingVideo = items.filter((it) => {
    const res = Array.isArray(it.resources) ? it.resources : [];
    return !res.some((r) => r && r.type === "video");
  });

  const grouped = {};
  for (const it of missingVideo) {
    const chapter = it.chapter ?? "unknown";
    if (!grouped[chapter]) grouped[chapter] = [];
    grouped[chapter].push({
      __index: it.__index,
      pattern: it.pattern,
      title: it.title,
      example: it.example,
      resourcesLen: Array.isArray(it.resources) ? it.resources.length : 0,
    });
  }

  const report = {
    totalItems: items.length,
    missingVideoCount: missingVideo.length,
    byChapter: grouped,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
