ALTER TABLE `pilot_endorsements` ADD `declared_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `pilot_endorsements` SET `declared_at` = unixepoch() WHERE `declared_at` = 0;
