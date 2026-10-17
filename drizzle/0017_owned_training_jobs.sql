ALTER TABLE "mediaAssets" ADD COLUMN "isPrivate" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "trainingJobs" (
  id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), "requestId" uuid NOT NULL,
  "payloadHash" varchar(64) NOT NULL CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  name varchar(128) NOT NULL, "trainingType" varchar(16) NOT NULL CHECK ("trainingType" IN ('face','style','product','object')),
  "triggerWord" varchar(32) NOT NULL CHECK ("triggerWord" ~ '^[A-Za-z][A-Za-z0-9_]{2,31}$'),
  steps integer NOT NULL CHECK (steps IN (800,1200)), "imageKeys" jsonb NOT NULL,
  "archiveKey" text, state varchar(24) DEFAULT 'draft' NOT NULL,
  "executionToken" uuid NOT NULL, "leaseToken" uuid, "leaseUntil" timestamp,
  "providerRequestId" varchar(128), "statusUrl" text, "responseUrl" text, "cancelUrl" text,
  "providerState" varchar(32), "queuePosition" integer,
  "quotedCredits" integer NOT NULL CHECK ("quotedCredits" > 0), "purchasedCreditsDebited" integer DEFAULT 0 NOT NULL,
  "debitTransactionId" integer, "debitedAt" timestamp, "refundedAt" timestamp, "modelKey" text,
  "errorCode" varchar(96), "expiresAt" timestamp NOT NULL, "deletedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "trainingJobs_state_valid" CHECK (state IN ('draft','preparing','ready_to_submit','submitting','queued','training','succeeded','failed','cancel_requested','canceled','reconciliation','deleted','rejected')),
  CONSTRAINT "trainingJobs_images_array" CHECK (jsonb_typeof("imageKeys") = 'array' AND (jsonb_array_length("imageKeys") BETWEEN 5 AND 20 OR (state = 'deleted' AND "imageKeys" = '[]'::jsonb))),
  CONSTRAINT "trainingJobs_purchase_valid" CHECK ("purchasedCreditsDebited" >= 0 AND "purchasedCreditsDebited" <= "quotedCredits"),
  CONSTRAINT "trainingJobs_success_asset" CHECK (state <> 'succeeded' OR "modelKey" IS NOT NULL),
  CONSTRAINT "trainingJobs_refund_debit" CHECK ("refundedAt" IS NULL OR "debitedAt" IS NOT NULL),
  CONSTRAINT "trainingJobs_debit_valid" CHECK (state NOT IN ('submitting','queued','training','succeeded','cancel_requested') OR "debitedAt" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trainingJobs_user_request_unique" ON "trainingJobs" ("userId","requestId");
--> statement-breakpoint
CREATE UNIQUE INDEX "trainingJobs_provider_request_unique" ON "trainingJobs" ("providerRequestId");
--> statement-breakpoint
CREATE INDEX "trainingJobs_user_state_idx" ON "trainingJobs" ("userId",state);
--> statement-breakpoint
CREATE INDEX "trainingJobs_state_updated_idx" ON "trainingJobs" (state,"updatedAt");
--> statement-breakpoint
CREATE TRIGGER training_jobs_active_owner BEFORE INSERT OR UPDATE ON "trainingJobs" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
