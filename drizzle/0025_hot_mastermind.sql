CREATE TABLE `forms_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`slot` integer NOT NULL,
	`title` text,
	`filename` text,
	`original_name` text,
	`file_size` integer,
	`uploaded_at` integer,
	`uploaded_by_user_id` text,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forms_procedures_slot_unique` ON `forms_procedures` (`slot`);