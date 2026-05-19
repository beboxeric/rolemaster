// Why RoleMaster — 4 cards in a 2×2 grid (single column on mobile).
// Cyan mono numerals, gradient left border on hover.

import { t } from '../../i18n.js';

const CARDS = [
  { num: '01', titleKey: 'landing_why_c1_title', bodyKey: 'landing_why_c1_body' },
  { num: '02', titleKey: 'landing_why_c2_title', bodyKey: 'landing_why_c2_body' },
  { num: '03', titleKey: 'landing_why_c3_title', bodyKey: 'landing_why_c3_body' },
  { num: '04', titleKey: 'landing_why_c4_title', bodyKey: 'landing_why_c4_body' },
];

export function Why({ lang }) {
  return (
    <section className="lr-section" id="why">
      <div className="lr-container">
        <div className="lr-section-head">
          <div className="lr-left lr-fade">
            <span className="lr-section-eyebrow">{t('landing_why_eyebrow', lang)}</span>
            <h2 className="lr-section-title">{t('landing_why_title', lang)}</h2>
            <p className="lr-section-lede">{t('landing_why_lede', lang)}</p>
          </div>
        </div>
        <div className="lr-why-grid">
          {CARDS.map(c => (
            <div key={c.num} className="lr-why-card lr-fade">
              <div className="lr-why-num">{c.num}</div>
              <h4>{t(c.titleKey, lang)}</h4>
              <p>{t(c.bodyKey, lang)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
