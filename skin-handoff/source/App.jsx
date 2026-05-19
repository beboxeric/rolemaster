// RoleMaster — three role-separated portals: supplier / curator / sales.
// No shared screen-picker dock. Each portal has its own entry, login, and home.

import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate, Link } from 'react-router-dom';
import { ProcessStepper, getPlatformSteps } from './chrome.jsx';
import { ScreenLanding } from './screens/landing.jsx';
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
import { ScreenV2CuratorInbox } from './screens/v2/curator-inbox.jsx';
import { ScreenV2CuratorReview } from './screens/v2/curator-review.jsx';
import { ScreenV2SalesLibrary, ScreenV2SalesRolepack } from './screens/v2/sales-library.jsx';
import { TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakSelect, TweakToggle, useTweaks } from './tweaks.jsx';
import { AuthProvider, useAuth } from './auth.jsx';

const TWEAK_DEFAULTS = {
  supplierColor: '#4FB17A',
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
  // Supplier v2 intake flow
  if (pathname === '/supplier/register')              return { platform: 'supplier', screen: 'register', stepper: true, requiresAuth: false };
  if (pathname === '/supplier/company-setup')         return { platform: 'supplier', screen: null,       stepper: false, requiresAuth: 'supplier' };
  if (pathname === '/supplier/onboard')               return { platform: 'supplier', screen: 'onboard',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/onboard\/[^/]+$/.test(pathname))  return { platform: 'supplier', screen: 'onboard',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/capabilities$/.test(pathname)) return { platform: 'supplier', screen: 'capabilities', stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/roles$/.test(pathname))         return { platform: 'supplier', screen: 'roles',        stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/role\/[^/]+\/details$/.test(pathname)) return { platform: 'supplier', screen: 'details', stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/service-pricing$/.test(pathname)) return { platform: 'supplier', screen: 'pricing', stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/review$/.test(pathname))         return { platform: 'supplier', screen: 'review',  stepper: true, requiresAuth: 'supplier' };
  if (/^\/supplier\/intake\/[^/]+\/done$/.test(pathname))           return { platform: 'supplier', screen: 'done',    stepper: true, requiresAuth: 'supplier' };
  // Supplier dashboard
  if (pathname === '/supplier')                        return { platform: 'supplier', screen: null,      stepper: false, requiresAuth: false };
  // Curator
  if (pathname === '/curator')                         return { platform: 'curator', screen: null, stepper: false, requiresAuth: false };
  if (pathname.startsWith('/curator/intake/'))         return { platform: 'curator', screen: null, stepper: false, requiresAuth: 'curator' };
  // Sales
  if (pathname === '/sales')                           return { platform: 'sales', screen: null, stepper: false, requiresAuth: false };
  if (pathname.startsWith('/sales/rolepack/'))         return { platform: 'sales', screen: null, stepper: false, requiresAuth: 'sales' };
  // Public
  return { platform: null, screen: null, stepper: false, requiresAuth: false };
}

function AppShell() {
  // T4.3 — initial language from localStorage; fall back to 'zh'.
  const [lang, setLangRaw] = useState(() => {
    if (typeof localStorage === 'undefined') return 'zh';
    const stored = localStorage.getItem('rm_lang');
    return stored === 'en' || stored === 'zh' ? stored : 'zh';
  });
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // T4.3 — persist locally + server-side for logged-in users.
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
    /^\/supplier\/intake\/([^/]+)(?:\/role\/([^/]+))?/
  );
  const currentIntakeId = intakeMatch?.[1] || null;
  const currentRpId = intakeMatch?.[2] || null;

  const jumpToStep = (sid) => {
    if (sid === 'register') return navigate('/supplier/register');
    if (sid === 'onboard') {
      return navigate(currentIntakeId ? `/supplier/onboard/${currentIntakeId}` : '/supplier/onboard');
    }
    if (!currentIntakeId) return navigate('/supplier');
    const routes = {
      capabilities: `/supplier/intake/${currentIntakeId}/capabilities`,
      roles:        `/supplier/intake/${currentIntakeId}/roles`,
      details:      currentRpId
        ? `/supplier/intake/${currentIntakeId}/role/${currentRpId}/details`
        : `/supplier/intake/${currentIntakeId}/roles`,
      pricing:      `/supplier/intake/${currentIntakeId}/service-pricing`,
      review:       `/supplier/intake/${currentIntakeId}/review`,
      done:         `/supplier/intake/${currentIntakeId}/done`,
    };
    if (routes[sid]) navigate(routes[sid]);
  };

  return (
    <>
      <div className={'app-root ' + (meta.platform ? 'platform-' + meta.platform : '')}>
        {stepperVisible && (
          <ProcessStepper
            steps={steps}
            currentScreen={meta.screen}
            onJump={jumpToStep}
          />
        )}
        <div className="app-route">
        <Routes>
          <Route path="/" element={<ScreenLanding lang={lang} setLang={setLang} />} />

          {/* Supplier portal — v2 intake-based flow */}
          <Route path="/supplier" element={<SupplierLanding lang={lang} setLang={setLang} />} />
          <Route path="/supplier/register" element={<V2RegisterRoute lang={lang} setLang={setLang} />} />
          <Route path="/supplier/company-setup" element={<RoleGate role="supplier" portal="/supplier"><V2CompanySetupRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/onboard" element={<RoleGate role="supplier" portal="/supplier"><V2OnboardRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/onboard/:id" element={<RoleGate role="supplier" portal="/supplier"><V2OnboardRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/capabilities" element={<RoleGate role="supplier" portal="/supplier"><V2CapabilitiesRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/roles" element={<RoleGate role="supplier" portal="/supplier"><V2RolesRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/role/:rpId/details" element={<RoleGate role="supplier" portal="/supplier"><V2RoleDetailsRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/service-pricing" element={<RoleGate role="supplier" portal="/supplier"><V2ServicePricingRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/review" element={<RoleGate role="supplier" portal="/supplier"><V2ReviewRoute lang={lang} setLang={setLang} /></RoleGate>} />
          <Route path="/supplier/intake/:id/done" element={<RoleGate role="supplier" portal="/supplier"><V2DoneRoute lang={lang} setLang={setLang} /></RoleGate>} />

          {/* Curator portal */}
          <Route path="/curator" element={<CuratorLanding lang={lang} setLang={setLang} />} />
          <Route path="/curator/intake/:id" element={<RoleGate role="curator" portal="/curator"><V2CuratorReviewRoute lang={lang} setLang={setLang} /></RoleGate>} />

          {/* Sales portal */}
          <Route path="/sales" element={<SalesLanding lang={lang} setLang={setLang} />} />
          <Route path="/sales/rolepack/:id" element={<RoleGate role="sales" portal="/sales"><V2SalesRolepackRoute lang={lang} setLang={setLang} /></RoleGate>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title={lang === 'zh' ? '平台配色' : 'Platform colors'}>
          <TweakColor label={lang === 'zh' ? '供应商' : 'Supplier'} value={tweaks.supplierColor} onChange={(v) => setTweak('supplierColor', v)} />
          <TweakColor label={lang === 'zh' ? '策展人' : 'Curator'} value={tweaks.curatorColor} onChange={(v) => setTweak('curatorColor', v)} />
          <TweakColor label={lang === 'zh' ? '销售' : 'Sales'} value={tweaks.salesColor} onChange={(v) => setTweak('salesColor', v)} />
        </TweakSection>
        <TweakSection title={lang === 'zh' ? '外观' : 'Appearance'}>
          <TweakRadio label={lang === 'zh' ? '密度' : 'Density'} value={tweaks.density} onChange={(v) => setTweak('density', v)}
            options={[{ value: 'compact', label: lang === 'zh' ? '紧凑' : 'Compact' }, { value: 'normal', label: lang === 'zh' ? '标准' : 'Normal' }, { value: 'comfortable', label: lang === 'zh' ? '宽松' : 'Comfy' }]} />
          <TweakRadio label={lang === 'zh' ? '圆角' : 'Roundness'} value={tweaks.roundness} onChange={(v) => setTweak('roundness', v)}
            options={[{ value: 'sharp', label: lang === 'zh' ? '锐利' : 'Sharp' }, { value: 'soft', label: lang === 'zh' ? '柔和' : 'Soft' }, { value: 'pill', label: lang === 'zh' ? '胶囊' : 'Pill' }]} />
          <TweakSelect label={lang === 'zh' ? '字体' : 'Font'} value={tweaks.font} onChange={(v) => setTweak('font', v)}
            options={[{ value: 'inter', label: 'Inter' }, { value: 'ibm', label: 'IBM Plex Sans' }, { value: 'serif', label: 'Source Serif 4' }, { value: 'system', label: lang === 'zh' ? '系统字体' : 'System UI' }]} />
        </TweakSection>
        <TweakSection title={lang === 'zh' ? '语言' : 'Language'}>
          <TweakRadio label={lang === 'zh' ? '默认语言' : 'Default'} value={lang} onChange={setLang}
            options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'EN' }]} />
        </TweakSection>
      </TweaksPanel>
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
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="supplier" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/supplier')} />;
  }
  if (user.role !== 'supplier') {
    return <WrongRole expected="supplier" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenSupplierHome lang={lang} setLang={setLang} onLogout={async () => { await logout(); navigate('/'); }} />;
}

function CuratorLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="curator" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/curator')} />;
  }
  if (user.role !== 'curator') {
    return <WrongRole expected="curator" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenV2CuratorInbox lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function SalesLanding({ lang, setLang }) {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>…</div>;
  if (!user) {
    return <ScreenPortalLogin platform="sales" lang={lang} setLang={setLang}
      onSuccess={() => navigate('/sales')} />;
  }
  if (user.role !== 'sales') {
    return <WrongRole expected="sales" actual={user.role} lang={lang} onLogout={async () => { await logout(); navigate('/'); }} />;
  }
  return <ScreenV2SalesLibrary lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function WrongRole({ expected, actual, lang, onLogout }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32, background: 'var(--bg)',
    }}>
      <div style={{
        background: 'white', border: '1px solid var(--line)',
        borderRadius: 14, padding: 40, maxWidth: 480, textAlign: 'center',
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
        <p style={{ color: 'var(--ink-2)', margin: '0 0 18px', fontSize: 14 }}>
          {lang === 'zh'
            ? `你的账号是「${actual}」,但当前门户是「${expected}」。请退出后用对应账号登录。`
            : `You're signed in as "${actual}", but this is the "${expected}" portal. Sign out and use a matching account.`}
        </p>
        <button className="btn btn-primary" onClick={onLogout}>
          {lang === 'zh' ? '退出' : 'Sign out'}
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
    if (user?.role === 'supplier') navigate('/supplier/company-setup');
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

function V2CuratorReviewRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2CuratorReview lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
}

function V2SalesRolepackRoute({ lang, setLang }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return <ScreenV2SalesRolepack lang={lang} setLang={setLang}
    onLogout={async () => { await logout(); navigate('/'); }} />;
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
