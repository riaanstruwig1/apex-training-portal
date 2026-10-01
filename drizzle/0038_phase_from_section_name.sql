-- 1 Oct 2026: a section whose own name says its phase ("Phase 2 - ...")
-- gets that phase tag, in case it was left on the default (Phase 1).
-- Only sections named "Phase 1/2/3 ..." are touched.
UPDATE `sections` SET `phase` = 'p1' WHERE lower(trim(`name`)) LIKE 'phase 1%';--> statement-breakpoint
UPDATE `sections` SET `phase` = 'p2' WHERE lower(trim(`name`)) LIKE 'phase 2%';--> statement-breakpoint
UPDATE `sections` SET `phase` = 'p3' WHERE lower(trim(`name`)) LIKE 'phase 3%';
