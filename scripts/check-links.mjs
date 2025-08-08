#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const GRAMMAR_PATH = path.join(ROOT, "grammar.json");
const REPORT_DIR = path.join(ROOT, "content");
const REPORT_PATH = path.join(REPORT_DIR, "report-broken-links.json");
const CACHE_DIR = path.join(ROOT, ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "link-status.json");

const CONCURRENCY = 10;
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.trim();
}

function validHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isYoutube(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")
    );
  } catch {
    return false;
  }
}

function toYoutubeWatchUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/watch?v=${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/watch?v=${v}`;
    }
  } catch {}
  return url;
}

async function ensureDirs() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function loadJson(p) {
  const txt = await fs.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function saveJson(p, obj) {
  const txt = JSON.stringify(obj, null, 2);
  await fs.writeFile(p, txt, "utf8");
}

async function loadCache() {
  try {
    const cache = await loadJson(CACHE_PATH);
    const now = Date.now();
    // Drop stale entries
    for (const [key, val] of Object.entries(cache)) {
      if (!val || now - (val.timestamp || 0) > CACHE_TTL_MS) {
        delete cache[key];
      }
    }
    return cache;
  } catch {
    return {};
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

async function headOrGet(url) {
  // Try HEAD then fallback to GET if 405
  try {
    const res = await withTimeout(
      fetch(url, { method: "HEAD", redirect: "follow" }),
      TIMEOUT_MS
    );
    if (res.status === 405) {
      const resGet = await withTimeout(
        fetch(url, { method: "GET", redirect: "follow" }),
        TIMEOUT_MS
      );
      return resGet;
    }
    return res;
  } catch (e) {
    // Fallback to GET
    const resGet = await withTimeout(
      fetch(url, { method: "GET", redirect: "follow" }),
      TIMEOUT_MS
    );
    return resGet;
  }
}

async function checkYoutube(url) {
  const watchUrl = toYoutubeWatchUrl(url);
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    watchUrl
  )}&format=json`;
  try {
    const res = await withTimeout(fetch(oembed, { method: "GET" }), TIMEOUT_MS);
    if (res.ok) {
      return {
        status: "ok",
        code: 200,
        finalUrl: watchUrl,
        reason: "oembed-ok",
      };
    }
    return {
      status: "broken",
      code: res.status,
      finalUrl: watchUrl,
      reason: "oembed-error",
    };
  } catch (e) {
    return {
      status: "timeout",
      code: 0,
      finalUrl: watchUrl,
      reason: "oembed-timeout",
    };
  }
}

async function checkGeneric(url) {
  try {
    const res = await headOrGet(url);
    const ok = res.status >= 200 && res.status < 400;
    const redirected = res.redirected && ok;
    const finalUrl = res.url || url;
    if (ok)
      return {
        status: redirected ? "redirected" : "ok",
        code: res.status,
        finalUrl,
      };
    return { status: "broken", code: res.status, finalUrl };
  } catch (e) {
    if (e?.message === "timeout")
      return { status: "timeout", code: 0, finalUrl: url };
    return {
      status: "error",
      code: 0,
      finalUrl: url,
      reason: e?.message || "fetch-error",
    };
  }
}

async function run() {
  await ensureDirs();
  const cache = await loadCache();
  const data = await loadJson(GRAMMAR_PATH);
  const items = Array.isArray(data) ? data : data.items || [];

  const tasks = [];
  for (const item of items) {
    const resources = Array.isArray(item.resources) ? item.resources : [];
    for (const r of resources) {
      const url = normalizeUrl(r.url);
      if (!validHttpUrl(url)) {
        tasks.push({
          item,
          resource: r,
          url,
          checker: async () => ({ status: "invalid", code: 0, finalUrl: url }),
        });
        continue;
      }
      const cacheKey = url;
      const cached = cache[cacheKey];
      if (cached) {
        tasks.push({ item, resource: r, url, cached });
        continue;
      }
      if (r.type === "video" && isYoutube(url)) {
        tasks.push({
          item,
          resource: r,
          url,
          checker: () => checkYoutube(url),
        });
      } else {
        tasks.push({
          item,
          resource: r,
          url,
          checker: () => checkGeneric(url),
        });
      }
    }
  }

  // Run with limited concurrency
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      const t = tasks[idx];
      let res;
      if (t.cached) {
        res = t.cached;
      } else {
        res = await t.checker();
        cache[t.url] = { ...res, timestamp: Date.now() };
      }
      results.push({
        chapter: t.item.chapter,
        pattern: t.item.pattern,
        type: t.resource.type || "",
        title: t.resource.title || "",
        url: t.url,
        status: res.status,
        code: res.code,
        finalUrl: res.finalUrl || t.url,
        reason: res.reason || "",
      });
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Summaries
  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const broken = results.filter((r) =>
    ["broken", "timeout", "error", "invalid"].includes(r.status)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    totals: { all: results.length, broken: broken.length },
    results,
    broken,
  };
  await saveJson(REPORT_PATH, report);
  await saveJson(CACHE_PATH, cache);

  // Console summary
  console.log(
    JSON.stringify(
      { report: "content/report-broken-links.json", ...report.totals, summary },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
