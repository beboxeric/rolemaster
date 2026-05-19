-- Wipe all test data; keep schema and the seed curator/sales accounts.
-- Run with: wrangler d1 execute rolemaster-db --remote --file=scripts/reset-data.sql
--
-- DOES NOT delete from R2 (objects are orphaned but the storage_keys go with files).

DELETE FROM platform_logs;
DELETE FROM notifications;
DELETE FROM sales_sessions;
DELETE FROM submission_comments;
DELETE FROM sales_materials_draft;
DELETE FROM submission_generated;
DELETE FROM layer_atoms;
DELETE FROM chat_messages;
DELETE FROM audit_log;
DELETE FROM files;
DELETE FROM submission_fields;
DELETE FROM submissions;
DELETE FROM rolepacks;
DELETE FROM products;
DELETE FROM supplier_company_info;
DELETE FROM suppliers;
-- Keep curator and sales accounts so the operator can still log in.
DELETE FROM users WHERE role = 'supplier';
