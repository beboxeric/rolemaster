// Bucket every industry id (canonical sub-id, custom:* free-text, or already
// a parent cat_*) onto its top-level taxonomy CATEGORY id (cat_finance,
// cat_tech, cat_retail, cat_telecom …). The landing-page hero, the public
// /rolepacks catalogue, and the curator library all show the BIG groups —
// not narrow leaves like 'highway' or 'film_tv'.
//
// Applied at read time so the DB stays untouched. If an id has no known
// parent we fall through to cat_other rather than leak the raw string.

// Sub-industry id → parent category. Mirrors
// scripts/migrate-v2-taxonomy-hierarchy.sql; keep them in sync if you add
// new leaves.
const SUB_TO_PARENT = {
  // Finance
  banking: 'cat_finance', insurance: 'cat_finance', securities: 'cat_finance',
  asset_mgmt: 'cat_finance', svf: 'cat_finance', wealth: 'cat_finance', fintech: 'cat_finance',
  // Technology
  software: 'cat_tech', internet: 'cat_tech', ai_ml: 'cat_tech',
  cloud: 'cat_tech', cybersecurity: 'cat_tech', saas: 'cat_tech',
  // Manufacturing
  industrial: 'cat_manufacturing', automotive: 'cat_manufacturing',
  semiconductor: 'cat_manufacturing', food_bev: 'cat_manufacturing', chemical: 'cat_manufacturing',
  // Retail
  retail: 'cat_retail', ecommerce: 'cat_retail', fnb: 'cat_retail',
  beauty: 'cat_retail', apparel: 'cat_retail',
  // Healthcare
  hospital: 'cat_healthcare', pharma: 'cat_healthcare',
  medtech: 'cat_healthcare', health_mgmt: 'cat_healthcare',
  // Government
  gov: 'cat_government', public_utility: 'cat_government',
  public_education: 'cat_government', non_profit: 'cat_government',
  // Professional services
  legal: 'cat_professional', consulting: 'cat_professional', accounting: 'cat_professional',
  hr_services: 'cat_professional', marketing_agency: 'cat_professional',
  // Logistics
  logistics: 'cat_logistics', shipping: 'cat_logistics',
  aviation: 'cat_logistics', rail_road: 'cat_logistics', highway: 'cat_logistics',
  // Real estate
  residential: 'cat_realestate', commercial_re: 'cat_realestate', property_mgmt: 'cat_realestate',
  // Energy
  oil_gas: 'cat_energy', power: 'cat_energy', renewable: 'cat_energy',
  // Education
  higher_ed: 'cat_education', k12: 'cat_education', training: 'cat_education', edtech: 'cat_education',
  // Telecom / Media
  telecom: 'cat_telecom', media: 'cat_telecom', broadcast: 'cat_telecom',
  film_tv: 'cat_telecom', short_video: 'cat_telecom', mcn: 'cat_telecom',
  // Other
  other: 'cat_other',
};

// `custom:xxx` string → canonical sub-id whose parent we should bucket to.
// Anything not in this list buckets to cat_other.
const CUSTOM_TO_SUB = {
  'custom:广告营销':       'marketing_agency',
  'custom:广告':           'marketing_agency',
  'custom:营销':           'marketing_agency',
  'custom:传媒':           'media',
  'custom:媒体':           'media',
  'custom:电商':           'ecommerce',
  'custom:电子商务':       'ecommerce',
  'custom:影视制作':       'film_tv',
  'custom:影视':           'film_tv',
  'custom:短视频平台':     'short_video',
  'custom:短视频':         'short_video',
  'custom:MCN机构':        'mcn',
  'custom:MCN 机构':       'mcn',
  // Highway / transport
  'custom:省/市级高速公路集团': 'highway',
  'custom:省级高速公路集团':    'highway',
  'custom:市级高速公路集团':    'highway',
  'custom:高速公路集团':        'highway',
  'custom:高速公路':            'highway',
  'custom:交投/交建集团':       'highway',
  'custom:交投集团':            'highway',
  'custom:交建集团':            'highway',
  'custom:城市快速路/绕城高速': 'highway',
  'custom:城市快速路':          'highway',
  'custom:绕城高速':            'highway',
  'custom:道路':                'highway',
};

// Bucket a single id → parent category id.
function bucketToParent(id) {
  if (typeof id !== 'string' || !id) return 'cat_other';
  // Already a parent category — keep it.
  if (id.startsWith('cat_')) return id;
  // Free-text custom string — look up its canonical sub, then parent.
  if (id.startsWith('custom:')) {
    const sub = CUSTOM_TO_SUB[id];
    if (sub && SUB_TO_PARENT[sub]) return SUB_TO_PARENT[sub];
    return 'cat_other';
  }
  // Sub-industry — look up its parent.
  return SUB_TO_PARENT[id] || 'cat_other';
}

// Map an industry id list onto deduped parent-category ids, preserving order.
export function remapIndustries(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const parent = bucketToParent(raw);
    if (!seen.has(parent)) {
      seen.add(parent);
      out.push(parent);
    }
  }
  return out;
}

// Display order of parent categories. Mirrors the display_order values in
// scripts/migrate-v2-taxonomy-hierarchy.sql + app/src/taxonomy-fallback.js.
// Used to group cards by industry across the landing hero, /rolepacks, and
// curator library so all three surfaces show cards in the same order.
const CATEGORY_DISPLAY_ORDER = {
  cat_finance:       10,
  cat_tech:          20,
  cat_manufacturing: 30,
  cat_retail:        40,
  cat_healthcare:    50,
  cat_government:    60,
  cat_professional:  70,
  cat_logistics:     80,
  cat_realestate:    90,
  cat_energy:        100,
  cat_education:     110,
  cat_telecom:       120,
  cat_other:         999,
};

// Rank a rolepack by its FIRST industry's parent-category display order.
// Use as the primary key in a stable sort to group same-industry cards.
// Cards with no industry — or only unknown ids — fall through to cat_other (999).
export function primaryIndustryRank(industries) {
  if (!Array.isArray(industries) || industries.length === 0) return 999;
  const parent = bucketToParent(industries[0]);
  return CATEGORY_DISPLAY_ORDER[parent] ?? 999;
}
