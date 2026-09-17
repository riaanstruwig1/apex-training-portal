CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`radio_call_script` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `call_sign` text;