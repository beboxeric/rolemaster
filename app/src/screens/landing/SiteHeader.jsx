// Sticky site header — frosted glass, switches to opaque-with-shadow on scroll.
// Uses IntersectionObserver via a sentinel rather than scroll listeners.
//
// Anchor links (#what, #catalog, …) work from anywhere: when the user is
// already on the landing, they smooth-scroll in-page; when they're on a
// sub-route like /rolepacks, they navigate back to the landing first and
// then scroll once the section mounts.
//
// On mobile (≤860px) the desktop nav-links collapse and a hamburger button
// reveals an off-canvas drawer with the same nav + login + contact CTAs.
// Body scroll is locked while the drawer is open; tapping a link, the
// backdrop, the close button, or pressing Escape closes it.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { t } from '../../i18n.js';

export function SiteHeader({ lang, setLang }) {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sentinelRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  // /, /cn, /en are all the landing — keep in-page scrolling on locale URLs.
  const onLanding = ['/', '/cn', '/en'].includes(location.pathname);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => setScrolled(!entries[0].isIntersecting),
      { rootMargin: '-12px 0px 0px 0px', threshold: 0 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Body scroll lock + Escape-to-close while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.classList.add('lr-no-scroll');
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('lr-no-scroll');
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  // Auto-close the drawer on route change (so tapping /rolepacks closes it).
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.hash]);

  // Resolve a section anchor: same-page → smooth scroll; cross-page → navigate
  // home then scroll once the destination element is in the DOM.
  const goSection = (id) => (e) => {
    e.preventDefault();
    setDrawerOpen(false);
    if (onLanding) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#' + id);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  return (
    <>
      <div ref={sentinelRef} style={{ position: 'absolute', top: 0, height: 1, width: 1 }} />
      <header className={'lr-header' + (scrolled ? ' lr-scrolled' : '')}>
        <div className="lr-container lr-nav">
          <Link to="/" className="lr-logo" aria-label="RoleMaster">
            <img src="/logos/rm-light-h.png" alt="RoleMaster" className="lr-logo-img" width="180" height="40" />
          </Link>
          <nav className="lr-nav-links" aria-label="Primary">
            <a href="/#what" onClick={goSection('what')}>{t('landing_nav_what', lang)}</a>
            <a href="/#catalog" onClick={goSection('catalog')}>{t('landing_nav_catalog', lang)}</a>
            <a href="/#capabilities" onClick={goSection('capabilities')}>{t('landing_nav_caps', lang)}</a>
            <a href="/#partner" onClick={goSection('partner')}>{t('landing_nav_partner', lang)}</a>
            <a href="/#why" onClick={goSection('why')}>{t('landing_nav_why', lang)}</a>
          </nav>
          <div className="lr-nav-cta">
            <button
              className="lr-lang-toggle"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              aria-label="Switch language"
            >
              {lang === 'zh' ? '中文' : 'EN'}
              <span className="lr-lang-chevron" aria-hidden="true">▾</span>
            </button>
            <Link to="/partners" className="lr-nav-login-btn">
              {t('landing_nav_partner_login', lang)}
            </Link>
            <button
              className="lr-menu-toggle"
              type="button"
              aria-expanded={drawerOpen ? 'true' : 'false'}
              aria-controls="lr-mobile-drawer"
              aria-label={lang === 'zh' ? '菜单' : 'Menu'}
              onClick={() => setDrawerOpen(true)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="13" x2="20" y2="13" />
                <line x1="4" y1="19" x2="20" y2="19" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div
        className={'lr-mobile-drawer-backdrop' + (drawerOpen ? ' is-open' : '')}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        id="lr-mobile-drawer"
        className={'lr-mobile-drawer' + (drawerOpen ? ' is-open' : '')}
        aria-hidden={drawerOpen ? 'false' : 'true'}
      >
        <div className="lr-mobile-drawer-head">
          <Link to="/" className="lr-logo" aria-label="RoleMaster" onClick={() => setDrawerOpen(false)}>
            <img src="/logos/rm-light-h.png" alt="RoleMaster" className="lr-logo-img lr-logo-img-drawer" width="200" height="44" />
          </Link>
          <button
            className="lr-menu-close"
            type="button"
            aria-label={lang === 'zh' ? '关闭菜单' : 'Close menu'}
            onClick={() => setDrawerOpen(false)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="lr-mobile-drawer-links" aria-label={lang === 'zh' ? '主导航' : 'Primary'}>
          <a href="/#what" onClick={goSection('what')}>{t('landing_nav_what', lang)}</a>
          <a href="/#catalog" onClick={goSection('catalog')}>{t('landing_nav_catalog', lang)}</a>
          <a href="/#capabilities" onClick={goSection('capabilities')}>{t('landing_nav_caps', lang)}</a>
          <a href="/#partner" onClick={goSection('partner')}>{t('landing_nav_partner', lang)}</a>
          <a href="/#why" onClick={goSection('why')}>{t('landing_nav_why', lang)}</a>
        </nav>
        <div className="lr-mobile-drawer-foot">
          <Link
            to="/partners"
            className="lr-btn lr-btn-secondary lr-btn-block"
            onClick={() => setDrawerOpen(false)}
          >
            {t('landing_nav_partner_login', lang)}
          </Link>
          <a
            href="/#contact"
            className="lr-btn lr-btn-primary lr-btn-block"
            onClick={goSection('contact')}
          >
            {lang === 'zh' ? '联系我们' : 'Contact us'}
          </a>
          <button
            className="lr-lang-toggle lr-btn-block"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ marginTop: 4 }}
          >
            {lang === 'zh' ? '中文 / English' : 'English / 中文'}
          </button>
        </div>
      </aside>
    </>
  );
}
