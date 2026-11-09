ALTER TABLE `site_settings` ADD `accounts_whatsapp_to` text DEFAULT '0725614474';--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `payment_option` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `invoice_to` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `invoice_company_name` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `invoice_company_vat` text;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `invoice_company_address` text;