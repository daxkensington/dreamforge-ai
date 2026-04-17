#!/usr/bin/env node
/**
 * Synthetic uptime probe — runs from CI cron to detect outages between
 * deploys. Hits a curated list of endpoints and reports failures.
 *
 * Designed for the GitHub Actions runner, but works locally:
 *   node scripts/health-check.mjs
 *   BASE_URL=https://preview.vercel.app node scripts/health-check.mjs
 *
 * Exit code 0 = all healthy, 1 = at least one probe failed. The wrapper
 * workflow opens (or reuses) a GitHub Issue on failure and closes it on
 * recovery, so you only get notified on state changes.
 */

const BASE_URL = process.env.BASE_URL || "https://dreamforgex.ai";
const TIMEOUT_MS = 15_000;

/**
 * Each probe:
 *   path     — relative URL
 *   expect   — required substring in body (or null if HEAD-only)
 *   method   — "GET" | "HEAD"
 *   maxMs    — fail if latency exceeds this
 *   critical — true → counts toward outage; false → just logged
 */
const PROBES = [
  { path: "/", expect: "DreamForge", method: "GET", maxMs: 8000, critical: true },
  { path: "/about", expect: "About", method: "GET", maxMs: 8000, critical: true },
  { path: "/terms", expect: "Terms of Service", method: "GET", maxMs: 8000, critical: true },
  { path: "/privacy", expect: "Privacy", method: "GET", maxMs: 8000, critical: true },
  { path: "/pricing", expect: "Pricing", method: "GET", maxMs: 8000, critical: true },
  { path: "/tools", expect: null, method: "HEAD", maxMs: 8000, critical: true },
  { path: "/api/health", expect: '"ok":true', method: "GET", maxMs: 8000, critical: true },
  { path: "/api/status/providers", expect: null, method: "HEAD", maxMs: 10000, critical: false },
];

async function probe(p) {
  const url = `${BASE_URL}${p.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: p.method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "dreamforgex-uptime-probe/1.0" },
    });
    const ms = Date.now() - start;
    let body = "";
    if (p.method === "GET" && p.expect) {
      body = await res.text();
    }
    const statusOk = res.status >= 200 && res.status < 400;
    const bodyOk = !p.expect || body.includes(p.expect);
    const latencyOk = ms <= p.maxMs;
    const ok = statusOk && bodyOk && latencyOk;
    const reasons = [];
    if (!statusOk) reasons.push(`status=${res.status}`);
    if (!bodyOk) reasons.push(`body missing "${p.expect}"`);
    if (!latencyOk) reasons.push(`slow ${ms}ms > ${p.maxMs}ms`);
    return { ...p, status: res.status, ms, ok, reasons };
  } catch (err) {
    return {
      ...p,
      status: 0,
      ms: Date.now() - start,
      ok: false,
      reasons: [err.name === "AbortError" ? "timeout" : err.message],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`🩺 Probing ${BASE_URL} — ${PROBES.length} endpoints`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const results = await Promise.all(PROBES.map(probe));

  let criticalFailures = 0;
  let warnings = 0;
  for (const r of results) {
    const tag = r.critical ? "" : " (non-critical)";
    if (r.ok) {
      console.log(`  ✓ ${r.path.padEnd(28)} ${String(r.status).padStart(3)} ${String(r.ms).padStart(5)}ms${tag}`);
    } else {
      const icon = r.critical ? "✗" : "⚠";
      console.log(`  ${icon} ${r.path.padEnd(28)} ${String(r.status).padStart(3)} ${String(r.ms).padStart(5)}ms — ${r.reasons.join("; ")}${tag}`);
      if (r.critical) criticalFailures++;
      else warnings++;
    }
  }

  console.log("");
  if (criticalFailures > 0) {
    console.log(`❌ ${criticalFailures} critical probe(s) failed.`);

    // Emit a structured summary for the workflow to pick up.
    const failures = results
      .filter((r) => !r.ok && r.critical)
      .map((r) => `- \`${r.path}\` — ${r.reasons.join("; ")} (status ${r.status}, ${r.ms}ms)`)
      .join("\n");
    console.log("\n::group::failure_summary");
    console.log(`Failures at ${new Date().toISOString()}\n\n${failures}`);
    console.log("::endgroup::");

    // GH Actions output (consumed by the workflow body).
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import("node:fs");
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `failed=true\nsummary<<__SUMMARY__\n${failures}\n__SUMMARY__\n`,
      );
    }
    process.exit(1);
  }

  if (warnings > 0) {
    console.log(`⚠  ${warnings} non-critical probe(s) failed (logged only).`);
  }
  console.log(`✅ All critical probes healthy.`);

  if (process.env.GITHUB_OUTPUT) {
    const fs = await import("node:fs");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `failed=false\nsummary=\n`);
  }
}

main().catch((err) => {
  console.error("Health probe crashed:", err);
  process.exit(2);
});
