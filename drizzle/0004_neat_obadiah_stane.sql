CREATE TABLE `projectCollaborators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`collabRole` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`invitedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectCollaborators_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectRevisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL,
	`data` json NOT NULL,
	`changeNote` text,
	`revisionSource` enum('manual','ai-refinement','revert','template') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectRevisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectShareTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`sharePermission` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`createdBy` int NOT NULL,
	`expiresAt` timestamp,
	`maxUses` int,
	`useCount` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectShareTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `projectShareTokens_token_unique` UNIQUE(`token`)
);
