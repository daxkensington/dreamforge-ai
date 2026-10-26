#!/usr/bin/env node
// Funnel report from first-party analytics_events (see server/routers/analytics.ts).
//
// Usage: node scripts/funnel-report.mjs <envFile> [days]
// Loads DATABASE_URL from the given env file (never prints the URL or credentials).
// Read-only. Default window: 14 days.
//
// Why this exists (2026-10-25): 7 of 7 Stripe checkouts in Oct expired unpaid with
// no payment attempt. The questions to re-ask after any paywall change are:
//   1. where do people see the offer (paywall placement)?
//   2. of those who click, how many actually reach Stripe (started -> redirected)?
//   3. of those who reach Stripe, how many back out (canceled) vs pay (completed)?
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const envFile = process.argv[2];
const days = Math.max(1, Math.min(365, Number(process.argv[3] ?? 14) || 14));
if (!envFile) {
  console.error("usage: node scripts/funnel-report.mjs <envFile> [days]");
  process.exit(2);
}
config({ path: envFile, quiet: true });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL is not set in ${envFile}`);
  process.exit(2);
}
const sql = neon(url);
const window = `${days} days`;

const pad = (v, n) => String(v ?? "").padEnd(n);
const num = (v, n = 7) => String(v ?? 0).padStart(n);

async function main() {
  console.log(`Funnel — last ${days} days — ${new Date().toISOString().slice(0, 16)}Z\n`);

  // 1. Top of funnel + offer placements.
  const [top] = await sql`
    select
      count(distinct "anonId") filter (where event = 'page_view')::int as visitors,
      count(distinct coalesce("userId"::text, "anonId")) filter (where event = 'signup_completed')::int as signups,
      count(distinct coalesce("userId"::text, "anonId")) filter (where event = 'generation_started')::int as generated,
      count(distinct coalesce("userId"::text, "anonId")) filter (where event = 'generation_completed')::int as got_result
    from analytics_events
    where "createdAt" > now() - ${window}::interval`;
  console.log("Visitors → signups → started a generation → saw a result");
  console.log(`  ${num(top.visitors)} ${num(top.signups)} ${num(top.generated)} ${num(top.got_result)}\n`);

  const placements = await sql`
    select coalesce(props->>'placement', 'default') as placement, coalesce(path, '?') as path,
           count(*)::int as views, count(distinct coalesce("userId"::text, "anonId"))::int as people
    from analytics_events
    where event = 'paywall_viewed' and "createdAt" > now() - ${window}::interval
    group by 1, 2 order by 3 desc limit 8`;
  console.log("Paywall views by placement / path");
  for (const r of placements) console.log(`  ${pad(r.placement, 13)} ${pad(r.path, 24)} views ${num(r.views)}  people ${num(r.people)}`);
  console.log("");

  // 2. Checkout steps by kind + surface.
  const steps = await sql`
    select coalesce(props->>'kind', '-') as kind, coalesce(props->>'surface', coalesce(path, '-')) as surface,
           count(*) filter (where event = 'checkout_started')::int as started,
           count(*) filter (where event = 'checkout_redirected')::int as redirected,
           count(*) filter (where event = 'checkout_canceled')::int as canceled,
           count(*) filter (where event = 'checkout_completed')::int as completed
    from analytics_events
    where event in ('checkout_started','checkout_redirected','checkout_canceled','checkout_completed')
      and "createdAt" > now() - ${window}::interval
    group by 1, 2 order by 3 desc`;
  console.log("Checkout steps (events)        started  redirect canceled completed");
  for (const r of steps) console.log(`  ${pad(r.kind, 16)} ${pad(r.surface, 12)} ${num(r.started)} ${num(r.redirected, 9)} ${num(r.canceled, 8)} ${num(r.completed, 9)}`);
  if (!steps.length) console.log("  (none)");
  console.log("");

  // 3. One row per person who started a checkout: did they reach Stripe, back out, pay?
  const people = await sql`
    with starters as (
      select distinct "userId" from analytics_events
      where event = 'checkout_started' and "userId" is not null and "createdAt" > now() - ${window}::interval)
    select s."userId" as uid,
      to_char((select min(e."createdAt") from analytics_events e where e."userId" = s."userId" and e.event = 'checkout_started'), 'YYYY-MM-DD') as first_click,
      (select count(*)::int from analytics_events e where e."userId" = s."userId" and e.event = 'checkout_started') as clicks,
      exists(select 1 from analytics_events e where e."userId" = s."userId" and e.event = 'checkout_redirected') as reached_stripe,
      exists(select 1 from analytics_events e where e."userId" = s."userId" and e.event = 'checkout_canceled') as backed_out,
      exists(select 1 from analytics_events e where e."userId" = s."userId" and e.event = 'checkout_completed') as paid,
      (select count(*)::int from generations g where g."userId" = s."userId" and g.status = 'completed') as renders,
      (select to_char(u."createdAt", 'YYYY-MM-DD') from users u where u.id = s."userId") as signed_up
    from starters s order by 2 desc`;
  console.log("People who clicked a pay button   signed_up   first_click clicks reachedStripe backedOut paid renders");
  for (const r of people) {
    console.log(`  user ${pad(r.uid, 6)} ${pad(String(r.signed_up).slice(0, 10), 11)} ${pad(String(r.first_click).slice(0, 10), 11)} ${num(r.clicks, 6)} ${pad(r.reached_stripe ? "yes" : "no", 13)} ${pad(r.backed_out ? "yes" : "no", 9)} ${pad(r.paid ? "YES" : "no", 4)} ${num(r.renders, 7)}`);
  }
  if (!people.length) console.log("  (none)");
  console.log("\nNote: checkout_redirected / checkout_canceled exist since 2026-10-25 (#79); older clicks show 'no' for both.");
}

main().catch((err) => {
  console.error("funnel-report failed:", err?.message ?? err);
  process.exit(1);
});
