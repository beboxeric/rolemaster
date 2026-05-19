// Capabilities — 6 categorized columns. Each capability list is a stable
// canonical list (matches the static reference). Items themselves are
// mostly Chinese tech-term strings; bilingual at the column level via
// the title key + per-item zh/en pairs.

import { t } from '../../i18n.js';

const CAPS = [
  {
    titleKey: 'landing_caps_c1_title',
    items: [
      { zh: '多渠道客户消息整合(微信、WhatsApp、邮件)',         en: 'Multi-channel customer messaging (WeChat, WhatsApp, email)' },
      { zh: '客户问询自然语言理解',                                en: 'NLU for customer inquiries' },
      { zh: '自动回复草稿生成',                                    en: 'Automated reply drafting' },
      { zh: '多轮对话与上下文理解',                                en: 'Multi-turn dialog with context' },
      { zh: '客户情绪识别',                                        en: 'Customer sentiment detection' },
      { zh: '多语言切换(简中、繁中、英文)',                       en: 'Multi-language switching (zh-CN, zh-TW, EN)' },
    ],
  },
  {
    titleKey: 'landing_caps_c2_title',
    items: [
      { zh: '证照图片 OCR 识别',          en: 'Document image OCR' },
      { zh: '证照真伪 AI 判定',           en: 'AI-driven document authenticity' },
      { zh: '文档库智能检索',             en: 'Document library smart search' },
      { zh: '多格式文档解析(PDF、Word、PPT)', en: 'Multi-format parsing (PDF, Word, PPT)' },
      { zh: '报告自动生成',               en: 'Automated report generation' },
      { zh: '文档摘要与要点提取',          en: 'Document summarization & key points' },
    ],
  },
  {
    titleKey: 'landing_caps_c3_title',
    items: [
      { zh: '活体检测与人脸识别',           en: 'Liveness detection & facial recognition' },
      { zh: '受益人多级穿透',              en: 'Multi-level UBO traversal' },
      { zh: '关系图谱计算',                en: 'Relationship graph computation' },
      { zh: '对手方画像分析',              en: 'Counterparty profiling' },
      { zh: 'AI 模糊匹配(适用于名单筛查)', en: 'AI fuzzy matching (sanctions screening)' },
      { zh: '多维风险评级',                en: 'Multi-dimensional risk rating' },
    ],
  },
  {
    titleKey: 'landing_caps_c4_title',
    items: [
      { zh: '全球制裁名单实时同步',                  en: 'Real-time global sanctions list sync' },
      { zh: '反洗钱模型(规则引擎 + CNN/LSTM 双模)',  en: 'AML model (rules engine + CNN/LSTM)' },
      { zh: '异动归因与 AI 智审',                    en: 'Anomaly attribution & AI-assisted review' },
      { zh: '监管政策日度抓取',                      en: 'Daily regulatory policy crawling' },
      { zh: '监管政策影响分析',                      en: 'Regulatory impact analysis' },
      { zh: 'BRRA 自评估',                          en: 'BRRA self-assessment' },
      { zh: 'SAR 智能报告生成',                      en: 'Intelligent SAR generation' },
    ],
  },
  {
    titleKey: 'landing_caps_c5_title',
    items: [
      { zh: '行程信息提取与日历写入',         en: 'Itinerary extraction & calendar writing' },
      { zh: '餐厅 / 会议预订',               en: 'Restaurant / meeting booking' },
      { zh: '项目状态跟踪',                  en: 'Project status tracking' },
      { zh: 'AI 项目周报',                  en: 'AI-generated weekly reports' },
      { zh: '会议录音转写与摘要',             en: 'Meeting recording transcription & summary' },
      { zh: '文档库搜索与公开链接分享',        en: 'Document search & shareable links' },
    ],
  },
  {
    titleKey: 'landing_caps_c6_title',
    items: [
      { zh: '银行间报文(SWIFT、ISO 20022、CIPS、FPS)',  en: 'Inter-bank messaging (SWIFT, ISO 20022, CIPS, FPS)' },
      { zh: '企业 ERP 对接',                            en: 'Enterprise ERP integration' },
      { zh: 'CRM 系统对接',                              en: 'CRM system integration' },
      { zh: '协同平台对接(飞书、钉钉、企业微信)',         en: 'Collab platforms (Lark, DingTalk, WeCom)' },
      { zh: '风险管理系统对接',                          en: 'Risk management system integration' },
      { zh: '私有化部署架构',                            en: 'Private deployment architecture' },
    ],
  },
];

export function Capabilities({ lang }) {
  return (
    <section className="lr-section lr-caps-section" id="capabilities">
      <div className="lr-container">
        <div className="lr-section-head">
          <div className="lr-left lr-fade">
            <span className="lr-section-eyebrow">{t('landing_caps_eyebrow', lang)}</span>
            <h2 className="lr-section-title">{t('landing_caps_title', lang)}</h2>
            {t('landing_caps_lede', lang).split('\n\n').map((para, i) => (
              <p key={i} className="lr-section-lede">{para}</p>
            ))}
          </div>
        </div>

        <div className="lr-caps-grid">
          {CAPS.map((cat, i) => (
            <div key={i} className="lr-cap lr-fade">
              <div className="lr-cap-head">
                <span className="lr-cap-num">{String(i + 1).padStart(2, '0')}</span>
                <h4>{t(cat.titleKey, lang)}</h4>
              </div>
              <ul className="lr-cap-list">
                {cat.items.map((it, j) => (
                  <li key={j}>{lang === 'zh' ? it.zh : it.en}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="lr-section-coda lr-fade">
          {t('landing_caps_coda_pre', lang)}
          <a href="#contact" onClick={(e) => {
            e.preventDefault();
            document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
          }}>{t('landing_caps_coda_link', lang)}</a>
        </p>
      </div>
    </section>
  );
}
