CREATE TABLE `creditBalances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 50,
	`lifetimeSpent` int NOT NULL DEFAULT 0,
	`stripeCustomerId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creditBalances_id` PRIMARY KEY(`id`),
	CONSTRAINT `creditBalances_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `creditTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`txType` enum('purchase','usage','bonus','refund') NOT NULL,
	`description` varchar(512),
	`stripeSessionId` varchar(256),
	`stripePaymentIntentId` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prefType` enum('collaboration','generation','comment','system','payment') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notifType` enum('collaboration','generation','comment','system','payment') NOT NULL,
	`title` varchar(256) NOT NULL,
	`message` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
