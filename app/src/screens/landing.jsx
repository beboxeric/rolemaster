// Public landing page — composition root for the marketing redesign.
// Sections live in ./landing/. Mirrors the static reference at
// marketing-redesign/index.html with React + bilingual zh/en + scroll
// reveals via IntersectionObserver. Toggles html.lr-active while
// mounted so the global app stepper / platform background are
// suppressed and the page can take over.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SiteHeader }     from './landing/SiteHeader.jsx';
import { Hero }           from './landing/Hero.jsx';
import { WhatIsRolePack } from './landing/WhatIsRolePack.jsx';
import { Catalog }        from './landing/Catalog.jsx';
import { Capabilities }   from './landing/Capabilities.jsx';
import { Partner }        from './landing/Partner.jsx';
import { Why }            from './landing/Why.jsx';
import { Contact }        from './landing/Contact.jsx';
import { SiteFooter }     from './landing/SiteFooter.jsx';

export function ScreenLanding({ lang, setLang }) {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add('lr-active');
    return () => document.documentElement.classList.remove('lr-active');
  }, []);

  // Scroll to a hash anchor (#contact, #catalog, …) after the section mounts.
  // React Router doesn't auto-scroll on hash; without this, links from
  // /rolepacks → /#contact land at the top of the page instead of scrolling
  // to the contact section.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    // Two attempts: first synchronous (in case the section is already in DOM),
    // then a delayed one once IntersectionObserver / images settle.
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    tryScroll();
    const t = setTimeout(tryScroll, 120);
    return () => clearTimeout(t);
  }, [location.hash]);

  // Scroll-reveal — single shared observer across all .lr-fade nodes.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = document.querySelectorAll('.lr-fade');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('lr-in');
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    targets.forEach(el => obs.observe(el));
    // Stagger reveals within grids by setting per-child transition-delay.
    document.querySelectorAll(
      '.lr-layers, .lr-catalog-grid, .lr-caps-grid, .lr-why-grid, .lr-partner-grid, .lr-roadmap-grid'
    ).forEach(grid => {
      Array.from(grid.children).forEach((child, i) => {
        child.style.transitionDelay = (i * 60) + 'ms';
      });
    });
    return () => obs.disconnect();
  }, [lang]);

  return (
    <div className="lr-root">
      <SiteHeader lang={lang} setLang={setLang} />
      <main>
        <Hero lang={lang} />
        <WhatIsRolePack lang={lang} />
        <Catalog lang={lang} />
        <Capabilities lang={lang} />
        <Partner lang={lang} />
        <Why lang={lang} />
        <Contact lang={lang} />
      </main>
      <SiteFooter lang={lang} />
      <BackToTop />
    </div>
  );
}

// Mobile-only back-to-top: fades in after the user has scrolled past 800px.
// Hidden at desktop via CSS @media (min-width: 861px).
function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const tick = () => setVisible(window.scrollY > 800);
    tick();
    window.addEventListener('scroll', tick, { passive: true });
    return () => window.removeEventListener('scroll', tick);
  }, []);
  return (
    <button
      type="button"
      className={'lr-to-top' + (visible ? ' is-visible' : '')}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 14l6-6 6 6" />
      </svg>
    </button>
  );
}
