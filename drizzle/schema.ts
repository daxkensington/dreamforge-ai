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

// ─── Relations ───────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(generations),
  galleryItems: many(galleryItems),
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
