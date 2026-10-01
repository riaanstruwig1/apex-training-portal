ALTER TABLE `sections` ADD `training_type` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `sections` ADD `phase` text DEFAULT 'p1' NOT NULL;--> statement-breakpoint
ALTER TABLE `study_materials` ADD `dashboard_box` integer;--> statement-breakpoint
-- Riaan's choice (1 Oct 2026): every existing section is PPG, phased 1/1/2/3/3.
UPDATE `sections` SET `training_type` = 'ppg';--> statement-breakpoint
UPDATE `sections` SET `phase` = 'p2' WHERE `name` LIKE 'Circuit%';--> statement-breakpoint
UPDATE `sections` SET `phase` = 'p3' WHERE `name` LIKE 'Advanced%' OR `name` LIKE 'Navigation%';
