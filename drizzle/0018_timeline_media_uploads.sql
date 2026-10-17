ALTER TYPE "videoProjectType" ADD VALUE IF NOT EXISTS 'timeline';
--> statement-breakpoint
CREATE TABLE "mediaUploads" (
  id uuid PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), key text NOT NULL UNIQUE,
  "fileName" varchar(256) NOT NULL, "contentType" varchar(128) NOT NULL,
  size integer NOT NULL CHECK (size BETWEEN 1 AND 26214400), purpose varchar(16) NOT NULL CHECK (purpose IN ('timeline','training','animation')),
  "partCount" integer NOT NULL CHECK ("partCount" BETWEEN 1 AND 9), parts jsonb DEFAULT '{}'::jsonb NOT NULL CHECK (jsonb_typeof(parts) = 'object'),
  state varchar(16) DEFAULT 'open' NOT NULL CHECK (state IN ('open','assembling','completed','failed')),
  "leaseToken" uuid, "leaseUntil" timestamp, "expiresAt" timestamp NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mediaUploads_user_idx" ON "mediaUploads" ("userId");
--> statement-breakpoint
CREATE INDEX "mediaUploads_expiry_idx" ON "mediaUploads" ("expiresAt");
--> statement-breakpoint
CREATE TRIGGER media_uploads_active_owner BEFORE INSERT OR UPDATE ON "mediaUploads" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
