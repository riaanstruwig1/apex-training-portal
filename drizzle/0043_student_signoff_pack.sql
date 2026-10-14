CREATE TABLE `student_signoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`student_user_id` text NOT NULL,
	`training_type` text NOT NULL,
	`signed_off_by_user_id` text NOT NULL,
	`signed_off_at` integer DEFAULT (unixepoch()) NOT NULL,
	`wings_awarded` integer DEFAULT true NOT NULL,
	`skill_grades` text,
	`remedial_action` text,
	`instructor_licence_number` text,
	`radio_examiner_name` text,
	`radio_examiner_licence` text,
	`call_sign_choices` text,
	`student_signature_applied` integer DEFAULT false NOT NULL,
	`instructor_signature_applied` integer DEFAULT false NOT NULL,
	`medical_signature_applied` integer DEFAULT false NOT NULL,
	`pack_file` text,
	`pack_generated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signed_off_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_signoff_unique` ON `student_signoffs` (`student_user_id`,`training_type`);--> statement-breakpoint
ALTER TABLE `pilot_profiles` ADD `awaiting_caa_licence_since` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `signature_forms_consent_at` integer;