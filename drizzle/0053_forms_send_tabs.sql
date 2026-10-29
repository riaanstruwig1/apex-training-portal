CREATE TABLE `forms_send_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`message` text,
	`slots` text DEFAULT '[]' NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forms_send_tabs_position_unique` ON `forms_send_tabs` (`position`);