// Site footer — dark navy, 4-column (brand + 3 link columns) + bottom strip.
// Mirrors the static reference verbatim.

import { t } from '../../i18n.js';

export function SiteFooter({ lang }) {
  return (
    <footer className="lr-footer">
      <div className="lr-container">
        <div className="lr-footer-top">
          <div className="lr-footer-brand">
            {/* Dark vertical variant — the footer sits on #0A0E27 navy, so the
                light lockup's black wordmark would be unreadable here. */}
            <a href="#top" className="lr-logo lr-logo-footer" aria-label="RoleMaster">
              <img src="/logos/rm-dark-v.png" alt="RoleMaster" className="lr-logo-img-footer" width="120" height="80" />
            </a>
            <p>{t('landing_footer_brand_tag', lang)}</p>
          </div>
          <div className="lr-footer-col">
            <h5>{t('landing_footer_col_product', lang)}</h5>
            <ul>
              <li><a href="#what">{t('landing_nav_what', lang)}</a></li>
              <li><a href="#catalog">{t('landing_nav_catalog', lang)}</a></li>
              <li><a href="#capabilities">{t('landing_nav_caps', lang)}</a></li>
            </ul>
          </div>
          <div className="lr-footer-col">
            <h5>{t('landing_footer_col_partner', lang)}</h5>
            <ul>
              <li><a href="#partner">{t('landing_partner_eyebrow', lang)}</a></li>
              <li><a href="#why">{t('landing_nav_why', lang)}</a></li>
            </ul>
          </div>
          <div className="lr-footer-col">
            <h5>{t('landing_footer_col_contact', lang)}</h5>
            <ul>
              <li><a href={'mailto:' + t('landing_contact_email_value', lang)}>{t('landing_contact_email_value', lang)}</a></li>
              <li><a href="#contact">{t('landing_footer_link_form', lang)}</a></li>
              <li>{t('landing_contact_phone_value', lang)}</li>
            </ul>
          </div>
        </div>
        <div className="lr-footer-bottom">
          <span>{t('landing_footer_copy', lang)}</span>
          <span>{t('landing_footer_tagline', lang)}</span>
          <a href="https://airolemaster.com/curators" className="lr-footer-curator-link">
            {t('landing_footer_curator_login', lang)} →
          </a>
        </div>
      </div>
    </footer>
  );
}
