ALTER TABLE `creditTransactions` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `creditTransactions` ADD `expired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailDigestEnabled` boolean DEFAULT false NOT NULL;