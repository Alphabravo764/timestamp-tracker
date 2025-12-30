CREATE TABLE `clientLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`scope` enum('all_guards','specific_guards','specific_shifts') NOT NULL DEFAULT 'all_guards',
	`scopeData` text,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`billingPlan` enum('free','standard','premium') NOT NULL DEFAULT 'free',
	`billingStatus` enum('active','suspended','cancelled') NOT NULL DEFAULT 'active',
	`activeGuardsCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companyAdmins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','viewer') NOT NULL DEFAULT 'admin',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companyAdmins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locationPoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shiftId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`accuracy` decimal(10,2),
	`altitude` decimal(10,2),
	`speed` decimal(10,2),
	`heading` decimal(10,2),
	`capturedAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`source` enum('gps','network','mock') NOT NULL DEFAULT 'gps',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locationPoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pairings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`shiftId` int NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`persistForFutureShifts` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `pairings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pdfReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shiftId` int NOT NULL,
	`pdfUrl` text NOT NULL,
	`fileSize` int,
	`integrityHash` varchar(64),
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdfReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photoEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shiftId` int NOT NULL,
	`fileUrl` text NOT NULL,
	`thumbnailUrl` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`accuracy` decimal(10,2),
	`photoType` enum('start','mid','end') NOT NULL DEFAULT 'mid',
	`capturedAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`exifData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteName` varchar(255) NOT NULL,
	`notes` text,
	`status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
	`startTimeUtc` timestamp NOT NULL,
	`endTimeUtc` timestamp,
	`durationMinutes` int,
	`liveToken` varchar(64) NOT NULL,
	`pairCode` varchar(10),
	`pairCodeExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shifts_liveToken_unique` UNIQUE(`liveToken`),
	CONSTRAINT `shifts_pairCode_unique` UNIQUE(`pairCode`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `profilePhotoUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deviceFingerprint` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionExpiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `companyId_idx` ON `clientLinks` (`companyId`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `clientLinks` (`token`);--> statement-breakpoint
CREATE INDEX `companyId_idx` ON `companyAdmins` (`companyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `companyAdmins` (`userId`);--> statement-breakpoint
CREATE INDEX `shiftId_idx` ON `locationPoints` (`shiftId`);--> statement-breakpoint
CREATE INDEX `capturedAt_idx` ON `locationPoints` (`capturedAt`);--> statement-breakpoint
CREATE INDEX `companyId_idx` ON `pairings` (`companyId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `pairings` (`userId`);--> statement-breakpoint
CREATE INDEX `shiftId_idx` ON `pairings` (`shiftId`);--> statement-breakpoint
CREATE INDEX `shiftId_idx` ON `pdfReports` (`shiftId`);--> statement-breakpoint
CREATE INDEX `shiftId_idx` ON `photoEvents` (`shiftId`);--> statement-breakpoint
CREATE INDEX `capturedAt_idx` ON `photoEvents` (`capturedAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `shifts` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `shifts` (`status`);--> statement-breakpoint
CREATE INDEX `liveToken_idx` ON `shifts` (`liveToken`);