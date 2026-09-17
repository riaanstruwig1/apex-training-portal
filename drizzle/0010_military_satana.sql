DROP INDEX `exam_attempts_student_exam_unique`;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `attempt_number` integer DEFAULT 1 NOT NULL;