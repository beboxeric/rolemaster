-- Allow suppliers to give each uploaded file a friendly display name
-- (e.g. "Production OpenAPI v2", "SDK quickstart") that shows alongside
-- the original filename.

ALTER TABLE intake_files ADD COLUMN display_name TEXT;
