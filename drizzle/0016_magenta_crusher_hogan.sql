ALTER TABLE `pilot_endorsements` ADD `declined` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_endorsements` ADD `decline_reason` text;--> statement-breakpoint
ALTER TABLE `pilot_endorsements` ADD `declined_at` integer;--> statement-breakpoint
ALTER TABLE `pilot_endorsements` ADD `declined_by_user_id` text REFERENCES users(id);