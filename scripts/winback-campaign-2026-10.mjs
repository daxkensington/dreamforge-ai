// Win-back campaign 2026-10: three segments, one script.
//   A) dormant-credits — 50+ idle credits, no generation in 14+ days
//   B) zero-balance    — credits ran out, stopped at the paywall
//   C) uncensored-exp  — uncensored pass expires within 48h (or lapsed <7d)
//
// HARD SEND WINDOW: nothing sends between 11pm and 7am local (override with
// TZ=<iana-tz>). The guard runs BEFORE anything else and exits without sending
// when the window is closed — there is no --force.
//
// Idempotent: skips anyone who already has a notification row with this
// campaign's tag, and records each send as a notification row (also surfaces
// in-app). Run: node scripts/winback-campaign-2026-10.mjs [--dry-run|--send]
import { config } from "dotenv";
import postgres from "postgres";

const SEND = process.argv.includes("--send");
const DRY = !SEND; // default is dry-run; you must pass --send explicitly

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_ADDRESS ?? "DreamForgeX <noreply@dreamforgex.ai>";
if (!url || !RESEND_KEY) { console.error("DATABASE_URL / RESEND_API_KEY missing"); process.exit(1); }
const sql = postgres(url, { max: 1 });

// ─── Send-window guard ─────────────────────────────────────────────────────
// Local machine time unless TZ is set (e.g. TZ=America/New_York node ...).
const tz = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
const hour = parseInt(
  new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()),
  10,
);
if (hour >= 23 || hour < 7) {
  console.log(`SEND WINDOW CLOSED — it is ${hour}:00 in ${tz}. Rule: no sends 11pm–7am. Nothing was sent.`);
  process.exit(0);
}
console.log(`Send window open (${hour}:00 in ${tz}). mode=${DRY ? "DRY-RUN" : "SEND"}`);

const TAG = "winback-2026-10";
const sent = new Set(
  (await sql`select distinct "userId" from notifications where "notifType" = 'system' and title like ${TAG + "%"}`).map((r) => r.userId),
);
console.log(`${sent.size} users already contacted for ${TAG}; they will be skipped.`);

// ─── Segments ──────────────────────────────────────────────────────────────
const dormant = await sql`
  select u.id, u.name, u.email, b.balance
  from users u
  join "creditBalances" b on b."userId" = u.id
  where u.email is not null
    and b.balance >= 50
    and u."createdAt" < now() - interval '14 days'
    and not exists (select 1 from generations g where g."userId" = u.id and g."createdAt" > now() - interval '14 days')
  order by u.id`;

const zeroBal = await sql`
  select u.id, u.name, u.email, b.balance
  from users u
  join "creditBalances" b on b."userId" = u.id
  where u.email is not null
    and b.balance < 10
    and not exists (select 1 from generations g where g."userId" = u.id and g."createdAt" > now() - interval '7 days')
  order by u.id`;

const expiring = await sql`
  select u.id, u.name, u.email, u."uncensoredUntil"
  from users u
  where u.email is not null
    and u."uncensoredUntil" is not null
    and (u."uncensoredUntil" between now() and now() + interval '48 hours'
         or u."uncensoredUntil" between now() - interval '7 days' and now())
  order by u."uncensoredUntil"`;

console.log(`segments: dormant=${dormant.length} zero-balance=${zeroBal.length} uncensored-expiring=${expiring.length}`);

// ─── Copy ──────────────────────────────────────────────────────────────────
const shell = (inner) => `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;color:#1a1a1a;">
  ${inner}
  <p style="font-size:12px;color:#999;margin-top:32px;">You're receiving this because you have a DreamForgeX account. One-time service notice — no newsletter, no spam.</p>
</div>`;
const first = (n) => (n ?? "").split(" ")[0] || null;
const btn = (href, label) => `<p style="text-align:center;margin:28px 0;"><a href="${href}" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`;

const MAILS = {
  dormant: (u) => ({
    title: `${TAG}:dormant`,
    subject: `You have ${u.balance} credits waiting on DreamForgeX`,
    html: shell(`
      <h2>Your credits are stacking up${first(u.name) ? `, ${first(u.name)}` : ""}.</h2>
      <p>Your DreamForgeX account currently holds <strong>${u.balance} credits</strong> — and 50 more land every day whether you use them or not. Right now they're just evaporating.</p>
      <p>There's a lot new since you last visited: the full 100+ tool suite is live, generation is faster, and you can try everything free before ever paying.</p>
      ${btn("https://dreamforgex.ai/workspace", `Use my ${u.balance} credits →`)}`),
  }),
  zero: (u) => ({
    title: `${TAG}:zero`,
    subject: "You're out of credits — here's the fastest way back in",
    html: shell(`
      <h2>Hit the credit wall${first(u.name) ? `, ${first(u.name)}` : ""}?</h2>
      <p>Your DreamForgeX balance ran dry — which usually means you were actually making things. Two ways back in:</p>
      <p><strong>1.</strong> Come back tomorrow: <strong>50 free credits</strong> land on your account every day.<br/>
         <strong>2.</strong> Top up instantly: one-time packs start at <strong>$4.99</strong> — no subscription, no card stored.</p>
      ${btn("https://dreamforgex.ai/credits", "See credit packs →")}
      ${btn("https://dreamforgex.ai/workspace", "Claim today's 50 free →")}`),
  }),
  expiring: (u) => ({
    title: `${TAG}:uncensored`,
    subject: "Your Uncensored Pass is ending",
    html: shell(`
      <h2>Your Uncensored Pass ${new Date(u.uncensoredUntil) < new Date() ? "expired" : "expires soon"}${first(u.name) ? `, ${first(u.name)}` : ""}.</h2>
      <p>${new Date(u.uncensoredUntil) < new Date()
        ? "Your pass lapsed within the last few days — your settings and history are still there."
        : `Your pass expires <strong>${u.uncensoredUntil.toLocaleString?.() ?? "within 48 hours"}</strong>.`}</p>
      <p>Renewing takes under a minute and pays with crypto — no card, no statement line item.</p>
      ${btn("https://dreamforgex.ai/uncensored", "Renew my pass →")}`),
  }),
};

// ─── Send loop ─────────────────────────────────────────────────────────────
let emailed = 0, skipped = 0, failed = 0;
const processed = new Set();

async function run(rows, kind) {
  for (const u of rows) {
    if (processed.has(u.id) || sent.has(u.id)) { skipped++; continue; }
    processed.add(u.id);
    const mail = MAILS[kind](u);
    if (DRY) { console.log(`DRY [${kind}] ${u.email}`); emailed++; continue; }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: u.email, subject: mail.subject, html: mail.html }),
    });
    if (!resp.ok) { failed++; console.error(`FAIL ${u.email}: ${resp.status} ${(await resp.text()).slice(0, 120)}`); continue; }

    await sql`insert into notifications ("userId", "notifType", title, message) values (${u.id}, 'system', ${mail.title}, ${mail.subject})`;
    emailed++;
    console.log(`sent [${kind}] ${u.email}`);
  }
}

await run(dormant, "dormant");
await run(zeroBal, "zero");
await run(expiring, "expiring");

console.log(`\ndone: ${emailed} ${DRY ? "would-be sends" : "sent"}, ${skipped} skipped, ${failed} failed`);
await sql.end();
