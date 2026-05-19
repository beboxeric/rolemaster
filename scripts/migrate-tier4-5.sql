-- T4.3 — add language column to existing users table.
-- ALTER TABLE ADD COLUMN errors if column already exists; that's fine for re-run.
-- Wrangler executes statements one at a time; if this fails for "duplicate column",
-- the schema.sql apply will have already taken care of it (or the column exists).
ALTER TABLE users ADD COLUMN language TEXT;

-- T2.3 — rolepacks asset columns. Same idempotency caveat.
ALTER TABLE rolepacks ADD COLUMN pitch_deck_zh_url TEXT;
ALTER TABLE rolepacks ADD COLUMN pitch_deck_en_url TEXT;
ALTER TABLE rolepacks ADD COLUMN product_manual_zh_url TEXT;
ALTER TABLE rolepacks ADD COLUMN product_manual_en_url TEXT;
ALTER TABLE rolepacks ADD COLUMN asset_status TEXT DEFAULT 'pending';
ALTER TABLE rolepacks ADD COLUMN asset_generated_at TEXT;
ALTER TABLE rolepacks ADD COLUMN asset_failed_reason TEXT;

-- T5.5 — seed initial industry taxonomy.
INSERT OR IGNORE INTO taxonomy_industries (id, name_zh, name_en, display_order) VALUES
  ('banking',     '银行',       'Banking',                 10),
  ('insurance',   '保险',       'Insurance',               20),
  ('securities',  '证券',       'Securities',              30),
  ('svf',         'SVF',        'SVF',                     40),
  ('retail',      '零售',       'Retail',                  50),
  ('manufacturing','制造',      'Manufacturing',           60),
  ('healthcare',  '医疗',       'Healthcare',              70),
  ('government',  '政府',       'Government',              80),
  ('professional','专业服务',   'Professional Services',   90),
  ('sme',         '中小企业',   'SME',                    100),
  ('brand',       '品牌',       'Brand',                  110),
  ('legal',       '法务',       'Legal',                  120);
