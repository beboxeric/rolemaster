// Coming-soon roadmap pill grid. Renders inside the Catalog <section>
// (no own <section> wrapper), so there's no inter-section padding gap
// between the catalog cards and the dark roadmap card above it.

import { t } from '../../i18n.js';

const PILLS = [
  { id: 'RP-FRAUD',  zh: '欺诈识别',           en: 'Fraud Detection' },
  { id: 'RP-FIN',    zh: '财务自动化',         en: 'Finance Automation' },
  { id: 'RP-SC',     zh: '供应链协同',         en: 'Supply Chain' },
  { id: 'RP-HR',     zh: 'HR 招聘与员工服务',  en: 'HR & Employee Services' },
  { id: 'RP-LEGAL',  zh: '法务合同',           en: 'Legal & Contracts' },
  { id: 'RP-CS',     zh: '客户服务',           en: 'Customer Service' },
];

export function Roadmap({ lang }) {
  return (
    <div className="lr-roadmap lr-fade" aria-label="Roadmap">
      <div className="lr-roadmap-head">
        <h3>{t('landing_roadmap_title', lang)}</h3>
        <span className="lr-roadmap-badge">{t('landing_roadmap_badge', lang)}</span>
      </div>
      <div className="lr-roadmap-grid">
        {PILLS.map(p => (
          <div key={p.id} className="lr-roadmap-pill">
            <div className="lr-id">{p.id}</div>
            <div className="lr-name">{lang === 'zh' ? p.zh : p.en}</div>
          </div>
        ))}
      </div>
      <div className="lr-roadmap-foot">
        <span>{t('landing_roadmap_q', lang)}</span>
        <a href="#catalog">{t('landing_roadmap_all', lang)}</a>
        <span>·</span>
        <a href="#contact" onClick={(e) => {
          e.preventDefault();
          document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
        }}>{t('landing_roadmap_tellus', lang)}</a>
      </div>
    </div>
  );
}
