CREATE TABLE `premiumCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`isUsed` boolean NOT NULL DEFAULT false,
	`usedByDeviceId` varchar(128),
	`usedAt` timestamp,
	`shiftsLimit` int NOT NULL DEFAULT 60,
	`liveSharesLimit` int NOT NULL DEFAULT 60,
	`reportsLimit` int NOT NULL DEFAULT 60,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `premiumCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `premiumCodes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `code_idx` ON `premiumCodes` (`code`);--> statement-breakpoint
CREATE INDEX `isUsed_idx` ON `premiumCodes` (`isUsed`);