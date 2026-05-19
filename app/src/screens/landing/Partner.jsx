// Capability Partner program — dark navy section. Three benefit cards on
// frosted-glass surfaces. Brand-violet CTA + "or scan QR" supporting line.

import { t } from '../../i18n.js';
import { QRPlaceholder } from './QRPlaceholder.jsx';

export function Partner({ lang }) {
  return (
    <section className="lr-section lr-partner-section" id="partner">
      <div className="lr-container">
        <div className="lr-section-head">
          <div className="lr-left lr-fade">
            <span className="lr-section-eyebrow">{t('landing_partner_eyebrow', lang)}</span>
            <h2 className="lr-section-title">{t('landing_partner_title', lang)}</h2>
            <p className="lr-section-lede">{t('landing_partner_lede', lang)}</p>
            <p className="lr-partner-pretext">
              {t('landing_partner_p1', lang)}
              <br />
              {t('landing_partner_p2_pre', lang)}
              <br />
              <strong>{t('landing_partner_p2_strong', lang)}</strong>
            </p>
          </div>
        </div>

        <div className="lr-partner-grid">
          <div className="lr-partner-card lr-fade">
            <h4>{t('landing_partner_b1_title', lang)}</h4>
            <p>{t('landing_partner_b1_body', lang)}</p>
          </div>
          <div className="lr-partner-card lr-fade">
            <h4>{t('landing_partner_b2_title', lang)}</h4>
            <p>{t('landing_partner_b2_body', lang)}</p>
          </div>
          <div className="lr-partner-card lr-fade">
            <h4>{t('landing_partner_b3_title', lang)}</h4>
            <p>{t('landing_partner_b3_body', lang)}</p>
          </div>
        </div>

        <div className="lr-partner-cta-row lr-fade">
          <div className="lr-partner-cta-stack">
            <span className="lr-partner-q">{t('landing_partner_q', lang)}</span>
            <a href="#contact" className="lr-btn lr-btn-brand lr-btn-lg" onClick={(e) => {
              e.preventDefault();
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              {t('landing_partner_cta', lang)} <span className="lr-arrow">→</span>
            </a>
            <span className="lr-partner-or">{t('landing_partner_or', lang)}</span>
          </div>
          <QRPlaceholder onDark />
        </div>
      </div>
    </section>
  );
}
