import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const digestFrequencyEnum = pgEnum("digestFrequency", ["weekly", "monthly"]);
export const tagCategoryEnum = pgEnum("tagCategory", ["genre", "theme", "style", "subject", "technique"]);
export const mediaTypeEnum = pgEnum("mediaType", ["image", "video"]);
export const generationStatusEnum = pgEnum("generationStatus", ["pending", "generating", "completed", "failed"]);
export const moderationStatusEnum = pgEnum("moderationStatus", ["pending", "approved", "rejected"]);
export const videoProjectTypeEnum = pgEnum("videoProjectType", ["storyboard", "script", "scene-direction", "soundtrack"]);
export const collabRoleEnum = pgEnum("collabRole", ["viewer", "editor"]);
export const sharePermissionEnum = pgEnum("sharePermission", ["viewer", "editor"]);
export const revisionSourceEnum = pgEnum("revisionSource", ["manual", "ai-refinement", "revert", "template"]);
export const subStatusEnum = pgEnum("subStatus", ["active", "canceled", "past_due", "trialing", "incomplete"]);
export const txTypeEnum = pgEnum("txType", ["purchase", "usage", "bonus", "refund", "subscription", "reward", "referral"]);
export const notifTypeEnum = pgEnum("notifType", ["collaboration", "generation", "comment", "system", "payment"]);
export const prefTypeEnum = pgEnum("prefType", ["collaboration", "generation", "comment", "system", "payment"]);
export const webhookStatusEnum = pgEnum("webhookStatus", ["processed", "failed", "ignored"]);
export const referralStatusEnum = pgEnum("referralStatus", ["pending", "completed", "expired"]);
export const listingTypeEnum = pgEnum("listingType", ["prompt", "preset", "workflow", "asset_pack", "lora"]);
export const listingStatusEnum = pgEnum("listingStatus", ["draft", "published", "suspended"]);
export const payoutStatusEnum = pgEnum("payoutStatus", ["pending", "paid", "failed"]);
export const audioTypeEnum = pgEnum("audioType", ["sfx", "music", "voiceover", "ambient"]);
export const audioStatusEnum = pgEnum("audioStatus", ["queued", "generating", "complete", "failed"]);
export const presetCategoryEnum = pgEnum("presetCategory", ["cinematic", "electronic", "ambient", "nature", "urban", "dramatic"]);
export const chatMsgTypeEnum = pgEnum("chatMsgType", ["text", "system", "action"]);
export const activityActionEnum = pgEnum("activityAction", [
  "clip_added",
  "clip_deleted",
  "clip_moved",
  "settings_changed",
  "member_joined",
  "member_left",
]);
export const keyframeStatusEnum = pgEnum("keyframeStatus", ["pending", "generating", "completed", "failed"]);
export const toolStatusEnum = pgEnum("toolStatus", ["active", "degraded", "offline"]);

// ─── Tool Kill-Switch ────────────────────────────────────────────────────────
// Operator-controlled per-tool status so a broken tool can be disabled without
// a redeploy. Rows present → override; rows absent → tool defaults to active.
export const toolStatus = pgTable("tool_status", {
  toolId: varchar("toolId", { length: 100 }).primaryKey(),
  status: toolStatusEnum("status").notNull().default("active"),
  message: text("message"),
  updatedBy: integer("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ToolStatus = typeof toolStatus.$inferSelect;

// ─── Tool Failure Events ─────────────────────────────────────────────────────
// Append-only log of generation failures per tool. Used for ops dashboards
// ("which tools are actually broken right now?") and for the auto-degrade
// job that flips a tool's status when failure rate spikes.
export const toolFailureEvents = pgTable(
  "tool_failure_events",
  {
    id: serial("id").primaryKey(),
    toolId: varchar("toolId", { length: 100 }).notNull(),
    errorMessage: text("errorMessage"),
    provider: varchar("provider", { length: 50 }),
    userId: integer("userId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    toolIdTimeIdx: index("tool_failure_toolid_time_idx").on(t.toolId, t.createdAt),
  }),
);
export type ToolFailureEvent = typeof toolFailureEvents.$inferSelect;

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  bio: text("bio"),
  institution: varchar("institution", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  digestEnabled: boolean("digestEnabled").default(false).notNull(),
  digestFrequency: digestFrequencyEnum("digestFrequency").default("weekly").notNull(),
  lastDigestSentAt: timestamp("lastDigestSentAt"),
  emailDigestEnabled: boolean("emailDigestEnabled").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tags ────────────────────────────────────────────────────────────────────
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  category: tagCategoryEnum("category").default("theme").notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ─── Generations ─────────────────────────────────────────────────────────────
export const generations = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  modelVersion: varchar("modelVersion", { length: 128 })
    .default("built-in-v1")
    .notNull(),
  mediaType: mediaTypeEnum("mediaType").default("image").notNull(),
  width: integer("width").default(512),
  height: integer("height").default(768),
  duration: integer("duration"), // seconds, for video
  imageUrl: text("imageUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  fileKey: varchar("fileKey", { length: 512 }),
  status: generationStatusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  parentGenerationId: integer("parentGenerationId"), // links animated video to source image
  animationStyle: varchar("animationStyle", { length: 64 }), // motion style for animation
  metadata: jsonb("metadata"), // extra generation params
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("generations_userId_idx").on(table.userId),
  index("generations_status_idx").on(table.status),
  index("generations_createdAt_idx").on(table.createdAt),
]);

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;

// ─── Generation Tags (join table) ────────────────────────────────────────────
export const generationTags = pgTable("generationTags", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  tagId: integer("tagId").notNull(),
}, (table) => [
  index("generationTags_generationId_idx").on(table.generationId),
  index("generationTags_tagId_idx").on(table.tagId),
]);

export type GenerationTag = typeof generationTags.$inferSelect;

// ─── Gallery Items (approved generations) ────────────────────────────────────
export const galleryItems = pgTable("galleryItems", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  featured: boolean("featured").default(false),
  viewCount: integer("viewCount").default(0),
  approvedAt: timestamp("approvedAt"),
  approvedBy: integer("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("galleryItems_generationId_idx").on(table.generationId),
  index("galleryItems_userId_idx").on(table.userId),
]);

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = typeof galleryItems.$inferInsert;

// ─── Moderation Queue ────────────────────────────────────────────────────────
export const moderationQueue = pgTable("moderationQueue", {
  id: serial("id").primaryKey(),
  generationId: integer("generationId").notNull(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  status: moderationStatusEnum("moderationStatus").default("pending").notNull(),
  reviewedBy: integer("reviewedBy"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("moderationQueue_status_idx").on(table.status),
]);

export type ModerationItem = typeof moderationQueue.$inferSelect;
export type InsertModerationItem = typeof moderationQueue.$inferInsert;

// ─── Video Projects ─────────────────────────────────────────────────────────
export const videoProjects = pgTable("videoProjects", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: videoProjectTypeEnum("type").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  data: jsonb("data").notNull(), // full project data (storyboard scenes, script scenes, etc.)
  thumbnailUrl: text("thumbnailUrl"),
  templateId: varchar("templateId", { length: 64 }), // if created from a template
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = typeof videoProjects.$inferInsert;

// ─── Project Collaborators ─────────────────────────────────────────────────
export const projectCollaborators = pgTable("projectCollaborators", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  userId: integer("userId").notNull(),
  role: collabRoleEnum("collabRole").default("viewer").notNull(),
  invitedBy: integer("invitedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;

// ─── Project Share Tokens ──────────────────────────────────────────────────
export const projectShareTokens = pgTable("projectShareTokens", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  permission: sharePermissionEnum("sharePermission").default("viewer").notNull(),
  createdBy: integer("createdBy").notNull(),
  expiresAt: timestamp("expiresAt"),
  maxUses: integer("maxUses"),
  useCount: integer("useCount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectShareToken = typeof projectShareTokens.$inferSelect;
export type InsertProjectShareToken = typeof projectShareTokens.$inferInsert;

// ─── Project Revisions ─────────────────────────────────────────────────────
export const projectRevisions = pgTable("projectRevisions", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  userId: integer("userId").notNull(),
  version: integer("version").notNull(),
  data: jsonb("data").notNull(),
  changeNote: text("changeNote"),
  source: revisionSourceEnum("revisionSource").default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectRevision = typeof projectRevisions.$inferSelect;
export type InsertProjectRevision = typeof projectRevisions.$inferInsert;

// ─── Gallery Likes ──────────────────────────────────────────────────────────
export const galleryLikes = pgTable("galleryLikes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  galleryItemId: integer("galleryItemId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GalleryLike = typeof galleryLikes.$inferSelect;

// ─── Gallery Comments ──────────────────────────────────────────────────────
export const galleryComments = pgTable("galleryComments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  galleryItemId: integer("galleryItemId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GalleryComment = typeof galleryComments.$inferSelect;

// ─── User Follows ──────────────────────────────────────────────────────────
export const userFollows = pgTable("userFollows", {
  id: serial("id").primaryKey(),
  followerId: integer("followerId").notNull(),
  followingId: integer("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserFollow = typeof userFollows.$inferSelect;

// ─── Characters (Consistency System) ───────────────────────────────────────
export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  referenceImages: jsonb("referenceImages"), // array of image URLs
  styleNotes: text("styleNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;

// ─── Brand Kits ────────────────────────────────────────────────────────────
export const brandKits = pgTable("brandKits", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  colorPalette: jsonb("colorPalette"), // array of hex colors
  stylePrompt: text("stylePrompt"),
  typography: varchar("typography", { length: 256 }),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BrandKit = typeof brandKits.$inferSelect;
export type InsertBrandKit = typeof brandKits.$inferInsert;

// ─── API Keys ──────────────────────────────────────────────────────────────
export const apiKeys = pgTable("apiKeys", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // first 8 chars for display
  permissions: jsonb("permissions"), // array of allowed scopes
  rateLimit: integer("rateLimit").default(100), // requests per hour
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─── Scene Keyframes (Video Generation) ────────────────────────────────────
export const sceneKeyframes = pgTable("sceneKeyframes", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  sceneIndex: integer("sceneIndex").notNull(),
  prompt: text("prompt").notNull(),
  imageUrl: text("imageUrl"),
  status: keyframeStatusEnum("keyframeStatus").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SceneKeyframe = typeof sceneKeyframes.$inferSelect;
export type InsertSceneKeyframe = typeof sceneKeyframes.$inferInsert;

// ─── Subscription Plans ──────────────────────────────────────────────────
export const subscriptionPlans = pgTable("subscriptionPlans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(), // free/creator/pro/studio/enterprise
  displayName: varchar("displayName", { length: 128 }).notNull(),
  price: integer("price").default(0).notNull(), // cents (0/1200/3500/7500/0)
  monthlyCredits: integer("monthlyCredits").default(0).notNull(), // 1500/30000/150000/450000/0
  features: jsonb("features"), // JSON array of feature strings
  stripeProductId: varchar("stripeProductId", { length: 128 }),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ─── User Subscriptions ─────────────────────────────────────────────────
export const userSubscriptions = pgTable("userSubscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  planId: integer("planId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  status: subStatusEnum("subStatus").default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Credit Balances ──────────────────────────────────────────────────────
export const creditBalances = pgTable("creditBalances", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  balance: integer("balance").default(50).notNull(), // free starter credits
  monthlyAllocation: integer("monthlyAllocation").default(0).notNull(), // credits from subscription
  bonusCredits: integer("bonusCredits").default(0).notNull(), // extra purchased/reward credits
  lifetimeSpent: integer("lifetimeSpent").default(0).notNull(),
  lastResetAt: timestamp("lastResetAt"), // when monthly credits were last allocated
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CreditBalance = typeof creditBalances.$inferSelect;
export type InsertCreditBalance = typeof creditBalances.$inferInsert;

// ─── Credit Transactions ─────────────────────────────────────────────────
export const creditTransactions = pgTable("creditTransactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: integer("amount").notNull(), // positive = purchase, negative = usage
  type: txTypeEnum("txType").notNull(),
  description: varchar("description", { length: 512 }),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  metadata: jsonb("txMetadata"), // extra context (plan change, etc.)
  expiresAt: timestamp("expiresAt"), // null = never expires; set for bonus/signup credits
  expired: boolean("expired").default(false).notNull(), // true once credits have been deducted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("creditTransactions_userId_idx").on(table.userId),
  // Composite (userId, createdAt DESC) for billing reports / audit queries
  // that list a user's transactions ordered by time. Much faster than the
  // userId-only index when users have many transactions.
  index("creditTransactions_user_time_idx").on(table.userId, table.createdAt),
]);

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notifTypeEnum("notifType").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: jsonb("metadata"), // extra data (projectId, generationId, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notifications_userId_idx").on(table.userId),
]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Notification Preferences ─────────────────────────────────────────────
export const notificationPreferences = pgTable("notificationPreferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: prefTypeEnum("prefType").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ─── Newsletter Signups ───────────────────────────────────────────────────
// Was a UI-only stub that flipped a "thanks!" state without saving anything;
// now actually persists emails so the footer signup does real work.
export const newsletterSignups = pgTable("newsletter_signups", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  ip: varchar("ip", { length: 64 }),
  source: varchar("source", { length: 64 }).default("footer"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Rate Limit Hits ──────────────────────────────────────────────────────
// One row per request, pruned periodically. Replaces the in-memory limiter
// that was effectively a no-op on Vercel serverless (every cold start = new
// process = empty Map). Keys look like "generation.create:user:42" or
// "video.textToVideo:ip:1.2.3.4".
export const rateLimitHits = pgTable("rate_limit_hits", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 256 }).notNull(),
  ts: timestamp("ts").defaultNow().notNull(),
}, (table) => [
  index("rate_limit_hits_key_ts_idx").on(table.key, table.ts),
]);

export type RateLimitHit = typeof rateLimitHits.$inferSelect;

// ─── Webhook Events ──────────────────────────────────────────────────────
export const webhookEvents = pgTable("webhookEvents", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 256 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  status: webhookStatusEnum("webhookStatus").default("processed").notNull(),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// ─── Referrals ────────────────────────────────────────────────────────────
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrerId").notNull(),
  referredUserId: integer("referredUserId"),
  code: varchar("code", { length: 32 }).notNull().unique(),
  status: referralStatusEnum("referralStatus").default("pending").notNull(),
  creditsAwarded: integer("creditsAwarded").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ─── Credit Budgets ──────────────────────────────────────────────────────
export const creditBudgets = pgTable("creditBudgets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  dailyLimit: integer("dailyLimit"), // null = no daily limit
  weeklyLimit: integer("weeklyLimit"), // null = no weekly limit
  alertThreshold: integer("alertThreshold").default(80).notNull(), // percentage (0-100)
  enabled: boolean("enabled").default(false).notNull(),
  budgetEmailEnabled: boolean("budgetEmailEnabled").default(true).notNull(),
  lastDailyAlertAt: timestamp("lastDailyAlertAt"),
  lastWeeklyAlertAt: timestamp("lastWeeklyAlertAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CreditBudget = typeof creditBudgets.$inferSelect;
export type InsertCreditBudget = typeof creditBudgets.$inferInsert;

// ─── Achievements ────────────────────────────────────────────────────────
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  achievementType: varchar("achievementType", { length: 64 }).notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
  metadata: jsonb("metadata"), // extra data (count, generation id, etc.)
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

// ─── Marketplace Listings ────────────────────────────────────────────────────
export const marketplaceListings = pgTable("marketplaceListings", {
  id: serial("id").primaryKey(),
  sellerId: integer("sellerId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  type: listingTypeEnum("listingType").notNull(),
  price: integer("price").default(0).notNull(), // cents, 0 = free
  previewImages: jsonb("previewImages"), // JSON array of URLs
  promptData: jsonb("promptData"), // the actual content being sold
  tags: jsonb("listingTags"), // JSON array of strings
  downloads: integer("downloads").default(0).notNull(),
  rating: integer("rating").default(0).notNull(), // stored as rating * 100 for precision (e.g. 450 = 4.50)
  ratingCount: integer("ratingCount").default(0).notNull(),
  status: listingStatusEnum("listingStatus").default("draft").notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  index("marketplaceListings_sellerId_idx").on(table.sellerId),
  index("marketplaceListings_status_idx").on(table.status),
]);

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = typeof marketplaceListings.$inferInsert;

// ─── Marketplace Purchases ──────────────────────────────────────────────────
export const marketplacePurchases = pgTable("marketplacePurchases", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyerId").notNull(),
  listingId: integer("listingId").notNull(),
  price: integer("price").notNull(), // cents paid
  platformFee: integer("platformFee").notNull(), // 20% platform fee in cents
  sellerPayout: integer("sellerPayout").notNull(), // 80% seller payout in cents
  stripePaymentId: varchar("stripePaymentId", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type InsertMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

// ─── Marketplace Reviews ────────────────────────────────────────────────────
export const marketplaceReviews = pgTable("marketplaceReviews", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyerId").notNull(),
  listingId: integer("listingId").notNull(),
  rating: integer("reviewRating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketplaceReview = typeof marketplaceReviews.$inferSelect;
export type InsertMarketplaceReview = typeof marketplaceReviews.$inferInsert;

// ─── Seller Profiles ────────────────────────────────────────────────────────
export const sellerProfiles = pgTable("sellerProfiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  bannerUrl: text("bannerUrl"),
  totalSales: integer("totalSales").default(0).notNull(),
  totalEarnings: integer("totalEarnings").default(0).notNull(), // cents
  payoutBalance: integer("payoutBalance").default(0).notNull(), // cents available to withdraw
  stripeConnectId: varchar("stripeConnectId", { length: 128 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type InsertSellerProfile = typeof sellerProfiles.$inferInsert;

// ─── Seller Payouts ─────────────────────────────────────────────────────────
export const sellerPayouts = pgTable("sellerPayouts", {
  id: serial("id").primaryKey(),
  sellerId: integer("sellerId").notNull(),
  amount: integer("amount").notNull(), // cents
  stripeTransferId: varchar("stripeTransferId", { length: 256 }),
  status: payoutStatusEnum("payoutStatus").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SellerPayout = typeof sellerPayouts.$inferSelect;
export type InsertSellerPayout = typeof sellerPayouts.$inferInsert;

// ─── Audio Generations ──────────────────────────────────────────────────────
export const audioGenerations = pgTable("audioGenerations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: audioTypeEnum("audioType").notNull(),
  prompt: text("prompt").notNull(),
  duration: integer("duration").notNull(), // seconds
  model: varchar("model", { length: 128 }).default("musicgen").notNull(),
  status: audioStatusEnum("audioStatus").default("queued").notNull(),
  audioUrl: text("audioUrl"),
  errorMessage: text("errorMessage"),
  metadata: jsonb("metadata"), // waveform data, bpm, key, etc.
  projectId: integer("projectId"), // optional link to videoProject
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AudioGeneration = typeof audioGenerations.$inferSelect;
export type InsertAudioGeneration = typeof audioGenerations.$inferInsert;

// ─── Audio Presets ──────────────────────────────────────────────────────────
export const audioPresets = pgTable("audioPresets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: presetCategoryEnum("presetCategory").notNull(),
  settings: jsonb("settings").notNull(), // preset config JSON
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AudioPreset = typeof audioPresets.$inferSelect;
export type InsertAudioPreset = typeof audioPresets.$inferInsert;

// ─── Project Chat Messages ──────────────────────────────────────────────────
export const projectChatMessages = pgTable("projectChatMessages", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  userId: integer("userId").notNull(),
  message: text("message").notNull(),
  type: chatMsgTypeEnum("chatMsgType").default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectChatMessage = typeof projectChatMessages.$inferSelect;
export type InsertProjectChatMessage = typeof projectChatMessages.$inferInsert;

// ─── Project Activity Log ───────────────────────────────────────────────────
export const projectActivityLog = pgTable("projectActivityLog", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull(),
  userId: integer("userId").notNull(),
  action: activityActionEnum("activityAction").notNull(),
  details: jsonb("activityDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectActivityLogEntry = typeof projectActivityLog.$inferSelect;
export type InsertProjectActivityLogEntry = typeof projectActivityLog.$inferInsert;

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
  galleryItems: many(galleryItems),
  videoProjects: many(videoProjects),
  audioGenerations: many(audioGenerations),
}));

export const generationsRelations = relations(generations, ({ one, many }) => ({
  user: one(users, { fields: [generations.userId], references: [users.id] }),
  tags: many(generationTags),
  galleryItem: one(galleryItems, {
    fields: [generations.id],
    references: [galleryItems.generationId],
  }),
}));

export const generationTagsRelations = relations(generationTags, ({ one }) => ({
  generation: one(generations, {
    fields: [generationTags.generationId],
    references: [generations.id],
  }),
  tag: one(tags, { fields: [generationTags.tagId], references: [tags.id] }),
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  generation: one(generations, {
    fields: [galleryItems.generationId],
    references: [generations.id],
  }),
  user: one(users, { fields: [galleryItems.userId], references: [users.id] }),
  approver: one(users, {
    fields: [galleryItems.approvedBy],
    references: [users.id],
  }),
}));

export const moderationQueueRelations = relations(
  moderationQueue,
  ({ one }) => ({
    generation: one(generations, {
      fields: [moderationQueue.generationId],
      references: [generations.id],
    }),
    user: one(users, {
      fields: [moderationQueue.userId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [moderationQueue.reviewedBy],
      references: [users.id],
    }),
  })
);

export const tagsRelations = relations(tags, ({ many }) => ({
  generationTags: many(generationTags),
}));

export const videoProjectsRelations = relations(videoProjects, ({ one, many }) => ({
  user: one(users, { fields: [videoProjects.userId], references: [users.id] }),
  collaborators: many(projectCollaborators),
  shareTokens: many(projectShareTokens),
  revisions: many(projectRevisions),
  audioTracks: many(audioGenerations),
}));

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(videoProjects, { fields: [projectCollaborators.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectCollaborators.userId], references: [users.id] }),
  inviter: one(users, { fields: [projectCollaborators.invitedBy], references: [users.id] }),
}));

export const projectShareTokensRelations = relations(projectShareTokens, ({ one }) => ({
  project: one(videoProjects, { fields: [projectShareTokens.projectId], references: [videoProjects.id] }),
  creator: one(users, { fields: [projectShareTokens.createdBy], references: [users.id] }),
}));

export const projectRevisionsRelations = relations(projectRevisions, ({ one }) => ({
  project: one(videoProjects, { fields: [projectRevisions.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectRevisions.userId], references: [users.id] }),
}));

export const audioGenerationsRelations = relations(audioGenerations, ({ one }) => ({
  user: one(users, { fields: [audioGenerations.userId], references: [users.id] }),
  project: one(videoProjects, { fields: [audioGenerations.projectId], references: [videoProjects.id] }),
}));

// ─── Marketplace Relations ──────────────────────────────────────────────────

export const marketplaceListingsRelations = relations(marketplaceListings, ({ one, many }) => ({
  seller: one(users, { fields: [marketplaceListings.sellerId], references: [users.id] }),
  purchases: many(marketplacePurchases),
  reviews: many(marketplaceReviews),
}));

export const marketplacePurchasesRelations = relations(marketplacePurchases, ({ one }) => ({
  buyer: one(users, { fields: [marketplacePurchases.buyerId], references: [users.id] }),
  listing: one(marketplaceListings, { fields: [marketplacePurchases.listingId], references: [marketplaceListings.id] }),
}));

export const marketplaceReviewsRelations = relations(marketplaceReviews, ({ one }) => ({
  buyer: one(users, { fields: [marketplaceReviews.buyerId], references: [users.id] }),
  listing: one(marketplaceListings, { fields: [marketplaceReviews.listingId], references: [marketplaceListings.id] }),
}));

export const sellerProfilesRelations = relations(sellerProfiles, ({ one, many }) => ({
  user: one(users, { fields: [sellerProfiles.userId], references: [users.id] }),
  payouts: many(sellerPayouts),
}));

export const sellerPayoutsRelations = relations(sellerPayouts, ({ one }) => ({
  seller: one(sellerProfiles, { fields: [sellerPayouts.sellerId], references: [sellerProfiles.id] }),
}));

// ─── Chat & Activity Relations ──────────────────────────────────────────────
export const projectChatMessagesRelations = relations(projectChatMessages, ({ one }) => ({
  project: one(videoProjects, { fields: [projectChatMessages.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectChatMessages.userId], references: [users.id] }),
}));

export const projectActivityLogRelations = relations(projectActivityLog, ({ one }) => ({
  project: one(videoProjects, { fields: [projectActivityLog.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectActivityLog.userId], references: [users.id] }),
}));

// ─── Auth.js Drizzle Adapter Tables ──────────────────────────────────────────
// These are the tables required by @auth/drizzle-adapter to support email
// magic-link sign-in. They live alongside the app's existing `users` table —
// the context bridge in server/_core/context.ts continues to find or create
// the app user row via email, so nothing in the rest of the app has to care
// about these. See project_dreamforge_magic_link_todo.md for the design note.
export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});
export type AuthUser = typeof authUsers.$inferSelect;

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: text("userId").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);
