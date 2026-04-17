CREATE TYPE "public"."toolStatus" AS ENUM('active', 'degraded', 'offline');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_status" (
	"toolId" varchar(100) PRIMARY KEY NOT NULL,
	"status" "toolStatus" DEFAULT 'active' NOT NULL,
	"message" text,
	"updatedBy" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
