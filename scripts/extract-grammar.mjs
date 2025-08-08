#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const indexPath = path.join(projectRoot, "index.html");
const outPath = path.join(projectRoot, "grammar.json");

function extractArrayLiteral(html) {
  const startMarker = "let grammarData = [";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Could not find "let grammarData = ["');
  let i = startIdx + startMarker.length - 1; // points to opening [
  let depth = 0;
  let inString = false;
  let escape = false;
  let quoteChar = null;
  let endIdx = -1;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === quoteChar) {
        inString = false;
        quoteChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quoteChar = ch;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error("Could not find end of grammarData array");
  return html.slice(startIdx + "let grammarData = ".length, endIdx + 1);
}

function writeTempModule(arrayLiteral) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kg-"));
  const tmpFile = path.join(tmpDir, "data.cjs");
  const moduleCode = "module.exports = " + arrayLiteral + ";\n";
  fs.writeFileSync(tmpFile, moduleCode, "utf8");
  return tmpFile;
}

async function main() {
  const html = fs.readFileSync(indexPath, "utf8");
  const arrLiteral = extractArrayLiteral(html);
  const tmpFile = writeTempModule(arrLiteral);
  // Use CommonJS require for simplicity
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const items = require(tmpFile);
  if (!Array.isArray(items)) throw new Error("Extracted data is not an array");
  const output = { items };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log("Extracted", items.length, "items to", outPath);
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
