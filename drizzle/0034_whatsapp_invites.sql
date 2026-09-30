CREATE TABLE `whatsapp_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`message` text NOT NULL,
	`invited_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_sent_at` integer NOT NULL,
	`send_count` integer DEFAULT 1 NOT NULL,
	`last_status` text NOT NULL,
	`last_error` text,
	`removed_at` integer,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
