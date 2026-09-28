ALTER TABLE `pilot_profiles` ADD `licence_first_issued_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `password_reset_token` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_reset_token_expires_at` integer;--> statement-breakpoint
-- "V23" items 7-9 (25 Sep 2026): pilots now self-sign their own flight-log
-- entries -- no per-entry CFI/instructor countersign at all (students are
-- unaffected; they still need it). Any already-existing PENDING entry owned
-- by a non-student account (pilot, or a cfi/instructor's own linked pilot
-- profile) is retroactively self-signed here, rather than being left stuck
-- forever showing "Pending" with no Verify button left anywhere to clear it.
-- A pilot who logged their own flight is recorded as having signed it
-- themselves (verified_by_user_id = student_id, i.e. the flight's owner) --
-- this is also exactly how the app tells a self-signed entry apart from a
-- CFI-countersigned one going forward, with no new column needed for that.
UPDATE `flight_log_entries`
SET `verified` = 1,
    `verified_by_user_id` = `student_id`,
    `verified_at` = coalesce(`verified_at`, `created_at`)
WHERE `verified` = 0
  AND `student_id` IN (SELECT `id` FROM `users` WHERE `role` != 'student');