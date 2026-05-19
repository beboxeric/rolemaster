// Contact section — info column (5 blocks with icons) + form card. Form
// falls back to alert() per the static reference; replace onSubmit with
// a real handler when the backend POST /api/contact exists.

import { useState } from 'react';
import { t } from '../../i18n.js';
import { QRPlaceholder } from './QRPlaceholder.jsx';

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </svg>
);
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconQR = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

function InfoBlock({ Icon, label, value, qr = false }) {
  return (
    <div className={'lr-info-block' + (qr ? ' lr-info-block-wide' : '')}>
      <div className="lr-info-icon"><Icon /></div>
      <div>
        <div className="lr-info-label">{label}</div>
        <div className="lr-info-value">{value}</div>
      </div>
      {qr && <QRPlaceholder />}
    </div>
  );
}

export function Contact({ lang }) {
  const onSubmit = (e) => {
    e.preventDefault();
    // Falls back to alert per HANDOFF — wire to /api/contact when available.
    alert(t('landing_form_thanks', lang));
    e.currentTarget.reset();
  };

  return (
    <section className="lr-section lr-contact-section" id="contact">
      <div className="lr-container">
        <div className="lr-section-head">
          <div className="lr-left lr-fade">
            <span className="lr-section-eyebrow">{t('landing_contact_eyebrow', lang)}</span>
            <h2 className="lr-section-title">{t('landing_contact_title', lang)}</h2>
            <p className="lr-section-lede">{t('landing_contact_lede', lang)}</p>
          </div>
        </div>

        <div className="lr-contact-wrap">
          <div className="lr-contact-info lr-fade">
            <InfoBlock Icon={IconMail}  label={t('landing_contact_email_label', lang)}  value={t('landing_contact_email_value', lang)} />
            <InfoBlock Icon={IconPhone} label={t('landing_contact_phone_label', lang)}  value={t('landing_contact_phone_value', lang)} />
            <InfoBlock Icon={IconPin}   label={t('landing_contact_loc_label', lang)}    value={t('landing_contact_loc_value', lang)} />
            <InfoBlock Icon={IconQR}    label={t('landing_contact_wechat_label', lang)} value={t('landing_contact_wechat_value', lang)} qr />
            <InfoBlock Icon={IconClock} label={t('landing_contact_hours_label', lang)}  value={t('landing_contact_hours_value', lang)} />
          </div>

          <form className="lr-contact-form lr-fade" onSubmit={onSubmit}>
            <h3>{t('landing_form_title', lang)}</h3>
            <p className="lr-form-sub">{t('landing_form_sub', lang)}</p>

            <div className="lr-row">
              <div className="lr-field">
                <label>{t('landing_form_name', lang)} <span className="lr-req">*</span></label>
                <input type="text" required placeholder={t('landing_form_name_ph', lang)} />
              </div>
              <div className="lr-field">
                <label>{t('landing_form_company', lang)} <span className="lr-req">*</span></label>
                <input type="text" required placeholder={t('landing_form_company_ph', lang)} />
              </div>
            </div>
            <div className="lr-row">
              <div className="lr-field">
                <label>{t('landing_form_role', lang)} <span className="lr-req">*</span></label>
                <input type="text" required placeholder={t('landing_form_role_ph', lang)} />
              </div>
              <div className="lr-field">
                <label>{t('landing_form_email', lang)} <span className="lr-req">*</span></label>
                <input type="email" required placeholder={t('landing_form_email_ph', lang)} />
              </div>
            </div>
            <div className="lr-row">
              <div className="lr-field">
                <label>{t('landing_form_phone', lang)}</label>
                <input type="tel" placeholder={t('landing_form_phone_ph', lang)} />
              </div>
              <div className="lr-field">
                <label>{t('landing_form_who', lang)} <span className="lr-req">*</span></label>
                <select required defaultValue="">
                  <option value="">{t('landing_form_who_ph', lang)}</option>
                  <option>{t('landing_form_who_o1', lang)}</option>
                  <option>{t('landing_form_who_o2', lang)}</option>
                  <option>{t('landing_form_who_o3', lang)}</option>
                  <option>{t('landing_form_who_o4', lang)}</option>
                </select>
              </div>
            </div>
            <div className="lr-row lr-single">
              <div className="lr-field">
                <label>{t('landing_form_rps', lang)}</label>
                <select defaultValue="">
                  <option value="">{t('landing_form_rps_ph', lang)}</option>
                  <option>{t('landing_form_rps_o1', lang)}</option>
                  <option>{t('landing_form_rps_o2', lang)}</option>
                  <option>{t('landing_form_rps_o3', lang)}</option>
                  <option>{t('landing_form_rps_o4', lang)}</option>
                  <option>{t('landing_form_rps_o5', lang)}</option>
                  <option>{t('landing_form_rps_o6', lang)}</option>
                </select>
              </div>
            </div>
            <div className="lr-row lr-single">
              <div className="lr-field">
                <label>{t('landing_form_msg', lang)}</label>
                <textarea placeholder={t('landing_form_msg_ph', lang)} />
              </div>
            </div>

            <button type="submit" className="lr-btn lr-btn-primary lr-btn-lg" style={{ width: '100%' }}>
              {t('landing_form_send', lang)} <span className="lr-arrow">→</span>
            </button>
            <div className="lr-form-foot">
              <IconLock />
              <span>{t('landing_form_foot', lang)}</span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
