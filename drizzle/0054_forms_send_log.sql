CREATE TABLE `forms_send_log` (
	`id` text PRIMARY KEY NOT NULL,
	`sent_at` integer NOT NULL,
	`sent_by_user_id` text,
	`sent_by_name` text,
	`recipient_name` text,
	`phone` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`documents` text,
	`status` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`sent_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
