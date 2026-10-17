CREATE TABLE "mediaAssets" (
  "key" text PRIMARY KEY,
  "ownerUserId" integer REFERENCES users(id),
  "revokedAt" timestamp,
  "deletedAt" timestamp,
  "deleteReason" varchar(64),
  "deleteAttempts" integer DEFAULT 0 NOT NULL,
  "lastDeleteAttemptAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "mediaAssets_key_valid" CHECK (length(key) BETWEEN 1 AND 1024),
  CONSTRAINT "mediaAssets_attempts_valid" CHECK ("deleteAttempts" >= 0),
  CONSTRAINT "mediaAssets_deleted_revoked" CHECK ("deletedAt" IS NULL OR "revokedAt" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "mediaAssets_owner_idx" ON "mediaAssets" ("ownerUserId");
--> statement-breakpoint
CREATE INDEX "mediaAssets_cleanup_idx" ON "mediaAssets" ("revokedAt", "deletedAt");
--> statement-breakpoint
-- Row locks serialize content writes against account deletion. The deletion
-- transaction takes the user FOR UPDATE before scrubbing content. Writers
-- either finish first (and are scrubbed), or see the deleted tombstone.
CREATE FUNCTION dreamforge_active_content_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id integer; active_id integer;
BEGIN
  owner_id := (to_jsonb(NEW)->>TG_ARGV[0])::integer;
  IF owner_id IS NOT NULL THEN
    SELECT id INTO active_id FROM users
      WHERE id = owner_id AND "loginMethod" IS DISTINCT FROM 'deleted' FOR SHARE;
    IF active_id IS NULL THEN RAISE EXCEPTION 'Content owner is unavailable' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER generations_active_owner BEFORE INSERT OR UPDATE ON generations FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER video_projects_active_owner BEFORE INSERT OR UPDATE ON "videoProjects" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER audio_active_owner BEFORE INSERT OR UPDATE ON "audioGenerations" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER characters_active_owner BEFORE INSERT OR UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER brand_kits_active_owner BEFORE INSERT OR UPDATE ON "brandKits" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE FUNCTION dreamforge_active_project() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_id integer;
BEGIN
  SELECT p.id INTO active_id FROM "videoProjects" p JOIN users u ON u.id = p."userId"
    WHERE p.id = NEW."projectId" AND u."loginMethod" IS DISTINCT FROM 'deleted'
    FOR SHARE OF p, u;
  IF active_id IS NULL THEN RAISE EXCEPTION 'Project is unavailable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER project_collaborators_active BEFORE INSERT OR UPDATE ON "projectCollaborators" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER project_shares_active BEFORE INSERT OR UPDATE ON "projectShareTokens" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER project_revisions_active BEFORE INSERT OR UPDATE ON "projectRevisions" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER project_chat_active BEFORE INSERT OR UPDATE ON "projectChatMessages" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER project_activity_active BEFORE INSERT OR UPDATE ON "projectActivityLog" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER project_collaborators_active_user BEFORE INSERT OR UPDATE ON "projectCollaborators" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER project_collaborators_active_inviter BEFORE INSERT OR UPDATE ON "projectCollaborators" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('invitedBy');
--> statement-breakpoint
CREATE TRIGGER project_shares_active_creator BEFORE INSERT OR UPDATE ON "projectShareTokens" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('createdBy');
--> statement-breakpoint
CREATE TRIGGER project_revisions_active_user BEFORE INSERT OR UPDATE ON "projectRevisions" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER project_chat_active_user BEFORE INSERT OR UPDATE ON "projectChatMessages" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER project_activity_active_user BEFORE INSERT OR UPDATE ON "projectActivityLog" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER gallery_comments_active_user BEFORE INSERT OR UPDATE ON "galleryComments" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER gallery_likes_active_user BEFORE INSERT OR UPDATE ON "galleryLikes" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER generation_requests_active_owner BEFORE INSERT OR UPDATE ON "generationRequests" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER generation_batches_active_owner BEFORE INSERT OR UPDATE ON "generationBatchRequests" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER credit_balances_active_owner BEFORE INSERT OR UPDATE ON "creditBalances" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER gallery_items_active_owner BEFORE INSERT OR UPDATE ON "galleryItems" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER moderation_queue_active_owner BEFORE INSERT OR UPDATE ON "moderationQueue" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER api_keys_active_owner BEFORE INSERT OR UPDATE ON "apiKeys" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER marketplace_listings_active_owner BEFORE INSERT OR UPDATE ON "marketplaceListings" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('sellerId');
--> statement-breakpoint
CREATE TRIGGER seller_profiles_active_owner BEFORE INSERT OR UPDATE ON "sellerProfiles" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE FUNCTION dreamforge_deleted_user_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."loginMethod" = 'deleted' THEN
    RAISE EXCEPTION 'Account is deleted' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_deleted_tombstone BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION dreamforge_deleted_user_tombstone();
--> statement-breakpoint
CREATE TRIGGER scene_keyframes_active_project BEFORE INSERT OR UPDATE ON "sceneKeyframes" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_project();
--> statement-breakpoint
CREATE TRIGGER notifications_active_owner BEFORE INSERT OR UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER notification_preferences_active_owner BEFORE INSERT OR UPDATE ON "notificationPreferences" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER credit_budgets_active_owner BEFORE INSERT OR UPDATE ON "creditBudgets" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER achievements_active_owner BEFORE INSERT OR UPDATE ON achievements FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
--> statement-breakpoint
CREATE TRIGGER marketplace_reviews_active_owner BEFORE INSERT OR UPDATE ON "marketplaceReviews" FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('buyerId');
--> statement-breakpoint
CREATE TRIGGER analytics_active_owner BEFORE INSERT OR UPDATE ON analytics_events FOR EACH ROW EXECUTE FUNCTION dreamforge_active_content_owner('userId');
