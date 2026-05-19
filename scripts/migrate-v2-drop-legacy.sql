-- Drop legacy v1 tables. Run AFTER verifying v2 supplier/curator/sales smoke passes.
-- This is destructive — all submission/product history is removed.

DROP TABLE IF EXISTS submission_comments;
DROP TABLE IF EXISTS submission_fields;
DROP TABLE IF EXISTS submission_generated;
DROP TABLE IF EXISTS submission_splits;
DROP TABLE IF EXISTS sales_materials_draft;
DROP TABLE IF EXISTS layer_atoms;
DROP TABLE IF EXISTS prefill_runs;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS rolepacks;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS files;
