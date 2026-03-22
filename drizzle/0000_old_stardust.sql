CREATE TYPE "public"."activityAction" AS ENUM('clip_added', 'clip_deleted', 'clip_moved', 'settings_changed', 'member_joined', 'member_left');--> statement-breakpoint
CREATE TYPE "public"."audioStatus" AS ENUM('queued', 'generating', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."audioType" AS ENUM('sfx', 'music', 'voiceover', 'ambient');--> statement-breakpoint
CREATE TYPE "public"."chatMsgType" AS ENUM('text', 'system', 'action');--> statement-breakpoint
CREATE TYPE "public"."collabRole" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TYPE "public"."digestFrequency" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."generationStatus" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."keyframeStatus" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."listingStatus" AS ENUM('draft', 'published', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."listingType" AS ENUM('prompt', 'preset', 'workflow', 'asset_pack', 'lora');--> statement-breakpoint
CREATE TYPE "public"."mediaType" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."moderationStatus" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notifType" AS ENUM('collaboration', 'generation', 'comment', 'system', 'payment');--> statement-breakpoint
CREATE TYPE "public"."payoutStatus" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prefType" AS ENUM('collaboration', 'generation', 'comment', 'system', 'payment');--> statement-breakpoint
CREATE TYPE "public"."presetCategory" AS ENUM('cinematic', 'electronic', 'ambient', 'nature', 'urban', 'dramatic');--> statement-breakpoint
CREATE TYPE "public"."referralStatus" AS ENUM('pending', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."revisionSource" AS ENUM('manual', 'ai-refinement', 'revert', 'template');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."sharePermission" AS ENUM('viewer', 'editor');--> statement-breakpoint
CREATE TYPE "public"."subStatus" AS ENUM('active', 'canceled', 'past_due', 'trialing', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."tagCategory" AS ENUM('genre', 'theme', 'style', 'subject', 'technique');--> statement-breakpoint
CREATE TYPE "public"."txType" AS ENUM('purchase', 'usage', 'bonus', 'refund', 'subscription', 'reward', 'referral');--> statement-breakpoint
CREATE TYPE "public"."videoProjectType" AS ENUM('storyboard', 'script', 'scene-direction', 'soundtrack');--> statement-breakpoint
CREATE TYPE "public"."webhookStatus" AS ENUM('processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"achievementType" varchar(64) NOT NULL,
	"unlockedAt" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "apiKeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"keyHash" varchar(128) NOT NULL,
	"keyPrefix" varchar(12) NOT NULL,
	"permissions" jsonb,
	"rateLimit" integer DEFAULT 100,
	"lastUsedAt" timestamp,
	"expiresAt" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apiKeys_keyHash_unique" UNIQUE("keyHash")
);
--> statement-breakpoint
CREATE TABLE "audioGenerations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"audioType" "audioType" NOT NULL,
	"prompt" text NOT NULL,
	"duration" integer NOT NULL,
	"model" varchar(128) DEFAULT 'musicgen' NOT NULL,
	"audioStatus" "audioStatus" DEFAULT 'queued' NOT NULL,
	"audioUrl" text,
	"errorMessage" text,
	"metadata" jsonb,
	"projectId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audioPresets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"presetCategory" "presetCategory" NOT NULL,
	"settings" jsonb NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brandKits" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"colorPalette" jsonb,
	"stylePrompt" text,
	"typography" varchar(256),
	"logoUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"referenceImages" jsonb,
	"styleNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creditBalances" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"balance" integer DEFAULT 50 NOT NULL,
	"monthlyAllocation" integer DEFAULT 0 NOT NULL,
	"bonusCredits" integer DEFAULT 0 NOT NULL,
	"lifetimeSpent" integer DEFAULT 0 NOT NULL,
	"lastResetAt" timestamp,
	"stripeCustomerId" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creditBalances_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "creditBudgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"dailyLimit" integer,
	"weeklyLimit" integer,
	"alertThreshold" integer DEFAULT 80 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"budgetEmailEnabled" boolean DEFAULT true NOT NULL,
	"lastDailyAlertAt" timestamp,
	"lastWeeklyAlertAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creditBudgets_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "creditTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amount" integer NOT NULL,
	"txType" "txType" NOT NULL,
	"description" varchar(512),
	"stripeSessionId" varchar(256),
	"stripePaymentIntentId" varchar(256),
	"txMetadata" jsonb,
	"expiresAt" timestamp,
	"expired" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleryComments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"galleryItemId" integer NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleryItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(256),
	"description" text,
	"featured" boolean DEFAULT false,
	"viewCount" integer DEFAULT 0,
	"approvedAt" timestamp,
	"approvedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "galleryLikes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"galleryItemId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generationTags" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"tagId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"prompt" text NOT NULL,
	"negativePrompt" text,
	"modelVersion" varchar(128) DEFAULT 'built-in-v1' NOT NULL,
	"mediaType" "mediaType" DEFAULT 'image' NOT NULL,
	"width" integer DEFAULT 512,
	"height" integer DEFAULT 768,
	"duration" integer,
	"imageUrl" text,
	"thumbnailUrl" text,
	"fileKey" varchar(512),
	"status" "generationStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"parentGenerationId" integer,
	"animationStyle" varchar(64),
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplaceListings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sellerId" integer NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"listingType" "listingType" NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"previewImages" jsonb,
	"promptData" jsonb,
	"listingTags" jsonb,
	"downloads" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"ratingCount" integer DEFAULT 0 NOT NULL,
	"listingStatus" "listingStatus" DEFAULT 'draft' NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplacePurchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyerId" integer NOT NULL,
	"listingId" integer NOT NULL,
	"price" integer NOT NULL,
	"platformFee" integer NOT NULL,
	"sellerPayout" integer NOT NULL,
	"stripePaymentId" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplaceReviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyerId" integer NOT NULL,
	"listingId" integer NOT NULL,
	"reviewRating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderationQueue" (
	"id" serial PRIMARY KEY NOT NULL,
	"generationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(256),
	"description" text,
	"moderationStatus" "moderationStatus" DEFAULT 'pending' NOT NULL,
	"reviewedBy" integer,
	"reviewNote" text,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificationPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"prefType" "prefType" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"notifType" "notifType" NOT NULL,
	"title" varchar(256) NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectActivityLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"activityAction" "activityAction" NOT NULL,
	"activityDetails" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectChatMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"message" text NOT NULL,
	"chatMsgType" "chatMsgType" DEFAULT 'text' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectCollaborators" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"collabRole" "collabRole" DEFAULT 'viewer' NOT NULL,
	"invitedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectRevisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"userId" integer NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"changeNote" text,
	"revisionSource" "revisionSource" DEFAULT 'manual' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projectShareTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"sharePermission" "sharePermission" DEFAULT 'viewer' NOT NULL,
	"createdBy" integer NOT NULL,
	"expiresAt" timestamp,
	"maxUses" integer,
	"useCount" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projectShareTokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" integer NOT NULL,
	"referredUserId" integer,
	"code" varchar(32) NOT NULL,
	"referralStatus" "referralStatus" DEFAULT 'pending' NOT NULL,
	"creditsAwarded" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	CONSTRAINT "referrals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sceneKeyframes" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"sceneIndex" integer NOT NULL,
	"prompt" text NOT NULL,
	"imageUrl" text,
	"keyframeStatus" "keyframeStatus" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellerPayouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"sellerId" integer NOT NULL,
	"amount" integer NOT NULL,
	"stripeTransferId" varchar(256),
	"payoutStatus" "payoutStatus" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellerProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"displayName" varchar(128) NOT NULL,
	"bio" text,
	"avatarUrl" text,
	"bannerUrl" text,
	"totalSales" integer DEFAULT 0 NOT NULL,
	"totalEarnings" integer DEFAULT 0 NOT NULL,
	"payoutBalance" integer DEFAULT 0 NOT NULL,
	"stripeConnectId" varchar(128),
	"isVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sellerProfiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "subscriptionPlans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"displayName" varchar(128) NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"monthlyCredits" integer DEFAULT 0 NOT NULL,
	"features" jsonb,
	"stripeProductId" varchar(128),
	"stripePriceId" varchar(128),
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptionPlans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"category" "tagCategory" DEFAULT 'theme' NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#6366f1',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "userFollows" (
	"id" serial PRIMARY KEY NOT NULL,
	"followerId" integer NOT NULL,
	"followingId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"planId" integer NOT NULL,
	"stripeSubscriptionId" varchar(128),
	"subStatus" "subStatus" DEFAULT 'active' NOT NULL,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"bio" text,
	"institution" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"referralCode" varchar(32),
	"digestEnabled" boolean DEFAULT false NOT NULL,
	"digestFrequency" "digestFrequency" DEFAULT 'weekly' NOT NULL,
	"lastDigestSentAt" timestamp,
	"emailDigestEnabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode")
);
--> statement-breakpoint
CREATE TABLE "videoProjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "videoProjectType" NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"data" jsonb NOT NULL,
	"thumbnailUrl" text,
	"templateId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhookEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" varchar(256) NOT NULL,
	"eventType" varchar(128) NOT NULL,
	"webhookStatus" "webhookStatus" DEFAULT 'processed' NOT NULL,
	"summary" text,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhookEvents_eventId_unique" UNIQUE("eventId")
);
