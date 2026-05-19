// POST /api/admin/seed-3-suppliers — DESTRUCTIVE.
// Wipes all suppliers + their data, then seeds 3 demo suppliers
// (AI e-commerce, Vigil Advisory, WizBank) with realistic submissions.
//
// Guards:
//   - Curator role required
//   - Body must include { confirm: 'wipe-and-seed' }
//
// Login credentials for the seeded users (printed in response):
//   demo-vigil@airolemaster.com / vigil1234
//   demo-wizbank@airolemaster.com / wizbank1234
//   demo-ai-ec@airolemaster.com / aiec1234

import { json, hashPassword, shortId } from '../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  if (body.confirm !== 'wipe-and-seed') {
    return json({
      error: 'confirm_required',
      hint: 'POST { "confirm": "wipe-and-seed" } to proceed. THIS DELETES ALL SUPPLIERS.',
    }, 400);
  }

  const env = context.env;

  // ── Wipe ──────────────────────────────────────────────────────────
  // Order matters because of foreign keys; cascades cover most.
  await env.DB.prepare(`DELETE FROM rolepack_chat_messages`).run();
  await env.DB.prepare(`DELETE FROM rolepack_capabilities`).run();
  await env.DB.prepare(`DELETE FROM rolepacks_v2`).run();
  await env.DB.prepare(`DELETE FROM capabilities`).run();
  // intake_files cascades from intakes; clear R2 best-effort
  try {
    const { results: files } = await env.DB.prepare('SELECT storage_key FROM intake_files').all();
    for (const f of files || []) { try { await env.R2.delete(f.storage_key); } catch {} }
  } catch {}
  await env.DB.prepare(`DELETE FROM intake_files`).run();
  await env.DB.prepare(`DELETE FROM intakes`).run();
  await env.DB.prepare(`DELETE FROM supplier_company_info`).run();
  // Delete supplier-role users (we'll recreate)
  await env.DB.prepare(`DELETE FROM users WHERE role = 'supplier'`).run();
  await env.DB.prepare(`DELETE FROM suppliers`).run();
  // Optional cleanup
  try { await env.DB.prepare(`DELETE FROM notifications`).run(); } catch {}

  // Demo curators: keep only Eric and Libin (delete other curator users, then re-create the two).
  await env.DB.prepare(`DELETE FROM users WHERE role = 'curator' AND email NOT LIKE 'demo-curator%'`).run();
  // Rename the surviving demo curator to Eric (so the header stops saying anything else).
  await env.DB.prepare(`UPDATE users SET name = 'Eric' WHERE email = 'demo-curator@airolemaster.com'`).run();
  // Add a Libin user if missing
  const libinExists = await env.DB.prepare(`SELECT 1 FROM users WHERE email = 'demo-libin@airolemaster.com'`).first();
  if (!libinExists) {
    const { hash: lh, salt: ls } = await hashPassword('libin1234');
    await env.DB.prepare(
      `INSERT INTO users (id, email, password, salt, name, role, language) VALUES (?, ?, ?, ?, 'Libin', 'curator', 'zh')`
    ).bind(shortId('USR-', 8), 'demo-libin@airolemaster.com', lh, ls).run();
  }

  // ── Seed ──────────────────────────────────────────────────────────
  const created = [];
  for (const def of SUPPLIERS) {
    const seeded = await seedSupplier(env, def);
    created.push(seeded);
  }

  return json({
    ok: true,
    wiped: true,
    created,
    note: 'Seeded 3 suppliers + login users. Each has 1 intake with full submission data.',
  });
}

// ─── seed payload definitions ──────────────────────────────────────
const SUPPLIERS = [
  {
    key: 'ai-ec',
    email: 'demo-ai-ec@airolemaster.com',
    password: 'aiec1234',
    user_name: 'Mei Chen',
    name: 'Aurora Vision Studio',
    short_name: 'Aurora Vision',
    hq: 'Hangzhou, China',
    company: {
      company_name:    { zh: '极昼视觉(杭州)科技有限公司', en: 'Aurora Vision Studio (Hangzhou) Co., Ltd.' },
      company_hq:      { zh: '中国杭州市余杭区', en: 'Yuhang District, Hangzhou, China' },
      company_founded: { zh: '2021', en: '2021' },
      company_team:    { zh: '46 人 / 视觉研发与运营', en: '46 staff / vision research + ops' },
      company_clients: { zh: '面向 SHEIN、TEMU 卖家与品牌方', en: 'cross-border sellers on SHEIN, TEMU + DTC brands' },
      website:       'https://aurora-vision.example.com',
      contact_name:  'Mei Chen',
      contact_phone: '+86 188 1234 5678',
      contact_email: 'mei@aurora-vision.example.com',
    },
    intake: {
      name: 'Aurora E-Commerce Detail Page Studio',
      industry_hint: 'E-commerce / cross-border product pages',
      website: 'https://aurora-vision.example.com',
      free_text:
        '我们用 AI 自动化电商详情页的视觉与文案生成,15 分钟即可从一张白底图产出完整长图。' +
        '主打跨境卖家(SHEIN/TEMU)与 DTC 品牌,核心客户已稳定使用 8+ 个月。',
      service_pricing: {
        service: {
          demo_mode: ['live'],
          sales_assist_level: 'self-serve-first',
          sales_coverage_regions: ['Greater China', 'SEA'],
          delivery_scope: ['SaaS', 'API'],
          support_languages: ['zh', 'en'],
        },
        pricing: {
          pricing_model: ['per-page', 'enterprise-license'],
          cost_price: 'CNY 1.8 / page',
          suggested_retail: 'CNY 6 / page (volume tiers)',
          custom_service_pricing: 'CNY 80,000 起',
          service_fee: 'CNY 15,000 / month',
        },
      },
    },
    capabilities: [
      { rc: 'RC-01', name_zh: 'AI 电商详情页全自动生成', name_en: 'Automated AI E-Commerce Product Detail Page Generation',
        desc_zh: '接收产品基础素材(白底图或灰底图),通过 AI 自动完成场景融入、虚拟模特生成、光影渲染、排版设计等全流程,在 15 分钟内输出完整电商详情页。',
        desc_en: 'Accepts basic product images (white or gray background), automatically generates complete e-commerce detail pages with AI scene integration, virtual model creation, lighting rendering, and layout design — all within 15 minutes.' },
      { rc: 'RC-02', name_zh: '品牌虚拟代言人资产创建与管理', name_en: 'Brand Virtual Spokesperson Asset Creation & Management',
        desc_zh: '支持品牌上传或指定专属虚拟模特面孔,永久买断使用权,消除肖像权纠纷。系统在复杂姿态和光影条件下(如闭眼睡姿、强逆光)保持高度稳定。',
        desc_en: 'Brands upload or commission proprietary virtual model faces with permanent usage rights, eliminating likeness disputes. Maintains identity consistency across difficult poses and lighting (closed-eyes, harsh backlight).' },
      { rc: 'RC-03', name_zh: '产品细节质感微距展示', name_en: 'Product Texture Detail Micro-Display',
        desc_zh: '系统视觉渲染中枢深度还原复杂工艺细节,包括拉链光泽、绑带纹理、飞边褶皱、缝线走线等,达到商业级逼真还原程度。',
        desc_en: 'Deep visual rendering pipeline reproduces complex craftsmanship details including zipper gloss, ribbon texture, frayed edges, and stitch paths at commercial-grade fidelity.' },
      { rc: 'RC-04', name_zh: '结构化品牌视觉长页输出', name_en: 'Structured Brand Visual Long-Form Page Output',
        desc_zh: '将顶尖商业设计逻辑与排版规范固化为可复用的数据流,输出排版精良、逻辑递进的完整电商详情页长图。',
        desc_en: 'Codifies top-tier commercial design logic and layout standards into reusable data pipelines, outputting well-structured, narrative-driven detail pages.' },
      { rc: 'RC-05', name_zh: '海量 SKU 快速上新周期压缩', name_en: 'High-Volume SKU Rapid Product Launch Acceleration',
        desc_zh: '通过自动化详情页生成,将传统上新流程从 5-7 天压缩至 15 分钟内完成。支持"日测百款 SKU"的绝对效率优势,大幅缩短新品上架周期。',
        desc_en: 'Compresses traditional product launch cycles from 5-7 days to 15 minutes by automating detail-page generation. Enables "100+ SKUs/day" testing efficiency.' },
    ],
    rolepacks: [
      { rp: 'RP-01', name_zh: '电商详情页视觉负责人', name_en: 'E-commerce Visual Lead',
        industry: ['retail'], company_size: ['mid-market', 'sme'],
        department: { zh: '电商视觉团队', en: 'E-commerce visual team' },
        capability_idx: [0, 1, 2, 3, 4],
        questionnaire: {
          profile: {
            daily_activities: { value_zh: '每周需上架 80–200 款新 SKU,与摄影、设计、排版团队协调,等待静物 → 模特拍摄 → 修图 → 排版 → 投放,每款平均 5–7 个工作日。', value_en: 'Coordinates 80–200 new SKUs / week through photography, retouch, layout, and launch — typically 5–7 days per SKU.' },
            decision_maker:    { value_zh: '电商运营总监、品牌创始人(对效率敏感)', value_en: 'E-commerce ops director or brand founder (efficiency-sensitive)' },
            decision_priorities: { value_zh: '上新速度、视觉调性一致性、人力成本、与现有 PIM/DAM 的对接', value_en: 'Launch speed, visual consistency, headcount cost, integration with existing PIM/DAM' },
          },
          pain: {
            main_pain:      { value_zh: '上新周期太长,旺季供不应求,模特拍摄档期挤,光影差异让画面不一致', value_en: 'Launch cycle too long; peak seasons can\'t keep up; model schedules conflict; lighting variance breaks visual consistency' },
            current_workflow: { value_zh: '静物棚拍 → 外拍模特 → 修图 → 设计排版 → 上架,链路长且每环节都依赖人手', value_en: 'Studio shoot → on-location model shoot → retouch → design layout → launch; long chain, each step manual' },
            quantified_value: { value_zh: '每 100 款 SKU 节省约 3.5 万人民币(摄影 + 修图 + 排版),上新提速 95%+', value_en: 'Saves ~CNY 35,000 per 100 SKUs (shoot + retouch + layout) and shortens launch cycle by 95%+' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '通过 SaaS 后台或 API 接入,直接读取 PIM 商品库,产出可投放长图;支持 Shopify、Lazada、TikTok Shop 直发', value_en: 'SaaS console or API into existing PIM; outputs launch-ready long pages; direct push to Shopify, Lazada, TikTok Shop' },
            outcomes:             { value_zh: '上新周期缩短到 15 分钟/款;摄影和后期外包预算下降约 60%', value_en: 'Launch cycle drops to 15 min/SKU; photo + retouch outsourcing budget down ~60%' },
            case_study:           { value_zh: '某 TEMU 头部女装卖家:从月均 220 款上新跃升到 850 款;ROAS 提升 28%', value_en: 'A top TEMU women\'s apparel seller scaled from 220 to 850 SKUs/month; ROAS improved 28%.' },
          },
          deployment: {
            deployment_mode: { value_zh: 'SaaS / 私有化部署 / API', value_en: 'SaaS / private deployment / API' },
            api_endpoint:    { value_zh: 'REST + Webhooks,提供 Shopify、TikTok Shop 直连插件', value_en: 'REST + webhooks; native Shopify and TikTok Shop plugins' },
          },
        },
      },
      { rp: 'RP-02', name_zh: '品牌视觉资产管理者', name_en: 'Brand Visual Asset Manager',
        industry: ['retail'], company_size: ['enterprise', 'mid-market'],
        department: { zh: '品牌部 / 视觉中心', en: 'Brand / visual center' },
        capability_idx: [1, 3],
        questionnaire: {
          profile: {
            daily_activities:    { value_zh: '管理品牌视觉资产、虚拟代言人形象,审核所有外发素材的一致性', value_en: 'Manages brand visual assets, virtual spokesperson imagery, reviews every outgoing creative for consistency' },
            decision_maker:       { value_zh: 'CMO 或品牌视觉总监', value_en: 'CMO or brand visual director' },
            decision_priorities:  { value_zh: '品牌识别度、肖像权安全、可复用性', value_en: 'Brand recognition, likeness rights safety, reusability' },
          },
          pain: {
            main_pain:        { value_zh: '签约真人模特存在档期与肖像权风险;不同摄影师产出风格分裂', value_en: 'Hiring real models incurs schedule + likeness risk; different photographers create stylistic drift' },
            current_workflow: { value_zh: '签约模特 → 拍摄合同 → 多平台授权管理 → 续约/换约', value_en: 'Sign model → shoot contract → multi-platform usage management → renew/replace' },
            quantified_value: { value_zh: '相比签约真人模特,年成本下降约 70%', value_en: '~70% annual cost reduction vs. signed-model program' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '虚拟模特资产入库,任何素材生成自动调用同一面孔', value_en: 'Virtual model asset stored; any creative generation auto-references the same identity' },
            outcomes:             { value_zh: '品牌一致性 SLA 100%,无肖像权纠纷', value_en: 'Brand-consistency SLA at 100%, zero likeness disputes' },
            case_study:           { value_zh: '某中端鞋履品牌将 12 位签约模特统一替换为 3 位虚拟代言人,跨平台投放视觉一致性达成', value_en: 'A mid-tier footwear brand replaced 12 signed models with 3 virtual spokespersons, achieving cross-platform visual consistency' },
          },
          deployment: {
            deployment_mode: { value_zh: 'SaaS', value_en: 'SaaS' },
            api_endpoint:    { value_zh: 'REST', value_en: 'REST' },
          },
        },
      },
    ],
    aiSummary: {
      summary_zh: `**一句话定位**:把电商详情页从"5-7 天"压到"15 分钟"的 AI 视觉自动化平台。\n\n**主要 RolePack**:\n- RP-01 电商详情页视觉负责人(全功能 5/5 能力)\n- RP-02 品牌视觉资产管理者(虚拟代言人 + 长页输出)\n\n**主要 RoleCapability**:RC-01 全自动详情页生成、RC-02 虚拟代言人、RC-03 微距细节、RC-04 长页输出、RC-05 海量 SKU 提速。\n\n**准备充分度**:2/2 RolePack 已生成内容,所有问卷字段已填写。\n\n**关注点**:\n- 价格在跨境头部卖家(SHEIN/TEMU)是否仍具吸引力?\n- 私有化部署的 SLA 与数据治理细节需进一步明确。\n- 是否能配合品牌方的色彩管理(ICC profile)?`,
      summary_en: `**One-liner**: AI visual automation that compresses e-commerce detail pages from 5-7 days to 15 minutes.\n\n**Primary RolePacks**:\n- RP-01 E-commerce Visual Lead (uses all 5 capabilities)\n- RP-02 Brand Visual Asset Manager (virtual spokesperson + long-form pages)\n\n**Primary RoleCapabilities**: RC-01 automated detail-page generation, RC-02 virtual spokesperson, RC-03 micro-detail rendering, RC-04 long-form output, RC-05 high-volume SKU acceleration.\n\n**Readiness**: 2/2 RolePacks have generated content; questionnaires fully filled.\n\n**Things to probe**:\n- Is the pricing still attractive vs. existing in-house pipelines at SHEIN/TEMU top sellers?\n- Need clearer SLAs and data-governance details for private deployment.\n- Does it support brand color management (ICC profiles)?`,
    },
  },

  {
    key: 'vigil',
    email: 'demo-vigil@airolemaster.com',
    password: 'vigil1234',
    user_name: 'Henry Lam',
    name: 'Vigil Advisory Limited',
    short_name: 'Vigil Advisory',
    hq: 'Hong Kong',
    company: {
      company_name:    { zh: '维吉咨询有限公司', en: 'Vigil Advisory Limited' },
      company_hq:      { zh: '中国香港', en: 'Hong Kong' },
      company_founded: { zh: '2018', en: '2018' },
      company_team:    { zh: '34 人 / 合规与金融犯罪科技', en: '34 staff / compliance + financial-crime tech' },
      company_clients: { zh: '香港持牌银行、虚拟资产平台、家族办公室', en: 'HK-licensed banks, VA platforms, family offices' },
      website:       'https://vigil-advisory.example.com',
      contact_name:  'Henry Lam',
      contact_phone: '+852 9876 1234',
      contact_email: 'henry@vigil-advisory.example.com',
    },
    intake: {
      name: 'Vigil Sentinel — AML & EDD Co-pilot',
      industry_hint: 'Banking / financial-crime compliance',
      website: 'https://vigil-advisory.example.com/sentinel',
      free_text:
        'Vigil Sentinel 是面向持牌银行与虚拟资产平台的反洗钱与加强尽调副驾。' +
        '从交易监控告警的初步审阅到 EDD 报告草稿,把人工合规人员的处理时间压低 60%+。',
      service_pricing: {
        service: {
          demo_mode: ['live', 'sandbox'],
          sales_assist_level: 'high-touch',
          sales_coverage_regions: ['Hong Kong', 'Singapore', 'Greater China'],
          delivery_scope: ['private deployment', 'managed service'],
          support_languages: ['zh', 'en'],
        },
        pricing: {
          pricing_model: ['enterprise-license', 'per-seat'],
          cost_price: 'HKD 12,000 / seat / year (volume)',
          suggested_retail: 'HKD 36,000 / seat / year',
          custom_service_pricing: 'HKD 800,000 起(私有化部署)',
          service_fee: 'HKD 60,000 / month (managed)',
        },
      },
    },
    capabilities: [
      { rc: 'RC-01', name_zh: '交易监控告警初审', name_en: 'Transaction Monitoring Alert Triage',
        desc_zh: '对反洗钱告警自动归并、去噪、打标,识别真阳性优先级。',
        desc_en: 'Auto-clusters AML alerts, de-noises, and tags true-positive priority.' },
      { rc: 'RC-02', name_zh: '加强尽调(EDD)报告草稿', name_en: 'Enhanced Due Diligence (EDD) Report Drafting',
        desc_zh: '基于客户档案、交易行为、外部公开数据自动生成 EDD 草稿,合规员审定后即用。',
        desc_en: 'Drafts EDD reports from customer file, transaction behavior, and public OSINT — compliance officer reviews and signs off.' },
      { rc: 'RC-03', name_zh: '受益所有人(UBO)穿透分析', name_en: 'Ultimate Beneficial Owner (UBO) Drill-down',
        desc_zh: '解析公司股权结构图,自动穿透到自然人 UBO,标注 PEP / 制裁命中。',
        desc_en: 'Parses corporate ownership graphs, drills to natural-person UBOs, flags PEP / sanctions hits.' },
      { rc: 'RC-04', name_zh: '可疑交易报告(STR)起草', name_en: 'Suspicious Transaction Report (STR) Drafting',
        desc_zh: '按 HKMA / FATF 模板自动生成 STR 草稿,合规员可一键提交监管端口。',
        desc_en: 'Generates HKMA / FATF-template STR drafts; compliance officer one-click submits to regulator.' },
      { rc: 'RC-05', name_zh: '客户风险评级动态更新', name_en: 'Dynamic Customer Risk Rating',
        desc_zh: '依据交易行为变化、外部新闻、监管变化等触发风险评级再评估。',
        desc_en: 'Re-rates customer risk based on behavior shifts, news triggers, and regulatory updates.' },
      { rc: 'RC-06', name_zh: '审计留痕与监管问询应答', name_en: 'Audit Trail & Regulator Q&A',
        desc_zh: '所有 AI 决策保留可追溯证据链,支持监管问询时一键导出。',
        desc_en: 'Every AI decision keeps a traceable evidence chain; one-click export for regulator inquiries.' },
    ],
    rolepacks: [
      { rp: 'RP-01', name_zh: 'AML 监控分析师', name_en: 'AML Monitoring Analyst',
        industry: ['banking'], company_size: ['enterprise'],
        department: { zh: '合规部 / 金融犯罪监控', en: 'Compliance / Financial Crime' },
        capability_idx: [0, 4, 5],
        questionnaire: {
          profile: {
            daily_activities: { value_zh: '每天处理 50–200 条交易监控告警:阅读交易日志、查 KYC 档案、做出 close/escalate 决定;每周抽样审核同事的告警处置。', value_en: 'Processes 50–200 transaction monitoring alerts/day: reads tx logs, checks KYC, decides close/escalate; weekly sampling of peer dispositions.' },
            decision_maker:    { value_zh: 'MLRO(反洗钱报告主任)、合规主管', value_en: 'MLRO (Money Laundering Reporting Officer), Head of Compliance' },
            decision_priorities: { value_zh: '降低误报率、不漏过真阳性、可解释性、监管认可度', value_en: 'Reduce false positives, never miss true positives, explainability, regulator acceptance' },
          },
          pain: {
            main_pain:      { value_zh: '告警量过大(单日 200+),分析师需逐条点开 5–7 个系统,处理一条平均 18 分钟', value_en: 'Alert volume too high (200+/day); analyst flips between 5–7 systems; ~18 min/alert on average' },
            current_workflow: { value_zh: '人工读告警 → 调出 KYC → 查交易历史 → 查制裁名单 → 写处置笔记 → 关闭或升级', value_en: 'Manual alert read → pull KYC → check tx history → screen sanctions → write disposition note → close or escalate' },
            quantified_value: { value_zh: '减少 60%+ 处理时间,每年节省 ~HKD 4.8M(20 名分析师团队)', value_en: '60%+ reduction in handling time; saves ~HKD 4.8M/year for a 20-analyst team' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '部署在银行内网,接入交易监控系统(Actimize / SAS),输出告警初判与建议处置;分析师审核确认即可关单', value_en: 'On-prem deployment, integrates with Actimize / SAS; outputs initial disposition + recommendation; analyst reviews and closes' },
            outcomes:             { value_zh: '处理时间从 18 分钟降至 6 分钟;真阳性识别率持平;合规月报缩短 3 个工作日', value_en: 'Handling time 18 → 6 min; true-positive recall unchanged; monthly compliance report cut by 3 business days' },
            case_study:           { value_zh: '某香港持牌银行(资产 1500 亿港币)上线 6 个月,告警处理 SLA 达成率从 78% 提升至 96%', value_en: 'A HK-licensed bank (HKD 150B AUM) deployed for 6 months: alert SLA attainment from 78% to 96%' },
          },
          deployment: {
            deployment_mode: { value_zh: '私有化部署(银行内网),客户隔离', value_en: 'Private deployment (on-prem in bank), tenant-isolated' },
            api_endpoint:    { value_zh: 'gRPC + REST,与 Actimize、SAS、Oracle Mantas 有现成连接器', value_en: 'gRPC + REST; pre-built connectors for Actimize, SAS, Oracle Mantas' },
          },
        },
      },
      { rp: 'RP-02', name_zh: 'EDD / KYC 审阅员', name_en: 'EDD / KYC Reviewer',
        industry: ['banking'], company_size: ['enterprise', 'mid-market'],
        department: { zh: '合规部 / 客户尽调', en: 'Compliance / Customer Due Diligence' },
        capability_idx: [1, 2, 4],
        questionnaire: {
          profile: {
            daily_activities:    { value_zh: '处理高净值客户、PEP、复杂股权结构客户的 EDD;穿透 UBO,识别风险点,撰写报告', value_en: 'Handles EDD for HNW / PEP / complex-ownership clients; drills UBO, identifies risk, writes reports' },
            decision_maker:       { value_zh: '合规主管、风控委员会', value_en: 'Head of Compliance; Risk Committee' },
            decision_priorities:  { value_zh: '准确性、覆盖面(没有遗漏)、监管报告完整度、效率', value_en: 'Accuracy, completeness (no gaps), regulator-ready reports, throughput' },
          },
          pain: {
            main_pain:        { value_zh: '一份 EDD 报告平均需 12–20 小时;复杂股权结构难以人工穿透到 UBO', value_en: 'One EDD report takes 12–20 hours on average; complex ownership graphs hard to traverse manually' },
            current_workflow: { value_zh: '收集客户文件 → 查股权 → 穿透 UBO → 查制裁/PEP → 整合写报告 → 复核 → 提交', value_en: 'Collect docs → check ownership → drill UBO → screen sanctions/PEP → consolidate → review → submit' },
            quantified_value: { value_zh: '单份报告时间从 16 小时降至 4 小时,UBO 漏识率从 8% 降至 <1%', value_en: 'Per-report time 16 → 4 hours; UBO miss rate from 8% to <1%' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '从 KYC 系统读取客户档案 → 自动穿透 UBO → 调用沙制裁 API → 生成 EDD 草稿 → 合规员审定', value_en: 'Reads KYC system → auto-drills UBO → calls sanctions API → drafts EDD → compliance officer reviews' },
            outcomes:             { value_zh: '日均处理 EDD 数从 4 件提升到 15 件;复杂结构客户处理周期缩短至 1 个工作日', value_en: 'Daily EDD throughput 4 → 15; complex-ownership cases turn around in 1 business day' },
            case_study:           { value_zh: '某香港私人银行家族办公室部门,EDD 积压从 230 件清零仅用 5 周', value_en: 'A HK private bank\'s family-office team cleared 230-case EDD backlog in 5 weeks' },
          },
          deployment: {
            deployment_mode: { value_zh: '私有化部署 / 托管服务', value_en: 'Private deployment / managed service' },
            api_endpoint:    { value_zh: 'REST + S/MIME 加密文件传输', value_en: 'REST + S/MIME encrypted file transfer' },
          },
        },
      },
      { rp: 'RP-03', name_zh: 'STR 起草专员', name_en: 'STR Drafting Specialist',
        industry: ['banking'], company_size: ['enterprise'],
        department: { zh: '合规部 / 监管报告', en: 'Compliance / Regulatory Reporting' },
        capability_idx: [3, 5],
        questionnaire: {
          profile: {
            daily_activities:    { value_zh: '审核已升级的告警,撰写 STR 提交香港金融管理局或新加坡金管局', value_en: 'Reviews escalated alerts, drafts STRs for submission to HKMA / MAS' },
            decision_maker:       { value_zh: 'MLRO', value_en: 'MLRO' },
            decision_priorities:  { value_zh: '完整性、表述准确、监管口径合规', value_en: 'Completeness, accurate phrasing, regulatory alignment' },
          },
          pain: {
            main_pain:        { value_zh: '一份 STR 平均 6–8 小时;监管模板细节多,容易漏字段', value_en: 'One STR takes 6–8 hours; regulator templates have many fields, easy to miss one' },
            current_workflow: { value_zh: '阅读告警 → 整理证据链 → 套用模板 → 撰写叙述 → MLRO 复核 → 监管端口提交', value_en: 'Read alert → assemble evidence chain → apply template → write narrative → MLRO review → regulator portal submit' },
            quantified_value: { value_zh: '单份 STR 时间 6 → 1.5 小时,字段完整度从 92% 提升至 100%', value_en: 'Per-STR time 6 → 1.5 hours; field completeness from 92% to 100%' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '调用 RC-04 自动生成 STR 草稿,MLRO 一键审定提交', value_en: 'Calls RC-04 to draft STR; MLRO one-click reviews and submits' },
            outcomes:             { value_zh: 'STR 月度产出从 28 件提升至 95 件,无监管退件', value_en: 'Monthly STR output 28 → 95, zero regulator rejections' },
            case_study:           { value_zh: '上线 3 个月内零退件率,被 HKMA 评为"合规自动化优秀实践"', value_en: 'Zero regulator rejections in first 3 months; cited by HKMA as a compliance-automation best practice' },
          },
          deployment: {
            deployment_mode: { value_zh: '私有化部署', value_en: 'Private deployment' },
            api_endpoint:    { value_zh: 'REST + 监管端口集成', value_en: 'REST + regulator-portal integration' },
          },
        },
      },
    ],
    aiSummary: {
      summary_zh: `**一句话定位**:面向香港持牌银行与 VA 平台的 AML / EDD / STR 副驾。\n\n**主要 RolePack**:\n- RP-01 AML 监控分析师(告警初审)\n- RP-02 EDD / KYC 审阅员(穿透 UBO)\n- RP-03 STR 起草专员(监管报告)\n\n**主要 RoleCapability**:RC-01 告警初审、RC-02 EDD 起草、RC-03 UBO 穿透、RC-04 STR 起草、RC-05 风险评级、RC-06 审计留痕。\n\n**准备充分度**:3/3 RolePack 已生成内容,服务定价完整。\n\n**关注点**:\n- 私有化部署的合规审计周期(银行 IT 流程)?\n- 与 Actimize / SAS 的具体接口稳定性?\n- 数据出境合规(香港 → 海外训练)?`,
      summary_en: `**One-liner**: AML / EDD / STR co-pilot for HK-licensed banks and VA platforms.\n\n**Primary RolePacks**:\n- RP-01 AML Monitoring Analyst (alert triage)\n- RP-02 EDD / KYC Reviewer (UBO drill)\n- RP-03 STR Drafting Specialist (regulatory reports)\n\n**Primary RoleCapabilities**: RC-01 alert triage, RC-02 EDD drafting, RC-03 UBO drill, RC-04 STR drafting, RC-05 dynamic risk rating, RC-06 audit trail.\n\n**Readiness**: 3/3 RolePacks have generated content; service pricing complete.\n\n**Things to probe**:\n- On-prem rollout timeline (bank IT cycles)?\n- Actimize / SAS connector stability in production?\n- Cross-border data residency (HK ↔ overseas training)?`,
    },
  },

  {
    key: 'wizbank',
    email: 'demo-wizbank@airolemaster.com',
    password: 'wizbank1234',
    user_name: 'Sara Tan',
    name: 'WizBank Technologies',
    short_name: 'WizBank',
    hq: 'Singapore',
    company: {
      company_name:    { zh: 'WizBank 科技(新加坡)私人有限公司', en: 'WizBank Technologies Pte. Ltd.' },
      company_hq:      { zh: '新加坡', en: 'Singapore' },
      company_founded: { zh: '2020', en: '2020' },
      company_team:    { zh: '58 人 / 银行 AI 与数字化转型', en: '58 staff / banking AI + digital transformation' },
      company_clients: { zh: '东南亚商业银行、虚拟银行、新兴金融科技', en: 'SEA commercial banks, digital banks, growth fintechs' },
      website:       'https://wizbank.example.com',
      contact_name:  'Sara Tan',
      contact_phone: '+65 9123 4567',
      contact_email: 'sara@wizbank.example.com',
    },
    intake: {
      name: 'WizBank Branch Intelligence Suite',
      industry_hint: 'Retail banking / branch + relationship management',
      website: 'https://wizbank.example.com/branch-intel',
      free_text:
        'WizBank Branch Intelligence Suite 帮助零售银行支行经理、客户经理、客服中心提升客户互动质量与产品交叉销售。' +
        '基于 NLP 与客户行为模型,实时给出对话建议、流失预警、产品匹配。',
      service_pricing: {
        service: {
          demo_mode: ['sandbox', 'pilot'],
          sales_assist_level: 'co-sell',
          sales_coverage_regions: ['Singapore', 'Malaysia', 'Indonesia', 'Vietnam'],
          delivery_scope: ['SaaS', 'private deployment'],
          support_languages: ['en', 'zh', 'id', 'vi'],
        },
        pricing: {
          pricing_model: ['per-seat', 'enterprise-license'],
          cost_price: 'SGD 800 / seat / year (volume)',
          suggested_retail: 'SGD 2,400 / seat / year',
          custom_service_pricing: 'SGD 60,000 起(私有化)',
          service_fee: 'SGD 8,000 / month (managed)',
        },
      },
    },
    capabilities: [
      { rc: 'RC-01', name_zh: '客户互动实时建议', name_en: 'Real-time Customer Interaction Coaching',
        desc_zh: '柜台或客服对话中实时弹出推荐话术、产品匹配建议,并标注客户情绪转折点。',
        desc_en: 'Live coaching during teller / contact-center conversations: suggested scripts, product matches, flagged sentiment shifts.' },
      { rc: 'RC-02', name_zh: '客户流失预警', name_en: 'Customer Attrition Early Warning',
        desc_zh: '基于 60+ 行为信号(余额变化、登录频次、客服联系)预测 30 天内流失风险。',
        desc_en: 'Predicts 30-day attrition risk from 60+ behavioral signals (balance moves, login cadence, service touches).' },
      { rc: 'RC-03', name_zh: '产品交叉销售匹配', name_en: 'Product Cross-Sell Matching',
        desc_zh: '为每位客户实时计算 Next-Best-Product 推荐,与现有 CRM 触发器对接。',
        desc_en: 'Computes Next-Best-Product per customer; integrates with existing CRM triggers.' },
      { rc: 'RC-04', name_zh: '支行业绩看板', name_en: 'Branch Performance Dashboard',
        desc_zh: '聚合每个支行的销售、客户满意度、AI 接受率,支行经理一目了然。',
        desc_en: 'Per-branch dashboard for sales, CSAT, and AI-suggestion acceptance rate.' },
      { rc: 'RC-05', name_zh: '多语言客服转写与分析', name_en: 'Multilingual Call Transcription & Analytics',
        desc_zh: '支持英、中、印尼、越四语;转写、情感分析、合规检查同步进行。',
        desc_en: 'EN / ZH / ID / VI; transcription, sentiment, compliance checks run inline.' },
    ],
    rolepacks: [
      { rp: 'RP-01', name_zh: '支行客户经理', name_en: 'Branch Relationship Manager',
        industry: ['banking'], company_size: ['enterprise', 'mid-market'],
        department: { zh: '零售银行 / 支行', en: 'Retail banking / branch network' },
        capability_idx: [0, 1, 2, 3],
        questionnaire: {
          profile: {
            daily_activities: { value_zh: '每日接待 8–15 位客户,做产品介绍、解答疑问、捕捉交叉销售机会;每周做 1–2 次 outbound 电话回访', value_en: 'Hosts 8–15 walk-in customers/day, presents products, captures cross-sell openings; 1–2 outbound callbacks/week' },
            decision_maker:    { value_zh: '零售银行总经理、支行总监', value_en: 'Head of Retail Banking; Branch Director' },
            decision_priorities: { value_zh: '销售达成、客户满意度、合规风险', value_en: 'Sales attainment, CSAT, compliance risk' },
          },
          pain: {
            main_pain:      { value_zh: '客户经理对产品掌握深度参差;高净值客户细节难记;交叉销售机会常被错过', value_en: 'Inconsistent product knowledge across RMs; HNW client details hard to remember; cross-sell openings missed' },
            current_workflow: { value_zh: '客户进门 → RM 调出 CRM 看摘要 → 凭经验推荐产品 → 事后填录', value_en: 'Customer arrives → RM pulls CRM summary → suggests product from memory → fills CRM after' },
            quantified_value: { value_zh: '单 RM 月度销售提升 22%,客户满意度 NPS 从 42 升到 58', value_en: 'Per-RM monthly sales +22%; customer NPS from 42 to 58' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: 'RM 桌面集成,客户身份识别后自动弹出"今天可以聊什么"卡片;对话中实时给出下一句建议', value_en: 'RM desktop add-on; auto-surfaces "talk-to-this-customer-about" card on identification; live next-line coaching' },
            outcomes:             { value_zh: 'RM 培训成本下降 35%;新人上手周期从 3 个月缩短到 4 周', value_en: 'RM training cost -35%; new-hire ramp from 3 months to 4 weeks' },
            case_study:           { value_zh: '某新加坡数字银行试点 3 个支行,试点季度交叉销售收入 +28%', value_en: 'A Singapore digital bank piloted in 3 branches: cross-sell revenue +28% in pilot quarter' },
          },
          deployment: {
            deployment_mode: { value_zh: 'SaaS 或私有化', value_en: 'SaaS or private deployment' },
            api_endpoint:    { value_zh: 'REST + 与 Salesforce / 国产 CRM 接入', value_en: 'REST + Salesforce / regional CRM connectors' },
          },
        },
      },
      { rp: 'RP-02', name_zh: '客服中心质量分析师', name_en: 'Contact-Center Quality Analyst',
        industry: ['banking'], company_size: ['enterprise'],
        department: { zh: '客服中心 / QA', en: 'Contact center / QA' },
        capability_idx: [4],
        questionnaire: {
          profile: {
            daily_activities:    { value_zh: '抽样客服通话,做合规与服务质量评分;识别培训机会', value_en: 'Samples agent calls, scores compliance + service quality, flags coaching needs' },
            decision_maker:       { value_zh: '客服中心总经理', value_en: 'Head of Contact Center' },
            decision_priorities:  { value_zh: '抽样覆盖率、合规命中率、培训反馈速度', value_en: 'Sampling coverage, compliance hit rate, coaching feedback speed' },
          },
          pain: {
            main_pain:        { value_zh: '人工抽样仅能覆盖 3–5%,合规风险盲点大;多语言成本高', value_en: 'Manual sampling covers only 3–5%; compliance blind spots; multilingual coverage expensive' },
            current_workflow: { value_zh: '人工随机抽 → 听录音 → 评分 → 写反馈', value_en: 'Random sample → listen to recording → score → write feedback' },
            quantified_value: { value_zh: '抽样覆盖率从 4% 提升到 100%,合规命中率提升 3 倍', value_en: 'Sampling coverage 4% → 100%; compliance hit rate up 3×' },
          },
          how_it_helps: {
            workflow_integration: { value_zh: '通话结束后自动转写、评分、合规检查,并入现有 QA 工作流', value_en: 'Auto-transcribes + scores + compliance-checks each call post-completion, feeds existing QA workflow' },
            outcomes:             { value_zh: 'QA 团队人力下降 40%;监管投诉数下降 22%', value_en: 'QA headcount -40%; regulatory complaints -22%' },
            case_study:           { value_zh: '某印尼商业银行客服中心(月通话 12 万)上线后,合规缺陷率下降 31%', value_en: 'An Indonesian commercial bank\'s contact center (120K calls/month): compliance defects -31% post-deployment' },
          },
          deployment: {
            deployment_mode: { value_zh: '私有化部署 / SaaS', value_en: 'Private deployment / SaaS' },
            api_endpoint:    { value_zh: 'REST,与 Genesys、NICE、Aspect 兼容', value_en: 'REST; compatible with Genesys, NICE, Aspect' },
          },
        },
      },
    ],
    aiSummary: {
      summary_zh: `**一句话定位**:面向东南亚零售银行的支行 + 客服中心智能化套件。\n\n**主要 RolePack**:\n- RP-01 支行客户经理(实时建议 + 流失预警)\n- RP-02 客服中心质量分析师(全量抽样)\n\n**主要 RoleCapability**:RC-01 实时建议、RC-02 流失预警、RC-03 交叉销售、RC-04 业绩看板、RC-05 多语言转写。\n\n**准备充分度**:2/2 RolePack 已生成内容。\n\n**关注点**:\n- 与本地 CRM(国产/区域)的集成深度?\n- 数据出境(印尼、越南)的本地化合规?\n- 多语言模型在小语种(越南语)的准确率?`,
      summary_en: `**One-liner**: Branch + contact-center intelligence suite for SEA retail banks.\n\n**Primary RolePacks**:\n- RP-01 Branch Relationship Manager (live coaching + attrition alerts)\n- RP-02 Contact-Center Quality Analyst (100% sampling)\n\n**Primary RoleCapabilities**: RC-01 live coaching, RC-02 attrition early warning, RC-03 cross-sell, RC-04 branch dashboards, RC-05 multilingual transcription.\n\n**Readiness**: 2/2 RolePacks have generated content.\n\n**Things to probe**:\n- Depth of integration with regional CRM stacks?\n- Data-residency for Indonesia + Vietnam deployments?\n- Multilingual accuracy on lower-resource languages (Vietnamese)?`,
    },
  },
];

async function seedSupplier(env, def) {
  // Supplier
  const supplierId = shortId('SUP-', 8);
  await env.DB.prepare(
    `INSERT INTO suppliers (id, name, short_name, hq) VALUES (?, ?, ?, ?)`
  ).bind(supplierId, def.name, def.short_name, def.hq).run();

  // User (login)
  const { hash, salt } = await hashPassword(def.password);
  const userId = shortId('USR-', 8);
  await env.DB.prepare(
    `INSERT INTO users (id, email, password, salt, name, role, supplier_id, language)
     VALUES (?, ?, ?, ?, ?, 'supplier', ?, 'zh')`
  ).bind(userId, def.email, hash, salt, def.user_name, supplierId).run();

  // supplier_company_info
  await env.DB.prepare(
    `INSERT INTO supplier_company_info (supplier_id) VALUES (?)`
  ).bind(supplierId).run();
  for (const [fid, val] of Object.entries(def.company)) {
    if (typeof val === 'object' && val !== null && ('zh' in val || 'en' in val)) {
      await env.DB.prepare(
        `UPDATE supplier_company_info SET ${fid}_zh = ?, ${fid}_en = ?, updated_at = datetime('now') WHERE supplier_id = ?`
      ).bind(val.zh || '', val.en || '', supplierId).run();
    } else {
      // Single column (website, contact_name, etc.) — try; column may not exist yet
      try {
        await env.DB.prepare(
          `UPDATE supplier_company_info SET ${fid} = ?, updated_at = datetime('now') WHERE supplier_id = ?`
        ).bind(val || '', supplierId).run();
      } catch {
        // column missing — call ensureContactColumns or skip
        try { await env.DB.prepare(`ALTER TABLE supplier_company_info ADD COLUMN ${fid} TEXT`).run(); } catch {}
        try {
          await env.DB.prepare(
            `UPDATE supplier_company_info SET ${fid} = ?, updated_at = datetime('now') WHERE supplier_id = ?`
          ).bind(val || '', supplierId).run();
        } catch {}
      }
    }
  }

  // Intake
  const intakeId = shortId('INT-', 8);
  const i = def.intake;
  await env.DB.prepare(
    // Status 'roles_ready' lands the intake in the curator's "新提交" (new) tab,
    // matching the demo state: a partner has finished WIP and is ready for curator review.
    `INSERT INTO intakes (id, supplier_id, status, name, website, industry_hint, free_text, service_pricing_json)
     VALUES (?, ?, 'roles_ready', ?, ?, ?, ?, ?)`
  ).bind(intakeId, supplierId, i.name, i.website || null, i.industry_hint || null, i.free_text || null, JSON.stringify(i.service_pricing || {})).run();

  // Capabilities
  const capIdMap = []; // index -> id
  for (let idx = 0; idx < def.capabilities.length; idx++) {
    const c = def.capabilities[idx];
    const id = shortId('CAP-', 8);
    capIdMap.push(id);
    await env.DB.prepare(
      `INSERT INTO capabilities (id, intake_id, rc_label, name_zh, name_en, description_zh, description_en, position, source, confirmed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'supplier', 1)`
    ).bind(id, intakeId, c.rc, c.name_zh || '', c.name_en || '', c.desc_zh || '', c.desc_en || '', idx).run();
  }

  // RolePacks + capability links
  for (let idx = 0; idx < def.rolepacks.length; idx++) {
    const r = def.rolepacks[idx];
    const rpId = shortId('RP-', 8);
    await env.DB.prepare(
      `INSERT INTO rolepacks_v2 (id, intake_id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json, position, questionnaire_json, generated_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    ).bind(
      rpId, intakeId, r.rp,
      r.name_zh || '', r.name_en || '',
      JSON.stringify(r.industry || []),
      JSON.stringify(r.company_size || []),
      JSON.stringify(r.department || {}),
      idx,
      JSON.stringify(r.questionnaire || {}),
      JSON.stringify({ generated_at: new Date().toISOString(), source: 'seed' }),
    ).run();
    // capability links
    for (let pos = 0; pos < (r.capability_idx || []).length; pos++) {
      const capId = capIdMap[r.capability_idx[pos]];
      if (!capId) continue;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)`
      ).bind(rpId, capId, pos).run();
    }
  }

  return {
    key: def.key,
    supplier: { id: supplierId, name: def.name },
    user: { email: def.email, password: def.password },
    intake_id: intakeId,
    rolepack_count: def.rolepacks.length,
    capability_count: def.capabilities.length,
    aiSummary: def.aiSummary,
  };
}
