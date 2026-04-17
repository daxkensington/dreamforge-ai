#!/usr/bin/env node
/**
 * Link + asset checker — scans the codebase for internal hrefs and static
 * asset references, then verifies each one exists.
 *
 *  • Routes (href="/foo")  — checked against BASE_URL (deployed)
 *  • Assets (src="/x.jpg") — checked against public/ on disk (no deploy needed)
 *
 * Usage:
 *   node scripts/check-links.mjs                    # checks https://dreamforgex.ai
 *   BASE_URL=https://preview.vercel.app node ...    # PR preview
 *   node scripts/check-links.mjs --assets-only      # skip route checks (no network)
 *   node scripts/check-links.mjs --routes-only      # skip asset checks
 *
 * Why: a 404 on a linked route or a missing image is invisible to Sentry —
 * Next.js renders not-found.tsx and returns a "successful" 404; img tags
 * just show broken images without throwing. This catches both pre-deploy.
 */

import { readdir, readFile, stat, access } from "node:fs/promises";
import { join, relative } from "node:path";

const BASE_URL = process.env.BASE_URL || "https://dreamforgex.ai";
const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const SCAN_DIRS = ["app", "client/src", "components"];
const FILE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const SKIP_ROUTES = args.includes("--assets-only");
const SKIP_ASSETS = args.includes("--routes-only");

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

// Static asset extensions — anything matching gets validated against public/.
const ASSET_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".ico",
  ".mp4", ".webm", ".mov", ".m4v",
  ".mp3", ".wav", ".ogg", ".m4a",
  ".pdf", ".json", ".xml", ".txt",
  ".woff", ".woff2", ".ttf", ".otf",
]);

function shouldSkipRoute(href) {
  return (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("http") ||
    href.startsWith("#") ||
    href.includes("[") ||
    href.includes("${") ||
    href === "/" ||
    href.startsWith("/api/")
  );
}

function isAssetPath(p) {
  if (!p.startsWith("/")) return false;
  if (p.includes("${") || p.includes("[")) return false;
  const dot = p.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = p.slice(dot).split("?")[0].toLowerCase();
  return ASSET_EXTS.has(ext);
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

async function collectReferences() {
  const routes = new Map(); // href -> Set<source>
  const assets = new Map(); // path -> Set<source>

  // Route patterns: href="/foo", href:"/foo", to="/foo", to:"/foo"
  const routePattern = /(?:href|to)\s*[=:]\s*["'`](\/[a-z0-9/_-]*)["'`]/gi;
  // Asset patterns: any quoted string starting with / and ending in a known ext.
  // Catches src=, bg:, image:, poster=, <source src=>, etc.
  const assetPattern = /["'`](\/[a-z0-9/_.-]+\.(?:jpe?g|png|gif|webp|avif|svg|ico|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|pdf|json|xml|woff2?|ttf|otf))["'`]/gi;

  for (const dir of SCAN_DIRS) {
    const fullDir = join(ROOT, dir);
    try {
      await stat(fullDir);
    } catch {
      continue;
    }
    for await (const file of walk(fullDir)) {
      const content = await readFile(file, "utf-8");
      const rel = relative(ROOT, file);

      let m;
      routePattern.lastIndex = 0;
      while ((m = routePattern.exec(content)) !== null) {
        const href = m[1];
        if (shouldSkipRoute(href)) continue;
        if (isAssetPath(href)) continue; // routed to asset bucket
        if (!routes.has(href)) routes.set(href, new Set());
        routes.get(href).add(rel);
      }

      assetPattern.lastIndex = 0;
      while ((m = assetPattern.exec(content)) !== null) {
        const path = m[1];
        if (!assets.has(path)) assets.set(path, new Set());
        assets.get(path).add(rel);
      }
    }
  }
  return { routes, assets };
}

async function checkRoute(href) {
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

async function checkAsset(path) {
  const filePath = join(PUBLIC_DIR, path);
  try {
    await access(filePath);
    return { path, ok: true };
  } catch {
    return { path, ok: false };
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

function isRouteOk(status, href) {
  if (status >= 200 && status < 300) return true;
  if (status >= 300 && status < 400 && AUTH_GATED.has(href)) return true;
  return false;
}

async function main() {
  console.log(`🔍 Scanning codebase…`);
  const { routes, assets } = await collectReferences();
  const routeList = [...routes.keys()].sort();
  const assetList = [...assets.keys()].sort();

  let brokenRoutes = [];
  let brokenAssets = [];
  let routeWarnings = [];

  // ── ROUTES ─────────────────────────────────────────────
  if (!SKIP_ROUTES) {
    console.log(`\n🌐 Checking ${routeList.length} routes against ${BASE_URL}…\n`);
    const results = await runWithConcurrency(routeList, checkRoute, CONCURRENCY);
    for (const r of results) {
      if (r.status === 0) {
        brokenRoutes.push({ ...r, sources: [...routes.get(r.href)] });
        console.log(`  ✗ ${r.href.padEnd(40)} NETWORK ERROR — ${r.error}`);
      } else if (r.status === 404) {
        brokenRoutes.push({ ...r, sources: [...routes.get(r.href)] });
        console.log(`  ✗ ${r.href.padEnd(40)} 404`);
      } else if (!isRouteOk(r.status, r.href)) {
        routeWarnings.push({ ...r, sources: [...routes.get(r.href)] });
        console.log(`  ⚠ ${r.href.padEnd(40)} ${r.status}`);
      } else {
        console.log(`  ✓ ${r.href.padEnd(40)} ${r.status}`);
      }
    }
  } else {
    console.log(`\n⏭  Skipping route checks (--assets-only)`);
  }

  // ── ASSETS ─────────────────────────────────────────────
  if (!SKIP_ASSETS) {
    console.log(`\n🖼  Checking ${assetList.length} assets against public/…\n`);
    const results = await runWithConcurrency(assetList, checkAsset, CONCURRENCY);
    for (const r of results) {
      if (r.ok) {
        console.log(`  ✓ ${r.path}`);
      } else {
        brokenAssets.push({ ...r, sources: [...assets.get(r.path)] });
        console.log(`  ✗ ${r.path}  MISSING in public/`);
      }
    }
  } else {
    console.log(`\n⏭  Skipping asset checks (--routes-only)`);
  }

  // ── REPORT ─────────────────────────────────────────────
  console.log("");
  let failed = false;

  if (brokenRoutes.length > 0) {
    failed = true;
    console.log(`❌ ${brokenRoutes.length} broken route(s):\n`);
    for (const b of brokenRoutes) {
      console.log(`   ${b.href} — referenced in:`);
      for (const src of b.sources) console.log(`     • ${src}`);
    }
    console.log("");
  }

  if (brokenAssets.length > 0) {
    failed = true;
    console.log(`❌ ${brokenAssets.length} missing asset(s):\n`);
    for (const b of brokenAssets) {
      console.log(`   ${b.path} — referenced in:`);
      for (const src of b.sources) console.log(`     • ${src}`);
    }
    console.log("");
  }

  if (routeWarnings.length > 0) {
    console.log(`⚠  ${routeWarnings.length} unexpected route status code(s) — review above.\n`);
  }

  if (failed) {
    process.exit(1);
  }

  const summary = [];
  if (!SKIP_ROUTES) summary.push(`${routeList.length} routes`);
  if (!SKIP_ASSETS) summary.push(`${assetList.length} assets`);
  console.log(`✅ All ${summary.join(" + ")} resolve.`);
}

main().catch((err) => {
  console.error("Link checker crashed:", err);
  process.exit(2);
});
