// GET /api/curator/seed-summaries — returns the canned AI summaries +
// semantic-code suggestions for the 3 demo intakes. Client pre-populates
// localStorage so curators see them instantly without waiting for Qwen.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const { results } = await context.env.DB.prepare(`
    SELECT i.id AS intake_id, i.name, s.short_name, s.name AS supplier_name
    FROM intakes i
    JOIN suppliers s ON s.id = i.supplier_id
  `).all();

  const summaries = {};
  const semantics = {};

  for (const row of results || []) {
    const def = SUMMARIES[row.short_name] || matchByName(row);
    if (def) {
      summaries[row.intake_id] = {
        summary_zh: def.zh,
        summary_en: def.en,
        generated_at: new Date().toISOString(),
      };
    }

    // Canned semantic codes — strict role/cap function; never brand.
    const map = SEMANTIC_BY_SUPPLIER[matchKey(row)];
    if (!map) continue;

    // Look up live RP/RC ids so we can write the overlay map.
    const rps = await context.env.DB.prepare(
      'SELECT id, rp_label FROM rolepacks_v2 WHERE intake_id = ? ORDER BY position'
    ).bind(row.intake_id).all();
    const rcs = await context.env.DB.prepare(
      'SELECT id, rc_label FROM capabilities WHERE intake_id = ? ORDER BY position'
    ).bind(row.intake_id).all();

    const rp = {}, rc = {};
    for (const r of rps.results || []) {
      if (map.rp[r.rp_label]) rp[r.id] = map.rp[r.rp_label];
    }
    for (const c of rcs.results || []) {
      if (map.rc[c.rc_label]) rc[c.id] = map.rc[c.rc_label];
    }
    semantics[row.intake_id] = { rp, rc };
  }

  return json({ summaries, semantics });
}

function matchKey(row) {
  if (/aurora|vision/i.test(row.supplier_name + row.name)) return 'Aurora Vision';
  if (/vigil/i.test(row.supplier_name + row.name)) return 'Vigil Advisory';
  if (/wizbank/i.test(row.supplier_name + row.name)) return 'WizBank';
  return null;
}

// Semantic codes are derived from role / capability function only.
// Unique within each intake. NEVER includes the supplier brand.
// Suffix is max 5 characters — RP-XXXXX / RC-XXXXX.
const SEMANTIC_BY_SUPPLIER = {
  'Aurora Vision': {
    rp: { 'RP-01': 'RP-VLEAD', 'RP-02': 'RP-BAM' },
    rc: {
      'RC-01': 'RC-PDP',
      'RC-02': 'RC-AVTR',
      'RC-03': 'RC-MICRO',
      'RC-04': 'RC-LFP',
      'RC-05': 'RC-SKU',
    },
  },
  'Vigil Advisory': {
    rp: { 'RP-01': 'RP-AML', 'RP-02': 'RP-EDD', 'RP-03': 'RP-STR' },
    rc: {
      'RC-01': 'RC-ALERT',
      'RC-02': 'RC-EDDDR',
      'RC-03': 'RC-UBO',
      'RC-04': 'RC-STRDR',
      'RC-05': 'RC-RISK',
      'RC-06': 'RC-AUDIT',
    },
  },
  'WizBank': {
    rp: { 'RP-01': 'RP-RM', 'RP-02': 'RP-QA' },
    rc: {
      'RC-01': 'RC-COACH',
      'RC-02': 'RC-CHURN',
      'RC-03': 'RC-NBP',
      'RC-04': 'RC-DASH',
      'RC-05': 'RC-TRX',
    },
  },
};

function matchByName(row) {
  if (/aurora|vision/i.test(row.supplier_name + row.name)) return SUMMARIES['Aurora Vision'];
  if (/vigil/i.test(row.supplier_name + row.name)) return SUMMARIES['Vigil Advisory'];
  if (/wizbank/i.test(row.supplier_name + row.name)) return SUMMARIES['WizBank'];
  return null;
}

// Compact narrative summaries — paragraph intro + key highlights + pain
// points + follow-up questions. Do NOT re-list the RolePacks/RoleCapabilities
// (they appear in their own sections below). Keep total height short.
const SUMMARIES = {
  'Aurora Vision': {
    zh: `这是一款 **AI 电商视觉自动化平台**,主打把传统 5–7 天的电商详情页生产周期压缩到 15 分钟内完成。能力伙伴上传商品白底图后,系统自动完成场景融入、虚拟模特生成、光影渲染与排版,直接产出可投放的长图。

🌟 **关键亮点**
- 单 SKU 上新成本与周期同时下降 60%+,旺季供给不再卡在摄影档期
- 永久买断的虚拟代言人面孔,跨平台保持品牌一致性,消除肖像权风险

💡 **解决的痛点**
跨境头部卖家(SHEIN/TEMU)在旺季面临"模特档期排不开 + 视觉风格漂移 + 上新跟不上选品速度"的三角问题。

❓ **建议追问**
- 与品牌方现有 PIM/DAM、ICC 色彩管理的对接深度?
- 私有化部署的 SLA、数据治理细节、训练数据所有权?
- 头部客户的实际节省金额、流失率,有没有书面案例?`,
    en: `An **AI e-commerce visual automation platform** that compresses traditional 5–7 day product-detail-page production into roughly 15 minutes. Partners upload white-background product shots; the system handles scene composition, virtual models, lighting, and layout, outputting launch-ready long-form pages.

🌟 **Key highlights**
- Per-SKU launch cost and cycle both drop 60%+, removing the photography-schedule bottleneck during peak seasons
- Permanently licensed virtual spokesperson faces give cross-platform brand consistency without likeness risk

💡 **Pain point addressed**
Cross-border top sellers (SHEIN/TEMU) are stuck on "no model availability + style drift + launch can't keep up with merchandising" during peak windows.

❓ **Questions to probe**
- Depth of integration with brand-side PIM/DAM and ICC colour management?
- Private deployment SLA, data governance, training-data ownership?
- Real $-savings + churn at flagship customers — any written case studies?`,
  },
  'Vigil Advisory': {
    zh: `**面向香港持牌银行与虚拟资产平台的合规副驾**,覆盖反洗钱告警初审 → 加强尽调(EDD)起草 → 可疑交易报告(STR)起草的端到端链路。重点在把合规人员的人均处理时间砍掉 60%+,同时保持监管口径合规。

🌟 **关键亮点**
- 单条告警平均处理时间 18 → 6 分钟;EDD 报告 16 小时 → 4 小时
- 所有 AI 决策保留可追溯证据链,支持监管问询时一键导出

💡 **解决的痛点**
持牌银行合规人员被告警量淹没(单日 200+),需在 5–7 个系统之间来回切换,真阳性识别率与 SLA 双双承压;复杂股权结构 UBO 难以人工穿透。

❓ **建议追问**
- 私有化部署在银行内网的合规审计周期(IT/Risk/MLRO 流程)?
- 与 Actimize/SAS/Oracle Mantas 接口的生产稳定性?
- 数据出境与训练数据隔离细节(香港 vs 海外)?`,
    en: `A **compliance co-pilot for HK-licensed banks and virtual-asset platforms** covering the end-to-end loop: AML alert triage → enhanced due diligence (EDD) drafting → suspicious transaction report (STR) drafting. The pitch is cutting per-officer handling time by 60%+ while staying inside regulator-acceptable language.

🌟 **Key highlights**
- Per-alert handling 18 → 6 min; EDD reports 16 → 4 hours
- Every AI decision keeps a traceable evidence chain — one-click export for regulator inquiries

💡 **Pain point addressed**
Bank compliance teams drown in 200+ alerts/day, flip between 5–7 systems per case, and miss SLAs; complex ownership structures are hard to drill manually to natural-person UBO.

❓ **Questions to probe**
- On-prem rollout timeline through IT/Risk/MLRO governance?
- Production stability of Actimize/SAS/Oracle Mantas connectors?
- Cross-border data residency + training-data isolation (HK vs overseas)?`,
  },
  'WizBank': {
    zh: `面向**东南亚零售银行**的支行 + 客服中心智能化套件。基于 NLP 与客户行为模型,在客户经理对话中实时给出推荐话术、流失预警、产品匹配;在客服中心做全量通话转写、合规检查、QA 评分。

🌟 **关键亮点**
- 试点支行的交叉销售收入提升 28%、新人客户经理上手周期 3 个月 → 4 周
- 客服中心抽样覆盖率 4% → 100%,合规缺陷率下降 31%

💡 **解决的痛点**
零售银行 RM 产品掌握深度参差、HNW 客户细节难记、QA 抽样覆盖率低导致合规盲点;多语言客服在印尼/越南等小语种 QA 成本高。

❓ **建议追问**
- 与本地 CRM(国产/区域)集成深度,具体连接器是否预置?
- 印尼、越南的数据残留与本地化合规?
- 越南语等小语种 ASR 准确率有无独立基准?`,
    en: `A **branch + contact-center intelligence suite for SEA retail banks**. NLP and customer-behaviour models give relationship managers live coaching, attrition alerts, and product-match suggestions in conversation; the contact center gets full transcription, compliance scoring, and QA on every call.

🌟 **Key highlights**
- Pilot branches: cross-sell revenue +28%; new-RM ramp 3 months → 4 weeks
- Call-center sampling coverage 4% → 100%; compliance defects down 31%

💡 **Pain point addressed**
RM product knowledge varies, HNW client details are hard to recall, and QA sampling at 3–5% leaves compliance blind spots; multilingual QA in ID/VI is expensive to staff.

❓ **Questions to probe**
- Depth of integration with regional CRM stacks — which connectors are pre-built?
- Data residency + local compliance for Indonesia and Vietnam?
- Independent benchmark for low-resource ASR (e.g. Vietnamese)?`,
  },
};
