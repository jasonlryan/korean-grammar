import fs from "fs";
import path from "path";

const projectRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const grammarPath = path.join(projectRoot, "grammar.json");

const data = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
const items = Array.isArray(data.items)
  ? data.items.map((it, idx) => ({ ...it, __index: idx }))
  : [];

const missing = items.filter(
  (it) => !it.exampleEn || String(it.exampleEn).trim() === ""
);

let withAnyResource = 0;
let withoutAnyResource = 0;
let withVideo = 0;
let withoutVideo = 0;

for (const it of missing) {
  const res = Array.isArray(it.resources) ? it.resources : [];
  if (res.length > 0) withAnyResource++;
  else withoutAnyResource++;
  if (res.some((r) => r && r.type === "video")) withVideo++;
  else withoutVideo++;
}

console.log(
  JSON.stringify(
    {
      totalMissingExampleEn: missing.length,
      withAnyResource,
      withoutAnyResource,
      withVideo,
      withoutVideo,
      sample: missing
        .slice(0, 5)
        .map(({ __index, chapter, pattern, resources }) => ({
          __index,
          chapter,
          pattern,
          resourcesLen: Array.isArray(resources) ? resources.length : 0,
          hasVideo:
            Array.isArray(resources) &&
            resources.some((r) => r && r.type === "video"),
        })),
    },
    null,
    2
  )
);
