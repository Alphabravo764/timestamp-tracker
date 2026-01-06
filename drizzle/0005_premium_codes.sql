-- Migration: Create premiumCodes table for Premium Access Code system
-- This table stores one-time-use codes that unlock premium features (60 shifts, 60 reports, 60 live shares)

CREATE TABLE IF NOT EXISTS `premiumCodes` (
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

-- Create indexes for faster lookups
CREATE INDEX `code_idx` ON `premiumCodes` (`code`);
CREATE INDEX `isUsed_idx` ON `premiumCodes` (`isUsed`);
