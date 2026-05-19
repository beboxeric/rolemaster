-- v2 redesign: replace product/submission with intake/rolepack/capability.
-- Idempotent: safe to re-run. New tables only; legacy tables stay until cutover.

-- ════════════════════════════════════════════════════════════════
-- intakes — one per supplier onboarding pass
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS intakes (
  id TEXT PRIMARY KEY,                 -- 'INT-XXXXXX'
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','analyzing_capabilities','capabilities_ready','matching_roles',
    'roles_ready','filling_details','pricing','submitted'
  )),
  website TEXT,
  industry_hint TEXT,                  -- supplier free-text on company page
  free_text TEXT,                      -- supplier free-text on upload step
  service_pricing_json TEXT,           -- one-time shared answers from §2.6
  finalized_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intakes_supplier ON intakes(supplier_id, created_at);

-- ════════════════════════════════════════════════════════════════
-- capabilities — RC-NN per intake
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  rc_label TEXT NOT NULL,              -- 'RC-01'
  name_zh TEXT, name_en TEXT,
  description_zh TEXT, description_en TEXT,
  source_quote TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'ai',            -- 'ai' | 'supplier'
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_caps_intake ON capabilities(intake_id, position);

-- ════════════════════════════════════════════════════════════════
-- rolepacks_v2 — RP-NN per intake (replaces 'products' + 'submissions')
-- New table to avoid clashing with the legacy 'rolepacks' table.
-- After cutover legacy 'rolepacks' is dropped and this is renamed.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rolepacks_v2 (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  rp_label TEXT NOT NULL,              -- 'RP-01'
  name_zh TEXT, name_en TEXT,
  industry_json TEXT,                  -- ["banking", "svf"]
  company_size_json TEXT,              -- ["mid-market"]
  department_json TEXT,                -- {"zh":"合规","en":"Compliance"}
  position INTEGER NOT NULL DEFAULT 0,
  questionnaire_json TEXT,             -- §2.5 answers
  generated_json TEXT,                 -- Surface D customer-voice + recommendation
  materials_draft_json TEXT,           -- Surface D sales materials draft
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','review','revision','approved','published'
  )),
  pitch_deck_zh_url TEXT,
  pitch_deck_en_url TEXT,
  product_manual_zh_url TEXT,
  product_manual_en_url TEXT,
  asset_status TEXT DEFAULT 'pending' CHECK (asset_status IN ('pending','generating','ready','failed')),
  asset_generated_at TEXT,
  asset_failed_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT,
  published_snapshot_json TEXT,        -- frozen view of curator-edited content
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rolepacks_v2_intake ON rolepacks_v2(intake_id, position);
CREATE INDEX IF NOT EXISTS idx_rolepacks_v2_status ON rolepacks_v2(status);
CREATE INDEX IF NOT EXISTS idx_rolepacks_v2_published ON rolepacks_v2(published_at);

-- ════════════════════════════════════════════════════════════════
-- rolepack_capabilities — many-to-many between rolepacks_v2 and capabilities
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rolepack_capabilities (
  rolepack_id TEXT NOT NULL REFERENCES rolepacks_v2(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rolepack_id, capability_id)
);

-- ════════════════════════════════════════════════════════════════
-- intake_files — materials uploaded during onboarding (replaces 'files')
-- Stays linked to intake even after rolepacks fan out.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS intake_files (
  id TEXT PRIMARY KEY,
  intake_id TEXT NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- 'pdf' | 'doc' | 'ppt' | 'voice' | 'api_doc' | 'other'
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  rolepack_id TEXT,                    -- optional: file scoped to one role (e.g. API docs)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_files_intake ON intake_files(intake_id);

-- ════════════════════════════════════════════════════════════════
-- rolepack_comments — curator/supplier thread per rolepack
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rolepack_comments (
  id TEXT PRIMARY KEY,
  rolepack_id TEXT NOT NULL REFERENCES rolepacks_v2(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('curator','supplier')),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rolepack_comments ON rolepack_comments(rolepack_id, created_at);

-- ════════════════════════════════════════════════════════════════
-- Hierarchical region taxonomy (China > Chengdu, etc.) for §2.6
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS taxonomy_regions (
  id TEXT PRIMARY KEY,                 -- e.g. 'cn-chengdu'
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  parent_id TEXT REFERENCES taxonomy_regions(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════════════════════════
-- Department taxonomy (controlled list with 'other')
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS taxonomy_departments (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════════════════════════
-- Company-size taxonomy
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS taxonomy_company_sizes (
  id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- ════════════════════════════════════════════════════════════════
-- Seed taxonomies
-- ════════════════════════════════════════════════════════════════

-- Departments
INSERT OR IGNORE INTO taxonomy_departments (id, name_zh, name_en, display_order) VALUES
  ('compliance',    '合规',         'Compliance',                10),
  ('risk',          '风险管理',     'Risk Management',           20),
  ('legal',         '法务',         'Legal',                     30),
  ('finance',       '财务',         'Finance',                   40),
  ('hr',            '人力资源',     'HR',                        50),
  ('sales',         '销售',         'Sales',                     60),
  ('marketing',     '市场',         'Marketing',                 70),
  ('cs',            '客户服务',     'Customer Service',          80),
  ('ops',           '运营',         'Operations',                90),
  ('it',            '信息技术',     'IT',                       100),
  ('product',       '产品',         'Product',                  110),
  ('rnd',           '研发',         'R&D',                      120),
  ('procurement',   '采购',         'Procurement',              130),
  ('admin',         '行政',         'Administration',           140),
  ('other',         '其他',         'Other',                    900);

-- Company sizes
INSERT OR IGNORE INTO taxonomy_company_sizes (id, name_zh, name_en, display_order) VALUES
  ('smb',         '小型(1-50 人)',         'SMB (1-50)',                  10),
  ('mid',         '中型(51-500 人)',       'Mid-market (51-500)',         20),
  ('enterprise',  '大型(500+ 人)',         'Enterprise (500+)',           30),
  ('government',  '政府/机构',             'Government / Public sector',  40),
  ('mixed',       '混合',                  'Mixed',                       50);

-- Hierarchical regions: APAC + EU + NA + 'global'
-- Top-level regions
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('global', '全球', 'Global', NULL, 0),
  ('apac',   '亚太', 'APAC',   NULL, 10),
  ('eu',     '欧洲', 'Europe', NULL, 20),
  ('na',     '北美', 'North America', NULL, 30),
  ('mea',    '中东与非洲', 'Middle East & Africa', NULL, 40),
  ('latam',  '拉美', 'Latin America', NULL, 50);

-- APAC countries
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('cn',  '中国大陆',     'Mainland China', 'apac', 1),
  ('hk',  '香港',         'Hong Kong SAR',  'apac', 2),
  ('mo',  '澳门',         'Macau SAR',      'apac', 3),
  ('tw',  '台湾',         'Taiwan',         'apac', 4),
  ('sg',  '新加坡',       'Singapore',      'apac', 5),
  ('jp',  '日本',         'Japan',          'apac', 6),
  ('kr',  '韩国',         'Korea',          'apac', 7),
  ('my',  '马来西亚',     'Malaysia',       'apac', 8),
  ('th',  '泰国',         'Thailand',       'apac', 9),
  ('id',  '印度尼西亚',   'Indonesia',      'apac', 10),
  ('ph',  '菲律宾',       'Philippines',    'apac', 11),
  ('vn',  '越南',         'Vietnam',        'apac', 12),
  ('in',  '印度',         'India',          'apac', 13),
  ('au',  '澳大利亚',     'Australia',      'apac', 14),
  ('nz',  '新西兰',       'New Zealand',    'apac', 15);

-- China cities (top tier + regional capitals)
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('cn-bj',       '北京',     'Beijing',     'cn', 1),
  ('cn-sh',       '上海',     'Shanghai',    'cn', 2),
  ('cn-sz',       '深圳',     'Shenzhen',    'cn', 3),
  ('cn-gz',       '广州',     'Guangzhou',   'cn', 4),
  ('cn-cd',       '成都',     'Chengdu',     'cn', 5),
  ('cn-hz',       '杭州',     'Hangzhou',    'cn', 6),
  ('cn-nj',       '南京',     'Nanjing',     'cn', 7),
  ('cn-xa',       '西安',     'Xi''an',      'cn', 8),
  ('cn-wh',       '武汉',     'Wuhan',       'cn', 9),
  ('cn-cq',       '重庆',     'Chongqing',   'cn', 10),
  ('cn-tj',       '天津',     'Tianjin',     'cn', 11),
  ('cn-su',       '苏州',     'Suzhou',      'cn', 12),
  ('cn-other',    '其他城市', 'Other (CN)',  'cn', 99);

-- EU
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('uk',  '英国',       'United Kingdom', 'eu', 1),
  ('de',  '德国',       'Germany',        'eu', 2),
  ('fr',  '法国',       'France',         'eu', 3),
  ('nl',  '荷兰',       'Netherlands',    'eu', 4),
  ('ch',  '瑞士',       'Switzerland',    'eu', 5),
  ('it',  '意大利',     'Italy',          'eu', 6),
  ('es',  '西班牙',     'Spain',          'eu', 7),
  ('eu-other', '其他欧洲', 'Other (EU)',  'eu', 99);

-- NA
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('us',       '美国',     'United States', 'na', 1),
  ('ca',       '加拿大',   'Canada',        'na', 2),
  ('mx',       '墨西哥',   'Mexico',        'na', 3);

-- MEA / LATAM placeholders (controlled but minimal)
INSERT OR IGNORE INTO taxonomy_regions (id, name_zh, name_en, parent_id, display_order) VALUES
  ('ae',  '阿联酋',    'UAE',         'mea',   1),
  ('sa',  '沙特',      'Saudi Arabia','mea',   2),
  ('za',  '南非',      'South Africa','mea',   3),
  ('br',  '巴西',      'Brazil',      'latam', 1),
  ('ar',  '阿根廷',    'Argentina',   'latam', 2);
