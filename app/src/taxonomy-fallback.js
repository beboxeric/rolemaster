// Static fallback for the industry + department taxonomy.
//
// Background: every couple of months an industry tag would render as the raw
// English ID (`retail`, `fnb`, `apparel`, `property_mgmt` …) somewhere in the
// UI. Each time the cause was the same — `taxonomy.industries()` returning
// empty (network blip, fresh preview env without seed, deploy ordering),
// which left every consumer's `indById[id]` lookup undefined and they fell
// through to displaying the raw ID.
//
// Fix: ship the canonical id → zh/en map alongside the bundle. The taxonomy
// API still wins when present (curators can rename), but if it's missing or
// incomplete, this fallback fills the gap so labels never leak as IDs.
//
// Mirrors scripts/migrate-v2-taxonomy-hierarchy.sql. Keep them in sync — if
// you add a new industry to the SQL migration, also add it here.

export const INDUSTRIES_FALLBACK = [
  // Main categories
  { id: 'cat_finance',       parent_id: null, name_zh: '金融',         name_en: 'Finance',                 display_order: 10 },
  { id: 'cat_tech',          parent_id: null, name_zh: '科技/互联网', name_en: 'Technology / Internet',  display_order: 20 },
  { id: 'cat_manufacturing', parent_id: null, name_zh: '制造',         name_en: 'Manufacturing',           display_order: 30 },
  { id: 'cat_retail',        parent_id: null, name_zh: '零售/消费',   name_en: 'Retail / Consumer',      display_order: 40 },
  { id: 'cat_healthcare',    parent_id: null, name_zh: '医疗',         name_en: 'Healthcare',              display_order: 50 },
  { id: 'cat_government',    parent_id: null, name_zh: '政府/公共',   name_en: 'Government / Public',    display_order: 60 },
  { id: 'cat_professional',  parent_id: null, name_zh: '专业服务',     name_en: 'Professional services',   display_order: 70 },
  { id: 'cat_logistics',     parent_id: null, name_zh: '物流交通',     name_en: 'Logistics / Transport',   display_order: 80 },
  { id: 'cat_realestate',    parent_id: null, name_zh: '房地产',       name_en: 'Real estate',             display_order: 90 },
  { id: 'cat_energy',        parent_id: null, name_zh: '能源',         name_en: 'Energy',                  display_order: 100 },
  { id: 'cat_education',     parent_id: null, name_zh: '教育',         name_en: 'Education',               display_order: 110 },
  { id: 'cat_telecom',       parent_id: null, name_zh: '电信/媒体',   name_en: 'Telecom / Media',        display_order: 120 },
  { id: 'cat_other',         parent_id: null, name_zh: '其他',         name_en: 'Other',                   display_order: 999 },

  // Finance
  { id: 'banking',     parent_id: 'cat_finance', name_zh: '银行',       name_en: 'Banking',           display_order: 11 },
  { id: 'insurance',   parent_id: 'cat_finance', name_zh: '保险',       name_en: 'Insurance',         display_order: 12 },
  { id: 'securities',  parent_id: 'cat_finance', name_zh: '证券',       name_en: 'Securities',        display_order: 13 },
  { id: 'asset_mgmt',  parent_id: 'cat_finance', name_zh: '资产管理',   name_en: 'Asset management',  display_order: 14 },
  { id: 'svf',         parent_id: 'cat_finance', name_zh: '支付/SVF',  name_en: 'Payments / SVF',    display_order: 15 },
  { id: 'wealth',      parent_id: 'cat_finance', name_zh: '财富管理',   name_en: 'Wealth management', display_order: 16 },
  { id: 'fintech',     parent_id: 'cat_finance', name_zh: '金融科技',   name_en: 'Fintech',           display_order: 17 },

  // Technology
  { id: 'software',      parent_id: 'cat_tech', name_zh: '软件',         name_en: 'Software',      display_order: 21 },
  { id: 'internet',      parent_id: 'cat_tech', name_zh: '互联网',       name_en: 'Internet',      display_order: 22 },
  { id: 'ai_ml',         parent_id: 'cat_tech', name_zh: 'AI/机器学习', name_en: 'AI / ML',       display_order: 23 },
  { id: 'cloud',         parent_id: 'cat_tech', name_zh: '云计算',       name_en: 'Cloud',         display_order: 24 },
  { id: 'cybersecurity', parent_id: 'cat_tech', name_zh: '网络安全',     name_en: 'Cybersecurity', display_order: 25 },
  { id: 'saas',          parent_id: 'cat_tech', name_zh: 'SaaS',         name_en: 'SaaS',          display_order: 26 },

  // Manufacturing
  { id: 'industrial',    parent_id: 'cat_manufacturing', name_zh: '工业制造', name_en: 'Industrial',      display_order: 31 },
  { id: 'automotive',    parent_id: 'cat_manufacturing', name_zh: '汽车',     name_en: 'Automotive',      display_order: 32 },
  { id: 'semiconductor', parent_id: 'cat_manufacturing', name_zh: '半导体',   name_en: 'Semiconductor',   display_order: 33 },
  { id: 'food_bev',      parent_id: 'cat_manufacturing', name_zh: '食品饮料', name_en: 'Food & beverage', display_order: 34 },
  { id: 'chemical',      parent_id: 'cat_manufacturing', name_zh: '化工',     name_en: 'Chemicals',       display_order: 35 },

  // Retail / Consumer
  { id: 'retail',    parent_id: 'cat_retail', name_zh: '零售', name_en: 'Retail',       display_order: 41 },
  { id: 'ecommerce', parent_id: 'cat_retail', name_zh: '电商', name_en: 'E-commerce',   display_order: 42 },
  { id: 'fnb',       parent_id: 'cat_retail', name_zh: '餐饮', name_en: 'Food service', display_order: 43 },
  { id: 'beauty',    parent_id: 'cat_retail', name_zh: '美妆', name_en: 'Beauty',       display_order: 44 },
  { id: 'apparel',   parent_id: 'cat_retail', name_zh: '服装', name_en: 'Apparel',      display_order: 45 },

  // Healthcare
  { id: 'hospital',    parent_id: 'cat_healthcare', name_zh: '医院',     name_en: 'Hospitals',         display_order: 51 },
  { id: 'pharma',      parent_id: 'cat_healthcare', name_zh: '制药',     name_en: 'Pharma',            display_order: 52 },
  { id: 'medtech',     parent_id: 'cat_healthcare', name_zh: '医疗器械', name_en: 'Med-tech',          display_order: 53 },
  { id: 'health_mgmt', parent_id: 'cat_healthcare', name_zh: '健康管理', name_en: 'Health management', display_order: 54 },

  // Government / Public
  { id: 'gov',              parent_id: 'cat_government', name_zh: '政府',     name_en: 'Government',       display_order: 61 },
  { id: 'public_utility',   parent_id: 'cat_government', name_zh: '公共事业', name_en: 'Public utility',   display_order: 62 },
  { id: 'public_education', parent_id: 'cat_government', name_zh: '公办教育', name_en: 'Public education', display_order: 63 },
  { id: 'non_profit',       parent_id: 'cat_government', name_zh: '非营利',   name_en: 'Non-profit',       display_order: 64 },

  // Professional services
  { id: 'legal',            parent_id: 'cat_professional', name_zh: '法律服务',     name_en: 'Legal services',  display_order: 71 },
  { id: 'consulting',       parent_id: 'cat_professional', name_zh: '咨询',         name_en: 'Consulting',      display_order: 72 },
  { id: 'accounting',       parent_id: 'cat_professional', name_zh: '会计',         name_en: 'Accounting',      display_order: 73 },
  { id: 'hr_services',      parent_id: 'cat_professional', name_zh: '人力资源服务', name_en: 'HR services',     display_order: 74 },
  { id: 'marketing_agency', parent_id: 'cat_professional', name_zh: '广告/营销',   name_en: 'Marketing / Ad',  display_order: 75 },

  // Logistics
  { id: 'logistics', parent_id: 'cat_logistics', name_zh: '物流',         name_en: 'Logistics',           display_order: 81 },
  { id: 'shipping',  parent_id: 'cat_logistics', name_zh: '航运',         name_en: 'Shipping',            display_order: 82 },
  { id: 'aviation',  parent_id: 'cat_logistics', name_zh: '航空',         name_en: 'Aviation',            display_order: 83 },
  { id: 'rail_road', parent_id: 'cat_logistics', name_zh: '铁路/公路',   name_en: 'Rail / Road',         display_order: 84 },
  { id: 'highway',   parent_id: 'cat_logistics', name_zh: '高速公路运营', name_en: 'Highway operations',   display_order: 85 },

  // Real estate
  { id: 'residential',   parent_id: 'cat_realestate', name_zh: '住宅',     name_en: 'Residential',    display_order: 91 },
  { id: 'commercial_re', parent_id: 'cat_realestate', name_zh: '商业地产', name_en: 'Commercial RE',  display_order: 92 },
  { id: 'property_mgmt', parent_id: 'cat_realestate', name_zh: '物业管理', name_en: 'Property mgmt',  display_order: 93 },

  // Energy
  { id: 'oil_gas',   parent_id: 'cat_energy', name_zh: '石油天然气', name_en: 'Oil & gas',  display_order: 101 },
  { id: 'power',     parent_id: 'cat_energy', name_zh: '电力',       name_en: 'Power',      display_order: 102 },
  { id: 'renewable', parent_id: 'cat_energy', name_zh: '新能源',     name_en: 'Renewables', display_order: 103 },

  // Education
  { id: 'higher_ed', parent_id: 'cat_education', name_zh: '高等教育', name_en: 'Higher ed', display_order: 111 },
  { id: 'k12',       parent_id: 'cat_education', name_zh: 'K12',      name_en: 'K12',       display_order: 112 },
  { id: 'training',  parent_id: 'cat_education', name_zh: '职业培训', name_en: 'Training',  display_order: 113 },
  { id: 'edtech',    parent_id: 'cat_education', name_zh: '教育科技', name_en: 'EdTech',    display_order: 114 },

  // Telecom / Media
  { id: 'telecom',     parent_id: 'cat_telecom', name_zh: '电信运营',     name_en: 'Telecom carrier',     display_order: 121 },
  { id: 'media',       parent_id: 'cat_telecom', name_zh: '媒体',         name_en: 'Media',               display_order: 122 },
  { id: 'broadcast',   parent_id: 'cat_telecom', name_zh: '广播电视',     name_en: 'Broadcast',           display_order: 123 },
  { id: 'film_tv',     parent_id: 'cat_telecom', name_zh: '影视制作',     name_en: 'Film & TV',           display_order: 124 },
  { id: 'short_video', parent_id: 'cat_telecom', name_zh: '短视频平台',   name_en: 'Short-video platform', display_order: 125 },
  { id: 'mcn',         parent_id: 'cat_telecom', name_zh: 'MCN 机构',     name_en: 'MCN agency',          display_order: 126 },

  // Other
  { id: 'other', parent_id: 'cat_other', name_zh: '其他', name_en: 'Other', display_order: 998 },
];

export const DEPARTMENTS_FALLBACK = [
  // Main categories
  { id: 'dcat_compliance', parent_id: null, name_zh: '合规与风控', name_en: 'Compliance & Risk',  display_order: 10 },
  { id: 'dcat_legal',      parent_id: null, name_zh: '法务',       name_en: 'Legal',              display_order: 20 },
  { id: 'dcat_sales',      parent_id: null, name_zh: '销售与市场', name_en: 'Sales & Marketing',  display_order: 30 },
  { id: 'dcat_ops',        parent_id: null, name_zh: '运营',       name_en: 'Operations',         display_order: 40 },
  { id: 'dcat_finance',    parent_id: null, name_zh: '财务',       name_en: 'Finance',            display_order: 50 },
  { id: 'dcat_hr',         parent_id: null, name_zh: '人力资源',   name_en: 'HR',                 display_order: 60 },
  { id: 'dcat_tech',       parent_id: null, name_zh: '技术',       name_en: 'Technology',         display_order: 70 },
  { id: 'dcat_product',    parent_id: null, name_zh: '产品与研发', name_en: 'Product & R&D',      display_order: 80 },
  { id: 'dcat_other',      parent_id: null, name_zh: '其他',       name_en: 'Other',              display_order: 999 },

  // Compliance & Risk
  { id: 'compliance', parent_id: 'dcat_compliance', name_zh: '合规',     name_en: 'Compliance',      display_order: 11 },
  { id: 'risk',       parent_id: 'dcat_compliance', name_zh: '风险管理', name_en: 'Risk management', display_order: 12 },
  { id: 'aml',        parent_id: 'dcat_compliance', name_zh: '反洗钱',   name_en: 'AML',             display_order: 13 },
  { id: 'audit',      parent_id: 'dcat_compliance', name_zh: '内审',     name_en: 'Internal audit',  display_order: 14 },

  // Legal
  { id: 'legal_dept', parent_id: 'dcat_legal', name_zh: '法务总监', name_en: 'Legal director', display_order: 21 },
  { id: 'contracts',  parent_id: 'dcat_legal', name_zh: '合同管理', name_en: 'Contracts',      display_order: 22 },
  { id: 'ip',         parent_id: 'dcat_legal', name_zh: '知识产权', name_en: 'IP',             display_order: 23 },

  // Sales & Marketing
  { id: 'sales',            parent_id: 'dcat_sales', name_zh: '销售',     name_en: 'Sales',            display_order: 31 },
  { id: 'marketing',        parent_id: 'dcat_sales', name_zh: '市场',     name_en: 'Marketing',        display_order: 32 },
  { id: 'bd',               parent_id: 'dcat_sales', name_zh: '商务拓展', name_en: 'Business dev',     display_order: 33 },
  { id: 'customer_success', parent_id: 'dcat_sales', name_zh: '客户成功', name_en: 'Customer success', display_order: 34 },

  // Operations
  { id: 'operations',       parent_id: 'dcat_ops', name_zh: '运营',     name_en: 'Operations',       display_order: 41 },
  { id: 'customer_service', parent_id: 'dcat_ops', name_zh: '客户服务', name_en: 'Customer service', display_order: 42 },
  { id: 'supply_chain',     parent_id: 'dcat_ops', name_zh: '供应链',   name_en: 'Supply chain',     display_order: 43 },
  { id: 'quality',          parent_id: 'dcat_ops', name_zh: '质量',     name_en: 'Quality',          display_order: 44 },

  // Finance
  { id: 'finance',    parent_id: 'dcat_finance', name_zh: '财务',     name_en: 'Finance',    display_order: 51 },
  { id: 'accounting', parent_id: 'dcat_finance', name_zh: '会计',     name_en: 'Accounting', display_order: 52 },
  { id: 'treasury',   parent_id: 'dcat_finance', name_zh: '资金',     name_en: 'Treasury',   display_order: 53 },
  { id: 'fpa',        parent_id: 'dcat_finance', name_zh: '财务规划', name_en: 'FP&A',       display_order: 54 },

  // HR
  { id: 'hr_dept',      parent_id: 'dcat_hr', name_zh: '人力资源', name_en: 'HR',           display_order: 61 },
  { id: 'recruiting',   parent_id: 'dcat_hr', name_zh: '招聘',     name_en: 'Recruiting',   display_order: 62 },
  { id: 'learning',     parent_id: 'dcat_hr', name_zh: '培训',     name_en: 'Learning',     display_order: 63 },
  { id: 'compensation', parent_id: 'dcat_hr', name_zh: '薪酬',     name_en: 'Compensation', display_order: 64 },

  // Technology
  { id: 'it',      parent_id: 'dcat_tech', name_zh: 'IT',       name_en: 'IT',      display_order: 71 },
  { id: 'infosec', parent_id: 'dcat_tech', name_zh: '信息安全', name_en: 'InfoSec', display_order: 72 },
  { id: 'devops',  parent_id: 'dcat_tech', name_zh: 'DevOps',   name_en: 'DevOps',  display_order: 73 },
  { id: 'data',    parent_id: 'dcat_tech', name_zh: '数据',     name_en: 'Data',    display_order: 74 },

  // Product & R&D
  { id: 'product',  parent_id: 'dcat_product', name_zh: '产品', name_en: 'Product', display_order: 81 },
  { id: 'r_and_d',  parent_id: 'dcat_product', name_zh: '研发', name_en: 'R&D',     display_order: 82 },
  { id: 'design',   parent_id: 'dcat_product', name_zh: '设计', name_en: 'Design',  display_order: 83 },

  // Other
  { id: 'other_dept', parent_id: 'dcat_other', name_zh: '其他', name_en: 'Other', display_order: 998 },
];

const INDUSTRIES_BY_ID = Object.fromEntries(INDUSTRIES_FALLBACK.map(i => [i.id, i]));
const DEPARTMENTS_BY_ID = Object.fromEntries(DEPARTMENTS_FALLBACK.map(d => [d.id, d]));

// Localize a single industry/department ID. Use this anywhere the label is
// rendered without first fetching the API. `kind` is 'industry' (default) or
// 'department'.
export function labelOfTaxonomy(id, lang, kind = 'industry') {
  if (id == null) return '';
  if (typeof id !== 'string') return String(id);
  if (id.startsWith('custom:')) return id.slice(7);
  const dict = kind === 'department' ? DEPARTMENTS_BY_ID : INDUSTRIES_BY_ID;
  const it = dict[id];
  if (!it) return id;
  if (lang === 'zh') return it.name_zh || it.name_en || id;
  return it.name_en || it.name_zh || id;
}

// Merge an API response (possibly empty) with the fallback list. API entries
// win — curators can rename via the admin endpoint and the new name should
// surface — but any ID present only in the fallback gets included so labels
// never fall through to the raw ID.
export function mergeIndustriesWithFallback(apiItems) {
  const byId = {};
  for (const f of INDUSTRIES_FALLBACK) byId[f.id] = f;
  for (const a of (apiItems || [])) if (a && a.id) byId[a.id] = a;
  return Object.values(byId).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}

export function mergeDepartmentsWithFallback(apiItems) {
  const byId = {};
  for (const f of DEPARTMENTS_FALLBACK) byId[f.id] = f;
  for (const a of (apiItems || [])) if (a && a.id) byId[a.id] = a;
  return Object.values(byId).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
