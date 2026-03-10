ALTER TABLE `users` ADD `digestEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `digestFrequency` enum('weekly','monthly') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lastDigestSentAt` timestamp;