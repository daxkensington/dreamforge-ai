-- Postgres-backed rate limiter. Replaces the in-memory limiter that was
-- effectively a no-op on Vercel serverless (every cold start wiped the Map).
--
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS "rate_limit_hits" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(256) NOT NULL,
  "ts" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rate_limit_hits_key_ts_idx"
  ON "rate_limit_hits" ("key", "ts");
