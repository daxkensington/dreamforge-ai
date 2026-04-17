/**
 * Health endpoint — confirms the app is running, the DB is reachable, and
 * critical env vars are configured. Used by the synthetic uptime monitor.
 *
 * Returns 200 with { ok: true, ... } when healthy, 503 otherwise. Callers
 * should treat anything other than 200 as unhealthy.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Minimum env vars the app needs to be functional. Auth + DB only — provider
// keys are optional (their absence is reported via /api/status/providers).
const REQUIRED_ENV = [
  "DATABASE_URL",
  "JWT_SECRET",
] as const;

type Check = { name: string; ok: boolean; ms?: number; error?: string };

async function checkDb(): Promise<Check> {
  const start = Date.now();
  try {
    const db = await getDb();
    if (!db) return { name: "db", ok: false, error: "no_database_url" };
    await (db as any).execute(sql`select 1`);
    return { name: "db", ok: true, ms: Date.now() - start };
  } catch (err) {
    return {
      name: "db",
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkEnv(): Check {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  return missing.length === 0
    ? { name: "env", ok: true }
    : { name: "env", ok: false, error: `missing: ${missing.join(", ")}` };
}

export async function GET() {
  const start = Date.now();
  const [dbCheck, envCheck] = await Promise.all([checkDb(), Promise.resolve(checkEnv())]);
  const checks = [dbCheck, envCheck];
  const ok = checks.every((c) => c.ok);

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      totalMs: Date.now() - start,
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}

export async function HEAD() {
  const dbCheck = await checkDb();
  const envCheck = checkEnv();
  const ok = dbCheck.ok && envCheck.ok;
  return new NextResponse(null, { status: ok ? 200 : 503 });
}
