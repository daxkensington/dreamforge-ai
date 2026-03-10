CREATE TABLE `videoProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('storyboard','script','scene-direction','soundtrack') NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text,
	`data` json NOT NULL,
	`thumbnailUrl` text,
	`templateId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoProjects_id` PRIMARY KEY(`id`)
);
