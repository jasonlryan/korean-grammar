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
  const total = Array.isArray(items) ? items.length : 0;
  let missingEn = 0;
  let missingRes = 0;
  let genericOnly = 0;
  let complete = 0;

  for (const it of items) {
    const enMissing = isBlank(it.exampleEn);
    const resList = Array.isArray(it.resources) ? it.resources : [];
    const resMissing = resList.length === 0;
    const allGeneric =
      resList.length > 0 && resList.every(isGenericSearchResource);

    if (enMissing) missingEn++;
    if (resMissing) missingRes++;
    if (!resMissing && allGeneric) genericOnly++;

    const hasRealResource = resList.length > 0 && !allGeneric;
    if (!enMissing && hasRealResource) complete++;
  }

  console.log(
    JSON.stringify(
      {
        total,
        complete,
        missing_exampleEn: missingEn,
        missing_resources: missingRes,
        generic_resource_only: genericOnly,
      },
      null,
      2
    )
  );
}

main();
