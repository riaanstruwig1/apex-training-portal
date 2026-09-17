ALTER TABLE `exams` ADD `category` text;--> statement-breakpoint
UPDATE `exams` SET `category` = 'pg' WHERE `slug` = 'pg-basic-licence-theory' AND `category` IS NULL;