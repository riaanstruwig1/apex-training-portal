ALTER TABLE `site_settings` ADD `birthday_whatsapp_to` text DEFAULT '0725614474';--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_whatsapp_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` ADD `birthday_last_sent_on` text;