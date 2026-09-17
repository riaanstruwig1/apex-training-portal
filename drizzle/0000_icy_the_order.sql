CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`section_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_code_unique` ON `exercises` (`code`);--> statement-breakpoint
CREATE TABLE `flight_log_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`date` integer NOT NULL,
	`site` text NOT NULL,
	`aircraft_type` text NOT NULL,
	`flight_type` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`launches` integer DEFAULT 1 NOT NULL,
	`exercise_codes_covered` text,
	`notes` text,
	`verified` integer DEFAULT false NOT NULL,
	`verified_by_user_id` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_exercise_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`notes` text,
	`signed_off_by_user_id` text,
	`signed_off_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signed_off_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_exercise_unique` ON `student_exercise_progress` (`student_id`,`exercise_id`);--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone` text,
	`license_number` text,
	`dto_number` text DEFAULT 'SACAA-0012DTO',
	`shopify_customer_id` text,
	`status` text DEFAULT 'invited' NOT NULL,
	`invite_token` text,
	`invite_token_expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_user_id_unique` ON `student_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_shopify_customer_id_unique` ON `student_profiles` (`shopify_customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_invite_token_unique` ON `student_profiles` (`invite_token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);