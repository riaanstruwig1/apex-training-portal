-- Data migration only (the "role" column is plain text with a TS-side enum,
-- no CHECK constraint -- see flight_type's 0004 migration for the same
-- pattern). Before this point there was only one instructor role; every
-- existing account with that role is the school's Chief Flight Instructor
-- (full access), so relabel it to "cfi" rather than leaving it as the new,
-- more restricted "instructor" role.
UPDATE users SET role = 'cfi' WHERE role = 'instructor';
