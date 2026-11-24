CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`actor_role` text,
	`action` text NOT NULL,
	`target_user_id` text,
	`target_name` text,
	`details` text,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `chosen_instructor_id` text REFERENCES users(id);