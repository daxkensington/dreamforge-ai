CREATE TABLE IF NOT EXISTS "tool_failure_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"toolId" varchar(100) NOT NULL,
	"errorMessage" text,
	"provider" varchar(50),
	"userId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_failure_toolid_time_idx" ON "tool_failure_events" ("toolId", "createdAt");
