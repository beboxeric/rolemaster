// Hero — gradient mesh background + grid overlay, eyebrow pill, gradient
// "让 AI," text + dark "第一天就能上岗。", product name with divider,
// lede with bold inline strong, single primary CTA scrolling to #what.

import { t } from '../../i18n.js';

export function Hero({ lang }) {
  return (
    <section className="lr-hero" id="top">
      <div className="lr-hero-bg" aria-hidden="true"></div>
      <div className="lr-container">
        <span className="lr-eyebrow">
          <span className="lr-dot"></span>{t('landing_hero_eyebrow', lang)}
        </span>
        <h1>
          <span className="lr-grad-text">{t('landing_hero_title_grad', lang)}</span>
          <br />
          {t('landing_hero_title_rest', lang)}
        </h1>
        <div className="lr-product-name">
          <span>RoleMaster</span>
          <span className="lr-pn-divider"></span>
          <span className="lr-pn-zh">{t('landing_hero_pn_zh', lang)}</span>
        </div>
        <p className="lr-lede">
          {t('landing_hero_lede_pre', lang)}
          <strong>{t('landing_hero_lede_strong', lang)}</strong>
          {t('landing_hero_lede_post', lang)}
        </p>
        <p className="lr-lede lr-lede-2">
          {t('landing_hero_lede_p2', lang)}
        </p>
        <div className="lr-cta-row">
          <a href="#what" className="lr-btn lr-btn-primary lr-btn-lg">
            {t('landing_hero_cta', lang)}
          </a>
        </div>
      </div>
    </section>
  );
}
