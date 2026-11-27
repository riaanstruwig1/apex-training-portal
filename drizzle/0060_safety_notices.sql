CREATE TABLE `safety_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`file` text,
	`file_original_name` text,
	`created_at` integer NOT NULL,
	`created_by_user_id` text,
	`created_by_name` text,
	`recipients` integer DEFAULT 0 NOT NULL,
	`sent_ok` integer DEFAULT 0 NOT NULL,
	`sent_failed` integer DEFAULT 0 NOT NULL,
	`send_done` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `safety_notices_number_unique` ON `safety_notices` (`number`);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `safety_officer_user_id` text;