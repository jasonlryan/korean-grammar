import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");

function main() {
  const raw = fs.readFileSync(grammarPath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data.items) ? data.items.slice() : [];
  items.sort((a, b) => {
    const ca = Number(a.chapter) || 0;
    const cb = Number(b.chapter) || 0;
    if (ca !== cb) return ca - cb;
    const pa = String(a.pattern || "");
    const pb = String(b.pattern || "");
    return pa.localeCompare(pb);
  });
  const out = { ...data, items };
  fs.writeFileSync(grammarPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`Sorted ${items.length} items by chapter → pattern.`);
}

main();
