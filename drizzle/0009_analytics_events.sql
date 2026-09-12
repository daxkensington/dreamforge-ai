-- First-party funnel log. The site had no queryable analytics: the Meta Pixel
-- is ad-attribution (widely ad-blocked, not queryable), so the drop from signup
-- to first generation was unmeasurable and the acquisition channel unknown.
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"anonId" varchar(64) NOT NULL,
	"userId" integer,
	"event" varchar(64) NOT NULL,
	"path" varchar(512),
	"referrer" varchar(512),
	"utmSource" varchar(128),
	"utmMedium" varchar(128),
	"utmCampaign" varchar(128),
	"props" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "analytics_events_event_time_idx" ON "analytics_events" USING btree ("event","createdAt");
CREATE INDEX IF NOT EXISTS "analytics_events_anon_idx" ON "analytics_events" USING btree ("anonId");
CREATE INDEX IF NOT EXISTS "analytics_events_user_idx" ON "analytics_events" USING btree ("userId");
