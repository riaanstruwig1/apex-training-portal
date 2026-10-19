ALTER TABLE `student_profiles` ADD `course_level` text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_requested_at` integer;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_requested_types` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_approved_at` integer;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_approved_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_declined_at` integer;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `phase2_decline_reason` text;