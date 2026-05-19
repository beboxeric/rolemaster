// What is a RolePack — three layered cards (Capability / Knowledge / Interface)
// with mono numeric tags, soft-gradient icon tiles, and a hover lift with
// gradient top stripe. Ends with a section coda.

import { t } from '../../i18n.js';

const IconCapability = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#lr-cap)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      <linearGradient id="lr-cap" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#7C5BD9" />
        <stop offset="1" stopColor="#29C5D9" />
      </linearGradient>
    </defs>
    <path d="M14 4l-3 9h6l-3 8" />
  </svg>
);

const IconKnowledge = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#lr-know)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      <linearGradient id="lr-know" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#7C5BD9" />
        <stop offset="1" stopColor="#29C5D9" />
      </linearGradient>
    </defs>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
    <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
  </svg>
);

const IconInterface = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#lr-int)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs>
      <linearGradient id="lr-int" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#7C5BD9" />
        <stop offset="1" stopColor="#29C5D9" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <path d="M14 7h-4M7 14v-4M14 7l3-3M10 14l-3 3" />
  </svg>
);

function Layer({ num, Icon, name, en, body }) {
  return (
    <div className="lr-layer lr-fade">
      <span className="lr-layer-num">{num}</span>
      <div className="lr-layer-icon" aria-hidden="true"><Icon /></div>
      <h3>{name} <span className="lr-en">{en}</span></h3>
      <p>{body}</p>
    </div>
  );
}

export function WhatIsRolePack({ lang }) {
  return (
    <section id="what" className="lr-section">
      <div className="lr-container">
        <div className="lr-section-head">
          <div className="lr-left lr-fade">
            <span className="lr-section-eyebrow">{t('landing_what_eyebrow', lang)}</span>
            <h2 className="lr-section-title">{t('landing_what_title', lang)}</h2>
            {t('landing_what_lede', lang).split('\n\n').map((para, i) => (
              <p key={i} className="lr-section-lede">{para}</p>
            ))}
          </div>
        </div>
        <div className="lr-layers">
          <Layer num="01" Icon={IconCapability}
            name={t('landing_what_l1_name', lang)}
            en={t('landing_what_l1_en', lang)}
            body={t('landing_what_l1_desc', lang)} />
          <Layer num="02" Icon={IconKnowledge}
            name={t('landing_what_l2_name', lang)}
            en={t('landing_what_l2_en', lang)}
            body={t('landing_what_l2_desc', lang)} />
          <Layer num="03" Icon={IconInterface}
            name={t('landing_what_l3_name', lang)}
            en={t('landing_what_l3_en', lang)}
            body={t('landing_what_l3_desc', lang)} />
        </div>
        <p className="lr-section-coda lr-fade">{t('landing_what_coda', lang)}</p>
      </div>
    </section>
  );
}
