#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const GRAMMAR_PATH = path.join(ROOT, "grammar.json");
const BROKEN_REPORT_PATH = path.join(
  ROOT,
  "content",
  "report-broken-links.json"
);
const CHANGES_REPORT_PATH = path.join(
  ROOT,
  "content",
  "report-broken-links-fixed.json"
);

function placeholderFor(pattern) {
  const q = encodeURIComponent((pattern || "").trim());
  return {
    type: "article",
    url: `https://www.howtostudykorean.com/?s=${q}`,
    title: `HowToStudyKorean: ${pattern} 검색`,
    channel: "",
  };
}

async function loadJson(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function saveJson(p, obj) {
  const txt = JSON.stringify(obj, null, 2);
  await fs.writeFile(p, txt, "utf8");
}

function key(chapter, pattern) {
  return `${chapter}::${(pattern || "").trim()}`;
}

async function run() {
  const brokenReport = await loadJson(BROKEN_REPORT_PATH);
  const brokenList = (brokenReport?.results || []).filter((r) =>
    ["broken", "invalid", "timeout", "error"].includes(r.status)
  );

  if (brokenList.length === 0) {
    console.log("No broken links to remove.");
    return;
  }

  const brokenByItem = new Map();
  for (const r of brokenList) {
    const k = key(r.chapter, r.pattern);
    if (!brokenByItem.has(k)) brokenByItem.set(k, new Set());
    brokenByItem.get(k).add(r.url);
  }

  const grammar = await loadJson(GRAMMAR_PATH);
  const items = Array.isArray(grammar) ? grammar : grammar.items || [];

  const changes = [];
  for (const item of items) {
    const k = key(item.chapter, item.pattern);
    const urls = brokenByItem.get(k);
    if (!urls || !Array.isArray(item.resources)) continue;
    const before = item.resources.length;
    const removed = [];
    item.resources = item.resources.filter((r) => {
      const match = urls.has((r?.url || "").trim());
      if (match) removed.push(r);
      return !match;
    });

    if (removed.length > 0) {
      // Ensure placeholder if now empty
      if (item.resources.length === 0) {
        item.resources = [placeholderFor(item.pattern)];
      }
      changes.push({
        chapter: item.chapter,
        pattern: item.pattern,
        removedCount: removed.length,
        beforeCount: before,
        afterCount: item.resources.length,
        removedUrls: removed.map((r) => r.url),
      });
    }
  }

  // Persist
  if (Array.isArray(grammar)) {
    await saveJson(GRAMMAR_PATH, items);
  } else {
    grammar.items = items;
    await saveJson(GRAMMAR_PATH, grammar);
  }

  await saveJson(CHANGES_REPORT_PATH, {
    generatedAt: new Date().toISOString(),
    removedLinks: brokenList.length,
    affectedItems: changes.length,
    changes,
  });

  console.log(
    JSON.stringify(
      {
        fixedReport: "content/report-broken-links-fixed.json",
        removedLinks: brokenList.length,
        affectedItems: changes.length,
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
