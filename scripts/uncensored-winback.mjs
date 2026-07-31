#!/usr/bin/env node
/**
 * Uncensored-tier reactivation email — existing accounts who never bought.
 *
 * Idempotent: skips emails already sent (tracks via creditTransactions
 * description tag OR a dry-run log). Does NOT grant credits by default —
 * pure conversion email pointing at free previews + day pass.
 *
 * Usage:
 *   # Pull secrets then:
 *   node scripts/uncensored-winback.mjs --dry-run
 *   node scripts/uncensored-winback.mjs --send
 *
 * Requires env: DATABASE_URL, RESEND_API_KEY, RESEND_FROM_ADDRESS
 * (or a vercel env pull into .env.local)
 */
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DRY = !process.argv.includes("--send");
const TAG = "uncensored-winback-2026-07";
const LIMIT = Number(process.env.WINBACK_LIMIT || 200);

function loadEnv() {
  const candidates = [".env.local", ".env.btcpay.tmp", ".env.production.local", ".env"];
  for (const f of candidates) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_ADDRESS || "DreamForgeX <noreply@dreamforgex.ai>";

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
if (!DRY && !RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY (required for --send)");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });

const subject = "3 free uncensored previews (no card) — then a $4.99 day pass if you like it";

const html = (firstName) => `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;color:#111;">
  <h2 style="color:#e11d48;">Your free uncensored previews are waiting${firstName ? `, ${firstName}` : ""}.</h2>
  <p>You already have a DreamForgeX account. We shipped the thing people kept asking for: an <strong>uncensored</strong> image mode on our own GPUs — no provider filter, private by default, pay with Bitcoin if you upgrade.</p>
  <p><strong>Free first:</strong> sign in → confirm 18+ → generate <strong>3 watermarked previews</strong>. No card. No commitment.</p>
  <p>Like what you see? Day pass is <strong>$4.99</strong> (24h + 60 credits). Week $12 · 30 days $19. One-time, no auto-renew. Anonymous crypto checkout.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="https://dreamforgex.ai/uncensored" style="background:linear-gradient(90deg,#f43f5e,#f97316);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;">Try 3 free previews →</a>
  </p>
  <p style="font-size:13px;color:#555;">Rules we never break: AI-generated, fictional only, 18+, no real people, no minors. Illegal prompts are refused.</p>
  <p style="color:#666;margin-top:24px;">— DreamForgeX</p>
  <p style="font-size:11px;color:#999;margin-top:32px;">You're getting this because you have a DreamForgeX account. One-time product notice. Reply to opt out of future product emails.</p>
</div>`;

const users = await sql`
  select u.id, u.name, u.email
  from users u
  where u.email is not null
    and (u."uncensoredUntil" is null or u."uncensoredUntil" < now())
    and not exists (
      select 1 from "creditTransactions" ct
      where ct."userId" = u.id and ct.description = ${TAG}
    )
  order by u.id
  limit ${LIMIT}
`;

console.log(`${users.length} candidates, from=${FROM}, dry=${DRY}, tag=${TAG}`);

let sent = 0;
let failed = 0;

for (const u of users) {
  const firstName = (u.name ?? "").split(" ")[0] || null;

  if (DRY) {
    console.log(`DRY: would email ${u.email}`);
    sent++;
    continue;
  }

  // Marker row so re-runs skip (0-credit log — no balance change).
  // DB column is "txType" (drizzle maps JS field `type` → "txType").
  await sql`
    insert into "creditTransactions" ("userId", amount, "txType", description)
    values (${u.id}, 0, 'bonus', ${TAG})
  `;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: u.email,
      subject,
      html: html(firstName),
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (resp.ok) {
    console.log(`sent ${u.email} id=${body.id}`);
    sent++;
  } else {
    console.error(`FAIL ${u.email}: ${JSON.stringify(body)}`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 650));
}

await sql.end();
console.log(`done sent=${sent} failed=${failed} dry=${DRY}`);
if (DRY) {
  console.log("\nRe-run with --send to actually deliver (after reviewing the dry list).");
}
