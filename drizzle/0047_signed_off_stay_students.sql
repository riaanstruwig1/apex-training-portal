-- Signed-off students whose CAA licence is not in yet go back to the Student list
-- (Riaan, 15 Oct 2026). They move to Pilots when the licence is submitted.
UPDATE `users` SET `role` = 'student'
WHERE `role` = 'pilot'
  AND `id` IN (SELECT `student_user_id` FROM `student_signoffs`)
  AND `id` IN (SELECT `user_id` FROM `pilot_profiles` WHERE `awaiting_caa_licence_since` IS NOT NULL AND `caa_licence_file` IS NULL);
