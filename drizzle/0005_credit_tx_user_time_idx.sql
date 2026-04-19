-- Composite (userId, createdAt) index for efficient billing history /
-- audit queries that list a user's transactions ordered by time.
-- Idempotent: safe to re-apply.

CREATE INDEX IF NOT EXISTS "creditTransactions_user_time_idx"
  ON "creditTransactions" ("userId", "createdAt");
