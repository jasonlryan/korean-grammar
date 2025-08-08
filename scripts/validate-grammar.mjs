#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const inPath = path.join(projectRoot, "grammar.json");

const REQUIRED_FIELDS = [
  "chapter",
  "title",
  "subtitle",
  "pattern",
  "example",
  "exampleEn",
];

function validate(items) {
  const problems = [];
  const seenPerChapter = new Map();

  function norm(s) {
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[()]/g, "")
      .replace(/·/g, "")
      .replace(/—/g, "-")
      .toLowerCase();
  }

  items.forEach((it, idx) => {
    // Required fields
    for (const f of REQUIRED_FIELDS) {
      if (
        it[f] === undefined ||
        it[f] === null ||
        String(it[f]).trim() === ""
      ) {
        problems.push({ idx, message: `Missing required field: ${f}` });
      }
    }

    // Chapter type
    if (typeof it.chapter !== "number") {
      problems.push({ idx, message: "chapter must be a number" });
    }

    // Unique pattern per chapter
    const key = `${it.chapter}:${norm(it.pattern)}`;
    if (seenPerChapter.has(key)) {
      problems.push({
        idx,
        message: `Duplicate pattern in chapter ${it.chapter}: ${it.pattern}`,
      });
    } else {
      seenPerChapter.set(key, true);
    }

    // Resources validation (must exist and have at least one entry)
    if (!Array.isArray(it.resources) || it.resources.length === 0) {
      problems.push({ idx, message: "resources must be a non-empty array" });
    } else {
      it.resources.forEach((r, rIdx) => {
        if (!r || !r.type || !r.url) {
          problems.push({
            idx,
            message: `resources[${rIdx}] must have type and url`,
          });
        }
        if (r.type === "video") {
          try {
            const u = new URL(r.url);
            const ok =
              u.hostname.includes("youtu.be") ||
              (u.hostname.includes("youtube.com") && u.searchParams.get("v"));
            if (!ok)
              problems.push({
                idx,
                message: `resources[${rIdx}] video url not embeddable: ${r.url}`,
              });
          } catch {
            problems.push({
              idx,
              message: `resources[${rIdx}] invalid url: ${r?.url}`,
            });
          }
        }
      });
    }
  });

  return problems;
}

function main() {
  if (!fs.existsSync(inPath)) {
    console.error("grammar.json not found");
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (!Array.isArray(items)) {
    console.error("grammar.json: expected { items: [] }");
    process.exit(1);
  }
  const problems = validate(items);
  if (problems.length) {
    console.error("Validation failed with", problems.length, "problems:");
    problems
      .slice(0, 100)
      .forEach((p) => console.error(`- [${p.idx}] ${p.message}`));
    process.exit(2);
  }
  console.log("grammar.json is valid. Items:", items.length);
}

main();
