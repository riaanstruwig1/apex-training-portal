CREATE TABLE `pilot_endorsements` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_profile_id` text NOT NULL,
	`key` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`verified_by_user_id` text,
	FOREIGN KEY (`pilot_profile_id`) REFERENCES `pilot_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_endorsement_unique` ON `pilot_endorsements` (`pilot_profile_id`,`key`);--> statement-breakpoint
CREATE TABLE `pilot_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`call_sign` text,
	`sahpa_number` text,
	`sahpa_expiry_date` integer,
	`caa_licence_file` text,
	`status` text DEFAULT 'pending_verification' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pilot_profiles_user_id_unique` ON `pilot_profiles` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `account_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `apex_number` text;--> statement-breakpoint
ALTER TABLE `users` ADD `title` text;--> statement-breakpoint
ALTER TABLE `users` ADD `initials` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `users` ADD `id_passport_number` text;--> statement-breakpoint
ALTER TABLE `users` ADD `id_passport_file` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_picture_file` text;--> statement-breakpoint
ALTER TABLE `users` ADD `dob` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `sex` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `alt_phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nok_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nok_contact_no` text;--> statement-breakpoint
ALTER TABLE `users` ADD `postal_address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `home_address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `club_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `consent_signed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `consent_signed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `consent_signed_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `indemnity_signed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `indemnity_signed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `indemnity_signed_name` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_apex_number_unique` ON `users` (`apex_number`);