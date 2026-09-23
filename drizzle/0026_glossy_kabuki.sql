ALTER TABLE `users` ADD `password_reset_requested_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `medical_declaration_expires_at` integer;--> statement-breakpoint
-- Backfill: anyone who already signed the declaration under the old schema
-- gets the same 12-months-from-signed rule applied retroactively, so this
-- column is never surprisingly empty for an already-signed account.
UPDATE `users` SET `medical_declaration_expires_at` = `medical_declaration_signed_at` + (365 * 24 * 60 * 60) WHERE `medical_declaration_signed_at` IS NOT NULL AND `medical_declaration_expires_at` IS NULL;