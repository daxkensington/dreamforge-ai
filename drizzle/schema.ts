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

// ─── Credit Balances ──────────────────────────────────────────────────────
export const creditBalances = mysqlTable("creditBalances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: int("balance").default(50).notNull(), // free starter credits
  lifetimeSpent: int("lifetimeSpent").default(0).notNull(),
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
  type: mysqlEnum("txType", ["purchase", "usage", "bonus", "refund"]).notNull(),
  description: varchar("description", { length: 512 }),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 256 }),
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

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
  galleryItems: many(galleryItems),
  videoProjects: many(videoProjects),
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
