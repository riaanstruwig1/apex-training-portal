ALTER TABLE `exam_answers` ADD `original_option_id` text REFERENCES exam_options(id);--> statement-breakpoint
ALTER TABLE `exam_answers` ADD `answer_changed` integer DEFAULT false NOT NULL;