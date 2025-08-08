#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const updatesPath = path.join(projectRoot, "content", "updates.json");

function normalize(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .replace(/·/g, "")
    .replace(/—/g, "-")
    .toLowerCase();
}

function mergeItem(base, upd) {
  const out = { ...base };
  const fields = [
    "example",
    "exampleEn",
    "description",
    "tip",
    "title",
    "subtitle",
  ];
  for (const f of fields) {
    if (upd[f] && String(upd[f]).trim() !== "") out[f] = upd[f];
  }
  // merge resources (replace if provided)
  if (Array.isArray(upd.resources) && upd.resources.length > 0) {
    out.resources = upd.resources;
  }
  return out;
}

function main() {
  if (!fs.existsSync(grammarPath)) {
    console.error("grammar.json not found");
    process.exit(1);
  }
  if (!fs.existsSync(updatesPath)) {
    console.error("content/updates.json not found");
    process.exit(1);
  }
  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const items = Array.isArray(grammar?.items) ? grammar.items : [];
  const updates = JSON.parse(fs.readFileSync(updatesPath, "utf8"));

  let updated = 0;
  for (const upd of updates) {
    const idx = items.findIndex(
      (it) =>
        it.chapter === upd.chapter &&
        normalize(it.pattern) === normalize(upd.pattern)
    );
    if (idx >= 0) {
      items[idx] = mergeItem(items[idx], upd);
      updated++;
    } else {
      // If item not found, add it
      const newItem = mergeItem(
        {
          chapter: upd.chapter,
          title: upd.title || `Ch. ${upd.chapter}`,
          subtitle: upd.subtitle || "",
          pattern: upd.pattern,
          example: upd.example || "",
          exampleEn: upd.exampleEn || "",
          description: upd.description || "",
          tip: upd.tip || "",
          resources: upd.resources || [],
        },
        upd
      );
      items.push(newItem);
      updated++;
    }
  }

  fs.writeFileSync(
    grammarPath,
    JSON.stringify({ items }, null, 2) + "\n",
    "utf8"
  );
  console.log(`Applied updates: ${updated}. Total items: ${items.length}`);
}

main();
