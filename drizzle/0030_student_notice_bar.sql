ALTER TABLE `site_settings` ADD `notice_message` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `notice_button_label` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `notice_link_url` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `notice_file` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `notice_file_original_name` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `notice_visible` integer DEFAULT false NOT NULL;