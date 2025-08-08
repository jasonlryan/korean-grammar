import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");

const LEGACY_KEYS = [
  "videoUrl",
  "videoTitle",
  "resourceUrl",
  "resourceTitle",
  "resourceType",
  "resourceNote",
  "videos",
  "channel"
];

function isNonEmpty(x) {
  return x !== undefined && String(x).trim() !== "";
}

function toResourcesFromLegacy(item) {
  const out = [];
  if (isNonEmpty(item.videoUrl)) {
    out.push({
      type: "video",
      url: item.videoUrl,
      title: item.videoTitle || "",
      channel: item.channel || ""
    });
  }
  if (isNonEmpty(item.resourceUrl)) {
    out.push({
      type: (item.resourceType || "article").toLowerCase(),
      url: item.resourceUrl,
      title: item.resourceTitle || "",
      channel: item.channel || ""
    });
  }
  if (Array.isArray(item.videos)) {
    for (const v of item.videos) {
      if (v && isNonEmpty(v.url)) {
        out.push({ type: "video", url: v.url, title: v.title || "", channel: v.channel || "" });
      }
    }
  }
  return out;
}

function dedupeResources(resources) {
  const seen = new Set();
  const result = [];
  for (const r of resources) {
    if (!r || !r.url) continue;
    const key = `${(r.type || "").toLowerCase()}::${r.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      type: (r.type || "article").toLowerCase(),
      url: r.url,
      title: r.title || "",
      channel: r.channel || ""
    });
  }
  return result;
}

function main() {
  const data = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const items = Array.isArray(data.items) ? data.items : [];
  let touched = 0;

  for (const it of items) {
    const legacyRes = toResourcesFromLegacy(it);
    if (legacyRes.length > 0) touched++;

    const existing = Array.isArray(it.resources) ? it.resources : [];
    it.resources = dedupeResources([...existing, ...legacyRes]);

    for (const k of LEGACY_KEYS) {
      if (k in it) delete it[k];
    }
  }

  fs.writeFileSync(grammarPath, JSON.stringify({ items }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ cleanedItems: items.length, itemsWithAddedResources: touched }, null, 2));
}

main();


