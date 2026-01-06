CREATE TABLE `userConsents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`deviceId` varchar(128),
	`consentType` enum('privacy_policy','terms_of_service','location','camera') NOT NULL,
	`version` varchar(20) NOT NULL,
	`consented` boolean NOT NULL DEFAULT true,
	`ipAddress` varchar(45),
	`userAgent` text,
	`consentedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userConsents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `userConsents` (`userId`);--> statement-breakpoint
CREATE INDEX `deviceId_idx` ON `userConsents` (`deviceId`);--> statement-breakpoint
CREATE INDEX `consentType_idx` ON `userConsents` (`consentType`);