ALTER TABLE `exam_attempts` ADD `source` text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `proof_file` text;--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `external_license_number` text;