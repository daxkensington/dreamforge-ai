-- Newsletter signup persistence — replaces the UI-only stub that flipped a
-- local "thanks!" state without saving anything.
-- Idempotent.

CREATE TABLE IF NOT EXISTS "newsletter_signups" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "ip" varchar(64),
  "source" varchar(64) DEFAULT 'footer',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_signups_email_unique"
  ON "newsletter_signups" ("email");
