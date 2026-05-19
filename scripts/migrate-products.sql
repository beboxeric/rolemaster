-- T3.1 backfill — idempotent. Re-run safely.
--
-- For every existing submission, INSERT a products row whose id matches the
-- submission's product_id. INSERT OR IGNORE means re-running is a no-op.
INSERT OR IGNORE INTO products (id, supplier_id, name, subtitle_zh, subtitle_en, position, created_at)
SELECT
  s.product_id,
  s.supplier_id,
  s.product_name,
  s.product_subtitle_zh,
  s.product_subtitle_en,
  0,
  s.created_at
FROM submissions s
WHERE s.product_id IS NOT NULL AND s.product_id != '';

-- Backfill supplier_company_info from each supplier's most recent submission.
-- Uses the section-1 field rows that were seeded at submission creation.
INSERT OR IGNORE INTO supplier_company_info (
  supplier_id,
  company_name_zh, company_name_en,
  company_hq_zh, company_hq_en,
  company_founded_zh, company_founded_en,
  company_team_zh, company_team_en,
  company_clients_zh, company_clients_en,
  updated_at
)
SELECT
  sup.id,
  COALESCE((SELECT value_zh FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_name'    ORDER BY s.created_at DESC LIMIT 1), sup.name),
  COALESCE((SELECT value_en FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_name'    ORDER BY s.created_at DESC LIMIT 1), sup.name),
  COALESCE((SELECT value_zh FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_hq'      ORDER BY s.created_at DESC LIMIT 1), sup.hq),
  COALESCE((SELECT value_en FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_hq'      ORDER BY s.created_at DESC LIMIT 1), sup.hq),
            (SELECT value_zh FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_founded' ORDER BY s.created_at DESC LIMIT 1),
            (SELECT value_en FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_founded' ORDER BY s.created_at DESC LIMIT 1),
            (SELECT value_zh FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_team'    ORDER BY s.created_at DESC LIMIT 1),
            (SELECT value_en FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_team'    ORDER BY s.created_at DESC LIMIT 1),
            (SELECT value_zh FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_clients' ORDER BY s.created_at DESC LIMIT 1),
            (SELECT value_en FROM submission_fields f JOIN submissions s ON s.id = f.submission_id WHERE s.supplier_id = sup.id AND f.field_id = 'company_clients' ORDER BY s.created_at DESC LIMIT 1),
  datetime('now')
FROM suppliers sup;
