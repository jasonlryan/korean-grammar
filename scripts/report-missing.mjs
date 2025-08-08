#!/usr/bin/env node
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");

function isBlank(s) {
  return !s || String(s).trim() === "";
}

function isGenericSearchResource(r) {
  return (
    r && typeof r.url === "string" && r.url.includes("howtostudykorean.com/?s=")
  );
}

function main() {
  if (!fs.existsSync(grammarPath)) {
    console.error("grammar.json not found");
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
  const report = [];
  for (const it of items) {
    const reasons = [];
    if (isBlank(it.exampleEn)) reasons.push("missing_exampleEn");

    const hasResources = Array.isArray(it.resources) && it.resources.length > 0;
    if (!hasResources) {
      reasons.push("missing_resources");
    } else {
      const allGeneric = it.resources.every(isGenericSearchResource);
      if (allGeneric) reasons.push("generic_resource_fallback");
    }

    if (reasons.length > 0) {
      report.push({
        chapter: it.chapter,
        pattern: it.pattern,
        title: it.title,
        subtitle: it.subtitle,
        reasons,
      });
    }
  }

  console.log(JSON.stringify({ issues: report }, null, 2));
}

main();
