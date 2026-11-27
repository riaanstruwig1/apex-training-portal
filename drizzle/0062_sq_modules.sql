CREATE TABLE `audit_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_id` text NOT NULL,
	`position` integer NOT NULL,
	`question` text NOT NULL,
	`reference` text,
	FOREIGN KEY (`checklist_id`) REFERENCES `audit_checklists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`reference` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_checklists_key_unique` ON `audit_checklists` (`key`);--> statement-breakpoint
CREATE TABLE `audit_results` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`position` integer NOT NULL,
	`question` text NOT NULL,
	`reference` text,
	`result` text,
	`comment` text,
	`evidence` text,
	`finding_level` integer,
	`action_id` text,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`checklist_id` text NOT NULL,
	`checklist_title` text NOT NULL,
	`scope` text,
	`audit_date` integer NOT NULL,
	`auditor_user_id` text NOT NULL,
	`auditor_name` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`conclusion` text,
	`completed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audits_number_unique` ON `audits` (`number`);--> statement-breakpoint
CREATE TABLE `occurrence_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`site` text,
	`equipment` text,
	`people` text,
	`description` text NOT NULL,
	`injuries` text DEFAULT 'none' NOT NULL,
	`damage` text,
	`weather` text,
	`immediate_action` text,
	`confidential` integer DEFAULT false NOT NULL,
	`reporter_user_id` text,
	`reporter_name` text,
	`status` text DEFAULT 'new' NOT NULL,
	`so_notes` text,
	`external_reported_at` text,
	`closed_at` integer,
	`closed_by_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_reports_number_unique` ON `occurrence_reports` (`number`);--> statement-breakpoint
CREATE TABLE `qs_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`area` text NOT NULL,
	`level` integer,
	`title` text NOT NULL,
	`description` text,
	`reference` text,
	`source_type` text,
	`source_id` text,
	`raised_by_user_id` text,
	`raised_by_name` text,
	`raised_at` integer NOT NULL,
	`due_date` integer,
	`status` text DEFAULT 'with_cfi' NOT NULL,
	`cfi_response` text,
	`cfi_user_id` text,
	`cfi_name` text,
	`cfi_submitted_at` integer,
	`return_comment` text,
	`signed_off_by_user_id` text,
	`signed_off_by_name` text,
	`signed_off_at` integer,
	`sign_off_comment` text
);
--> statement-breakpoint
CREATE TABLE `sirsl_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`entry_date` integer NOT NULL,
	`area` text DEFAULT 'general' NOT NULL,
	`event` text NOT NULL,
	`action` text,
	`completed_at` integer,
	`comments` text,
	`by_name` text,
	`by_user_id` text,
	`ref_type` text,
	`ref_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sirsl_entries_number_unique` ON `sirsl_entries` (`number`);--> statement-breakpoint
ALTER TABLE `site_settings` ADD `quality_person_user_id` text;