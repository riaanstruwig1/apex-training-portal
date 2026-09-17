-- The "dual"/"solo" flight_type vocabulary was replaced with
-- "solo_ppg" / "solo_trike" / "dual_trike" (a PPG is single-seat, so
-- "dual" only ever means a trike). Existing rows predate the split, so
-- there's no way to know which equipment they used -- map them to the most
-- common case (solo -> solo PPG, dual -> dual trike) rather than leaving a
-- stale value the app no longer recognises.
UPDATE `flight_log_entries` SET `flight_type` = 'solo_ppg' WHERE `flight_type` = 'solo';--> statement-breakpoint
UPDATE `flight_log_entries` SET `flight_type` = 'dual_trike' WHERE `flight_type` = 'dual';
