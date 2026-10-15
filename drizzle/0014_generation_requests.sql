CREATE TABLE "generationRequests" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "requestId" uuid NOT NULL,
  "payloadHash" varchar(64) NOT NULL,
  "executionToken" uuid NOT NULL,
  "quotedCredits" integer NOT NULL,
  "state" varchar(24) NOT NULL,
  "generationId" integer REFERENCES "generations"("id"),
  "result" jsonb,
  "errorCode" varchar(128),
  "debitedAt" timestamp,
  "refundedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "generationRequests_positive_quote" CHECK ("quotedCredits" > 0),
  CONSTRAINT "generationRequests_payload_hash" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "generationRequests_state_valid" CHECK ("state" IN ('reserved', 'rendering', 'completed', 'rejected', 'refunded', 'reconciliation')),
  CONSTRAINT "generationRequests_debit_state" CHECK (("state" = 'rejected' AND "debitedAt" IS NULL) OR ("state" <> 'rejected' AND "debitedAt" IS NOT NULL)),
  CONSTRAINT "generationRequests_refund_state" CHECK (("state" = 'refunded') = ("refundedAt" IS NOT NULL)),
  CONSTRAINT "generationRequests_result_state" CHECK (("state" IN ('completed', 'rejected', 'refunded')) = ("result" IS NOT NULL)),
  CONSTRAINT "generationRequests_result_object" CHECK ("result" IS NULL OR jsonb_typeof("result") = 'object'),
  CONSTRAINT "generationRequests_render_owner" CHECK ("state" NOT IN ('rendering', 'completed') OR "generationId" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "generationRequests_user_request_unique" ON "generationRequests" ("userId", "requestId");
--> statement-breakpoint
CREATE UNIQUE INDEX "generationRequests_generation_unique" ON "generationRequests" ("generationId");
--> statement-breakpoint
CREATE INDEX "generationRequests_state_updated_idx" ON "generationRequests" ("state", "updatedAt");
