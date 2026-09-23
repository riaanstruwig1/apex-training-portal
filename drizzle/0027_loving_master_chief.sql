ALTER TABLE `pilot_profiles` ADD `caa_licence_expiry_date` integer;--> statement-breakpoint
ALTER TABLE `pilot_profiles` ADD `starting_flight_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pilot_profiles` ADD `starting_flight_hours` real DEFAULT 0 NOT NULL;