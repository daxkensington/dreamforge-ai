-- 0013_foreign_keys_not_valid.sql
--
-- First foreign keys on the schema (it has had zero FKs since 0000). Added as
-- NOT VALID on purpose: existing rows are NOT scanned, so orphans accumulated
-- over the app's lifetime can't fail this migration — but every NEW write is
-- enforced immediately. Follow-up plan:
--   1. Run scripts/audit-orphans.mjs to count orphans per relationship.
--   2. Clean up orphans (delete or re-parent).
--   3. VALIDATE each constraint: ALTER TABLE <t> VALIDATE CONSTRAINT <c>;
--      (takes a brief lock, no rewrite, safe in production)
--
-- Do NOT fold this into an earlier migration — 0011/0012 are already applied
-- to production. Constraint names follow the fk_<table>_<column> convention.
--> statement-breakpoint
ALTER TABLE "creditTransactions" ADD CONSTRAINT fk_credit_transactions_user FOREIGN KEY ("userId") REFERENCES "users" ("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT fk_generations_user FOREIGN KEY ("userId") REFERENCES "users" ("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "audioGenerations" ADD CONSTRAINT fk_audio_generations_user FOREIGN KEY ("userId") REFERENCES "users" ("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "userSubscriptions" ADD CONSTRAINT fk_user_subscriptions_user FOREIGN KEY ("userId") REFERENCES "users" ("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "videoProjects" ADD CONSTRAINT fk_video_projects_user FOREIGN KEY ("userId") REFERENCES "users" ("id") NOT VALID;
--> statement-breakpoint
ALTER TABLE "galleryItems" ADD CONSTRAINT fk_gallery_items_generation FOREIGN KEY ("generationId") REFERENCES "generations" ("id") NOT VALID;
