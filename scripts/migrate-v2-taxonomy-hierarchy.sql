-- Hierarchical industries + departments. Two levels: main category → sub.
-- Adds parent_id to taxonomy_departments and reseeds both with structure.

ALTER TABLE taxonomy_departments ADD COLUMN parent_id TEXT;

-- ────────── INDUSTRIES ──────────
DELETE FROM taxonomy_industries;

INSERT INTO taxonomy_industries (id, parent_id, name_zh, name_en, display_order) VALUES
  -- Main categories
  ('cat_finance',       NULL, '金融',         'Finance',              10),
  ('cat_tech',          NULL, '科技/互联网', 'Technology / Internet', 20),
  ('cat_manufacturing', NULL, '制造',         'Manufacturing',        30),
  ('cat_retail',        NULL, '零售/消费',   'Retail / Consumer',    40),
  ('cat_healthcare',    NULL, '医疗',         'Healthcare',           50),
  ('cat_government',    NULL, '政府/公共',   'Government / Public',  60),
  ('cat_professional',  NULL, '专业服务',     'Professional services',70),
  ('cat_logistics',     NULL, '物流交通',     'Logistics / Transport',80),
  ('cat_realestate',    NULL, '房地产',       'Real estate',          90),
  ('cat_energy',        NULL, '能源',         'Energy',              100),
  ('cat_education',     NULL, '教育',         'Education',           110),
  ('cat_telecom',       NULL, '电信/媒体',   'Telecom / Media',     120),
  ('cat_other',         NULL, '其他',         'Other',               999),

  -- Finance
  ('banking',          'cat_finance', '银行',       'Banking',           11),
  ('insurance',        'cat_finance', '保险',       'Insurance',         12),
  ('securities',       'cat_finance', '证券',       'Securities',        13),
  ('asset_mgmt',       'cat_finance', '资产管理',   'Asset management',  14),
  ('svf',              'cat_finance', '支付/SVF',  'Payments / SVF',    15),
  ('wealth',           'cat_finance', '财富管理',   'Wealth management', 16),
  ('fintech',          'cat_finance', '金融科技',   'Fintech',           17),

  -- Technology
  ('software',         'cat_tech', '软件',         'Software',           21),
  ('internet',         'cat_tech', '互联网',       'Internet',           22),
  ('ai_ml',            'cat_tech', 'AI/机器学习', 'AI / ML',            23),
  ('cloud',            'cat_tech', '云计算',       'Cloud',              24),
  ('cybersecurity',    'cat_tech', '网络安全',     'Cybersecurity',      25),
  ('saas',             'cat_tech', 'SaaS',         'SaaS',               26),

  -- Manufacturing
  ('industrial',       'cat_manufacturing', '工业制造',     'Industrial',         31),
  ('automotive',       'cat_manufacturing', '汽车',         'Automotive',         32),
  ('semiconductor',    'cat_manufacturing', '半导体',       'Semiconductor',      33),
  ('food_bev',         'cat_manufacturing', '食品饮料',     'Food & beverage',    34),
  ('chemical',         'cat_manufacturing', '化工',         'Chemicals',          35),

  -- Retail
  ('retail',           'cat_retail', '零售',         'Retail',             41),
  ('ecommerce',        'cat_retail', '电商',         'E-commerce',         42),
  ('fnb',              'cat_retail', '餐饮',         'Food service',       43),
  ('beauty',           'cat_retail', '美妆',         'Beauty',             44),
  ('apparel',          'cat_retail', '服装',         'Apparel',            45),

  -- Healthcare
  ('hospital',         'cat_healthcare', '医院',         'Hospitals',          51),
  ('pharma',           'cat_healthcare', '制药',         'Pharma',             52),
  ('medtech',          'cat_healthcare', '医疗器械',     'Med-tech',           53),
  ('health_mgmt',      'cat_healthcare', '健康管理',     'Health management',  54),

  -- Government / Public
  ('gov',              'cat_government', '政府',         'Government',         61),
  ('public_utility',   'cat_government', '公共事业',     'Public utility',     62),
  ('public_education', 'cat_government', '公办教育',     'Public education',   63),
  ('non_profit',       'cat_government', '非营利',       'Non-profit',         64),

  -- Professional services
  ('legal',            'cat_professional', '法律服务',     'Legal services',     71),
  ('consulting',       'cat_professional', '咨询',         'Consulting',         72),
  ('accounting',       'cat_professional', '会计',         'Accounting',         73),
  ('hr_services',      'cat_professional', '人力资源服务', 'HR services',        74),
  ('marketing_agency', 'cat_professional', '广告/营销',   'Marketing / Ad',     75),

  -- Logistics
  ('logistics',        'cat_logistics', '物流',         'Logistics',          81),
  ('shipping',         'cat_logistics', '航运',         'Shipping',           82),
  ('aviation',         'cat_logistics', '航空',         'Aviation',           83),
  ('rail_road',        'cat_logistics', '铁路/公路',   'Rail / Road',        84),

  -- Real estate
  ('residential',      'cat_realestate', '住宅',         'Residential',        91),
  ('commercial_re',    'cat_realestate', '商业地产',     'Commercial RE',      92),
  ('property_mgmt',    'cat_realestate', '物业管理',     'Property mgmt',      93),

  -- Energy
  ('oil_gas',          'cat_energy', '石油天然气',   'Oil & gas',         101),
  ('power',            'cat_energy', '电力',         'Power',             102),
  ('renewable',        'cat_energy', '新能源',       'Renewables',        103),

  -- Education
  ('higher_ed',        'cat_education', '高等教育',     'Higher ed',         111),
  ('k12',              'cat_education', 'K12',          'K12',               112),
  ('training',         'cat_education', '职业培训',     'Training',          113),
  ('edtech',           'cat_education', '教育科技',     'EdTech',            114),

  -- Telecom / Media
  ('telecom',          'cat_telecom', '电信运营',     'Telecom carrier',   121),
  ('media',            'cat_telecom', '媒体',         'Media',             122),
  ('broadcast',        'cat_telecom', '广播电视',     'Broadcast',         123),

  -- Other (catch-all)
  ('other',            'cat_other', '其他',         'Other',            998);


-- ────────── DEPARTMENTS ──────────
DELETE FROM taxonomy_departments;

INSERT INTO taxonomy_departments (id, parent_id, name_zh, name_en, display_order) VALUES
  -- Main categories
  ('dcat_compliance',  NULL, '合规与风控',   'Compliance & Risk',     10),
  ('dcat_legal',       NULL, '法务',         'Legal',                 20),
  ('dcat_sales',       NULL, '销售与市场',   'Sales & Marketing',     30),
  ('dcat_ops',         NULL, '运营',         'Operations',            40),
  ('dcat_finance',     NULL, '财务',         'Finance',               50),
  ('dcat_hr',          NULL, '人力资源',     'HR',                    60),
  ('dcat_tech',        NULL, '技术',         'Technology',            70),
  ('dcat_product',     NULL, '产品与研发',   'Product & R&D',         80),
  ('dcat_other',       NULL, '其他',         'Other',                999),

  -- Compliance & Risk
  ('compliance',       'dcat_compliance', '合规',         'Compliance',         11),
  ('risk',             'dcat_compliance', '风险管理',     'Risk management',    12),
  ('aml',              'dcat_compliance', '反洗钱',       'AML',                13),
  ('audit',            'dcat_compliance', '内审',         'Internal audit',     14),

  -- Legal
  ('legal_dept',       'dcat_legal', '法务总监',     'Legal director',    21),
  ('contracts',        'dcat_legal', '合同管理',     'Contracts',         22),
  ('ip',               'dcat_legal', '知识产权',     'IP',                23),

  -- Sales & Marketing
  ('sales',            'dcat_sales', '销售',         'Sales',             31),
  ('marketing',        'dcat_sales', '市场',         'Marketing',         32),
  ('bd',               'dcat_sales', '商务拓展',     'Business dev',      33),
  ('customer_success', 'dcat_sales', '客户成功',     'Customer success',  34),

  -- Operations
  ('operations',       'dcat_ops', '运营',         'Operations',        41),
  ('customer_service', 'dcat_ops', '客户服务',     'Customer service',  42),
  ('supply_chain',     'dcat_ops', '供应链',       'Supply chain',      43),
  ('quality',          'dcat_ops', '质量',         'Quality',           44),

  -- Finance
  ('finance',          'dcat_finance', '财务',         'Finance',           51),
  ('accounting',       'dcat_finance', '会计',         'Accounting',        52),
  ('treasury',         'dcat_finance', '资金',         'Treasury',          53),
  ('fpa',              'dcat_finance', '财务规划',     'FP&A',              54),

  -- HR
  ('hr_dept',          'dcat_hr', '人力资源',     'HR',                61),
  ('recruiting',       'dcat_hr', '招聘',         'Recruiting',        62),
  ('learning',         'dcat_hr', '培训',         'Learning',          63),
  ('compensation',     'dcat_hr', '薪酬',         'Compensation',      64),

  -- Technology
  ('it',               'dcat_tech', 'IT',           'IT',                71),
  ('infosec',          'dcat_tech', '信息安全',     'InfoSec',           72),
  ('devops',           'dcat_tech', 'DevOps',       'DevOps',            73),
  ('data',             'dcat_tech', '数据',         'Data',              74),

  -- Product & R&D
  ('product',          'dcat_product', '产品',         'Product',           81),
  ('r_and_d',          'dcat_product', '研发',         'R&D',               82),
  ('design',           'dcat_product', '设计',         'Design',            83),

  -- Other
  ('other_dept',       'dcat_other', '其他',         'Other',            998);
