import { relations } from "drizzle-orm";
import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  bio: text("bio"),
  institution: varchar("institution", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  digestEnabled: boolean("digestEnabled").default(false).notNull(),
  digestFrequency: mysqlEnum("digestFrequency", ["weekly", "monthly"]).default("weekly").notNull(),
  lastDigestSentAt: timestamp("lastDigestSentAt"),
  emailDigestEnabled: boolean("emailDigestEnabled").default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tags ────────────────────────────────────────────────────────────────────
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  category: mysqlEnum("category", [
    "genre",
    "theme",
    "style",
    "subject",
    "technique",
  ])
    .default("theme")
    .notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ─── Generations ─────────────────────────────────────────────────────────────
export const generations = mysqlTable("generations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negativePrompt"),
  modelVersion: varchar("modelVersion", { length: 128 })
    .default("built-in-v1")
    .notNull(),
  mediaType: mysqlEnum("mediaType", ["image", "video"])
    .default("image")
    .notNull(),
  width: int("width").default(512),
  height: int("height").default(768),
  duration: int("duration"), // seconds, for video
  imageUrl: text("imageUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  fileKey: varchar("fileKey", { length: 512 }),
  status: mysqlEnum("status", [
    "pending",
    "generating",
    "completed",
    "failed",
  ])
    .default("pending")
    .notNull(),
  errorMessage: text("errorMessage"),
  parentGenerationId: int("parentGenerationId"), // links animated video to source image
  animationStyle: varchar("animationStyle", { length: 64 }), // motion style for animation
  metadata: json("metadata"), // extra generation params
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type InsertGeneration = typeof generations.$inferInsert;

// ─── Generation Tags (join table) ────────────────────────────────────────────
export const generationTags = mysqlTable("generationTags", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  tagId: int("tagId").notNull(),
});

export type GenerationTag = typeof generationTags.$inferSelect;

// ─── Gallery Items (approved generations) ────────────────────────────────────
export const galleryItems = mysqlTable("galleryItems", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  featured: boolean("featured").default(false),
  viewCount: int("viewCount").default(0),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GalleryItem = typeof galleryItems.$inferSelect;
export type InsertGalleryItem = typeof galleryItems.$inferInsert;

// ─── Moderation Queue ────────────────────────────────────────────────────────
export const moderationQueue = mysqlTable("moderationQueue", {
  id: int("id").autoincrement().primaryKey(),
  generationId: int("generationId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  status: mysqlEnum("moderationStatus", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  reviewedBy: int("reviewedBy"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModerationItem = typeof moderationQueue.$inferSelect;
export type InsertModerationItem = typeof moderationQueue.$inferInsert;

// ─── Video Projects ─────────────────────────────────────────────────────────
export const videoProjects = mysqlTable("videoProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["storyboard", "script", "scene-direction", "soundtrack"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  data: json("data").notNull(), // full project data (storyboard scenes, script scenes, etc.)
  thumbnailUrl: text("thumbnailUrl"),
  templateId: varchar("templateId", { length: 64 }), // if created from a template
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = typeof videoProjects.$inferInsert;

// ─── Project Collaborators ─────────────────────────────────────────────────
export const projectCollaborators = mysqlTable("projectCollaborators", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("collabRole", ["viewer", "editor"]).default("viewer").notNull(),
  invitedBy: int("invitedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;

// ─── Project Share Tokens ──────────────────────────────────────────────────
export const projectShareTokens = mysqlTable("projectShareTokens", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  permission: mysqlEnum("sharePermission", ["viewer", "editor"]).default("viewer").notNull(),
  createdBy: int("createdBy").notNull(),
  expiresAt: timestamp("expiresAt"),
  maxUses: int("maxUses"),
  useCount: int("useCount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectShareToken = typeof projectShareTokens.$inferSelect;
export type InsertProjectShareToken = typeof projectShareTokens.$inferInsert;

// ─── Project Revisions ─────────────────────────────────────────────────────
export const projectRevisions = mysqlTable("projectRevisions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  version: int("version").notNull(),
  data: json("data").notNull(),
  changeNote: text("changeNote"),
  source: mysqlEnum("revisionSource", ["manual", "ai-refinement", "revert", "template"]).default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectRevision = typeof projectRevisions.$inferSelect;
export type InsertProjectRevision = typeof projectRevisions.$inferInsert;

// ─── Gallery Likes ──────────────────────────────────────────────────────────
export const galleryLikes = mysqlTable("galleryLikes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  galleryItemId: int("galleryItemId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GalleryLike = typeof galleryLikes.$inferSelect;

// ─── Gallery Comments ──────────────────────────────────────────────────────
export const galleryComments = mysqlTable("galleryComments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  galleryItemId: int("galleryItemId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GalleryComment = typeof galleryComments.$inferSelect;

// ─── User Follows ──────────────────────────────────────────────────────────
export const userFollows = mysqlTable("userFollows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserFollow = typeof userFollows.$inferSelect;

// ─── Characters (Consistency System) ───────────────────────────────────────
export const characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  referenceImages: json("referenceImages"), // array of image URLs
  styleNotes: text("styleNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;

// ─── Brand Kits ────────────────────────────────────────────────────────────
export const brandKits = mysqlTable("brandKits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  colorPalette: json("colorPalette"), // array of hex colors
  stylePrompt: text("stylePrompt"),
  typography: varchar("typography", { length: 256 }),
  logoUrl: text("logoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandKit = typeof brandKits.$inferSelect;
export type InsertBrandKit = typeof brandKits.$inferInsert;

// ─── API Keys ──────────────────────────────────────────────────────────────
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // first 8 chars for display
  permissions: json("permissions"), // array of allowed scopes
  rateLimit: int("rateLimit").default(100), // requests per hour
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ─── Scene Keyframes (Video Generation) ────────────────────────────────────
export const sceneKeyframes = mysqlTable("sceneKeyframes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sceneIndex: int("sceneIndex").notNull(),
  prompt: text("prompt").notNull(),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("keyframeStatus", ["pending", "generating", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SceneKeyframe = typeof sceneKeyframes.$inferSelect;
export type InsertSceneKeyframe = typeof sceneKeyframes.$inferInsert;

// ─── Subscription Plans ──────────────────────────────────────────────────
export const subscriptionPlans = mysqlTable("subscriptionPlans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(), // free/creator/pro/studio/enterprise
  displayName: varchar("displayName", { length: 128 }).notNull(),
  price: int("price").default(0).notNull(), // cents (0/1200/3500/7500/0)
  monthlyCredits: int("monthlyCredits").default(0).notNull(), // 1500/30000/150000/450000/0
  features: json("features"), // JSON array of feature strings
  stripeProductId: varchar("stripeProductId", { length: 128 }),
  stripePriceId: varchar("stripePriceId", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ─── User Subscriptions ─────────────────────────────────────────────────
export const userSubscriptions = mysqlTable("userSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  status: mysqlEnum("subStatus", ["active", "canceled", "past_due", "trialing", "incomplete"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Credit Balances ──────────────────────────────────────────────────────
export const creditBalances = mysqlTable("creditBalances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").default(50).notNull(), // free starter credits
  monthlyAllocation: int("monthlyAllocation").default(0).notNull(), // credits from subscription
  bonusCredits: int("bonusCredits").default(0).notNull(), // extra purchased/reward credits
  lifetimeSpent: int("lifetimeSpent").default(0).notNull(),
  lastResetAt: timestamp("lastResetAt"), // when monthly credits were last allocated
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditBalance = typeof creditBalances.$inferSelect;
export type InsertCreditBalance = typeof creditBalances.$inferInsert;

// ─── Credit Transactions ─────────────────────────────────────────────────
export const creditTransactions = mysqlTable("creditTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // positive = purchase, negative = usage
  type: mysqlEnum("txType", ["purchase", "usage", "bonus", "refund", "subscription", "reward", "referral"]).notNull(),
  description: varchar("description", { length: 512 }),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
  metadata: json("txMetadata"), // extra context (plan change, etc.)
  expiresAt: timestamp("expiresAt"), // null = never expires; set for bonus/signup credits
  expired: boolean("expired").default(false).notNull(), // true once credits have been deducted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

// ─── Notifications ────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("notifType", ["collaboration", "generation", "comment", "system", "payment"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  metadata: json("metadata"), // extra data (projectId, generationId, etc.)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Notification Preferences ─────────────────────────────────────────────
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("prefType", ["collaboration", "generation", "comment", "system", "payment"]).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

// ─── Webhook Events ──────────────────────────────────────────────────────
export const webhookEvents = mysqlTable("webhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 256 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  status: mysqlEnum("webhookStatus", ["processed", "failed", "ignored"]).default("processed").notNull(),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// ─── Referrals ────────────────────────────────────────────────────────────
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(),
  referredUserId: int("referredUserId"),
  code: varchar("code", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "completed", "expired"]).default("pending").notNull(),
  creditsAwarded: int("creditsAwarded").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

// ─── Credit Budgets ──────────────────────────────────────────────────────
export const creditBudgets = mysqlTable("creditBudgets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dailyLimit: int("dailyLimit"), // null = no daily limit
  weeklyLimit: int("weeklyLimit"), // null = no weekly limit
  alertThreshold: int("alertThreshold").default(80).notNull(), // percentage (0-100)
  enabled: boolean("enabled").default(false).notNull(),
  budgetEmailEnabled: boolean("budgetEmailEnabled").default(true).notNull(),
  lastDailyAlertAt: timestamp("lastDailyAlertAt"),
  lastWeeklyAlertAt: timestamp("lastWeeklyAlertAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CreditBudget = typeof creditBudgets.$inferSelect;
export type InsertCreditBudget = typeof creditBudgets.$inferInsert;

// ─── Achievements ────────────────────────────────────────────────────────
export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementType: varchar("achievementType", { length: 64 }).notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
  metadata: json("metadata"), // extra data (count, generation id, etc.)
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

// ─── Marketplace Listings ────────────────────────────────────────────────────
export const marketplaceListings = mysqlTable("marketplaceListings", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  type: mysqlEnum("listingType", ["prompt", "preset", "workflow", "asset_pack", "lora"]).notNull(),
  price: int("price").default(0).notNull(), // cents, 0 = free
  previewImages: json("previewImages"), // JSON array of URLs
  promptData: json("promptData"), // the actual content being sold
  tags: json("listingTags"), // JSON array of strings
  downloads: int("downloads").default(0).notNull(),
  rating: int("rating").default(0).notNull(), // stored as rating * 100 for precision (e.g. 450 = 4.50)
  ratingCount: int("ratingCount").default(0).notNull(),
  status: mysqlEnum("listingStatus", ["draft", "published", "suspended"]).default("draft").notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type InsertMarketplaceListing = typeof marketplaceListings.$inferInsert;

// ─── Marketplace Purchases ──────────────────────────────────────────────────
export const marketplacePurchases = mysqlTable("marketplacePurchases", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyerId").notNull(),
  listingId: int("listingId").notNull(),
  price: int("price").notNull(), // cents paid
  platformFee: int("platformFee").notNull(), // 20% platform fee in cents
  sellerPayout: int("sellerPayout").notNull(), // 80% seller payout in cents
  stripePaymentId: varchar("stripePaymentId", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type InsertMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

// ─── Marketplace Reviews ────────────────────────────────────────────────────
export const marketplaceReviews = mysqlTable("marketplaceReviews", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyerId").notNull(),
  listingId: int("listingId").notNull(),
  rating: int("reviewRating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketplaceReview = typeof marketplaceReviews.$inferSelect;
export type InsertMarketplaceReview = typeof marketplaceReviews.$inferInsert;

// ─── Seller Profiles ────────────────────────────────────────────────────────
export const sellerProfiles = mysqlTable("sellerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  bannerUrl: text("bannerUrl"),
  totalSales: int("totalSales").default(0).notNull(),
  totalEarnings: int("totalEarnings").default(0).notNull(), // cents
  payoutBalance: int("payoutBalance").default(0).notNull(), // cents available to withdraw
  stripeConnectId: varchar("stripeConnectId", { length: 128 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type InsertSellerProfile = typeof sellerProfiles.$inferInsert;

// ─── Seller Payouts ─────────────────────────────────────────────────────────
export const sellerPayouts = mysqlTable("sellerPayouts", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId").notNull(),
  amount: int("amount").notNull(), // cents
  stripeTransferId: varchar("stripeTransferId", { length: 256 }),
  status: mysqlEnum("payoutStatus", ["pending", "paid", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SellerPayout = typeof sellerPayouts.$inferSelect;
export type InsertSellerPayout = typeof sellerPayouts.$inferInsert;

// ─── Audio Generations ──────────────────────────────────────────────────────
export const audioGenerations = mysqlTable("audioGenerations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("audioType", ["sfx", "music", "voiceover", "ambient"]).notNull(),
  prompt: text("prompt").notNull(),
  duration: int("duration").notNull(), // seconds
  model: varchar("model", { length: 128 }).default("musicgen").notNull(),
  status: mysqlEnum("audioStatus", ["queued", "generating", "complete", "failed"]).default("queued").notNull(),
  audioUrl: text("audioUrl"),
  errorMessage: text("errorMessage"),
  metadata: json("metadata"), // waveform data, bpm, key, etc.
  projectId: int("projectId"), // optional link to videoProject
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AudioGeneration = typeof audioGenerations.$inferSelect;
export type InsertAudioGeneration = typeof audioGenerations.$inferInsert;

// ─── Audio Presets ──────────────────────────────────────────────────────────
export const audioPresets = mysqlTable("audioPresets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  category: mysqlEnum("presetCategory", ["cinematic", "electronic", "ambient", "nature", "urban", "dramatic"]).notNull(),
  settings: json("settings").notNull(), // preset config JSON
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AudioPreset = typeof audioPresets.$inferSelect;
export type InsertAudioPreset = typeof audioPresets.$inferInsert;

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

// ─── Project Chat Messages ──────────────────────────────────────────────────
export const projectChatMessages = mysqlTable("projectChatMessages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("chatMsgType", ["text", "system", "action"]).default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectChatMessage = typeof projectChatMessages.$inferSelect;
export type InsertProjectChatMessage = typeof projectChatMessages.$inferInsert;

// ─── Project Activity Log ───────────────────────────────────────────────────
export const projectActivityLog = mysqlTable("projectActivityLog", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  action: mysqlEnum("activityAction", [
    "clip_added",
    "clip_deleted",
    "clip_moved",
    "settings_changed",
    "member_joined",
    "member_left",
  ]).notNull(),
  details: json("activityDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectActivityLogEntry = typeof projectActivityLog.$inferSelect;
export type InsertProjectActivityLogEntry = typeof projectActivityLog.$inferInsert;

// ─── Chat & Activity Relations ──────────────────────────────────────────────
export const projectChatMessagesRelations = relations(projectChatMessages, ({ one }) => ({
  project: one(videoProjects, { fields: [projectChatMessages.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectChatMessages.userId], references: [users.id] }),
}));

export const projectActivityLogRelations = relations(projectActivityLog, ({ one }) => ({
  project: one(videoProjects, { fields: [projectActivityLog.projectId], references: [videoProjects.id] }),
  user: one(users, { fields: [projectActivityLog.userId], references: [users.id] }),
}));
