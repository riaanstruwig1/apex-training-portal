ALTER TABLE `exam_answers` ADD `awarded_marks` real;--> statement-breakpoint
ALTER TABLE `exam_answers` ADD `staff_note` text;--> statement-breakpoint
ALTER TABLE `exam_answers` ADD `marked_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `exam_answers` ADD `marked_at` integer;