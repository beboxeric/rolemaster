// RoleMaster — three role-separated portals: supplier / curator / sales.
// No shared screen-picker dock. Each portal has its own entry, login, and home.

import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate, Link } from 'react-router-dom';
import { getPlatformSteps, StepperContext } from './chrome.jsx';
import { ScreenLanding } from './screens/landing.jsx';
import { ScreenRolepackCatalog } from './screens/rolepack-catalog.jsx';
import { ScreenPortalLogin } from './screens/portal-login.jsx';
import { ScreenSupplierHome } from './screens/supplier-home.jsx';
import { ScreenV2Register } from './screens/v2/register.jsx';
import { ScreenV2CompanySetup } from './screens/v2/company-setup.jsx';
import { ScreenV2Onboard } from './screens/v2/onboard.jsx';
import { ScreenV2Capabilities } from './screens/v2/capabilities.jsx';
import { ScreenV2Roles } from './screens/v2/roles.jsx';
import { ScreenV2RoleDetails } from './screens/v2/role-details.jsx';
import { ScreenV2ServicePricing } from './screens/v2/service-pricing.jsx';
import { ScreenV2Review } from './screens/v2/review.jsx';
import { ScreenV2Done } from './screens/v2/done.jsx';
import { ScreenQueue, ScreenWorkbench, ScreenPublish } from './screens/other.jsx';
import { ScreenSupplierMgmt, ScreenSupplierDetail } from './screens/suppliers-mgmt.jsx';
import { ScreenUserMgmt } from './screens/users-mgmt.jsx';
import { ScreenCuratorLibrary } from './screens/curator-library.jsx';
import { ScreenTerms, ScreenPrivacy } from './screens/legal.jsx';
import { isSuperadmin } from './auth.jsx';
import { ScreenV2SalesLibrary, ScreenV2SalesRolepack } from './screens/v2/sales-library.jsx';
import { useTweaks } from './tweaks.jsx';
import { AuthProvider, useAuth, ImpersonationBanner } from './auth.jsx';

const TWEAK_DEFAULTS = {
  supplierColor: '#4DAC77',
  curatorColor: '#8B5CF6',
  salesColor: '#3B82F6',
  supplierGradient: 'b',
  density: 'normal',
  warmth: 'neutral',
  roundness: 'soft',
  font: 'inter',
  showStepper: true,
};

function tint(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (c) => Math.round(c + (255 - c) * amt);
  const x = (n) => n.toString(16).padStart(2, '0');
  return '#' + x(m(r)) + x(m(g)) + x(m(b));
}
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const m = (c) => Math.round(c * (1 - amt));
  const x = (n) => n.toString(16).padStart(2, '0');
  return '#' + x(m(r)) + x(m(g)) + x(m(b));
}

// Map a route to (platform, screenId, showStepper).
// Stepper appears only on workflow steps — not on dashboards or login pages.
function routeMeta(pathname) {
  // Capability Partner (URL: /partners). JWT role + DB column stay 'supplier'.
  if (pathname === '/partners/register')              return { platform: 'supplier', screen: 'register', stepper: true, requiresAuth: false };
  if (pathname === '/partners/company-setup')         return { platform: 'supplier', screen: null,       stepper: false, requiresAuth: 'supplier' };
  if (pathname === '/partners/onboard')               return { platform: 'supplier', screen: 'onboard',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/onboard\/[^/]+$/.test(pathname))  return { platform: 'supplier', screen: 'onboard',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/capabilities$/.test(pathname)) return { platform: 'supplier', screen: 'capabilities', stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/roles$/.test(pathname))         return { platform: 'supplier', screen: 'roles',        stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/role\/[^/]+\/details$/.test(pathname)) return { platform: 'supplier', screen: 'details', stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/service-pricing$/.test(pathname)) return { platform: 'supplier', screen: 'pricing', stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/review$/.test(pathname))         return { platform: 'supplier', screen: 'review',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/partners\/intake\/[^/]+\/done$/.test(pathname))           return { platform: 'supplier', screen: 'done',    stepper: true, requiresAuth: 'supplier' };
  // Capability Partner dashboard
  if (pathname === '/partners')                        return { platform: 'supplier', screen: null,      stepper: false, requiresAuth: false };
  // Curator
  if (pathname === '/curators')                         return { platform: 'curator', screen: null, stepper: false, requiresAuth: false };
  if (pathname.startsWith('/curators/intake/'))         return { platform: 'curator', screen: null, stepper: false, requiresAuth: 'curator' };
  // Sales
  if (pathname === '/advisors')                           return { platform: 'sales', screen: null, stepper: false, requiresAuth: false };
  if (pathname.startsWith('/advisors/rolepack/'))         return { platform: 'sales', screen: null, stepper: false, requiresAuth: 'sales' };
  // Public
  return { platform: null, screen: null, stepper: false, requiresAuth: false };
}

function AppShell() {
  // Landing-locale URL takes precedence over saved preference so a /en or
  // /cn link shared externally always renders that language. Otherwise fall
  // back to localStorage, defaulting to 'zh' for first-time visitors —
  // airolemaster.com without a path defaults to Chinese.
  const [lang, setLangRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/cn') return 'zh';
      if (window.location.pathname === '/en') return 'en';
    }
    if (typeof localStorage === 'undefined') return 'zh';
    const stored = localStorage.getItem('rm_lang');
    return stored === 'en' || stored === 'zh' ? stored : 'zh';
  });
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Keep lang state in sync with explicit /cn or /en URL segments without
  // touching localStorage — only the toggle (setLang below) saves a
  // preference, so a /en link shared with a Chinese-default user shows
  // English for that visit but doesn't override their saved preference.
  useEffect(() => {
    if (location.pathname === '/cn' && lang !== 'zh') setLangRaw('zh');
    else if (location.pathname === '/en' && lang !== 'en') setLangRaw('en');
  }, [location.pathname]);

  // T4.3 — persist locally + server-side for logged-in users.
  // On a landing locale route, mirror the toggle into the URL so the
  // current locale stays bookmarkable / shareable.
  const setLang = (next) => {
    setLangRaw(next);
    try { localStorage.setItem('rm_lang', next); } catch {}
    if (user) {
      // Fire-and-forget; failure shouldn't block the UI.
      fetch('/api/auth/me/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ language: next }),
      }).catch(() => {});
    }
    const p = location.pathname;
    if (p === '/' || p === '/cn' || p === '/en') {
      const target = next === 'en' ? '/en' : '/cn';
      if (p !== target) navigate(target);
    }
  };

  // T4.3 — when user logs in, hydrate from their server-side preference.
  useEffect(() => {
    if (!user?.language) return;
    if (user.language !== lang && (user.language === 'zh' || user.language === 'en')) {
      setLangRaw(user.language);
      try { localStorage.setItem('rm_lang', user.language); } catch {}
    }
  }, [user?.id]);

  // Apply CSS variables for the platform theme.
  useEffect(() => {
    const root = document.documentElement;
    const sup = tweaks.supplierColor || '#6FA577';
    const cur = tweaks.curatorColor || '#8E7AB5';
    const sal = tweaks.salesColor || '#6E9CC9';
    root.style.setProperty('--plat-supplier', sup);
    root.style.setProperty('--plat-supplier-2', shade(sup, 0.18));
    root.style.setProperty('--plat-supplier-tint', tint(sup, 0.92));
    root.style.setProperty('--plat-curator', cur);
    root.style.setProperty('--plat-curator-2', shade(cur, 0.18));
    root.style.setProperty('--plat-curator-tint', tint(cur, 0.92));
    root.style.setProperty('--plat-sales', sal);
    root.style.setProperty('--plat-sales-2', shade(sal, 0.18));
    root.style.setProperty('--plat-sales-tint', tint(sal, 0.92));

    document.body.className = [
      'density-' + (tweaks.density || 'normal'),
      'warm-' + (tweaks.warmth || 'neutral'),
      'round-' + (tweaks.roundness || 'soft'),
      tweaks.showStepper ? '' : 'no-stepper',
    ].filter(Boolean).join(' ');

    const fonts = {
      inter: '"Inter", "Noto Sans SC", system-ui, sans-serif',
      ibm: '"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif',
      serif: '"Source Serif 4", "Noto Sans SC", Georgia, serif',
      system: 'system-ui, -apple-system, "Noto Sans SC", sans-serif',
    };
    root.style.setProperty('--font-sans', fonts[tweaks.font] || fonts.inter);
  }, [tweaks]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  // PATCH-15 Fix 3 — smooth-scroll on anchor link clicks. Uses event
  // delegation so it covers footer / in-content anchors that don't go
  // through the React-managed nav handlers. Doesn't toggle html {
  // scroll-behavior } so the wheel/touch scroll defenses from PATCH-12
  // stay in place. The browser respects scroll-margin-top from Fix 2
  // natively when scrollIntoView fires.
  useEffect(() => {
    const onClick = (e) => {
      let a = e.target;
      while (a && a.tagName !== 'A') a = a.parentElement;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href.includes('#')) return;
      const hash = href.slice(href.indexOf('#'));
      if (!hash || hash === '#') return;
      const samePage = href.startsWith('#') ||
        (location.pathname === '/' && href.startsWith('/#'));
      if (!samePage) return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { history.pushState(null, '', hash); } catch {}
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [location.pathname]);

  // PATCH-15 Fix 4 — active nav-link highlight when matching section is
  // in view. Re-runs on route change so observers attach to the right
  // sections after the landing remounts. No-op on routes that don't
  // expose .lr-nav-links a (e.g. /curators, /partners).
  useEffect(() => {
    const links = [...document.querySelectorAll('.lr-nav-links a')]
      .filter(a => /#/.test(a.getAttribute('href') || ''));
    if (links.length === 0) return;
    const targets = links.map(a => {
      const href = a.getAttribute('href') || '';
      const hash = href.slice(href.indexOf('#'));
      return { link: a, target: document.querySelector(hash) };
    }).filter(t => t.target);
    if (targets.length === 0) return;
    const setActive = (active) => {
      targets.forEach(t => t.link.classList.toggle('is-active', t.target === active));
    };
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target);
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    targets.forEach(t => obs.observe(t.target));
    return () => obs.disconnect();
  }, [location.pathname]);

  const meta = routeMeta(location.pathname);
  const stepperVisible = tweaks.showStepper && meta.stepper && (
    !meta.requiresAuth || (user && user.role === meta.requiresAuth)
  );
  const steps = meta.platform ? getPlatformSteps(meta.platform, lang) : [];

  // Pull a submission ID out of the current path so the stepper can navigate
  // back to the right per-submission route.
  // Pull intake_id + (optional) rolepack_id from current path so the stepper can
  // navigate back to per-intake routes correctly.
  const intakeMatch = location.pathname.match(
    /^\/partners\/intake\/([^/]+)(?:\/role\/([^/]+))?/
  );
  const currentIntakeId = intakeMatch?.[1] || null;
  const currentRpId = intakeMatch?.[2] || null;

  const jumpToStep = (sid) => {
    if (sid === 'register') return navigate('/partners/register');
    if (sid === 'onboard') {
      return navigate(currentIntakeId ? `/partners/onboard/${currentIntakeId}` : '/partners/onboard');
    }
    if (!currentIntakeId) return navigate('/partners');
    const routes = {
      capabilities: `/partners/intake/${currentIntakeId}/capabilities`,
      roles:        `/partners/intake/${currentIntakeId}/roles`,
      details:      currentRpId
        ? `/partners/intake/${currentIntakeId}/role/${currentRpId}/details`
        : `/partners/intake/${currentIntakeId}/roles`,
      pricing:      `/partners/intake/${currentIntakeId}/service-pricing`,
      review:       `/partners/intake/${currentIntakeId}/review`,
      done:         `/partners/intake/${currentIntakeId}/done`,
    };
    if (routes[sid]) navigate(routes[sid]);
  };

  return (
    <>
      <StepperContext.Provider value={{ steps, currentScreen: meta.screen, onJump: jumpToStep, visible: stepperVisible }}>
      <ImpersonationBanner />
      <div className={'app-root ' + (meta.platform ? 'platform-' + meta.platform : '')}>
        <div className="app-route">
        <Routes>
          {/* Landing in three flavors: / (default — uses saved preference,
              first-time visitors get zh), /cn (canonical Chinese), /en
              (canonical English). Locale routes are bookmarkable / shareable. */}
          <Route path="/" element={<ScreenLanding lang={lang} setLang={setLang} />} />
          <Route path="/cn" element={<ScreenLanding lang={lang} setLang={setLang} />} />
          <Route path="/en" element={<ScreenLanding lang={lang} setLang={setLang} />} />
          <Route path="/rolepacks" element={<ScreenRolepackCatalog lang={lang} setLang={setLang} />} />

          {/* Capability Partner portal — v2 intake-based flow.
              JWT role and DB column stay 'supplier' (legacy); only the URL is /partners. */}
          <Route path="/partners" element={<SupplierLanding lang={lang} setLang={setLang} />} />
          <Route path="/partners/register" element={<V2RegisterRoute lang={lang} setLang={setLang} />} />
          <Route path="/partners/company-setup" element={<RoleGate role="supplier" portal="/partners"><V2CompanySetupRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/onboard" element={<RoleGate role="supplier" portal="/partners"><V2OnboardRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/onboard/:id" element={<RoleGate role="supplier" portal="/partners"><V2OnboardRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/capabilities" element={<RoleGate role="supplier" portal="/partners"><V2CapabilitiesRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/roles" element={<RoleGate role="supplier" portal="/partners"><V2RolesRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/role/:rpId/details" element={<RoleGate role="supplier" portal="/partners"><V2RoleDetailsRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/service-pricing" element={<RoleGate role="supplier" portal="/partners"><V2ServicePricingRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/review" element={<RoleGate role="supplier" portal="/partners"><V2ReviewRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/partners/intake/:id/done" element={<RoleGate role="supplier" portal="/partners"><V2DoneRoute lang={lang} setLang={setLang} /></RoleGate>} />

          {/* Curator portal */}
          <Route path="/curators" element={<CuratorLanding lang={lang} setLang={setLang} />} />
          <Route path="/curators/intake/:id" element={<CuratorWorkbenchRoute lang={lang} setLang={setLang} />} />
          <Route path="/curators/publish/:id" element={<CuratorPublishRoute lang={lang} setLang={setLang} />} />
          <Route path="/curators/suppliers" element={<CuratorSuppliersRoute lang={lang} setLang={setLang} />} />
          <Route path="/curators/suppliers/:supplierId" element={<CuratorSupplierDetailRoute lang={lang} setLang={setLang} />} />
          <Route path="/curators/users" element={<CuratorUsersRoute lang={lang} setLang={setLang} />} />
          <Route path="/curators/library" element={<CuratorLibraryRoute lang={lang} setLang={setLang} />} />

          {/* Sales portal */}
          <Route path="/advisors" element={<SalesLanding lang={lang} setLang={setLang} />} />
          <Route path="/advisors/rolepack/:id" element={<RoleGate role="sales" portal="/advisors"><V2SalesRolepackRoute lang={lang} setLang={setLang} /></RoleGate>} />

          <Route path="/legal/terms" element={<ScreenTerms lang={lang} />} />
          <Route path="/legal/privacy" element={<ScreenPrivacy lang={lang} />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </div>

      </StepperContext.Provider>
    </>
  );
}

// ── Auth gates ────────────────────────────────────

function RoleGate({ role, portal, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user || user.role !== role) return <Navigate to={portal} replace />;
  return children;
}

// ── Per-platform landings (login or dashboard depending on auth) ──

function SupplierLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading, localSignOut } = useAuth();
  // If the user follows "能力伙伴登入" from the landing while a different
  // role's session is active (e.g. they were logged in as curator in this
  // tab from earlier), silently drop the per-tab session so they land on
  // the partner login form instead of the WrongRole interstitial. The
  // shared cookie + other tabs' sessions stay intact (localSignOut only
  // clears this tab's sessionStorage + local React state).
  useEffect(() => {
    if (!loading && user && user.role !== 'supplier') localSignOut();
  }, [loading, user, localSignOut]);
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user || user.role !== 'supplier') {
    return <ScreenPortalLogin platform="supplier" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/partners')} />;
  }
  return <ScreenSupplierHome lang={lang} setLang={setLang} onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading, localSignOut } = useAuth();
  // Same as SupplierLanding — if the user lands here while a different
  // role's session is active, sign this tab out silently and show the
  // curator login form. Shared cookie + other tabs unaffected.
  useEffect(() => {
    if (!loading && user && user.role !== 'curator') localSignOut();
  }, [loading, user, localSignOut]);
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user || user.role !== 'curator') {
    return <ScreenPortalLogin platform="curator" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/curators')} />;
  }
  return <ScreenQueue lang={lang} setLang={setLang}
    curatorName={user?.name || 'Eric'}
    openSubmission={(id) => navigate(`/curators/intake/${id}`)}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function SalesLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading, localSignOut } = useAuth();
  useEffect(() => {
    if (!loading && user && user.role !== 'sales') localSignOut();
  }, [loading, user, localSignOut]);
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user || user.role !== 'sales') {
    return <ScreenPortalLogin platform="sales" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/advisors')} />;
  }
  return <ScreenV2SalesLibrary lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function WrongRole({ expected, actual, lang, onLogout }) {
  const navigate = useNavigate();
  const { localSignOut } = useAuth();
  // Map portal name → its login URL.
  // Each portal's landing route renders the login form when there's no user.
  const loginUrl = expected === 'curator' ? '/curators'
    : expected === 'sales' ? '/advisors'
    : '/partners';
  const portalLabel = expected === 'curator' ? (lang === 'zh' ? '策展人' : 'Curator')
    : expected === 'sales' ? (lang === 'zh' ? '方案顾问' : 'Solution Advisor')
    : (lang === 'zh' ? '能力伙伴' : 'Capability Partner');
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, background: 'var(--bg)',
    }}>
      <div style={{
        background: 'white', border: '1px solid var(--line)',
        borderRadius: 14, padding: 40, maxWidth: 520, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--st-empty-bg)', color: 'var(--st-empty-ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 14,
        }}>!</div>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>
          {lang === 'zh' ? '门户不匹配' : 'Wrong portal'}
        </h2>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 18px', fontSize: 14, lineHeight: 1.6 }}>
          {lang === 'zh'
            ? <>这个标签页登录的是「<strong>{actual}</strong>」账号,而这里是「<strong>{expected}</strong>」门户。<br />你可以在<strong>本标签页</strong>切换账号 — 其他标签页的登录不受影响。</>
            : <>This tab is signed in as <strong>{actual}</strong>, but this portal is for <strong>{expected}</strong>.<br />You can sign in with another account <strong>in this tab only</strong> — your other tabs stay signed in.</>}
        </p>
        <button className="btn btn-primary" onClick={() => { localSignOut(); navigate(loginUrl); }}
          style={{ marginRight: 10 }}>
          {lang === 'zh'
            ? `在本标签页登录${portalLabel}账号`
            : `Sign in as ${portalLabel} (this tab only)`}
        </button>
        <button className="btn btn-ghost" onClick={onLogout}>
          {lang === 'zh' ? '全部退出' : 'Sign out everywhere'}
        </button>
      </div>
    </div>
  );
}

// ── Route components ──────────────────────────────

// ── v2 supplier routes ────────────────────────────────────────────
function V2RegisterRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  useEffect(() => {
    if (user?.role === 'supplier') navigate('/partners/company-setup');
  }, [user]);
  return <ScreenV2Register lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2CompanySetupRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2CompanySetup lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2OnboardRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2Onboard lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2CapabilitiesRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2Capabilities lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2RolesRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2Roles lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2RoleDetailsRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2RoleDetails lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2ServicePricingRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2ServicePricing lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2ReviewRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2Review lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}
function V2DoneRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2Done lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

// Curator workbench (S7) — gates access by role, but ?preview=1 bypasses
// auth so the prototype renders against demo data without a working backend.
function CuratorWorkbenchRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user, logout, loading } = useAuth();
  const previewMode = new URLSearchParams(location.search).get('preview') === '1';
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user && !previewMode) return <Navigate to="/curators" replace />;
  if (user && user.role !== 'curator') return <Navigate to="/curators" replace />;
  return <ScreenWorkbench
    lang={lang}
    setLang={setLang}
    intakeId={id}
    curatorName={user?.name || 'Eric'}
    onBack={() => navigate(previewMode ? '/curators?preview=1' : '/curators')}
    onLogout={user ? async () => { await logout(); navigate('/'); } : () => navigate('/')} />;
}

function CuratorPublishRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user, logout, loading } = useAuth();
  const previewMode = new URLSearchParams(location.search).get('preview') === '1';
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user && !previewMode) return <Navigate to="/curators" replace />;
  if (user && user.role !== 'curator') return <Navigate to="/curators" replace />;
  return <ScreenPublish
    lang={lang}
    setLang={setLang}
    submissionId={id}
    curatorName={user?.name || 'Eric'}
    goBack={() => navigate(`/curators/intake/${id}` + (previewMode ? '?preview=1' : ''))}
    onBackToQueue={() => navigate('/curators' + (previewMode ? '?preview=1' : ''))}
    onViewListing={() => navigate('/rolepacks')}
    onLogout={user ? async () => { await logout(); navigate('/'); } : () => navigate('/')} />;
}

function CuratorSuppliersRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) return <Navigate to="/curators" replace />;
  if (user.role !== 'curator') return <Navigate to="/curators" replace />;
  return <ScreenSupplierMgmt
    lang={lang} setLang={setLang}
    curatorName={user?.name || 'Eric'}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorUsersRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) return <Navigate to="/curators" replace />;
  if (!isSuperadmin(user)) return <Navigate to="/curators" replace />;
  return <ScreenUserMgmt lang={lang} setLang={setLang} user={user}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorLibraryRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) return <Navigate to="/curators" replace />;
  if (user.role !== 'curator') return <Navigate to="/curators" replace />;
  return <ScreenCuratorLibrary lang={lang} setLang={setLang} user={user}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorSupplierDetailRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { supplierId } = useParams();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) return <Navigate to="/curators" replace />;
  if (user.role !== 'curator') return <Navigate to="/curators" replace />;
  return <ScreenSupplierDetail
    lang={lang} setLang={setLang}
    supplierId={supplierId}
    curatorName={user?.name || 'Eric'}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function V2SalesRolepackRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2SalesRolepack lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

// 10 curated supplier-green swatches — calmer than #4FB17A, all readable
// against white (WCAG AA at 14px+).
const SUPPLIER_GREENS = [
  { hex: '#4DAC77', name: 'Confirmed (RGB 77/172/119)' },
  { hex: '#3B9863', name: 'Deep emerald' },
  { hex: '#2E7D5B', name: 'Forest' },
  { hex: '#1F8554', name: 'Jewel' },
  { hex: '#5A9A78', name: 'Muted sage' },
  { hex: '#6FA577', name: 'Original sage' },
  { hex: '#3F8F6D', name: 'Pine' },
  { hex: '#48875F', name: 'Slate green' },
  { hex: '#5C8A4E', name: 'Olive' },
  { hex: '#388E66', name: 'Verdant' },
];

function SupplierGreenSwatches({ value, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '4px 0' }}>
      {SUPPLIER_GREENS.map(({ hex, name }) => {
        const active = value?.toUpperCase() === hex.toUpperCase();
        return (
          <button key={hex} onClick={() => onPick(hex)} title={`${hex} — ${name}`}
            style={{
              width: '100%', aspectRatio: '1', borderRadius: 8,
              background: hex, border: active ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer', padding: 0, position: 'relative',
              boxShadow: active ? '0 0 0 2px white inset' : 'none',
            }}>
            {active && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
