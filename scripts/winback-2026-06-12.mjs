// Win-back campaign 2026-06-12: every user who signed up hit the broken
// generation pipeline (8/9 gens failed May 14 - Jun 8). Pipeline is fixed and
// verified. Grant each user 25 bonus credits (30-day expiry) and email them.
//
// Idempotent: skips users who already have a winback-2026-06 bonus tx.
// Run: node scripts/winback-2026-06-12.mjs [--dry-run]
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const DRY = process.argv.includes("--dry-run");
const env = JSON.parse(readFileSync(join(process.env.TEMP, "dfx-keys2.json"), "utf8"));
const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 1 });

const BONUS = 25;
const TAG = "winback-2026-06";
const FROM = env.RESEND_FROM_ADDRESS;

const users = await sql`select id, name, email from users where email is not null order by id`;
const already = await sql`select distinct "userId" from "creditTransactions" where description = ${TAG}`;
const doneIds = new Set(already.map((r) => r.userId));

console.log(`${users.length} users, ${doneIds.size} already granted, from=${FROM}, dry=${DRY}`);

const subject = "Your generations failed — we fixed it (and added 25 credits)";
const html = (firstName) => `
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 540px; margin: 0 auto; color: #1a1a1a;">
  <h2 style="color:#b45309;">We owe you an apology${firstName ? `, ${firstName}` : ""}.</h2>
  <p>You signed up for DreamForge, tried to create something, and it probably failed. That was our fault — a chain of provider outages broke image generation for several weeks.</p>
  <p><strong>It's fixed.</strong> We rebuilt the entire generation stack: images, video, music, and all 100+ tools are live and verified working.</p>
  <p>To make it right, we've added <strong>${BONUS} bonus credits</strong> to your account — on top of whatever you had. They're live now, no action needed.</p>
  <p style="text-align:center; margin: 28px 0;">
    <a href="https://dreamforgex.ai/workspace" style="background:#b45309; color:#fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Try it again →</a>
  </p>
  <p>If anything fails this time, reply to this email and a human will look at it the same day.</p>
  <p style="color:#666;">— The DreamForge team</p>
  <p style="font-size:12px; color:#999; margin-top:32px;">You're receiving this because you have a DreamForge account. This is a one-time service notice about your account credits.</p>
</div>`;

for (const u of users) {
  if (doneIds.has(u.id)) { console.log(`skip ${u.email} (already granted)`); continue; }
  const firstName = (u.name ?? "").split(" ")[0] || null;

  if (DRY) { console.log(`DRY: would grant ${BONUS}cr + email ${u.email}`); continue; }

  // Grant credits: balance upsert + transaction with 30d expiry
  await sql`
    insert into "creditBalances" ("userId", balance, "lifetimeSpent")
    values (${u.id}, ${BONUS}, 0)
    on conflict ("userId") do update set balance = "creditBalances".balance + ${BONUS}`;
  await sql`
    insert into "creditTransactions" ("userId", amount, "txType", description, "expiresAt")
    values (${u.id}, ${BONUS}, 'bonus', ${TAG}, now() + interval '30 days')`;

  // Send email
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: u.email, subject, html: html(firstName) }),
  });
  const body = await resp.json();
  console.log(`${u.email}: granted ${BONUS}cr, email ${resp.ok ? "sent " + body.id : "FAILED " + JSON.stringify(body)}`);
  await new Promise((r) => setTimeout(r, 600)); // Resend rate limit courtesy
}

await sql.end();
