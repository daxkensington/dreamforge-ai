ALTER TABLE `creditBudgets` ADD `budgetEmailEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `creditBudgets` ADD `lastDailyAlertAt` timestamp;--> statement-breakpoint
ALTER TABLE `creditBudgets` ADD `lastWeeklyAlertAt` timestamp;