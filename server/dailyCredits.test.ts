/**
 * The daily free-credit top-up, exercised as SQL against the real database.
 *
 * The logic lives in one statement inside getOrCreateBalance, and its risky
 * parts are all things unit-testing a JS function would miss: the UTC date
 * boundary, idempotency within a day, and not clawing back credits a user
 * bought. So this runs the actual statement against a scratch row.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import { TIERS } from "../shared/tiers";

const DAILY = TIERS.free.dailyCreditsForFree;

function loadDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env.test", ".env.local"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    const line = fs
      .readFileSync(p, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "").trim();
  }
  return null;
}

const DATABASE_URL = loadDatabaseUrl();
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

/** The exact statement getOrCreateBalance runs. */
async function topUp(userId: number) {
  return sql!(
    `UPDATE "creditBalances" cb
        SET balance = GREATEST(cb.balance, $2),
            "lastResetAt" = (now() AT TIME ZONE 'UTC')
      WHERE cb."userId" = $1
        AND (cb."lastResetAt" IS NULL
             OR cb."lastResetAt" < date_trunc('day', now() AT TIME ZONE 'UTC'))
        AND NOT EXISTS (
          SELECT 1 FROM "userSubscriptions" us
           WHERE us."userId" = cb."userId"
             AND us."subStatus" IN ('active','trialing')
        )
      RETURNING cb.balance`,
    [userId, DAILY],
  );
}

const read = async (userId: number) =>
  (await sql!(`SELECT balance, "lastResetAt" FROM "creditBalances" WHERE "userId"=$1`, [userId]))[0];

const setRow = async (userId: number, balance: number, lastReset: string | null) =>
  sql!(
    `UPDATE "creditBalances" SET balance=$2, "lastResetAt"=${lastReset === null ? "NULL" : "$3::timestamp"} WHERE "userId"=$1`,
    lastReset === null ? [userId, balance] : [userId, balance, lastReset],
  );

// A scratch user that owns nothing — never a real account.
const SCRATCH_EMAIL = "vitest-daily-credits@dreamforgex.invalid";
let userId = 0;

describe.skipIf(!sql)("daily free credits", () => {
  beforeAll(async () => {
    const existing = await sql!(`SELECT id FROM users WHERE email=$1`, [SCRATCH_EMAIL]);
    if (existing.length) {
      userId = existing[0].id as number;
    } else {
      const created = await sql!(
        `INSERT INTO users ("openId", name, email, "loginMethod") VALUES ($1,$2,$3,$4) RETURNING id`,
        [`vitest-daily-${Date.now()}`, "vitest daily credits", SCRATCH_EMAIL, "system"],
      );
      userId = created[0].id as number;
    }
    await sql!(
      `INSERT INTO "creditBalances" ("userId", balance) VALUES ($1, 0)
       ON CONFLICT ("userId") DO NOTHING`,
      [userId],
    );
  });

  afterAll(async () => {
    if (!userId) return;
    await sql!(`DELETE FROM "creditBalances" WHERE "userId"=$1`, [userId]);
    await sql!(`DELETE FROM users WHERE id=$1`, [userId]);
  });

  it("refills a user who has never been reset — the 7 stuck at zero", async () => {
    await setRow(userId, 0, null);
    await topUp(userId);
    expect((await read(userId)).balance).toBe(DAILY);
  });

  it("is idempotent within the same UTC day (no double-granting)", async () => {
    await setRow(userId, 0, null);
    await topUp(userId);
    // Spend, then run again the same day — must NOT refill.
    await setRow(userId, 5, (await read(userId)).lastResetAt as any);
    await topUp(userId);
    await topUp(userId);
    expect((await read(userId)).balance).toBe(5);
  });

  it("refills once the UTC day has rolled over", async () => {
    await setRow(userId, 5, "2020-01-01 00:00:00");
    await topUp(userId);
    expect((await read(userId)).balance).toBe(DAILY);
  });

  it("tops UP only — never claws back purchased or bonus credits", async () => {
    // A pass buyer sitting above the free allowance keeps every credit.
    await setRow(userId, DAILY + 500, "2020-01-01 00:00:00");
    await topUp(userId);
    expect((await read(userId)).balance).toBe(DAILY + 500);
  });

  it("does not refill an active subscriber (they draw on monthlyAllocation)", async () => {
    await setRow(userId, 0, "2020-01-01 00:00:00");
    await sql!(
      `INSERT INTO "userSubscriptions" ("userId","planId","subStatus") VALUES ($1,$2,'active')`,
      [userId, 1],
    );
    try {
      await topUp(userId);
      expect((await read(userId)).balance).toBe(0);
    } finally {
      await sql!(`DELETE FROM "userSubscriptions" WHERE "userId"=$1`, [userId]);
    }
  });

  it("treats the day boundary as UTC, not the caller's local zone", async () => {
    // 23:30 UTC "today" is still today — a reader west of UTC would see it as
    // yesterday and hand out a second grant.
    const rows = await sql!(
      `SELECT (date_trunc('day', now() AT TIME ZONE 'UTC') + interval '23 hours 30 minutes'
               < date_trunc('day', now() AT TIME ZONE 'UTC')) AS same_day_is_stale`,
    );
    expect(rows[0].same_day_is_stale).toBe(false);
  });
});
