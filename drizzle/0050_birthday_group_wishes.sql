ALTER TABLE `site_settings` ADD `birthday_group_chat_id` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_group_name` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_group_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_group_templates` text;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_group_sent` text;