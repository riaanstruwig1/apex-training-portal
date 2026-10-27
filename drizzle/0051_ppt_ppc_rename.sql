-- Batch 83 (Riaan, 27 Oct 2026): "Powered Paratrike" is now "Powered Trike/Chute (PPT/PPC)"
-- and the PPT exam is the "PPT/PPC Theoretical Knowledge Test". Data only; safe if the exam
-- isn't loaded yet (the seed then uses the new wording).
UPDATE `exams` SET `title` = 'PPT/PPC Theoretical Knowledge Test' WHERE `slug` = 'ppt-theoretical-knowledge' AND `title` = 'PPT Theoretical Knowledge Test';--> statement-breakpoint
UPDATE `exam_questions` SET `prompt` = replace(`prompt`, 'Powered Paratrike', 'Powered Trike/Chute'), `print_prompt` = replace(`print_prompt`, 'Powered Paratrike', 'Powered Trike/Chute') WHERE `section_id` IN (SELECT `id` FROM `exam_sections` WHERE `exam_id` IN (SELECT `id` FROM `exams` WHERE `slug` = 'ppt-theoretical-knowledge'));--> statement-breakpoint
UPDATE `exam_options` SET `text` = replace(`text`, 'Powered Paratrike', 'Powered Trike/Chute') WHERE `question_id` IN (SELECT `q`.`id` FROM `exam_questions` `q` JOIN `exam_sections` `s` ON `q`.`section_id` = `s`.`id` JOIN `exams` `e` ON `s`.`exam_id` = `e`.`id` WHERE `e`.`slug` = 'ppt-theoretical-knowledge');
