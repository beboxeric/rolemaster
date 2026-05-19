-- RoleMaster — D1 schema. Same SQLite syntax as the prior local server.
-- Apply with: wrangler d1 execute rolemaster-db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,         -- PBKDF2 hex hash
  salt        TEXT NOT NULL,         -- PBKDF2 hex salt
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('supplier','curator','sales')),
  supplier_id TEXT,
  language    TEXT,                  -- T4.3: 'zh' | 'en' | NULL
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  short_name  TEXT NOT NULL,
  hq          TEXT NOT NULL,
  contact     TEXT,
  phone       TEXT,
  founded     INTEGER,
  team        TEXT,
  clients     INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_subtitle_zh TEXT,
  product_subtitle_en TEXT,
  status      TEXT NOT NULL CHECK(status IN ('draft','new','review','revision','approved','published')) DEFAULT 'draft',
  prefill     INTEGER NOT NULL DEFAULT 0,
  materials   TEXT NOT NULL DEFAULT '[]',
  rolepack_id TEXT,
  submitted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submission_fields (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  field_id    TEXT NOT NULL,
  section     INTEGER NOT NULL,
  label_zh    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  value_zh    TEXT,
  value_en    TEXT,
  status      TEXT NOT NULL CHECK(status IN ('ai','filled','empty','weak')),
  hint_zh     TEXT,
  hint_en     TEXT,
  optional    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (submission_id, field_id)
);

CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  storage_key TEXT NOT NULL,         -- R2 object key (replaces filesystem path)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE,
  who         TEXT NOT NULL,
  action_zh   TEXT NOT NULL,
  action_en   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rolepacks (
  id          TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  data        TEXT NOT NULL,         -- JSON
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- T2.3: asset URLs + status. Populated by curator publish chain.
  pitch_deck_zh_url TEXT,
  pitch_deck_en_url TEXT,
  product_manual_zh_url TEXT,
  product_manual_en_url TEXT,
  asset_status TEXT DEFAULT 'pending' CHECK(asset_status IN ('pending','generating','ready','failed')),
  asset_generated_at TEXT,
  asset_failed_reason TEXT
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  meta        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_supplier ON submissions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_audit_sub ON audit_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_chat_sub ON chat_messages(submission_id);

-- ════════════════════════════════════════════════════════════════
-- T1.1 — three-layer atoms + AI-generated content + sales materials
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS layer_atoms (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  layer TEXT NOT NULL CHECK (layer IN ('capability','knowledge','interface')),
  atom_id TEXT NOT NULL,                 -- CAP-01, KNW-03, INF-02
  name_zh TEXT,
  name_en TEXT,
  description_zh TEXT,
  description_en TEXT,
  source_quote TEXT,                     -- curator-private
  confidence REAL,                       -- 0.0 to 1.0
  position INTEGER NOT NULL DEFAULT 0,   -- ordering within layer
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  edited_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_atoms_sub_layer ON layer_atoms(submission_id, layer, position);

CREATE TABLE IF NOT EXISTS submission_generated (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  customer_voice_pain_zh TEXT,
  customer_voice_pain_en TEXT,
  value_positioning_zh TEXT,
  value_positioning_en TEXT,
  capability_summary_zh TEXT,            -- newline-separated bullets
  capability_summary_en TEXT,
  one_liner_zh TEXT,
  one_liner_en TEXT,
  ai_assembly_recommendation_zh TEXT,
  ai_assembly_recommendation_en TEXT,
  ai_assembly_alternatives_json TEXT,    -- JSON array
  generated_at TEXT,
  generated_by TEXT                      -- 'auto' | curator user id
);

CREATE TABLE IF NOT EXISTS sales_materials_draft (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  pitch_outline_json TEXT,               -- JSON array of {title_zh,title_en,bullets_zh[],bullets_en[]}
  faq_json TEXT,                         -- JSON array of {q_zh,q_en,a_zh,a_en}
  elevator_pitch_zh TEXT,
  elevator_pitch_en TEXT,
  discovery_questions_json TEXT,         -- JSON array of {q_zh,q_en}
  generated_at TEXT,
  edited_at TEXT
);

-- ════════════════════════════════════════════════════════════════
-- T5.2 — curator/supplier comment thread per submission
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS submission_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('curator','supplier')),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_sub ON submission_comments(submission_id, created_at);

-- ════════════════════════════════════════════════════════════════
-- T4.3 — user language preference (idempotent column add)
-- ════════════════════════════════════════════════════════════════
-- D1 supports ALTER TABLE ADD COLUMN. Wrap in pragma trick: a fresh
-- DB sees the CREATE above (no language col), and re-running this on
-- an existing DB just adds it. SQLite errors on duplicate column;
-- the migration script tolerates that.

-- ════════════════════════════════════════════════════════════════
-- T3.1 — Products as first-class entities + shared company info
-- ════════════════════════════════════════════════════════════════

-- Each supplier owns many products. submissions.product_id is the FK pointing here.
-- For backfill, we create a products row for every distinct (supplier_id, product_id)
-- already used by an existing submission.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,                    -- matches submissions.product_id
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subtitle_zh TEXT,
  subtitle_en TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id, position);

-- Section-1 fields move here so they're shared across all products for a supplier.
-- The form reads/writes this on Section 1 instead of the per-submission rows.
CREATE TABLE IF NOT EXISTS supplier_company_info (
  supplier_id TEXT PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
  company_name_zh TEXT,
  company_name_en TEXT,
  company_hq_zh TEXT,
  company_hq_en TEXT,
  company_founded_zh TEXT,
  company_founded_en TEXT,
  company_team_zh TEXT,
  company_team_en TEXT,
  company_clients_zh TEXT,
  company_clients_en TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════════════════════════
-- T5.3 — In-app notifications
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                 -- submission_approved, submission_revision, submission_held, submission_published, comment
  payload_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read_at, created_at);

-- ════════════════════════════════════════════════════════════════
-- T5.4 — Sales-rep telemetry
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sales_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  signed_in_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_sess_signin ON sales_sessions(signed_in_at);

-- ════════════════════════════════════════════════════════════════
-- T5.5 — Industry taxonomy (curator-managed)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS taxonomy_industries (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  parent_id TEXT REFERENCES taxonomy_industries(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════════════════════════
-- T5.6 — Platform-level logging
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,                 -- 'info' | 'warn' | 'error'
  message TEXT NOT NULL,
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_level_time ON platform_logs(level, created_at);
