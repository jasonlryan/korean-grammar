import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");

// Consolidation rules: keep canonical pattern; merge & remove variants (same chapter)
const RULES = [
  {
    chapter: 4,
    canonical: "-(으)로 말미암아",
    variants: ["(으)로 말미암아"],
  },
  {
    chapter: 4,
    canonical: "-(으)로 인해서",
    variants: ["(으)로 인해서"],
  },
  {
    chapter: 11,
    canonical: "-(이)거니와",
    variants: ["-거니와"],
  },
  {
    chapter: 14,
    canonical: "-(으)려고 들다",
    variants: ["-(으)려들다"],
  },
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
      channel: item.channel || "",
    });
  }
  if (isNonEmpty(item.resourceUrl)) {
    out.push({
      type: (item.resourceType || "article").toLowerCase(),
      url: item.resourceUrl,
      title: item.resourceTitle || "",
      channel: item.channel || "",
    });
  }
  if (Array.isArray(item.videos)) {
    for (const v of item.videos) {
      if (v && isNonEmpty(v.url)) {
        out.push({
          type: "video",
          url: v.url,
          title: v.title || "",
          channel: v.channel || "",
        });
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
    const key = `${r.type || ""}::${r.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      type: r.type || "article",
      url: r.url,
      title: r.title || "",
      channel: r.channel || "",
    });
  }
  return result;
}

function mergeInto(target, source) {
  // Copy scalar fields if missing/empty
  const fields = [
    "title",
    "subtitle",
    "example",
    "exampleEn",
    "description",
    "tip",
  ];
  for (const f of fields) {
    if (!isNonEmpty(target[f]) && isNonEmpty(source[f])) target[f] = source[f];
  }
  // Merge resources
  const tRes = Array.isArray(target.resources) ? target.resources.slice() : [];
  const sRes = Array.isArray(source.resources) ? source.resources.slice() : [];
  const legacy = toResourcesFromLegacy(source);
  target.resources = dedupeResources([...tRes, ...sRes, ...legacy]);
}

function findItem(items, chapter, pattern) {
  return items.find(
    (it) =>
      Number(it.chapter) === Number(chapter) &&
      String(it.pattern) === String(pattern)
  );
}

function main() {
  const data = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const items = Array.isArray(data.items) ? data.items : [];
  let removed = 0;
  const actions = [];

  for (const rule of RULES) {
    const canonical = findItem(items, rule.chapter, rule.canonical);
    if (!canonical) {
      actions.push({
        type: "warn",
        message: `Canonical not found: ch${rule.chapter} ${rule.canonical}`,
      });
      continue;
    }
    for (const vp of rule.variants) {
      const variant = findItem(items, rule.chapter, vp);
      if (!variant) continue;
      mergeInto(canonical, variant);
      // remove variant
      const idx = items.indexOf(variant);
      if (idx >= 0) {
        items.splice(idx, 1);
        removed += 1;
        actions.push({
          type: "merged_removed",
          chapter: rule.chapter,
          canonical: rule.canonical,
          removedPattern: vp,
        });
      }
    }
  }

  data.items = items;
  fs.writeFileSync(grammarPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ removed, actions }, null, 2));
}

main();
