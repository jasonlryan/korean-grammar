import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const updatesPath = path.join(projectRoot, "content", "updates.json");
const incomingPath = path.join(
  projectRoot,
  "content",
  "incoming-exampleEn.json"
);

function main() {
  const incoming = JSON.parse(fs.readFileSync(incomingPath, "utf8"));
  const existing = JSON.parse(fs.readFileSync(updatesPath, "utf8"));

  const merged = [...existing];
  for (const it of incoming) {
    // Only update translations; ignore any video/link fields
    const update = {
      chapter: it.chapter,
      pattern: it.pattern,
      exampleEn: it.exampleEn,
    };
    merged.push(update);
  }

  fs.writeFileSync(updatesPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(
    `Merged translations for ${incoming.length} entries into updates.json (now ${merged.length} total).`
  );
}

main();
