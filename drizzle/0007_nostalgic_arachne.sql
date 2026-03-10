CREATE TABLE `webhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(256) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`webhookStatus` enum('processed','failed','ignored') NOT NULL DEFAULT 'processed',
	`summary` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhookEvents_eventId_unique` UNIQUE(`eventId`)
);
