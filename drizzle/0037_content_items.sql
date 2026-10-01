CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`filename` text,
	`original_name` text,
	`mime_type` text,
	`file_size` integer,
	`link_url` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
