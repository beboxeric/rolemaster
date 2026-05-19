// Sample data for the Vigil / TMX submission. Bilingual where the supplier
// might have entered Chinese vs English content.

window.SUPPLIER = {
  name: "Vigil Advisory Limited",
  shortName: "Vigil",
  hq: "Hong Kong",
  contact: "陈志伟 / Wilson Chan",
  email: "wilson@vigil.hk",
  phone: "+852 5432 1098",
  founded: 2018,
  team: "6 core + advisory network",
  clients: 12,
};

window.PRODUCTS = [
  { id: "KYX", name: "KYX", subtitle: { zh: "客户尽调", en: "Customer Due Diligence" }, progress: 0, status: "untouched" },
  { id: "NSX", name: "NSX", subtitle: { zh: "制裁名单筛查", en: "Sanctions Screening" }, progress: 0, status: "untouched" },
  { id: "RRX", name: "RRX", subtitle: { zh: "风险评级", en: "Risk Rating" }, progress: 0, status: "untouched" },
  { id: "TMX", name: "TMX", subtitle: { zh: "AML 交易监控", en: "AML Monitoring" }, progress: 75, status: "active" },
  { id: "PAX", name: "PAX", subtitle: { zh: "政策智库", en: "Policy Intelligence" }, progress: 0, status: "untouched" },
];

// Field statuses: ai (light blue), filled (light green), empty (light orange), weak (light yellow)
// Each field has bilingual label + a value (string or list)
window.FIELDS = {
  // Section 1 — Company basics (shared)
  company_name:    { section: 1, label: { zh: "公司名称", en: "Company name" }, status: "filled", value: "Vigil Advisory Limited" },
  company_hq:      { section: 1, label: { zh: "总部", en: "Headquarters" }, status: "filled", value: { zh: "香港", en: "Hong Kong" } },
  company_founded: { section: 1, label: { zh: "成立年份", en: "Founded" }, status: "ai", value: "2018" },
  company_team:    { section: 1, label: { zh: "团队规模", en: "Team size" }, status: "ai", value: { zh: "6 名核心 + 顾问网络", en: "6 core + advisory network" } },
  company_clients: { section: 1, label: { zh: "现有企业客户", en: "Enterprise clients" }, status: "ai", value: { zh: "12 家(港资银行、保险、SVF)", en: "12 (HK banks, insurance, SVF)" } },

  // Section 2 — Who uses it
  user_industry:   { section: 2, label: { zh: "目标行业", en: "Target industries" }, status: "ai", value: { zh: "持牌银行、虚拟银行、SVF、证券", en: "Licensed banks, virtual banks, SVF, securities" } },
  user_orgsize:    { section: 2, label: { zh: "客户组织规模", en: "Org size" }, status: "ai", value: { zh: "中型(大型机构通常自建)", en: "Mid-tier (large institutions build their own)" } },
  user_role:       { section: 2, label: { zh: "使用者角色", en: "User role" }, status: "ai", value: { zh: "AML 分析师,初级到中级", en: "AML Analyst, junior to mid" } },
  user_seniority:  { section: 2, label: { zh: "资历", en: "Seniority" }, status: "weak", value: { zh: "合规团队", en: "Compliance teams" }, hint: { zh: "请具体到职级,例如「初级到中级 AML 分析师」", en: "Be specific — e.g. 'junior to mid AML Analysts'" } },
  user_daily:      { section: 2, label: { zh: "日常工作内容", en: "Daily activities" }, status: "ai", value: { zh: "清理告警队列、判断可疑度、撰写 SAR 报告", en: "Clearing alert queues, judging suspicion, writing SAR reports" } },

  // Section 3 — Who buys it
  buyer_role:      { section: 3, label: { zh: "决策者", en: "Decision-maker" }, status: "ai", value: { zh: "MLRO 或 CCO,有时 COO", en: "MLRO or CCO; sometimes COO" } },
  buyer_priorities:{ section: 3, label: { zh: "采购方关注点", en: "Buyer priorities" }, status: "ai", value: { zh: "通过监管检查、模型可解释性、低误报率、数据本地化", en: "Passing regulator inspection, model explainability, low false-positive rate, data localization" } },
  buyer_budget:    { section: 3, label: { zh: "预算区间", en: "Typical budget" }, status: "empty", value: "" },

  // Section 4 — Problem
  pain_main:       { section: 4, label: { zh: "客户当前主要痛点", en: "Main pain" }, status: "ai", value: { zh: "规则引擎误报率 40-60%,告警堆积;黑盒模型在监管解释性上不达标", en: "Rule engine false positive rate 40-60%; alerts pile up; black-box models fail regulator explainability" } },
  pain_workaround: { section: 4, label: { zh: "客户当前如何处理", en: "Current workaround" }, status: "ai", value: { zh: "扩编合规团队人手清理告警,效率与成本两难", en: "Hire more compliance staff to clear alerts — efficiency vs cost tradeoff" } },
  pain_outcome:    { section: 4, label: { zh: "量化效果(可选)", en: "Quantified outcomes (optional)" }, status: "ai", value: { zh: "误报降低 90%+;告警处理效率提升 70-85%;客户复核 2-3 天 → 2-4 小时", en: "False positives cut 90%+; alert handling efficiency up 70-85%; client review 2-3 days → 2-4 hours" } },

  // Section 5 — three plain questions, three layers internally
  do_capabilities: { section: 5, label: { zh: "产品能做什么动作", en: "What actions does it perform" }, status: "ai", value: { zh: "规则 + CNN/LSTM 双模引擎、异常归因、AI 辅助复核、SAR 自动生成、多维风险评级、AI 动态再评级、BRRA 自评估", en: "Rules + CNN/LSTM dual engine, anomaly attribution, AI-assisted review, auto SAR generation, multi-dim risk rating, AI dynamic re-rating, BRRA self-assessment" } },
  do_knowledge:    { section: 5, label: { zh: "内置了哪些规则、SOP、行业知识", en: "Embedded knowledge / SOPs" }, status: "ai", value: { zh: "FATF、中国《反洗钱法》、HKMA/SFC 要求、异常处理 SOP、误报申诉流程、250+ 司法辖区风险库", en: "FATF, China AML Law, HKMA/SFC requirements, anomaly handling SOP, false-positive appeal flow, 250+ jurisdiction risk libraries" } },
  do_interfaces:   { section: 5, label: { zh: "需要对接哪些系统", en: "What systems does it integrate with" }, status: "ai", value: { zh: "SWIFT、ISO 20022、CIPS、FPS、内部 ERP、风险看板", en: "SWIFT, ISO 20022, CIPS, FPS, internal ERP, risk dashboards" } },

  // Section 6 — Deployment
  deploy_mode:     { section: 6, label: { zh: "部署方式", en: "Deployment mode" }, status: "ai", value: { zh: "私有化部署优先,混合云可", en: "Private deployment preferred, hybrid cloud OK" } },
  deploy_regions:  { section: 6, label: { zh: "已落地区域", en: "Production regions" }, status: "ai", value: { zh: "香港、新加坡;可适配中国大陆与亚太", en: "Hong Kong, Singapore; adaptable to mainland China & APAC" } },
  deploy_lang:     { section: 6, label: { zh: "支持语言", en: "Supported languages" }, status: "ai", value: { zh: "中文、英文", en: "Chinese, English" } },
  deploy_reg:      { section: 6, label: { zh: "监管合规(可选)", en: "Regulatory (optional)" }, status: "ai", value: { zh: "HKMA、MAS、SFC 已支持;PBOC 可适配", en: "HKMA, MAS, SFC supported; PBOC adaptable" } },

  // Section 7 — Service
  svc_demo:        { section: 7, label: { zh: "演示偏好", en: "Demo preferences" }, status: "empty", value: "" },
  svc_assist:      { section: 7, label: { zh: "是否愿意配合销售", en: "Sales-assist willingness" }, status: "ai", value: { zh: "愿意,可派 SE 配合演示与 POC", en: "Yes — SE can join demos and POC" } },
  svc_response:    { section: 7, label: { zh: "响应时间", en: "Response SLA" }, status: "empty", value: "" },
  svc_scope:       { section: 7, label: { zh: "交付范围", en: "Delivery scope" }, status: "ai", value: { zh: "产品交付 + 上线培训 + 持续运营支持", en: "Product delivery + onboarding training + ongoing support" } },
  svc_lang:        { section: 7, label: { zh: "支持语言", en: "Support languages" }, status: "ai", value: { zh: "中文、英文", en: "Chinese, English" } },

  // Section 8 — Pricing
  price_model:     { section: 8, label: { zh: "定价模式", en: "Pricing model" }, status: "ai", value: { zh: "年度许可 + 按交易笔数分级", en: "Annual license + per-transaction tiers" } },
  price_cost:      { section: 8, label: { zh: "成本价(对我方)", en: "Cost (to us)" }, status: "ai", value: "HKD 300K / yr" },
  price_retail:    { section: 8, label: { zh: "建议零售价", en: "Suggested retail" }, status: "ai", value: "HKD 600K - 800K / yr" },
  price_custom:    { section: 8, label: { zh: "私有化部署起价", en: "Private deployment from" }, status: "ai", value: "HKD 200K" },
  price_service:   { section: 8, label: { zh: "定制服务费(可选)", en: "Custom service fee (optional)" }, status: "ai", value: "HKD 8K / person-day" },
};

// AI-generated content for confirmation modal & curator workbench
window.AI_GENERATED = {
  pain_narrative: {
    zh: "「我们 AML 团队每天清理几千条告警,80% 都是误报。每次监管检查我都心惊胆战 — 模型说不出为什么标记这笔交易,我也答不上来。多招人成本上不封顶,不招又出不了 SAR。」",
    en: "\"My AML team clears a few thousand alerts a day, and 80% are false positives. Every regulator inspection I'm holding my breath — the model can't explain why it flagged a transaction, and neither can I. Hiring more analysts isn't sustainable; not hiring means we miss SAR deadlines.\""
  },
  value_position: {
    zh: "TMX 用规则 + 神经网络双引擎,把 AML 告警的误报率从 40-60% 压到 5% 以下,同时输出可被监管复盘的归因路径。一线分析师每天清掉的告警从几百条变成上千条,SAR 报告自动起草,人手不变,合规效率提升 70%+。",
    en: "TMX uses a hybrid rule + neural-network engine to bring AML false-positive rates from 40-60% down to under 5%, while producing regulator-auditable attribution paths. Front-line analysts clear thousands of alerts per day instead of hundreds; SAR drafts auto-generate. Same headcount, 70%+ compliance efficiency lift."
  },
  capabilities_summary: {
    zh: ["双模告警引擎(规则 + CNN/LSTM)", "异常归因与可解释性输出", "AI 辅助复核与 SAR 自动起草", "多维度动态风险评级", "BRRA 内部风险自评估"],
    en: ["Dual-mode alert engine (rules + CNN/LSTM)", "Anomaly attribution with explainability", "AI-assisted review with SAR auto-drafting", "Multi-dimensional dynamic risk rating", "BRRA internal risk self-assessment"]
  },
  one_liner: {
    zh: "给银行 AML 分析师的可解释 AI 副驾 — 误报率降 90%、SAR 自动起草、监管检查交得出账。",
    en: "An explainable AI copilot for bank AML analysts — 90% fewer false positives, auto-drafted SARs, regulator-ready audit trails."
  },
};

// Curator-side: three-layer decomposition cards
window.LAYERS = {
  capabilities: [
    { id: "CAP-01", name: { zh: "双模告警引擎", en: "Dual-mode alert engine" }, desc: { zh: "规则引擎 + CNN/LSTM 神经网络协同打分,降低误报", en: "Rules engine + CNN/LSTM neural network co-scoring; reduces false positives" }, conf: 0.95 },
    { id: "CAP-02", name: { zh: "异常归因", en: "Anomaly attribution" }, desc: { zh: "对每条告警输出可解释的特征贡献", en: "Explainable feature attribution per alert" }, conf: 0.92 },
    { id: "CAP-03", name: { zh: "AI 辅助复核", en: "AI-assisted review" }, desc: { zh: "为分析师推荐相似案例与处置建议", en: "Surfaces similar past cases and disposition suggestions for analysts" }, conf: 0.88 },
    { id: "CAP-04", name: { zh: "SAR 自动生成", en: "SAR auto-generation" }, desc: { zh: "基于告警与处置记录自动生成 SAR 草稿", en: "Generates SAR drafts from alert and disposition records" }, conf: 0.90 },
    { id: "CAP-05", name: { zh: "动态风险评级", en: "Dynamic risk rating" }, desc: { zh: "基于交易行为持续重新评级客户风险", en: "Continuously re-rates customer risk based on transaction behavior" }, conf: 0.86 },
    { id: "CAP-06", name: { zh: "BRRA 自评估", en: "BRRA self-assessment" }, desc: { zh: "业务范围风险自评工具", en: "Business risk self-assessment workflow" }, conf: 0.78 },
  ],
  knowledge: [
    { id: "KNW-01", name: { zh: "FATF 反洗钱标准", en: "FATF AML standards" }, desc: { zh: "40 项建议与风险指标库", en: "40 Recommendations and risk indicators library" }, conf: 0.94 },
    { id: "KNW-02", name: { zh: "HKMA / SFC 监管要求", en: "HKMA / SFC regulatory rules" }, desc: { zh: "本地法规与申报模板", en: "Local rules and reporting templates" }, conf: 0.96 },
    { id: "KNW-03", name: { zh: "中国《反洗钱法》", en: "China AML Law" }, desc: { zh: "法律条款与 PBOC 申报口径", en: "Statutes and PBOC reporting alignment" }, conf: 0.85 },
    { id: "KNW-04", name: { zh: "误报申诉 SOP", en: "False-positive appeal SOP" }, desc: { zh: "标准处理流程,含审计轨迹要求", en: "Standard handling flow incl. audit-trail requirements" }, conf: 0.82 },
    { id: "KNW-05", name: { zh: "250+ 司法辖区风险库", en: "250+ jurisdiction risk library" }, desc: { zh: "国家与地区风险评分", en: "Country / region risk scoring" }, conf: 0.91 },
  ],
  interfaces: [
    { id: "INF-01", name: "SWIFT", desc: { zh: "MT/MX 报文消费", en: "MT / MX message ingestion" }, conf: 0.95 },
    { id: "INF-02", name: "ISO 20022", desc: { zh: "支付报文标准", en: "Payment message standard" }, conf: 0.95 },
    { id: "INF-03", name: "CIPS", desc: { zh: "人民币跨境支付清算", en: "Cross-border RMB clearing" }, conf: 0.80 },
    { id: "INF-04", name: "FPS", desc: { zh: "香港转数快", en: "Hong Kong Faster Payment System" }, conf: 0.86 },
    { id: "INF-05", name: { zh: "内部 ERP", en: "Internal ERP" }, desc: { zh: "客户主数据同步", en: "Customer master data sync" }, conf: 0.70 },
    { id: "INF-06", name: { zh: "风险看板", en: "Risk dashboards" }, desc: { zh: "Tableau / PowerBI 出口", en: "Tableau / PowerBI export" }, conf: 0.74 },
  ],
};

// AI assembly recommendation
window.AI_REC = {
  primary: {
    zh: "建议组装为单个 RolePack:「AML 监控分析师助手」",
    en: "Assemble as a single RolePack: \"AML Monitoring Analyst Assistant\"",
  },
  reasoning: {
    zh: "TMX 的能力、知识、接口都围绕同一个用户画像 — 银行 AML 分析师 — 展开。三层信息互相依赖,不宜拆分。建议作为单一 RolePack 推向 持牌银行 / 虚拟银行 / SVF 三类客户。可与同供应商的 KYX、NSX 串联为复合套餐,但作为独立 RolePack 即可上架。",
    en: "TMX's capabilities, knowledge, and interfaces all converge on a single persona — bank AML analysts. The three layers are interdependent; splitting them would dilute value. Pitch as a single RolePack to licensed banks, virtual banks, and SVF. Can be bundled later with the same supplier's KYX / NSX for a composite offer.",
  },
  alternatives: [
    { id: "A", label: { zh: "拆分为两个 RolePack:「告警清理副驾」+「SAR 起草助手」", en: "Split into two RolePacks: 'Alert Triage Copilot' + 'SAR Drafting Assistant'" } },
    { id: "B", label: { zh: "并入复合 RolePack:KYX + NSX + TMX 全栈合规", en: "Bundle: KYX + NSX + TMX as a full-stack compliance pack" } },
  ],
};

// Curator queue rows
window.QUEUE = [
  { id: "S-2418", supplier: "Vigil Advisory Limited", contact: "wilson@vigil.hk", product: "TMX", productSub: { zh: "AML 交易监控", en: "AML Monitoring" }, submitted: { zh: "2 小时前", en: "2 hours ago" }, prefill: 65, materials: ["pdf", "ppt", "url"], status: "new" },
  { id: "S-2417", supplier: "Aselo Inc.", contact: "ops@aselo.io", product: "Aselo Sales Copilot", productSub: { zh: "零售门店导购助手", en: "Retail SME sales assistant" }, submitted: { zh: "5 小时前", en: "5 hours ago" }, prefill: 72, materials: ["pdf", "ppt"], status: "review" },
  { id: "S-2416", supplier: "Lumon AI", contact: "harmony@lumon.ai", product: "Severance Workflow", productSub: { zh: "工作流自动化", en: "Workflow automation" }, submitted: { zh: "昨天", en: "yesterday" }, prefill: 48, materials: ["pdf", "voice"], status: "revision" },
  { id: "S-2415", supplier: "Anthropic Edge", contact: "deploy@aedge.ai", product: "Claude Sales Coach", productSub: { zh: "B2B 销售训练", en: "B2B sales training" }, submitted: { zh: "昨天", en: "yesterday" }, prefill: 88, materials: ["pdf", "url", "voice"], status: "review" },
  { id: "S-2414", supplier: "Helix Compliance", contact: "team@helix.cn", product: "Helix KYC", productSub: { zh: "客户尽调", en: "KYC due diligence" }, submitted: { zh: "2 天前", en: "2 days ago" }, prefill: 70, materials: ["pdf", "ppt", "url"], status: "approved" },
  { id: "S-2413", supplier: "MarketBase", contact: "founders@marketbase.io", product: "MB Insights", productSub: { zh: "市场情报", en: "Market intelligence" }, submitted: { zh: "2 天前", en: "2 days ago" }, prefill: 55, materials: ["url", "voice"], status: "new" },
  { id: "S-2412", supplier: "Stratify HK", contact: "sales@stratify.hk", product: "Stratify Risk", productSub: { zh: "风险建模", en: "Risk modeling" }, submitted: { zh: "3 天前", en: "3 days ago" }, prefill: 81, materials: ["pdf", "ppt"], status: "approved" },
  { id: "S-2411", supplier: "Cobalt Labs", contact: "biz@cobaltlabs.ai", product: "Cobalt Eval", productSub: { zh: "模型评测平台", en: "Model evaluation" }, submitted: { zh: "3 天前", en: "3 days ago" }, prefill: 60, materials: ["pdf"], status: "review" },
];

// Sales materials (curator preview)
window.SALES = {
  onepager_headline: { zh: "用可解释 AI 把银行 AML 告警的误报率压到 5% 以下", en: "Bring bank AML alert false-positive rates under 5% with explainable AI" },
  onepager_body: { zh: "TMX 是为持牌银行 AML 团队打造的告警副驾。规则 + CNN/LSTM 双模引擎,异常归因可被监管复盘,SAR 自动起草。已在港 / 新两地银行落地。", en: "TMX is an alert copilot built for bank AML teams. A hybrid rule + neural engine with regulator-auditable attribution and SAR auto-drafting. In production at HK and SG banks." },
  pitch_outline: [
    { zh: "今天的银行 AML 团队怎么过日子", en: "What a day looks like for a bank AML team today" },
    { zh: "误报与监管:两面夹击", en: "False positives & regulators: a two-front squeeze" },
    { zh: "TMX 怎么不一样:可解释 + 自动化", en: "How TMX is different: explainable + automated" },
    { zh: "客户实例:某港资银行的 8 周变化", en: "Customer story: 8 weeks at a HK bank" },
    { zh: "30 天试点路径", en: "A 30-day pilot path" },
  ],
  faq: [
    { q: { zh: "模型解释性怎么向监管交代?", en: "How is model explainability handled for regulators?" }, a: { zh: "每条告警输出特征贡献路径与历史可比案例,直接进入审计日志。", en: "Each alert produces a feature-contribution trace and comparable case history, written straight to audit log." } },
    { q: { zh: "数据要不要出客户机房?", en: "Does data leave the client environment?" }, a: { zh: "不需要。私有化部署,模型推理与训练均在客户域内。", en: "No. Private deployment — both inference and training stay inside the client's environment." } },
    { q: { zh: "和现有规则引擎怎么共存?", en: "How does it coexist with existing rule engines?" }, a: { zh: "TMX 不替换规则,而是给规则告警加一层 AI 二次评分,误报先过滤再进队列。", en: "TMX doesn't replace rules — it adds an AI re-scoring layer, filtering false positives before they hit the queue." } },
    { q: { zh: "上线要多久?", en: "How long to go live?" }, a: { zh: "标准部署 8-12 周,含数据接入、模型微调与一线培训。", en: "Standard deployment is 8-12 weeks, covering data ingestion, fine-tuning, and frontline training." } },
    { q: { zh: "支持哪些监管口径?", en: "Which regulators are supported?" }, a: { zh: "HKMA、MAS、SFC 已上线;PBOC 在适配中。", en: "HKMA, MAS, SFC are live; PBOC adaptation in progress." } },
  ],
  script_30s: { zh: "我们给银行 AML 分析师做了个可解释的 AI 副驾。一线团队每天清的告警从几百条变成几千条,误报率压到 5% 以下,SAR 自动起草。监管要的特征归因和审计轨迹都在,可解释。香港、新加坡的持牌银行已经在用。8 周可以上线。", en: "We built an explainable AI copilot for bank AML analysts. Frontline teams clear thousands of alerts daily instead of hundreds, false-positive rates drop under 5%, and SAR drafts auto-generate. Feature attribution and audit trails are regulator-ready. Already in production at HK and SG banks. Eight weeks to go live." },
  discovery: [
    { zh: "你们现在每天处理多少条告警?误报率大概是?", en: "How many alerts does your team triage daily, and what's your false-positive rate?" },
    { zh: "上次监管检查里,模型解释性是不是被问到?", en: "In your last regulator inspection, did model explainability come up?" },
    { zh: "SAR 起草现在主要谁在做?多久一份?", en: "Who drafts SARs today, and how long does each one take?" },
    { zh: "AML 团队最近有没有扩编计划?", en: "Has your AML team had recent headcount discussions?" },
    { zh: "现有规则引擎是自研还是采购?替换成本多大?", en: "Is your current rule engine in-house or vendor — and what's switching cost?" },
    { zh: "数据本地化方面有没有硬性要求?", en: "Any hard requirements on data localization?" },
  ],
};

// ───────── Sales catalog: published RolePacks ─────────
window.ROLEPACKS = [
  {
    id: "RP-AML",
    name: { zh: "AI 驱动的 AML 交易监控", en: "AI-driven AML Transaction Monitoring" },
    supplier: "Vigil Advisory Limited",
    pitch: { zh: "把中型银行合规团队的制裁筛查误报率降低 90%+,通过监管复盘有底气。", en: "Cut sanctions-screening false positives by 90%+ for mid-tier compliance teams who pass regulator inspection." },
    industries: ["banking", "svf", "securities"],
    industryLabels: { zh: ["银行", "SVF", "证券"], en: ["Banking", "SVF", "Securities"] },
    persona: { zh: "AML 分析师", en: "AML Analyst" },
    decisionMaker: { zh: "MLRO / CCO", en: "MLRO / CCO" },
    orgSize: { zh: "中型机构", en: "Mid-tier" },
    region: { zh: "香港、新加坡(可适配亚太)", en: "HK, SG (adaptable APAC)" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "HKMA, MAS, SFC",
    fromPrice: "HKD 600K/yr",
    deck: { slides: 7, sizeMB: 2.4 },
    manual: { pages: 4, sizeMB: 1.1 },
    overview: {
      zh: "一套面向中型银行 AML 团队的智能交易监控方案。基于规则与 CNN/LSTM 双模引擎,把传统名单筛查的高误报率压到可运营的水平,同时为每条告警提供可解释的归因证据,帮助 MLRO 在监管问询时拿得出依据。已在香港持牌机构 6 周内完成投产。",
      en: "An intelligent transaction-monitoring solution for mid-tier banks' AML teams. A dual-mode rules + CNN/LSTM engine cuts the false-positive rate of name-based screening to operationally sustainable levels, while every alert ships with explainable attribution so the MLRO has a defensible answer when the regulator asks. Deployed in production at a Hong Kong-licensed institution in 6 weeks.",
    },
    pain: {
      zh: "「我们 AML 团队每天清几千条告警,80% 都是误报。规则一加再加,常见名字反复触发。监管来问 AI 怎么判的,我答不上来,因为是黑盒。每年年报都要重新解释一遍。」",
      en: "\"My analysts deal with hundreds of alerts a day. Once rules pile up, false positives go through the roof — most are the same common names triggering repeatedly. When the regulator asks how the AI made its call, I can't answer because it's a black box. I have to explain it every annual report.\"",
    },
    outcomes: {
      zh: ["误报率降低 90%+", "告警处理效率提升 70-85%", "客户复核 2-3 天 → 2-4 小时"],
      en: ["False positives reduced by 90%+", "Alert handling efficiency up 70-85%", "Client review time: 2-3 days → 2-4 hours"],
    },
    proof: { zh: "香港持牌保险公司,6 周完成部署", en: "Hong Kong-licensed insurance company, 6-week deployment" },
    capabilities: {
      zh: ["规则 + CNN/LSTM 双模引擎", "异常归因", "AI 辅助复核", "SAR 自动起草", "多维风险评级", "AI 动态再评级", "BRRA 自评估"],
      en: ["Rules engine + CNN/LSTM dual-mode detection", "Anomaly attribution", "AI-assisted case review", "SAR auto-generation", "Multi-dimensional risk rating", "AI dynamic re-rating", "BRRA self-assessment"],
    },
    prereqs: {
      zh: ["实时交易流接入,或批量文件接口", "制裁名单源对接", "可选:案件管理系统集成"],
      en: ["Real-time transaction stream OR batch file feed", "Sanctions list provider connection", "Optional: case management system integration"],
    },
    deployment: {
      zh: "私有化部署优先(合规要求);支持混合云。典型上线周期:4-6 周。",
      en: "Private deployment preferred (compliance requirement). Hybrid cloud supported. Typical timeline: 4-6 weeks for production rollout.",
    },
    pricing: {
      zh: { model: "年度许可 + 按交易笔数分级", from: "HKD 600K / 年起", custom: "私有化部署、定制集成另议" },
      en: { model: "Annual license + per-transaction tiers", from: "Starting from HKD 600K/year", custom: "Custom services (private deployment, integration) priced separately" },
    },
    pitchScript: {
      zh: "如果你在中型银行,监管对 AML 施压、分析师被误报淹没,这是唯一一个把规则与 ML 检测合二为一、并对 HKMA 复盘可解释的平台。误报降 90%+,4-6 周上线,本地部署、数据不出门。",
      en: "If you're at a mid-tier bank with regulator pressure on AML and your analysts drowning in false positives, this is the only platform that combines rules-based and ML detection with full explainability for HKMA review. Cuts noise by 90%+, deploys in 4-6 weeks, runs on-prem so your data stays put.",
    },
    discovery: {
      zh: ["你们目前的误报率大概是多少?", "今天谁在审核告警,每条要花多久?", "AML 模型在监管复盘里被挑战过吗?", "现有供应商能解释单条告警的判断依据吗?", "部署偏好是云端还是本地?"],
      en: ["What's your current false-positive rate?", "Who reviews alerts today and how long does each take?", "Has your AML model been challenged in regulator review?", "Is your current vendor able to explain individual decisions?", "What's your deployment preference — cloud or on-prem?"],
    },
  },
  {
    id: "RP-KYC",
    name: { zh: "客户尽职调查智能助手", en: "Customer Due Diligence Copilot" },
    supplier: "Vigil Advisory Limited",
    pitch: { zh: "用 AI 把开户与客户审核流程从 2 周压到 2 天,合规依然合规。", en: "Compress account opening and CDD reviews from 2 weeks to 2 days — still fully audit-ready." },
    industries: ["banking", "svf", "insurance"],
    industryLabels: { zh: ["银行", "SVF", "保险"], en: ["Banking", "SVF", "Insurance"] },
    persona: { zh: "合规专员 / 客户经理", en: "Compliance Officer / RM" },
    decisionMaker: { zh: "CCO / Head of Onboarding", en: "CCO / Head of Onboarding" },
    orgSize: { zh: "中型机构", en: "Mid-tier" },
    region: { zh: "香港、新加坡", en: "HK, SG" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "HKMA, MAS",
    fromPrice: "HKD 480K/yr",
  },
  {
    id: "RP-NSX",
    name: { zh: "制裁名单实时筛查", en: "Real-time Sanctions Screening" },
    supplier: "Vigil Advisory Limited",
    pitch: { zh: "覆盖 250+ 司法辖区,毫秒级筛查,误报率行业最低区间。", en: "Cover 250+ jurisdictions with millisecond screening — false-positive rate in the industry's lowest band." },
    industries: ["banking", "svf", "securities"],
    industryLabels: { zh: ["银行", "SVF", "证券"], en: ["Banking", "SVF", "Securities"] },
    persona: { zh: "合规筛查员", en: "Sanctions Officer" },
    decisionMaker: { zh: "CCO / MLRO", en: "CCO / MLRO" },
    orgSize: { zh: "中大型机构", en: "Mid to Enterprise" },
    region: { zh: "香港、新加坡、亚太", en: "HK, SG, APAC" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "HKMA, MAS, OFAC",
    fromPrice: "HKD 380K/yr",
  },
  {
    id: "RP-RRX",
    name: { zh: "动态客户风险评级", en: "Dynamic Customer Risk Rating" },
    supplier: "Vigil Advisory Limited",
    pitch: { zh: "基于交易行为与外部信号持续更新风险评分,合规与业务双赢。", en: "Continuously refresh customer risk scores from transaction behavior and external signals." },
    industries: ["banking", "insurance"],
    industryLabels: { zh: ["银行", "保险"], en: ["Banking", "Insurance"] },
    persona: { zh: "风险分析师", en: "Risk Analyst" },
    decisionMaker: { zh: "CRO / CCO", en: "CRO / CCO" },
    orgSize: { zh: "中型机构", en: "Mid-tier" },
    region: { zh: "香港、亚太", en: "HK, APAC" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "HKMA, MAS",
    fromPrice: "HKD 420K/yr",
  },
  {
    id: "RP-PAX",
    name: { zh: "监管政策智库", en: "Regulatory Policy Intelligence" },
    supplier: "Vigil Advisory Limited",
    pitch: { zh: "把全球反洗钱与制裁政策变化推送到合规团队桌面,影响一目了然。", en: "Surface global AML & sanctions policy changes with impact analysis on the compliance team's desk." },
    industries: ["banking", "securities", "legal"],
    industryLabels: { zh: ["银行", "证券", "法务"], en: ["Banking", "Securities", "Legal"] },
    persona: { zh: "合规政策专员", en: "Compliance Policy Lead" },
    decisionMaker: { zh: "CCO / GC", en: "CCO / General Counsel" },
    orgSize: { zh: "中大型机构", en: "Mid to Enterprise" },
    region: { zh: "全球", en: "Global" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "—",
    fromPrice: "HKD 220K/yr",
  },
  {
    id: "RP-RETAIL-CHAT",
    name: { zh: "零售门店导购对话助手", en: "Conversational Retail Sales Assistant" },
    supplier: "Aselo Inc.",
    pitch: { zh: "门店店员的 AI 副驾,把成交转化拉高 18%,新人上手时间缩到 1 周。", en: "An in-store AI copilot for sales staff — 18% lift in conversion, new-hire ramp cut to one week." },
    industries: ["retail", "sme", "brand"],
    industryLabels: { zh: ["零售", "SME", "品牌"], en: ["Retail", "SME", "Brand"] },
    persona: { zh: "销售店员", en: "Sales Rep" },
    decisionMaker: { zh: "Retail Director", en: "Retail Director" },
    orgSize: { zh: "中小品牌(50+ 门店)", en: "SMB / mid-market (50+ stores)" },
    region: { zh: "香港、亚太", en: "HK, APAC" },
    languages: { zh: "中 / 英 / 粤", en: "中 · EN · 粤" },
    compliance: "—",
    fromPrice: "HKD 400/user/mo",
  },
  {
    id: "RP-RETAIL-COORD",
    name: { zh: "门店日常协调中枢", en: "Retail Floor Coordination Hub" },
    supplier: "Aselo Inc.",
    pitch: { zh: "排班、补货、客流分析一屏管,店长每天少花 90 分钟做表。", en: "Scheduling, restock, foot-traffic in one pane — 90 minutes back to store managers daily." },
    industries: ["retail", "sme"],
    industryLabels: { zh: ["零售", "SME"], en: ["Retail", "SME"] },
    persona: { zh: "店长", en: "Store Manager" },
    decisionMaker: { zh: "Operations Lead", en: "Operations Lead" },
    orgSize: { zh: "SMB", en: "SMB" },
    region: { zh: "香港", en: "HK" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "—",
    fromPrice: "HKD 280/user/mo",
  },
  {
    id: "RP-CLAIMS",
    name: { zh: "保险理赔审核加速器", en: "Insurance Claims Adjudication Accelerator" },
    supplier: "Helix Compliance",
    pitch: { zh: "针对中小保险公司的理赔审核 AI 副驾,处理时效缩短 60%。", en: "Cut claims adjudication time by 60% for mid-tier insurers." },
    industries: ["insurance"],
    industryLabels: { zh: ["保险"], en: ["Insurance"] },
    persona: { zh: "理赔专员", en: "Claims Adjudicator" },
    decisionMaker: { zh: "Head of Claims", en: "Head of Claims" },
    orgSize: { zh: "中型保险公司", en: "Mid-tier insurer" },
    region: { zh: "香港、新加坡", en: "HK, SG" },
    languages: { zh: "中 / 英", en: "中 · EN" },
    compliance: "IA, MAS",
    fromPrice: "HKD 350K/yr",
  },
];

window.AUDIT_LOG = [
  { who: "Sarah Lin", whoEn: "Sarah Lin", whoZh: "林晓", action: { zh: "创建提交", en: "Created submission" }, time: "2026-04-30 09:14" },
  { who: "AI", action: { zh: "完成材料解析,预填 65%", en: "Parsed materials, prefilled 65% of fields" }, time: "2026-04-30 09:16" },
  { who: "Wilson Chan", action: { zh: "确认并提交 TMX", en: "Confirmed and submitted TMX" }, time: "2026-04-30 11:22" },
  { who: "Grace Ho", action: { zh: "开始审阅", en: "Started review" }, time: "2026-04-30 13:45" },
];

// ───────── AI Briefing for the curator workbench (S7) ─────────
// Click-to-jump anchors reference field IDs in window.FIELDS.
// The briefing runs against TMX submission (the only one with full data per CLAUDE.md §12).
window.BRIEFING = {
  what: {
    zh: [
      "面向香港持牌银行 AML 团队的智能交易监控副驾 —— 把规则告警的误报率从 40-60% 压到 5% 以下",
      "规则 + CNN/LSTM 双模引擎,异常归因可被监管复盘,SAR 自动起草",
      "标准部署 8-12 周,已在港 / 新两地银行投产",
    ],
    en: [
      "An intelligent transaction-monitoring copilot for HK-licensed banks' AML teams — drops rule-engine false positives from 40-60% to under 5%",
      "Hybrid rules + CNN/LSTM engine with regulator-auditable attribution and auto-drafted SAR reports",
      "8-12 week standard deployment, in production at HK and SG banks",
    ],
  },
  strong: [
    { fieldId: "pain_main",      label: { zh: "主要痛点", en: "Main pain" } },
    { fieldId: "pain_outcome",   label: { zh: "量化效果", en: "Quantified outcomes" } },
    { fieldId: "do_capabilities",label: { zh: "产品能力", en: "Capabilities" } },
    { fieldId: "do_knowledge",   label: { zh: "嵌入知识", en: "Embedded knowledge" } },
    { fieldId: "deploy_regions", label: { zh: "落地区域", en: "Production regions" } },
  ],
  thin: [
    { fieldId: "user_seniority", label: { zh: "使用者资历", en: "User seniority" }, why: { zh: "供应商写「合规团队」,缺职级粒度", en: "Supplier wrote 'compliance teams' — missing seniority detail" } },
    { fieldId: "buyer_budget",   label: { zh: "采购预算区间", en: "Typical budget" }, why: { zh: "未填写,销售定价需要参考", en: "Empty — sales needs this for pricing anchor" } },
    { fieldId: "svc_demo",       label: { zh: "演示偏好", en: "Demo preferences" }, why: { zh: "未填写,影响销售排期", en: "Empty — affects sales scheduling" } },
    { fieldId: "svc_response",   label: { zh: "响应 SLA", en: "Response SLA" }, why: { zh: "未填写,合同条款需明确", en: "Empty — required for contract terms" } },
  ],
  questions: [
    {
      fieldIds: ["user_seniority"],
      q: { zh: "AML 团队的具体职级分布是怎样的?初级、中级、高级各占多少?", en: "What's the seniority breakdown of the AML team — junior / mid / senior split?" },
    },
    {
      fieldIds: ["buyer_budget"],
      q: { zh: "中型银行的合规科技采购预算大致区间是?年化还是项目制?", en: "What's the typical compliance-tech budget range for mid-tier banks — annual or project-based?" },
    },
    {
      fieldIds: ["svc_demo", "svc_response"],
      q: { zh: "演示形式和响应 SLA 怎么定?能不能给一个标准条款?", en: "What's your standard for demos and response SLA — can we anchor on a default?" },
    },
    {
      fieldIds: ["pain_outcome"],
      q: { zh: "「误报降低 90%+」这个数字来自哪个客户案例?监管能拿到引用吗?", en: "Where does the '90%+ false positive reduction' figure come from — which customer case? Is it regulator-citable?" },
    },
    {
      fieldIds: ["deploy_regions"],
      q: { zh: "PBOC 适配现在的进度?有没有可披露的客户?", en: "What's the current status of PBOC adaptation, and any disclosable customers?" },
    },
    {
      fieldIds: ["price_retail"],
      q: { zh: "建议零售价的下限是怎么测算的?和成本之间的差额覆盖了哪些?", en: "How is the lower bound of suggested retail derived, and what does the margin over cost cover?" },
    },
  ],
};
