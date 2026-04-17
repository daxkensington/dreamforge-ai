#!/usr/bin/env node
/**
 * Link checker — scans the codebase for internal hrefs and verifies each
 * resolves on the deployed URL. Fails the build if any return 404.
 *
 * Usage:
 *   node scripts/check-links.mjs                    # checks https://dreamforgex.ai
 *   BASE_URL=https://preview.vercel.app node ...    # custom base
 *   node scripts/check-links.mjs --skip-auth        # skip routes that require auth (already default)
 *
 * Why: a 404 on a linked route is invisible to Sentry (it's a successful
 * "not found" response, not an exception). This catches them pre-deploy.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const BASE_URL = process.env.BASE_URL || "https://dreamforgex.ai";
const ROOT = process.cwd();
const SCAN_DIRS = ["app", "client/src", "components"];
const FILE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const CONCURRENCY = 8;

// Routes we expect to redirect (auth-gated). 3xx is OK for these.
const AUTH_GATED = new Set([
  "/admin",
  "/api-keys",
  "/credits",
  "/notifications",
  "/profile",
  "/moderation",
  "/timeline",
]);

// Skip these paths — they're not real routes (mailto, anchors, dynamic segments, etc).
function shouldSkip(href) {
  return (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("http") ||
    href.startsWith("#") ||
    href.includes("[") || // dynamic segments like /gallery/[id]
    href.includes("${") || // template strings
    href === "/" ||
    href.startsWith("/api/") // API routes, not pages
  );
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walk(path);
    } else if (FILE_EXTS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      yield path;
    }
  }
}

async function collectHrefs() {
  const found = new Map(); // href -> Set of source files
  // Match: href="/foo", href: "/foo", to="/foo", to: "/foo"
  const pattern = /(?:href|to)\s*[=:]\s*["'`](\/[a-z0-9/_-]*)["'`]/gi;

  for (const dir of SCAN_DIRS) {
    const fullDir = join(ROOT, dir);
    try {
      await stat(fullDir);
    } catch {
      continue;
    }
    for await (const file of walk(fullDir)) {
      const content = await readFile(file, "utf-8");
      let m;
      while ((m = pattern.exec(content)) !== null) {
        const href = m[1];
        if (shouldSkip(href)) continue;
        if (!found.has(href)) found.set(href, new Set());
        found.get(href).add(relative(ROOT, file));
      }
    }
  }
  return found;
}

async function checkOne(href) {
  const url = `${BASE_URL}${href}`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "dreamforgex-link-checker/1.0" },
    });
    return { href, status: res.status };
  } catch (err) {
    return { href, status: 0, error: err.message };
  }
}

async function runWithConcurrency(items, fn, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function isOk(status, href) {
  if (status >= 200 && status < 300) return true;
  // Auth redirects are expected for gated routes.
  if (status >= 300 && status < 400 && AUTH_GATED.has(href)) return true;
  // Generic 3xx — flag as warning, not failure (could be a misconfig).
  return false;
}

async function main() {
  console.log(`🔍 Scanning codebase for internal links…`);
  const found = await collectHrefs();
  const hrefs = [...found.keys()].sort();
  console.log(`   Found ${hrefs.length} unique internal routes referenced.\n`);
  console.log(`🌐 Checking against ${BASE_URL}…\n`);

  const results = await runWithConcurrency(hrefs, checkOne, CONCURRENCY);

  const broken = [];
  const warnings = [];
  for (const r of results) {
    if (r.status === 0) {
      broken.push({ ...r, sources: [...found.get(r.href)] });
      console.log(`  ✗ ${r.href.padEnd(40)} NETWORK ERROR — ${r.error}`);
    } else if (r.status === 404) {
      broken.push({ ...r, sources: [...found.get(r.href)] });
      console.log(`  ✗ ${r.href.padEnd(40)} 404`);
    } else if (!isOk(r.status, r.href)) {
      warnings.push({ ...r, sources: [...found.get(r.href)] });
      console.log(`  ⚠ ${r.href.padEnd(40)} ${r.status}`);
    } else {
      console.log(`  ✓ ${r.href.padEnd(40)} ${r.status}`);
    }
  }

  console.log("");
  if (broken.length > 0) {
    console.log(`❌ ${broken.length} broken link(s):\n`);
    for (const b of broken) {
      console.log(`   ${b.href} — referenced in:`);
      for (const src of b.sources) console.log(`     • ${src}`);
    }
    process.exit(1);
  }
  if (warnings.length > 0) {
    console.log(`⚠  ${warnings.length} unexpected status code(s) — review above.`);
  }
  console.log(`✅ All ${hrefs.length} links resolve.`);
}

main().catch((err) => {
  console.error("Link checker crashed:", err);
  process.exit(2);
});
