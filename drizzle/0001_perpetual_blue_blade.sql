CREATE TABLE `galleryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generationId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256),
	`description` text,
	`featured` boolean DEFAULT false,
	`viewCount` int DEFAULT 0,
	`approvedAt` timestamp,
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `galleryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generationTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generationId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `generationTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prompt` text NOT NULL,
	`negativePrompt` text,
	`modelVersion` varchar(128) NOT NULL DEFAULT 'built-in-v1',
	`mediaType` enum('image','video') NOT NULL DEFAULT 'image',
	`width` int DEFAULT 512,
	`height` int DEFAULT 768,
	`duration` int,
	`imageUrl` text,
	`thumbnailUrl` text,
	`fileKey` varchar(512),
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderationQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generationId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(256),
	`description` text,
	`moderationStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `moderationQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`category` enum('genre','theme','style','subject','technique') NOT NULL DEFAULT 'theme',
	`description` text,
	`color` varchar(7) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_name_unique` UNIQUE(`name`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `institution` varchar(256);