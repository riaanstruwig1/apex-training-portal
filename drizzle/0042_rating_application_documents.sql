CREATE TABLE `rating_application_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_profile_id` text NOT NULL,
	`user_id` text NOT NULL,
	`endorsement_key` text NOT NULL,
	`label` text NOT NULL,
	`filename` text NOT NULL,
	`original_name` text,
	`uploaded_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pilot_profile_id`) REFERENCES `pilot_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rating_app_docs_pilot_key` ON `rating_application_documents` (`pilot_profile_id`,`endorsement_key`);