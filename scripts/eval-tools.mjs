// Tool eval harness — runs fixed inputs through the REAL tool procedures
// (via createCaller, same as the test suite) and writes outputs + an HTML
// review page. Answers "are the tools good?" with evidence instead of vibes.
//
// Usage (run with tsx — the harness imports the real TypeScript router):
//   npx tsx scripts/eval-tools.mjs list          — show eval targets
//   npx tsx scripts/eval-tools.mjs run [tool...] — run all (or named) evals
//   npx tsx scripts/eval-tools.mjs run --cheap   — only the sub-$0.01 evals
// Results land in eval-results/<date>/ with an index.html.
//
// Requires .env.local (provider keys + DATABASE_URL). Creates/uses an
// 'eval@dreamforgex.ai' user and grants it credits — eval rows are real DB
// rows for that user. Costs a few cents per run (real provider calls).
import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import postgres from "postgres";

config({ path: ".env.local" });

// Input images are the site's own showcase assets — fetchable via
// fetchGuardedImage (https, same-origin, image content-type).
const IMG = (name) => `https://dreamforgex.ai/showcase/${name}.jpg`;

/** @type {Record<string, { input: object, label: string, cheap?: boolean }>} */
const EVALS = {
  "text-to-image": { input: { prompt: "a lighthouse on a cliff at golden hour, cinematic", modelVersion: "auto", mediaType: "image", width: 1024, height: 1024 }, label: "Core image gen" },
  "upscale": { input: { imageUrl: IMG("example-upscale-1"), scale: 2 }, label: "ESRGAN upscale", cheap: true },
  "depth-map": { tool: "depthMap", input: { imageUrl: IMG("example-interior-1"), style: "grayscale" }, label: "Depth (grayscale)", cheap: true },
  "depth-map-color": { tool: "depthMap", input: { imageUrl: IMG("example-interior-1"), style: "colored" }, label: "Depth (colored)", cheap: true },
  "depth-map-normal": { tool: "depthMap", input: { imageUrl: IMG("example-interior-1"), style: "normal-map" }, label: "Depth (normal map)", cheap: true },
  "vectorize": { input: { imageUrl: IMG("example-logo-1"), style: "flat", colorCount: 8 }, label: "Vectorize + SVG", cheap: true },
  "style-transfer": { input: { imageUrl: IMG("example-style-1"), style: "oil-painting", intensity: 0.7 }, label: "Style transfer" },
  "face-enhancer": { input: { imageUrl: IMG("example-face-1"), enhancement: "restore" }, label: "Face enhance" },
  "object-eraser": { input: { imageUrl: IMG("example-eraser-1"), objectToRemove: "the person" }, label: "Object eraser" },
  "photo-colorize": { input: { imageUrl: IMG("example-headshot-1"), era: "auto", intensity: "natural" }, label: "Photo colorize" },
  "qr-art": { input: { url: "https://dreamforgex.ai", prompt: "cyberpunk neon city", style: "artistic" }, label: "QR art" },
};

const [, , cmd, ...rest] = process.argv;

if (cmd === "list") {
  for (const [key, e] of Object.entries(EVALS)) {
    console.log(`${(e.tool ?? key).padEnd(14)} ${key.padEnd(20)} ${e.cheap ? "[cheap]" : ""} ${e.label}`);
  }
  process.exit(0);
}

if (cmd !== "run") {
  console.error("usage: npx tsx scripts/eval-tools.mjs list | run [--cheap] [evalKeys...]");
  process.exit(1);
}

const cheapOnly = rest.includes("--cheap");
const only = rest.filter((r) => !r.startsWith("--"));
const targets = Object.entries(EVALS).filter(([key, e]) => {
  if (only.length) return only.includes(key) || only.includes(e.tool ?? key);
  return !cheapOnly || e.cheap;
});
if (!targets.length) { console.error("no matching evals"); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

// Eval user — created once, reused. Credits granted ad hoc per run.
let [user] = await sql`select id from users where email = 'eval@dreamforgex.ai'`;
if (!user) {
  [user] = await sql`insert into users ("openId", name, email, "loginMethod") values ('eval-internal', 'Eval Harness', 'eval@dreamforgex.ai', 'internal') returning id`;
}
await sql`insert into "creditBalances" ("userId", balance) values (${user.id}, 5000) on conflict ("userId") do update set balance = "creditBalances".balance + 5000`;
await sql`insert into "creditTransactions" ("userId", amount, "txType", description) values (${user.id}, 5000, 'bonus', 'eval harness grant')`;

const { appRouter } = await import("../server/routers.ts").catch(() => ({ appRouter: null }));
if (!appRouter) {
  console.error("router import failed — this harness must run under tsx (see usage).");
  await sql.end();
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
const outDir = `eval-results/${day}`;
await mkdir(outDir, { recursive: true });

const caller = appRouter.createCaller({ user: { id: user.id, role: "user", email: "eval@dreamforgex.ai" }, session: null, ip: "127.0.0.1" });

const results = [];
for (const [key, e] of targets) {
  const proc = e.tool ?? key;
  const t0 = Date.now();
  let status = "failed", url = null, error = null, extra = {};
  try {
    const fn = proc === "text-to-image" ? caller.generation.create : caller.tools[proc];
    if (typeof fn !== "function") throw new Error(`procedure tools.${proc} not found`);
    const res = await fn(e.input);
    status = res.status ?? "completed";
    url = res.url ?? res.imageUrl ?? null;
    if (res.svgUrl) extra.svgUrl = res.svgUrl;
    if (res.engine) extra.engine = res.engine;
    if (status !== "completed") error = res.error ?? "unknown";
  } catch (err) {
    error = String(err.message ?? err).slice(0, 300);
  }
  const ms = Date.now() - t0;
  results.push({ key, proc, label: e.label, status, url, error, ms, input: e.input, ...extra });
  console.log(`${status === "completed" ? "OK " : "FAIL"} ${key.padEnd(20)} ${ms}ms ${error ?? url ?? ""}`);
}

// Download outputs for the report
for (const r of results) {
  if (!r.url) continue;
  try {
    const buf = Buffer.from(await (await fetch(r.url)).arrayBuffer());
    const ext = r.url.split(".").pop().split("?")[0] || "png";
    const file = `${r.key}.${ext}`;
    await writeFile(`${outDir}/${file}`, buf);
    r.localFile = file;
  } catch { r.localFile = null; }
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tool evals ${day}</title>
<style>body{font-family:system-ui;max-width:1000px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ddd;padding:6px;vertical-align:top}img{max-width:280px;max-height:200px}.ok{color:#059669}.fail{color:#dc2626}</style></head><body>
<h1>DreamForgeX tool evals — ${day}</h1>
<table><tr><th>Tool</th><th>Status</th><th>Time</th><th>Engine/Extra</th><th>Output</th><th>Error</th></tr>
${results.map((r) => `<tr><td><b>${r.label}</b><br><code>${r.proc}</code></td><td class="${r.status === "completed" ? "ok" : "fail"}">${r.status}</td><td>${r.ms}ms</td><td>${r.engine ?? ""}${r.svgUrl ? `<br><a href="${r.svgUrl}">svg</a>` : ""}</td><td>${r.localFile ? `<img src="${r.localFile}">` : ""}</td><td>${r.error ?? ""}</td></tr>`).join("")}
</table></body></html>`;
await writeFile(`${outDir}/index.html`, html);
console.log(`\nreport: ${outDir}/index.html`);
await sql.end();
