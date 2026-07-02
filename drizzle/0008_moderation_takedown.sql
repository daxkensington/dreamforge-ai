-- Moderation/compliance plumbing. Additive + idempotent.
--  * moderation_log — persistent audit trail for refused prompts (was console-only)
--  * takedown_requests — public content-removal reports from /takedown

CREATE TABLE IF NOT EXISTS "moderation_log" (
  "id" serial PRIMARY KEY,
  "category" varchar(32) NOT NULL,
  "surface" varchar(64) NOT NULL,
  "userId" integer,
  "ip" varchar(64),
  "promptLen" integer NOT NULL,
  "promptSha256" varchar(64),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "moderation_log_createdAt_idx" ON "moderation_log" ("createdAt");
CREATE INDEX IF NOT EXISTS "moderation_log_category_idx" ON "moderation_log" ("category");

CREATE TABLE IF NOT EXISTS "takedown_requests" (
  "id" serial PRIMARY KEY,
  "ticket" varchar(24) NOT NULL UNIQUE,
  "url" text NOT NULL,
  "reason" text NOT NULL,
  "contact" varchar(320),
  "ip" varchar(64),
  "status" varchar(32) NOT NULL DEFAULT 'open',
  "notes" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "resolvedAt" timestamp
);
CREATE INDEX IF NOT EXISTS "takedown_requests_createdAt_idx" ON "takedown_requests" ("createdAt");
CREATE INDEX IF NOT EXISTS "takedown_requests_status_idx" ON "takedown_requests" ("status");
