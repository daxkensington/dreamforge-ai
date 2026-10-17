ALTER TABLE "creditBalances" ADD COLUMN "walletAccountingVersion" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "subscriptionCreditPeriods" (
  id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id),
  "stripeSubscriptionId" varchar(128) NOT NULL, "stripeInvoiceId" varchar(128) UNIQUE NOT NULL,
  "subscriptionItemId" varchar(128) NOT NULL, "priceId" varchar(128) NOT NULL,
  "periodStart" timestamp NOT NULL, "periodEnd" timestamp NOT NULL,
  "monthlyCredits" integer NOT NULL CHECK ("monthlyCredits" > 0),
  "lastAllowanceIndex" integer DEFAULT 0 NOT NULL CHECK ("lastAllowanceIndex" >= 0),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CHECK ("periodEnd" > "periodStart")
);
--> statement-breakpoint
CREATE INDEX "subscriptionCreditPeriods_user_end_idx" ON "subscriptionCreditPeriods" ("userId", "periodEnd");
--> statement-breakpoint
CREATE TABLE "generationBatchRequests" (
  id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), "requestId" varchar(64) NOT NULL,
  "payloadHash" varchar(64) NOT NULL CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'), "executionToken" uuid NOT NULL,
  "quotedCredits" integer NOT NULL CHECK ("quotedCredits" > 0),
  "purchasedCreditsDebited" integer DEFAULT 0 NOT NULL CHECK ("purchasedCreditsDebited" >= 0 AND "purchasedCreditsDebited" <= "quotedCredits"),
  state varchar(24) NOT NULL CHECK (state IN ('reserved','submitting','completed','rejected','reconciliation','refunded')),
  result jsonb, "errorCode" varchar(128), "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL,
  CHECK ((state IN ('completed','rejected','refunded')) = (result IS NOT NULL)),
  CHECK (result IS NULL OR jsonb_typeof(result) = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "generationBatchRequests_user_request_unique" ON "generationBatchRequests" ("userId", "requestId");
--> statement-breakpoint
CREATE INDEX "generationBatchRequests_state_updated_idx" ON "generationBatchRequests" (state, "updatedAt");
