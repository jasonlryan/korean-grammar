#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const GRAMMAR_PATH = path.join(ROOT, "grammar.json");
const INCOMING_PATH = path.join(ROOT, "content", "incoming-resources.json");

function toResource(url) {
  if (!url || url === "CANNOT_FIND") return null;
  try {
    const u = new URL(url);
    const isYoutube =
      u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be");
    return {
      type: isYoutube ? "video" : "article",
      url,
      title: "",
      channel: "",
    };
  } catch {
    return null;
  }
}

async function loadJson(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function saveJson(p, obj) {
  const txt = JSON.stringify(obj, null, 2);
  await fs.writeFile(p, txt, "utf8");
}

async function run() {
  const incoming = await loadJson(INCOMING_PATH);
  const data = await loadJson(GRAMMAR_PATH);
  const items = Array.isArray(data) ? data : data.items || [];

  const applied = [];
  for (const row of incoming) {
    const idx = row.__index;
    const url = row.resource;
    const res = toResource(url);
    if (res && items[idx]) {
      items[idx].resources = items[idx].resources || [];
      items[idx].resources.unshift(res);
      applied.push({ index: idx, pattern: items[idx].pattern, url });
    }
  }

  if (Array.isArray(data)) {
    await saveJson(GRAMMAR_PATH, items);
  } else {
    data.items = items;
    await saveJson(GRAMMAR_PATH, data);
  }

  console.log(JSON.stringify({ applied: applied.length }, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
