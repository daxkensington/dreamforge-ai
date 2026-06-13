-- Uncensored tier (crypto-paid via BTCPay). Idempotent.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uncensoredUntil" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageConfirmedAt" timestamp;

CREATE TABLE IF NOT EXISTS "cryptoInvoices" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "invoiceId" varchar(128) NOT NULL UNIQUE,
  "plan" varchar(64) NOT NULL,
  "amountUsdCents" integer NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'new',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "settledAt" timestamp
);
CREATE INDEX IF NOT EXISTS "cryptoInvoices_userId_idx" ON "cryptoInvoices" ("userId");
