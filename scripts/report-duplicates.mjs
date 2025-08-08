import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const outPath = path.join(projectRoot, "content", "report-duplicates.json");

function normalizePattern(s) {
  return String(s || "")
    .replace(/[\s·]/g, "") // remove spaces and middot
    .replace(/[()]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function normalizedKey(it) {
  return `${it.chapter}::${normalizePattern(it.pattern)}`;
}

function levenshtein(a, b) {
  // Simple Levenshtein distance for short strings
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items)
    ? data.items.map((it, idx) => ({ ...it, __index: idx }))
    : [];

  // Exact duplicates by normalized key
  const map = new Map();
  for (const it of items) {
    const key = normalizedKey(it);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  const exactDuplicates = Array.from(map.values()).filter(
    (arr) => arr.length > 1
  );

  // Near-duplicates within same chapter based on small Levenshtein distance of normalized patterns
  const near = [];
  const byChapter = new Map();
  for (const it of items) {
    const arr = byChapter.get(it.chapter) || [];
    arr.push(it);
    byChapter.set(it.chapter, arr);
  }
  for (const [chapter, arr] of byChapter.entries()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = normalizePattern(arr[i].pattern);
        const b = normalizePattern(arr[j].pattern);
        const dist = levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length) || 1;
        const ratio = dist / maxLen;
        if (ratio <= 0.25 && a !== b) {
          near.push({
            chapter,
            aIndex: arr[i].__index,
            aPattern: arr[i].pattern,
            bIndex: arr[j].__index,
            bPattern: arr[j].pattern,
            distance: dist,
            ratio,
          });
        }
      }
    }
  }

  const report = {
    totalItems: items.length,
    exactDuplicateGroups: exactDuplicates.length,
    exactDuplicates: exactDuplicates.map((group) =>
      group.map(({ __index, chapter, pattern }) => ({
        __index,
        chapter,
        pattern,
      }))
    ),
    nearDuplicatesCount: near.length,
    nearDuplicates: near,
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main();
