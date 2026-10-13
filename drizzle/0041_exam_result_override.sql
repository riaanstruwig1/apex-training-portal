ALTER TABLE `exam_attempts` ADD `result_override` text;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `result_override_note` text;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `result_override_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `result_override_at` integer;