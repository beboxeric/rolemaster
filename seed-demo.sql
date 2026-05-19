-- RoleMaster — RICH DEMO seed.
-- Wipes everything and creates 4 accounts + 2 suppliers + 2 submissions + 2 published RolePacks.
-- All accounts: password "demo" (PBKDF2 SHA-256, 100k iter).
--
-- Apply with: wrangler d1 execute rolemaster-db --file=seed-demo.sql --remote
-- (or --local for the dev DB)

DELETE FROM chat_messages;
DELETE FROM audit_log;
DELETE FROM files;
DELETE FROM submission_fields;
DELETE FROM submissions;
DELETE FROM rolepacks;
DELETE FROM users;
DELETE FROM suppliers;

-- ════════════════════════════════════════════════════════════════
-- USERS — all password "demo"
-- ════════════════════════════════════════════════════════════════

INSERT INTO suppliers (id, name, short_name, hq, contact, phone, founded, team, clients) VALUES
  ('SUP-VIGIL', 'Vigil Advisory Limited', 'Vigil', 'Hong Kong', '陈志伟 / Wilson Chan', '+852 5432 1098', 2018, '6 core + advisory network', 12),
  ('SUP-ASELO', 'Aselo Inc.',             'Aselo', 'Hong Kong', 'ops@aselo.io',           '+852 2880 1234', 2024, '4 core founders',           8);

INSERT INTO users (id, email, password, salt, name, role, supplier_id) VALUES
  ('U-curator', 'curator@demo', '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
                                'f5d7ad77511a07ad74077a8ab180967b', 'Grace Ho',     'curator',  NULL),
  ('U-sales',   'sales@demo',   '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
                                'f5d7ad77511a07ad74077a8ab180967b', 'Sales Rep',    'sales',    NULL),
  ('U-vigil',   'vigil@demo',   '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
                                'f5d7ad77511a07ad74077a8ab180967b', 'Wilson Chan',  'supplier', 'SUP-VIGIL'),
  ('U-aselo',   'aselo@demo',   '8ad15ed3c8a87945b3a1fa6b385f8337bd9fb6749094b0b55ad18602e25ae6b9',
                                'f5d7ad77511a07ad74077a8ab180967b', 'Aselo Ops',    'supplier', 'SUP-ASELO');

-- ════════════════════════════════════════════════════════════════
-- VIGIL — TMX submission (S-2418), status='new', AI-prefilled at 65%
-- This mirrors the original prototype's centerpiece.
-- ════════════════════════════════════════════════════════════════

INSERT INTO submissions
  (id, supplier_id, product_id, product_name, product_subtitle_zh, product_subtitle_en,
   status, prefill, materials, submitted_at)
VALUES
  ('S-2418', 'SUP-VIGIL', 'TMX', 'TMX', 'AML 交易监控', 'AML Monitoring',
   'new', 65, '["pdf","ppt","url"]', datetime('now', '-2 hours'));

-- 30 fields covering all 8 sections.
INSERT INTO submission_fields (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, hint_zh, hint_en, optional) VALUES
-- Section 1 — Company basics
('S-2418', 'company_name',     1, '公司名称', 'Company name',
   'Vigil Advisory Limited', 'Vigil Advisory Limited', 'filled', NULL, NULL, 0),
('S-2418', 'company_hq',       1, '总部', 'Headquarters',
   '香港', 'Hong Kong', 'filled', NULL, NULL, 0),
('S-2418', 'company_founded',  1, '成立年份', 'Founded',
   '2018', '2018', 'ai', NULL, NULL, 1),
('S-2418', 'company_team',     1, '团队规模', 'Team size',
   '6 名核心 + 顾问网络', '6 core + advisory network', 'ai', NULL, NULL, 1),
('S-2418', 'company_clients',  1, '现有企业客户', 'Enterprise clients',
   '12 家(港资银行、保险、SVF)', '12 (HK banks, insurance, SVF)', 'ai', NULL, NULL, 1),

-- Section 2 — Who uses
('S-2418', 'user_industry',    2, '目标行业', 'Target industries',
   '持牌银行、虚拟银行、SVF、证券', 'Licensed banks, virtual banks, SVF, securities', 'ai', NULL, NULL, 0),
('S-2418', 'user_orgsize',     2, '客户组织规模', 'Org size',
   '中型(大型机构通常自建)', 'Mid-tier (large institutions build their own)', 'ai', NULL, NULL, 0),
('S-2418', 'user_role',        2, '使用者角色', 'User role',
   'AML 分析师,初级到中级', 'AML Analyst, junior to mid', 'ai', NULL, NULL, 0),
('S-2418', 'user_seniority',   2, '资历', 'Seniority',
   '合规团队', 'Compliance teams', 'weak',
   '请具体到职级,例如「初级到中级 AML 分析师」', 'Be specific — e.g. junior to mid AML Analysts', 0),
('S-2418', 'user_daily',       2, '日常工作内容', 'Daily activities',
   '清理告警队列、判断可疑度、撰写 SAR 报告', 'Clearing alert queues, judging suspicion, writing SAR reports', 'ai', NULL, NULL, 0),

-- Section 3 — Who buys
('S-2418', 'buyer_role',       3, '决策者', 'Decision-maker',
   'MLRO 或 CCO,有时 COO', 'MLRO or CCO; sometimes COO', 'ai', NULL, NULL, 0),
('S-2418', 'buyer_priorities', 3, '采购方关注点', 'Buyer priorities',
   '通过监管检查、模型可解释性、低误报率、数据本地化', 'Passing regulator inspection, model explainability, low false-positive rate, data localization', 'ai', NULL, NULL, 0),
('S-2418', 'buyer_budget',     3, '预算区间', 'Typical budget',
   '', '', 'empty', NULL, NULL, 1),

-- Section 4 — Problem
('S-2418', 'pain_main',        4, '客户当前主要痛点', 'Main pain',
   '规则引擎误报率 40-60%,告警堆积;黑盒模型在监管解释性上不达标',
   'Rule engine false positive rate 40-60%; alerts pile up; black-box models fail regulator explainability', 'ai', NULL, NULL, 0),
('S-2418', 'pain_workaround',  4, '客户当前如何处理', 'Current workaround',
   '扩编合规团队人手清理告警,效率与成本两难',
   'Hire more compliance staff to clear alerts — efficiency vs cost tradeoff', 'ai', NULL, NULL, 0),
('S-2418', 'pain_outcome',     4, '量化效果(可选)', 'Quantified outcomes (optional)',
   '误报降低 90%+;告警处理效率提升 70-85%;客户复核 2-3 天 → 2-4 小时',
   'False positives cut 90%+; alert handling efficiency up 70-85%; client review 2-3 days → 2-4 hours', 'ai', NULL, NULL, 1),

-- Section 5 — Product
('S-2418', 'do_capabilities',  5, '产品能做什么动作', 'What actions does it perform',
   '规则 + CNN/LSTM 双模引擎、异常归因、AI 辅助复核、SAR 自动生成、多维风险评级、AI 动态再评级、BRRA 自评估',
   'Rules + CNN/LSTM dual engine, anomaly attribution, AI-assisted review, auto SAR generation, multi-dim risk rating, AI dynamic re-rating, BRRA self-assessment', 'ai', NULL, NULL, 0),
('S-2418', 'do_knowledge',     5, '内置了哪些规则、SOP、行业知识', 'Embedded knowledge / SOPs',
   'FATF、中国《反洗钱法》、HKMA/SFC 要求、异常处理 SOP、误报申诉流程、250+ 司法辖区风险库',
   'FATF, China AML Law, HKMA/SFC requirements, anomaly handling SOP, false-positive appeal flow, 250+ jurisdiction risk libraries', 'ai', NULL, NULL, 0),
('S-2418', 'do_interfaces',    5, '需要对接哪些系统', 'What systems does it integrate with',
   'SWIFT、ISO 20022、CIPS、FPS、内部 ERP、风险看板',
   'SWIFT, ISO 20022, CIPS, FPS, internal ERP, risk dashboards', 'ai', NULL, NULL, 0),

-- Section 6 — Deployment
('S-2418', 'deploy_mode',      6, '部署方式', 'Deployment mode',
   '私有化部署优先,混合云可', 'Private deployment preferred, hybrid cloud OK', 'ai', NULL, NULL, 0),
('S-2418', 'deploy_regions',   6, '已落地区域', 'Production regions',
   '香港、新加坡;可适配中国大陆与亚太', 'Hong Kong, Singapore; adaptable to mainland China & APAC', 'ai', NULL, NULL, 0),
('S-2418', 'deploy_lang',      6, '支持语言', 'Supported languages',
   '中文、英文', 'Chinese, English', 'ai', NULL, NULL, 0),
('S-2418', 'deploy_reg',       6, '监管合规(可选)', 'Regulatory (optional)',
   'HKMA、MAS、SFC 已支持;PBOC 可适配', 'HKMA, MAS, SFC supported; PBOC adaptable', 'ai', NULL, NULL, 1),

-- Section 7 — Service
('S-2418', 'svc_demo',         7, '演示偏好', 'Demo preferences',
   '', '', 'empty', NULL, NULL, 0),
('S-2418', 'svc_assist',       7, '是否愿意配合销售', 'Sales-assist willingness',
   '愿意,可派 SE 配合演示与 POC', 'Yes — SE can join demos and POC', 'ai', NULL, NULL, 0),
('S-2418', 'svc_response',     7, '响应时间', 'Response SLA',
   '', '', 'empty', NULL, NULL, 0),
('S-2418', 'svc_scope',        7, '交付范围', 'Delivery scope',
   '产品交付 + 上线培训 + 持续运营支持', 'Product delivery + onboarding training + ongoing support', 'ai', NULL, NULL, 0),
('S-2418', 'svc_lang',         7, '支持语言', 'Support languages',
   '中文、英文', 'Chinese, English', 'ai', NULL, NULL, 0),

-- Section 8 — Pricing
('S-2418', 'price_model',      8, '定价模式', 'Pricing model',
   '年度许可 + 按交易笔数分级', 'Annual license + per-transaction tiers', 'ai', NULL, NULL, 0),
('S-2418', 'price_cost',       8, '成本价(对我方)', 'Cost (to us)',
   'HKD 300K / yr', 'HKD 300K / yr', 'ai', NULL, NULL, 0),
('S-2418', 'price_retail',     8, '建议零售价', 'Suggested retail',
   'HKD 600K - 800K / yr', 'HKD 600K - 800K / yr', 'ai', NULL, NULL, 0),
('S-2418', 'price_custom',     8, '私有化部署起价', 'Private deployment from',
   'HKD 200K', 'HKD 200K', 'ai', NULL, NULL, 1),
('S-2418', 'price_service',    8, '定制服务费(可选)', 'Custom service fee (optional)',
   'HKD 8K / person-day', 'HKD 8K / person-day', 'ai', NULL, NULL, 1);

INSERT INTO audit_log (submission_id, who, action_zh, action_en, created_at) VALUES
  ('S-2418', 'AI',           '完成材料解析,预填 65%', 'Parsed materials, prefilled 65% of fields', datetime('now', '-2 hours', '+2 minutes')),
  ('S-2418', 'Wilson Chan',  '确认并提交 TMX',         'Confirmed and submitted TMX',              datetime('now', '-1 hours'));

-- ════════════════════════════════════════════════════════════════
-- ASELO — Staff Assistant submission (S-3001), status='new', prefill 70%
-- Real Aselo product: multi-tenant SaaS, RAG chat for shop floor staff, HK SMBs.
-- ════════════════════════════════════════════════════════════════

INSERT INTO submissions
  (id, supplier_id, product_id, product_name, product_subtitle_zh, product_subtitle_en,
   status, prefill, materials, submitted_at)
VALUES
  ('S-3001', 'SUP-ASELO', 'STAFF', 'Aselo Staff Assistant', '门店店员智能问答助手', 'Shop-floor staff Q&A assistant',
   'new', 70, '["pdf","url"]', datetime('now', '-30 minutes'));

INSERT INTO submission_fields (submission_id, field_id, section, label_zh, label_en, value_zh, value_en, status, hint_zh, hint_en, optional) VALUES
-- Section 1
('S-3001', 'company_name',     1, '公司名称', 'Company name',
   'Aselo Inc.', 'Aselo Inc.', 'filled', NULL, NULL, 0),
('S-3001', 'company_hq',       1, '总部', 'Headquarters',
   '香港', 'Hong Kong', 'filled', NULL, NULL, 0),
('S-3001', 'company_founded',  1, '成立年份', 'Founded',
   '2024', '2024', 'ai', NULL, NULL, 1),
('S-3001', 'company_team',     1, '团队规模', 'Team size',
   '4 名创始团队', '4 core founders', 'ai', NULL, NULL, 1),
('S-3001', 'company_clients',  1, '现有企业客户', 'Enterprise clients',
   '8 家(港资零售、餐饮、SaaS)', '8 (HK retail, F&B, SaaS)', 'ai', NULL, NULL, 1),

-- Section 2
('S-3001', 'user_industry',    2, '目标行业', 'Target industries',
   '零售、餐饮、专业服务、品牌门店', 'Retail, F&B, professional services, brand stores', 'ai', NULL, NULL, 0),
('S-3001', 'user_orgsize',     2, '客户组织规模', 'Org size',
   '中小企业(2-50 名员工)', 'SMB (2-50 employees)', 'ai', NULL, NULL, 0),
('S-3001', 'user_role',        2, '使用者角色', 'User role',
   '门店店员、前台接待、新入职员工', 'Shop-floor staff, front-desk receptionists, new hires', 'ai', NULL, NULL, 0),
('S-3001', 'user_seniority',   2, '资历', 'Seniority',
   '一线员工,无技术背景要求', 'Frontline workers, no technical background required', 'ai', NULL, NULL, 0),
('S-3001', 'user_daily',       2, '日常工作内容', 'Daily activities',
   '回答客户产品问题、查找内部文档、转发资料给客户(WhatsApp/微信)、新人培训',
   'Answering customer product questions, looking up internal docs, sending materials to customers via WhatsApp/WeChat, training new hires', 'ai', NULL, NULL, 0),

-- Section 3
('S-3001', 'buyer_role',       3, '决策者', 'Decision-maker',
   '小企业老板 / 店长 / 营运经理', 'SMB owner / store manager / operations lead', 'ai', NULL, NULL, 0),
('S-3001', 'buyer_priorities', 3, '采购方关注点', 'Buyer priorities',
   '上手简单、价格低、中文友好、不需要 IT 部门部署',
   'Easy to use, low price, Chinese-friendly, no IT dept needed for setup', 'ai', NULL, NULL, 0),
('S-3001', 'buyer_budget',     3, '预算区间', 'Typical budget',
   'HK$88-880 / 月,价格高度敏感', 'HK$88-880 / month, highly price-sensitive', 'filled', NULL, NULL, 1),

-- Section 4
('S-3001', 'pain_main',        4, '客户当前主要痛点', 'Main pain',
   '一线员工找产品资料慢,新人上手要 4-6 周;老板没空写 SOP;客户在 WhatsApp 上问问题等不及',
   'Frontline staff slow to find product info; new hires take 4-6 weeks to ramp; owners have no time to write SOPs; customers waiting on WhatsApp', 'ai', NULL, NULL, 0),
('S-3001', 'pain_workaround',  4, '客户当前如何处理', 'Current workaround',
   '微信群里问同事、翻 Excel、打电话给老板,回复时间长',
   'Asking colleagues in WeChat groups, scrolling Excel files, calling the boss — long response times', 'ai', NULL, NULL, 0),
('S-3001', 'pain_outcome',     4, '量化效果(可选)', 'Quantified outcomes (optional)',
   '员工回答客户问题时间从 5-10 分钟降到 30 秒;新人上手从 4-6 周降到 1 周',
   'Time to answer customer questions: 5-10 min → 30s; new-hire ramp: 4-6 weeks → 1 week', 'ai', NULL, NULL, 1),

-- Section 5
('S-3001', 'do_capabilities',  5, '产品能做什么动作', 'What actions does it perform',
   '基于公司知识库的实时问答(RAG)、文档自动索引、员工分享文件库、会议纪要总结、餐厅菜单专用模式',
   'Real-time Q&A grounded in company knowledge base (RAG), automatic document indexing, staff-shareable file library, meeting summarisation, restaurant menu mode', 'ai', NULL, NULL, 0),
('S-3001', 'do_knowledge',     5, '内置了哪些规则、SOP、行业知识', 'Embedded knowledge / SOPs',
   '客户上传的产品资料、SOP、价目表、菜单;支持 PDF / DOCX / 图片 OCR;中文优化',
   'Customer-uploaded product materials, SOPs, pricelists, menus; supports PDF / DOCX / image OCR; Chinese-optimized', 'ai', NULL, NULL, 0),
('S-3001', 'do_interfaces',    5, '需要对接哪些系统', 'What systems does it integrate with',
   'WhatsApp / 微信(通过永久分享链接)、移动端浏览器、可选 Stripe 收款',
   'WhatsApp / WeChat (via permalinked share URLs), mobile browser, optional Stripe billing', 'ai', NULL, NULL, 0),

-- Section 6
('S-3001', 'deploy_mode',      6, '部署方式', 'Deployment mode',
   'SaaS 多租户(Cloudflare Pages),零部署,注册即用',
   'Multi-tenant SaaS on Cloudflare Pages, zero deployment — sign up and use', 'ai', NULL, NULL, 0),
('S-3001', 'deploy_regions',   6, '已落地区域', 'Production regions',
   '香港(主要)、东南亚、台湾', 'Hong Kong (primary), SEA, Taiwan', 'ai', NULL, NULL, 0),
('S-3001', 'deploy_lang',      6, '支持语言', 'Supported languages',
   '中文(繁/简)、英文', 'Chinese (Trad / Simp), English', 'ai', NULL, NULL, 0),
('S-3001', 'deploy_reg',       6, '监管合规(可选)', 'Regulatory (optional)',
   '香港个人资料(私隐)条例', 'HK PDPO (Personal Data Privacy Ordinance)', 'ai', NULL, NULL, 1),

-- Section 7
('S-3001', 'svc_demo',         7, '演示偏好', 'Demo preferences',
   '15 分钟在线演示,客户当场注册体验', '15-min online demo with on-the-spot signup', 'ai', NULL, NULL, 0),
('S-3001', 'svc_assist',       7, '是否愿意配合销售', 'Sales-assist willingness',
   '小客户优先自助,大客户(50+ 员工)创始人可亲自跟进',
   'Self-serve preferred for SMBs; founder-led for larger accounts (50+ staff)', 'ai', NULL, NULL, 0),
('S-3001', 'svc_response',     7, '响应时间', 'Response SLA',
   '工作日 24 小时内邮件回复;付费客户 4 小时内',
   'Email response within 24 business hours; paid customers within 4 hours', 'ai', NULL, NULL, 0),
('S-3001', 'svc_scope',        7, '交付范围', 'Delivery scope',
   '自助 onboarding + 文档 + 视频教程;付费客户可申请远程协助',
   'Self-serve onboarding + docs + video tutorials; paid customers can request remote assistance', 'ai', NULL, NULL, 0),
('S-3001', 'svc_lang',         7, '支持语言', 'Support languages',
   '中文、英文', 'Chinese, English', 'ai', NULL, NULL, 0),

-- Section 8
('S-3001', 'price_model',      8, '定价模式', 'Pricing model',
   '免费 + 订阅(每月 HK$88 解锁 AI 与上传)', 'Freemium + subscription (HK$88/mo unlocks AI + uploads)', 'ai', NULL, NULL, 0),
('S-3001', 'price_cost',       8, '成本价(对我方)', 'Cost (to us)',
   'HK$15-20 / 租户 / 月(LLM + 存储)', 'HK$15-20 / tenant / month (LLM + storage)', 'ai', NULL, NULL, 0),
('S-3001', 'price_retail',     8, '建议零售价', 'Suggested retail',
   'HK$88 / 月起,企业版 HK$880 / 月', 'From HK$88 / month, enterprise tier HK$880 / month', 'ai', NULL, NULL, 0),
('S-3001', 'price_custom',     8, '私有化部署起价', 'Private deployment from',
   '', '', 'empty', NULL, NULL, 1),
('S-3001', 'price_service',    8, '定制服务费(可选)', 'Custom service fee (optional)',
   '', '', 'empty', NULL, NULL, 1);

INSERT INTO audit_log (submission_id, who, action_zh, action_en, created_at) VALUES
  ('S-3001', 'AI',         '完成材料解析,预填 70%', 'Parsed materials, prefilled 70% of fields', datetime('now', '-30 minutes', '+2 minutes')),
  ('S-3001', 'Aselo Ops',  '确认并提交 Staff Assistant', 'Confirmed and submitted Staff Assistant',   datetime('now', '-15 minutes'));

-- ════════════════════════════════════════════════════════════════
-- PRE-PUBLISHED RolePacks — visible immediately in the sales catalog
-- ════════════════════════════════════════════════════════════════

INSERT INTO rolepacks (id, supplier_id, supplier_name, data, published_at) VALUES
('RP-AML', 'SUP-VIGIL', 'Vigil Advisory Limited', '{
  "name": {"zh": "AI 驱动的 AML 交易监控", "en": "AI-driven AML Transaction Monitoring"},
  "pitch": {"zh": "把中型银行合规团队的制裁筛查误报率降低 90%+,通过监管复盘有底气。", "en": "Cut sanctions-screening false positives by 90%+ for mid-tier compliance teams who pass regulator inspection."},
  "industries": ["banking", "svf", "securities"],
  "industryLabels": {"zh": ["银行", "SVF", "证券"], "en": ["Banking", "SVF", "Securities"]},
  "persona": {"zh": "AML 分析师", "en": "AML Analyst"},
  "decisionMaker": {"zh": "MLRO / CCO", "en": "MLRO / CCO"},
  "orgSize": {"zh": "中型机构", "en": "Mid-tier"},
  "region": {"zh": "香港、新加坡(可适配亚太)", "en": "HK, SG (adaptable APAC)"},
  "languages": {"zh": "中 / 英", "en": "中 · EN"},
  "compliance": "HKMA, MAS, SFC",
  "fromPrice": "HKD 600K/yr",
  "deck": {"slides": 7, "sizeMB": 2.4},
  "manual": {"pages": 4, "sizeMB": 1.1},
  "overview": {"zh": "面向中型银行 AML 团队的智能交易监控方案。规则与 CNN/LSTM 双模引擎将名单筛查的误报率压到可运营水平,每条告警附带可解释归因,MLRO 在监管问询时拿得出依据。", "en": "Intelligent transaction-monitoring for mid-tier bank AML teams. Dual-mode rules + CNN/LSTM cuts false-positive rates to operationally sustainable levels, with explainable attribution on every alert."},
  "pain": {"zh": "「我们 AML 团队每天清几千条告警,80% 都是误报。监管来问 AI 怎么判的,我答不上来,因为是黑盒。」", "en": "\"My analysts deal with hundreds of alerts a day. When the regulator asks how the AI made its call, I can''t answer because it''s a black box.\""},
  "outcomes": {"zh": ["误报率降低 90%+", "告警处理效率提升 70-85%", "客户复核 2-3 天 → 2-4 小时"], "en": ["False positives reduced by 90%+", "Alert handling efficiency up 70-85%", "Client review time: 2-3 days → 2-4 hours"]},
  "proof": {"zh": "香港持牌保险公司,6 周完成部署", "en": "Hong Kong-licensed insurance company, 6-week deployment"},
  "capabilities": {"zh": ["规则 + CNN/LSTM 双模引擎", "异常归因", "AI 辅助复核", "SAR 自动起草", "多维风险评级", "AI 动态再评级", "BRRA 自评估"], "en": ["Rules + CNN/LSTM dual-mode detection", "Anomaly attribution", "AI-assisted case review", "SAR auto-generation", "Multi-dimensional risk rating", "AI dynamic re-rating", "BRRA self-assessment"]},
  "prereqs": {"zh": ["实时交易流接入,或批量文件接口", "制裁名单源对接", "可选:案件管理系统集成"], "en": ["Real-time transaction stream OR batch file feed", "Sanctions list provider connection", "Optional: case management system integration"]},
  "deployment": {"zh": "私有化部署优先(合规要求);支持混合云。典型上线周期:4-6 周。", "en": "Private deployment preferred (compliance requirement). Hybrid cloud supported. Typical timeline: 4-6 weeks."},
  "pricing": {"zh": {"model": "年度许可 + 按交易笔数分级", "from": "HKD 600K / 年起", "custom": "私有化部署、定制集成另议"}, "en": {"model": "Annual license + per-transaction tiers", "from": "Starting from HKD 600K/year", "custom": "Custom services priced separately"}},
  "pitchScript": {"zh": "如果你在中型银行,监管对 AML 施压、分析师被误报淹没,这是唯一一个把规则与 ML 检测合二为一、并对 HKMA 复盘可解释的平台。误报降 90%+,4-6 周上线,本地部署、数据不出门。", "en": "If you''re at a mid-tier bank with regulator pressure and analysts drowning in false positives, this is the only platform that combines rules + ML with full explainability for HKMA review. Cuts noise by 90%+, deploys in 4-6 weeks, runs on-prem."},
  "discovery": {"zh": ["你们目前的误报率大概是多少?", "今天谁在审核告警,每条要花多久?", "AML 模型在监管复盘里被挑战过吗?", "现有供应商能解释单条告警的判断依据吗?", "部署偏好是云端还是本地?"], "en": ["What''s your current false-positive rate?", "Who reviews alerts today, how long does each take?", "Has your AML model been challenged in regulator review?", "Can your current vendor explain individual decisions?", "Cloud or on-prem deployment preference?"]}
}', datetime('now', '-7 days')),

('RP-ASELO-CHAT', 'SUP-ASELO', 'Aselo Inc.', '{
  "name": {"zh": "Aselo 门店店员智能问答助手", "en": "Aselo Staff Assistant"},
  "pitch": {"zh": "中小门店的 AI 副手 — 让一线员工 30 秒回应客户问题,新人 1 周上手。", "en": "An AI sidekick for SMB shop floors — answer customer questions in 30 seconds, new hires productive in a week."},
  "industries": ["retail", "sme", "brand"],
  "industryLabels": {"zh": ["零售", "中小企业", "品牌"], "en": ["Retail", "SME", "Brand"]},
  "persona": {"zh": "门店店员 / 前台接待", "en": "Shop staff / Front desk"},
  "decisionMaker": {"zh": "店长 / 老板", "en": "Store Manager / Owner"},
  "orgSize": {"zh": "中小企业(2-50 人)", "en": "SMB (2-50 staff)"},
  "region": {"zh": "香港、东南亚", "en": "HK, SEA"},
  "languages": {"zh": "中(繁/简)/ 英", "en": "中(繁/简) · EN"},
  "compliance": "HK PDPO",
  "fromPrice": "HK$88/mo",
  "deck": {"slides": 5, "sizeMB": 1.6},
  "manual": {"pages": 3, "sizeMB": 0.8},
  "overview": {"zh": "面向中小门店与连锁的多租户 SaaS。把公司自己的产品资料、SOP、价目表上传一次,门店员工在手机浏览器里就能问、就能搜、就能转发给客户。基于 Cloudflare 全球边缘网络,免部署,中文优先。", "en": "A multi-tenant SaaS for SMB shops and chains. Upload your own product info, SOPs, and pricelists once; staff query, search, and forward to customers from any mobile browser. Runs on Cloudflare''s global edge — no deployment, Chinese-first."},
  "pain": {"zh": "「客户在 WhatsApp 上问问题,店员翻 Excel 找半天;新人不知道公司有什么资料;我没时间一个个回答员工。」", "en": "\"Customer asks on WhatsApp, staff scrolls through Excel for ages; new hires don''t know what materials we have; I don''t have time to answer every staff question myself.\""},
  "outcomes": {"zh": ["回答客户问题时间 5-10 分钟 → 30 秒", "新人上手 4-6 周 → 1 周", "老板被打扰次数减少 80%"], "en": ["Customer answer time: 5-10 min → 30s", "New-hire ramp: 4-6 weeks → 1 week", "Owner interruptions cut by 80%"]},
  "proof": {"zh": "香港某连锁眼镜店 5 家分店,上线第二周客户咨询转化率 +18%", "en": "HK optical chain (5 stores): +18% conversion in week two"},
  "capabilities": {"zh": ["RAG 实时问答(Qwen + 公司知识库)", "PDF / DOCX 上传与自动索引", "永久分享链接(WhatsApp / 微信)", "员工 PIN 锁屏", "会议纪要(可选模块)", "餐厅菜单模式(可选模块)"], "en": ["RAG real-time Q&A (Qwen + company KB)", "PDF / DOCX upload + auto-indexing", "Permalink shareable file URLs (WhatsApp / WeChat)", "Staff PIN lockscreen", "Meeting summariser (optional)", "Restaurant menu mode (optional)"]},
  "prereqs": {"zh": ["公司有现成产品资料 / SOP / 价目表(任意格式)", "员工有手机浏览器", "(选配)Stripe 帐号收款"], "en": ["Existing product materials / SOPs / pricelists in any format", "Mobile browser on staff phones", "(optional) Stripe account for billing"]},
  "deployment": {"zh": "SaaS 多租户,网页注册立即可用。每个公司一个独立 slug,30 秒上线。", "en": "Multi-tenant SaaS, sign up online and start immediately. One slug per company, 30 seconds to live."},
  "pricing": {"zh": {"model": "免费 + 订阅", "from": "免费(只读) / HK$88 起 / 月", "custom": "企业版 HK$880 / 月,白标可议"}, "en": {"model": "Freemium + subscription", "from": "Free (read-only) / from HK$88 / month", "custom": "Enterprise HK$880 / month, white-label by quote"}},
  "pitchScript": {"zh": "你做小型零售或品牌连锁,门店员工每天被客户问、翻 Excel 找资料?把公司知识库上传一次,所有员工在手机上 30 秒问答、30 秒转发给客户。HK$88 一个月,自助开通,免部署,中文友好。", "en": "Got a small retail or brand chain where staff get bombarded with customer questions and waste time digging through Excel? Upload your company knowledge once and your team answers and forwards in 30 seconds. HK$88/month, self-serve, zero deployment, Chinese-first."},
  "discovery": {"zh": ["你们门店员工平均花多少时间帮客户找产品资料?", "新人上手要多久才能独立面对客户?", "现在有 WhatsApp / 微信群吗?平均一天多少条提问?", "公司有现成的 SOP / 产品介绍 / 价目表吗?是什么格式?", "店长每天接听员工电话/信息多少次?"], "en": ["How long does staff spend looking up product info per customer?", "How long until new hires can handle customers independently?", "Are you on WhatsApp / WeChat? Roughly how many staff questions per day?", "Do you have existing SOPs / product info / pricelists? What format?", "How many staff calls / messages does the manager field per day?"]}
}', datetime('now', '-3 days'));
