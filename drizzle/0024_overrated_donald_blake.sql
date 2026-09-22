CREATE TABLE `student_endorsements` (
	`id` text PRIMARY KEY NOT NULL,
	`student_profile_id` text NOT NULL,
	`key` text NOT NULL,
	`granted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`granted_by_user_id` text,
	FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_endorsement_unique` ON `student_endorsements` (`student_profile_id`,`key`);