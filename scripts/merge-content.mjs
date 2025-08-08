#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");
const chapterDetailsPath = path.join(projectRoot, "chapter_details.json");

function normalize(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .replace(/·/g, "")
    .replace(/—/g, "-")
    .toLowerCase();
}

function isValidYoutube(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return true;
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v"))
      return true;
    return false;
  } catch {
    return false;
  }
}

function toResources(item) {
  const resources = [];
  if (Array.isArray(item.videos)) {
    for (const v of item.videos) {
      if (v?.url)
        resources.push({
          type: "video",
          url: v.url,
          title: v.title || "",
          channel: v.channel || "",
        });
    }
  }
  if (item.videoUrl) {
    resources.push({
      type: "video",
      url: item.videoUrl,
      title: item.videoTitle || "",
      channel: item.channel || "",
    });
  }
  if (item.resourceUrl) {
    const t = String(item.resourceType || "").toLowerCase();
    const type = t.includes("video")
      ? "video"
      : t.includes("interactive")
      ? "interactive"
      : "article";
    resources.push({
      type,
      url: item.resourceUrl,
      title: item.resourceTitle || "",
      channel: "",
    });
  }
  // Filter invalid video URLs; keep all non-video
  const filtered = resources.filter(
    (r) => r.type !== "video" || isValidYoutube(r.url || "")
  );
  return filtered;
}

function getChapterDetailsMap(details) {
  const map = new Map();
  const chapters = Array.isArray(details?.chapters) ? details.chapters : [];
  for (const ch of chapters) {
    const patterns = Array.isArray(ch?.patterns) ? ch.patterns : [];
    for (const p of patterns) {
      const key = `${ch.chapter}:${normalize(p.pattern)}`;
      map.set(key, p);
    }
  }
  return map;
}

function findDetailsFor(map, chapter, pattern) {
  const normPat = normalize(pattern);
  const exactKey = `${chapter}:${normPat}`;
  if (map.has(exactKey)) return map.get(exactKey);
  // Fallback: scan keys of same chapter to see includes either way
  const prefix = `${chapter}:`;
  for (const [key, val] of map.entries()) {
    if (!key.startsWith(prefix)) continue;
    const k = key.slice(prefix.length);
    if (normPat.includes(k) || k.includes(normPat)) return val;
  }
  return null;
}

function main() {
  if (!fs.existsSync(grammarPath)) {
    console.error("grammar.json not found");
    process.exit(1);
  }
  if (!fs.existsSync(chapterDetailsPath)) {
    console.error("chapter_details.json not found");
    process.exit(1);
  }
  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const items = Array.isArray(grammar?.items) ? grammar.items : [];
  const details = JSON.parse(fs.readFileSync(chapterDetailsPath, "utf8"));
  const map = getChapterDetailsMap(details);

  let enriched = 0;
  let resourcesAdded = 0;
  let created = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Merge translations and descriptions from chapter_details
    const d = findDetailsFor(map, item.chapter, item.pattern);
    if (d) {
      if (!item.example || String(item.example).trim() === "")
        item.example = d.example_ko || item.example || "";
      if (!item.exampleEn || String(item.exampleEn).trim() === "")
        item.exampleEn = d.example_en || item.exampleEn || "";
      if (!item.description || String(item.description).trim() === "")
        item.description = d.description || item.description || "";
      if (!item.tip || String(item.tip).trim() === "")
        item.tip = d.tip || item.tip || "";
      enriched++;
    }

    // Ensure resources[] exist
    if (!Array.isArray(item.resources) || item.resources.length === 0) {
      item.resources = toResources(item);
    }
    if (!Array.isArray(item.resources) || item.resources.length === 0) {
      const q = encodeURIComponent(String(item.pattern || "").trim());
      item.resources = [
        {
          type: "article",
          url: `https://www.howtostudykorean.com/?s=${q}`,
          title: `HowToStudyKorean: ${item.pattern} 검색`,
          channel: "",
        },
      ];
      resourcesAdded++;
    }
  }

  // Add any patterns from chapter_details.json that are not present in grammar.json
  const detailsChapters = Array.isArray(details?.chapters)
    ? details.chapters
    : [];
  for (const ch of detailsChapters) {
    const chPatterns = Array.isArray(ch?.patterns) ? ch.patterns : [];
    for (const p of chPatterns) {
      const alreadyExists = items.some(
        (it) =>
          it.chapter === ch.chapter &&
          normalize(it.pattern) === normalize(p.pattern)
      );
      if (alreadyExists) continue;

      const exemplar = items.find((it) => it.chapter === ch.chapter);
      const title = exemplar?.title || ch.title || `Ch. ${ch.chapter}`;
      const subtitle = exemplar?.subtitle || ch.title || "";

      const newItem = {
        chapter: ch.chapter,
        title,
        subtitle,
        pattern: p.pattern,
        example: p.example_ko || "",
        exampleEn: p.example_en || "",
        description: p.description || "",
        tip: p.tip || "",
        resources: [],
      };

      // Seed default resource
      const q = encodeURIComponent(String(newItem.pattern || "").trim());
      newItem.resources = [
        {
          type: "article",
          url: `https://www.howtostudykorean.com/?s=${q}`,
          title: `HowToStudyKorean: ${newItem.pattern} 검색`,
          channel: "",
        },
      ];

      items.push(newItem);
      created++;
    }
  }

  fs.writeFileSync(
    grammarPath,
    JSON.stringify({ items }, null, 2) + "\n",
    "utf8"
  );
  console.log(
    `Merged content. Items: ${items.length}. Enriched: ${enriched}. Created: ${created}. Added fallback resources: ${resourcesAdded}.`
  );
}

main();
