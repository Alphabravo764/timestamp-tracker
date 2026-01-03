CREATE TABLE `noteEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shiftId` int NOT NULL,
	`noteText` text NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`accuracy` decimal(10,2),
	`capturedAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `noteEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `shiftId_idx` ON `noteEvents` (`shiftId`);--> statement-breakpoint
CREATE INDEX `capturedAt_idx` ON `noteEvents` (`capturedAt`);