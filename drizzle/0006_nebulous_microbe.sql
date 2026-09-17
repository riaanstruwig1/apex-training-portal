ALTER TABLE `users` ADD `invite_token` text;--> statement-breakpoint
ALTER TABLE `users` ADD `invite_token_expires_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_invite_token_unique` ON `users` (`invite_token`);