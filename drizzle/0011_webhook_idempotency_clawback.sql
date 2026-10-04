-- Webhook idempotency + refund/dispute clawback correctness.
--   * 'pending' webhook status: events are claimed up front (INSERT ...
--     ON CONFLICT DO NOTHING) and updated to processed/failed/ignored after
--     handling, so a crash mid-handler is visible instead of masquerading
--     as processed.
--   * clawedBackCredits: per-purchase cumulative clawback counter. Stripe
--     refund events carry CUMULATIVE amount_refunded, so handlers claw only
--     the delta over what earlier events already removed (staged partial
--     refunds used to claw the full ratio every event).
--   * 'dispute' tx type: chargeback clawbacks are recorded as their own
--     transaction type.
--   * stripeSessionId index: the addCredits re-grant guard looks up purchases
--     by checkout session id before granting credits.
-- Idempotent: safe to re-apply.

ALTER TYPE "webhookStatus" ADD VALUE IF NOT EXISTS 'pending';--> statement-breakpoint
ALTER TABLE "creditTransactions" ADD COLUMN IF NOT EXISTS "clawedBackCredits" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TYPE "txType" ADD VALUE IF NOT EXISTS 'dispute';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creditTransactions_stripeSessionId_idx" ON "creditTransactions" USING btree ("stripeSessionId");
