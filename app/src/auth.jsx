// Auth context — wraps the app, exposes user/supplier + login/logout/register.
// Superadmin "view as partner": opens a NEW TAB with ?impersonate_as=SUP-XXX.
// The new tab stores the impersonation in sessionStorage (per-tab), which
// means the original curator tab is completely unaffected. Same browser, two
// tabs, two simultaneous identities. localStorage was the wrong choice
// because it leaks impersonation across tabs and confuses the curator portal.

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { auth as authApi, setSessionToken } from './api.js';

const AuthCtx = createContext(null);
const IMPERSONATE_KEY = 'rm_impersonate_supplier_id'; // sessionStorage, per-tab

// One-time URL handoff: ?impersonate_as=SUP-... arrives in the new tab,
// we copy it into sessionStorage, then strip it from the URL so reloads
// stay clean and the value can't leak through Referer headers.
function pickUpImpersonationFromURL() {
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('impersonate_as');
    if (!id) return null;
    sessionStorage.setItem(IMPERSONATE_KEY, id);
    url.searchParams.delete('impersonate_as');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    return id;
  } catch { return null; }
}
function readImpersonation() {
  try { return sessionStorage.getItem(IMPERSONATE_KEY) || null; } catch { return null; }
}

export function AuthProvider({ children }) {
  const [realUser, setRealUser] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedId, setImpersonatedId] = useState(() => {
    return pickUpImpersonationFromURL() || readImpersonation();
  });

  const refresh = useCallback(async () => {
    try {
      const { user: u, supplier: s } = await authApi.me();
      setRealUser(u); setSupplier(s ?? null);
    } catch {
      setRealUser(null); setSupplier(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    await refresh();
    return res;
  };
  const register = async (payload) => {
    const res = await authApi.register(payload);
    await refresh();
    return res;
  };
  const logout = async () => {
    try { await authApi.logout(); } catch {}
    setRealUser(null); setSupplier(null);
    setImpersonatedId(null);
    try { sessionStorage.removeItem(IMPERSONATE_KEY); } catch {}
  };

  // Sign out only THIS tab — clears the per-tab JWT + local state without
  // calling /auth/logout. The shared cookie + other tabs' sessionStorage
  // tokens remain intact, so a curator session in tab A survives when the
  // user switches tab B to a supplier login. Used by the WrongRole screen.
  const localSignOut = useCallback(() => {
    setSessionToken(null);
    setRealUser(null); setSupplier(null);
    setImpersonatedId(null);
    try { sessionStorage.removeItem(IMPERSONATE_KEY); } catch {}
  }, []);

  // Open the impersonated partner view in a NEW TAB. The new tab picks up
  // the supplier id from the URL and stores it in its own sessionStorage.
  // The original tab keeps no impersonation state.
  const impersonateSupplier = useCallback((supplierId) => {
    if (!supplierId) return;
    try {
      window.open(`/partners?impersonate_as=${encodeURIComponent(supplierId)}`,
        '_blank', 'noopener,noreferrer');
    } catch {}
  }, []);
  const stopImpersonating = useCallback(() => {
    try { sessionStorage.removeItem(IMPERSONATE_KEY); } catch {}
    setImpersonatedId(null);
  }, []);

  // Effective user: when superadmin is impersonating in this tab, present as
  // a supplier for the impersonated supplier_id while keeping real id/email.
  const user = useMemo(() => {
    if (!realUser) return null;
    if (impersonatedId && isSuperadmin(realUser)) {
      return { ...realUser, role: 'supplier', supplier_id: impersonatedId };
    }
    return realUser;
  }, [realUser, impersonatedId]);

  return (
    <AuthCtx.Provider value={{
      user, realUser, supplier, loading,
      impersonatedSupplierId: impersonatedId,
      impersonateSupplier, stopImpersonating,
      login, register, logout, localSignOut, refresh,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Banner shown at the top of every page while a superadmin is impersonating
// a supplier. Includes one-click exit.
export function ImpersonationBanner() {
  const { impersonatedSupplierId, stopImpersonating, supplier } = useAuth();
  if (!impersonatedSupplierId) return null;
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('rm_lang')) || 'zh';
  const name = supplier?.name || supplier?.short_name || impersonatedSupplierId;
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'linear-gradient(90deg, #2A6EA0 0%, #8E7AB5 100%)',
      color: 'white', padding: '8px 18px', fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      boxShadow: '0 2px 8px rgba(15,30,60,0.12)',
    }}>
      <span>👁️ {lang === 'zh' ? '正在以能力伙伴身份查看:' : 'Viewing as Capability Partner:'} <strong>{name}</strong></span>
      <button onClick={() => {
        stopImpersonating();
        // Tab was opened by the curator's "View as partner" action — try to
        // close it so they go back to the original tab automatically. If the
        // browser blocks that (e.g. tab opened manually), redirect.
        try { window.close(); } catch {}
        setTimeout(() => { window.location.assign('/curators/suppliers'); }, 50);
      }}
        style={{
          background: 'rgba(255,255,255,0.2)', color: 'white',
          border: '1px solid rgba(255,255,255,0.4)', borderRadius: 5,
          padding: '4px 12px', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
        {lang === 'zh' ? '关闭此视图' : 'Close view'}
      </button>
    </div>
  );
}

// Superadmin = email allowlist OR DB-backed users.is_superadmin flag.
// Email allowlist seeds the bootstrap superadmin (Eric for the demo); after
// that, superadmins are granted/revoked through the user-management UI.
const SUPERADMIN_EMAILS = new Set([
  'hello@rolemaster.io',
  'tildajed130@outlook.com',
  'demo-admin@airolemaster.com',
  'demo-curator@airolemaster.com', // Eric — bootstrap superadmin
]);
export function isSuperadmin(user) {
  if (!user) return false;
  // DB flag takes precedence (set via user mgmt)
  if (user.is_superadmin === 1 || user.is_superadmin === true) return true;
  if (!user.email) return false;
  const e = String(user.email).toLowerCase();
  if (SUPERADMIN_EMAILS.has(e)) return true;
  if (e.startsWith('admin@')) return true;
  return false;
}
