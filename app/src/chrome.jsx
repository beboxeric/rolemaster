// Shared chrome: app header, screen picker, language switcher, stepper, bell.

import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from './i18n.js';
import { notifications as notifApi } from './api.js';
import { useAuth, isSuperadmin } from './auth.jsx';

// AppShell publishes the current stepper config here so AppHeader can render
// the progress bar directly under itself (instead of as a sibling above).
export const StepperContext = createContext(null);

// T5.3 — bell icon with unread badge + dropdown. Polls every 60s while mounted.
export function NotificationBell({ lang, onNavigate }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await notifApi.list();
      setItems(res.items || []);
      setUnread(res.unread || 0);
    } catch {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);

  const click = async (n) => {
    try { await notifApi.markRead([n.id]); } catch {}
    setOpen(false);
    if (n.type === 'rolepack_published' && n.payload?.intake_id && n.payload?.rolepack_id) {
      window.location.assign(`/supplier/intake/${n.payload.intake_id}/role/${n.payload.rolepack_id}/details`);
      return;
    }
    if (n.payload?.submissionId && onNavigate) onNavigate(n.payload.submissionId, n.type);
    refresh();
  };

  const markAll = async () => {
    try { await notifApi.markRead([]); } catch {}
    refresh();
  };

  const labelFor = (n) => {
    const p = n.payload || {};
    const product = p.productName || p.product_name || '';
    if (n.type === 'rolepack_published') {
      const role = lang === 'zh' ? (p.role_name_zh || p.role_name_en) : (p.role_name_en || p.role_name_zh);
      return lang === 'zh' ? `${role || p.rp_label} 已发布到销售库` : `${role || p.rp_label} published to sales library`;
    }
    if (n.type === 'submission_approved')  return lang === 'zh' ? `${product} 已批准` : `${product} approved`;
    if (n.type === 'submission_revision')  return lang === 'zh' ? `${product} 需修改` : `${product} needs revision`;
    if (n.type === 'submission_published') return lang === 'zh' ? `${product} 已发布` : `${product} published`;
    if (n.type === 'submission_held')      return lang === 'zh' ? `${product} 暂缓` : `${product} on hold`;
    if (n.type === 'comment')              return lang === 'zh' ? `${p.from || ''} 留言:${p.body || ''}` : `${p.from || ''}: ${p.body || ''}`;
    return n.type;
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        title={lang === 'zh' ? '通知' : 'Notifications'}
        style={{ position: 'relative', background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: 'var(--plat-supplier)', color: 'white',
            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
            minWidth: 16, textAlign: 'center',
            boxShadow: '0 0 0 2px white',
          }}>{unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 320, maxHeight: 400, overflowY: 'auto',
          background: 'white', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(15,36,64,0.15)', zIndex: 100,
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>
              {lang === 'zh' ? '通知' : 'Notifications'}
            </span>
            {unread > 0 && (
              <button onClick={markAll}
                style={{ fontSize: 11, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {lang === 'zh' ? '全部标为已读' : 'Mark all read'}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
              {lang === 'zh' ? '暂无通知' : 'No notifications'}
            </div>
          ) : (
            items.map(n => (
              <button key={n.id} onClick={() => click(n)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', border: 'none', cursor: 'pointer',
                  background: n.read ? 'white' : 'color-mix(in srgb, var(--plat-supplier) 12%, white)',
                  borderLeft: n.read ? 'none' : '3px solid var(--plat-supplier)',
                  borderBottom: '1px solid var(--line-2)',
                }}>
                <div style={{ fontSize: 13, color: 'var(--navy-ink)', fontWeight: n.read ? 400 : 600 }}>
                  {labelFor(n)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function LangSwitcher({ lang, setLang }) {
  return (
    <button
      className="lang-switch"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      {lang === "zh" ? "EN" : "中文"}
    </button>
  );
}

export function BrandMark({ size = 22 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.6 }}>
      R
    </span>
  );
}

export function PlatformPill({ platform, lang }) {
  // User-facing labels only — the internal `platform` key + JWT role stay the
  // same (`supplier` / `curator` / `sales`) so backend code is unchanged.
  const labels = {
    supplier: { zh: "能力伙伴", en: "Capability Partner" },
    curator:  { zh: "策展人",   en: "Curator" },
    sales:    { zh: "方案顾问", en: "Solution Advisor" },
  };
  return (
    <span className="platform-pill">
      <span className="dot" />
      <span className="label">{labels[platform][lang]}</span>
    </span>
  );
}

function ViewAsSelect({ lang, currentPlatform }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  // Curator view modes: 'self' = only my queue; 'leader' = team-wide view.
  // Persisted in localStorage so the inbox respects the choice across reloads.
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('rm_curator_scope')) || 'self';
  const [scope, setScope] = useState(stored);
  const setActive = (s) => {
    setScope(s);
    try { localStorage.setItem('rm_curator_scope', s); } catch {}
    // Mirror to the legacy inbox flag so existing logic keeps working.
    try { localStorage.setItem('rm_curator_lead', s === 'leader' ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('rm-curator-scope-changed', { detail: { scope: s } }));
    setOpen(false);
  };
  const options = [
    { id: 'self',   zh: '我自己',   en: 'Self',   hint_zh: '只看分配给我的提交',  hint_en: 'only my assignments' },
    { id: 'leader', zh: '团队主管', en: 'Leader', hint_zh: '查看全队所有提交',     hint_en: 'team-wide view' },
  ];
  const active = options.find(o => o.id === scope) || options[0];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={lang === 'zh' ? '切换视角' : 'Switch view'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid var(--line)', borderRadius: 6,
          cursor: 'pointer', color: 'var(--ink-2)',
        }}>
        <span style={{ color: 'var(--ink-3)' }}>{lang === 'zh' ? '视角:' : 'View as:'}</span>
        <span style={{ color: 'var(--navy-ink)', fontWeight: 600 }}>
          {lang === 'zh' ? active.zh : active.en}
        </span>
        <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
          background: 'white', border: '1px solid var(--line)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, padding: 4,
        }}>
          <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            {lang === 'zh' ? '策展人视角' : 'Curator view'}
          </div>
          {options.map(o => {
            const isActive = o.id === active.id;
            return (
              <button key={o.id} onClick={() => setActive(o.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: isActive ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'transparent',
                  border: 'none', cursor: 'pointer', padding: '7px 10px', borderRadius: 4,
                  fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
                }}>
                <div style={{ fontWeight: 600 }}>
                  {lang === 'zh' ? o.zh : o.en}
                  {isActive && <span style={{ float: 'right', color: 'var(--plat-curator)', fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {lang === 'zh' ? o.hint_zh : o.hint_en}
                </div>
              </button>
            );
          })}
          <div style={{ height: 1, background: 'var(--line-2)', margin: '4px 4px' }} />
          <button
            onClick={() => { setOpen(false); navigate('/curators/suppliers'); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '7px 10px', borderRadius: 4,
              fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
            }}>
            🏢 {lang === 'zh' ? '能力伙伴管理' : 'Partner management'}
          </button>
          <button
            onClick={() => { setOpen(false); navigate('/curators/users'); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '7px 10px', borderRadius: 4,
              fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
            }}>
            👥 {lang === 'zh' ? '用户与权限管理' : 'User management'}
          </button>
        </div>
      )}
    </div>
  );
}

export function PlatformHeader({ platform, lang, setLang, right, nav, contextLabel, onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showViewAs = isSuperadmin(user);
  // Clicking the brand goes to the user's home dashboard.
  const homePath = platform === 'supplier' ? '/partners'
    : platform === 'curator' ? '/curators'
    : platform === 'sales' ? '/advisors'
    : '/';
  return (
    <header className={"app-header platform-header-" + platform}>
      <button
        className="brand brand-img-lockup"
        onClick={() => navigate(homePath)}
        title={lang === 'zh' ? '返回首页' : 'Back to dashboard'}
        aria-label="RoleMaster"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', font: 'inherit', color: 'inherit' }}>
        <img src="/logos/rm-light-h.png" alt="RoleMaster" className="brand-img" />
      </button>
      <PlatformPill platform={platform} lang={lang} />
      {contextLabel && (
        <span style={{
          marginLeft: 8, fontSize: 17, fontWeight: 700,
          color: 'var(--navy-ink)', letterSpacing: '-0.01em',
        }}>{contextLabel}</span>
      )}
      {nav && <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>{nav}</nav>}
      <div style={{ flex: 1 }} />
      <div className="header-right">
        {right}
        {showViewAs && <ViewAsSelect lang={lang} currentPlatform={platform} />}
        {onLogout && (
          <button className="btn-ghost" onClick={onLogout}
            style={{ padding: "5px 10px", fontSize: 12, color: "var(--ink-2)" }}>
            {lang === "zh" ? "退出" : "Sign out"}
          </button>
        )}
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
    </header>
  );
}

export function AppHeader({ lang, setLang, productLabel, savedAt, progress, supplierName, userName, platform = "supplier", onLogout, onNavigate }) {
  const right = (
    <>
      {typeof progress === "number" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("progress_overall", lang)}</span>
          <div style={{ width: 80, height: 5, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--plat-color, var(--plat-supplier))", transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 600, fontSize: 12 }}>{progress}%</span>
        </div>
      )}
      {savedAt && (
        <div className="save-status" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          <span className="save-dot" />
          {t("save_state_saved", lang, { time: savedAt })}
        </div>
      )}
      <NotificationBell lang={lang} onNavigate={onNavigate} />
    </>
  );
  const stepper = useContext(StepperContext);
  return (
    <>
      <PlatformHeader
        platform={platform}
        lang={lang} setLang={setLang}
        contextLabel={productLabel || userName || supplierName || ''}
        right={right}
        onLogout={onLogout}
      />
      {stepper?.visible && (
        <ProcessStepper
          steps={stepper.steps}
          currentScreen={stepper.currentScreen}
          onJump={stepper.onJump} />
      )}
    </>
  );
}

export function CuratorHeader({ lang, setLang, activeTab = "subs", curatorName, onLogout, onNavigate }) {
  const nav = (
    <>
      <button className={"nav-link " + (activeTab === "subs" ? "active" : "")}>
        {t("s6_nav_subs", lang)}
      </button>
    </>
  );
  const right = (
    <>
      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
        {lang === "zh" ? `审阅员:${curatorName ?? ""}` : `Curator: ${curatorName ?? ""}`}
      </span>
      <NotificationBell lang={lang} onNavigate={onNavigate} />
    </>
  );
  return (
    <PlatformHeader platform="curator" lang={lang} setLang={setLang} nav={nav} right={right} onLogout={onLogout} />
  );
}

export function ProcessStepper({ steps, currentScreen }) {
  const currentIdx = steps.findIndex(
    s => s.screenId === currentScreen || (Array.isArray(s.screenIds) && s.screenIds.includes(currentScreen))
  );
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '14px 16px', background: 'transparent',
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
        {steps.map((s, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending';
          const dotBg = state === 'done' ? 'var(--plat-color, var(--plat-supplier))'
            : state === 'current' ? 'var(--plat-color, var(--plat-supplier))'
            : 'transparent';
          const dotColor = state === 'pending' ? 'var(--ink-3)' : 'white';
          const dotBorder = state === 'pending' ? '1.5px solid var(--line-2)' : 'none';
          return (
            <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: dotBg, color: dotColor, border: dotBorder,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  transition: 'background 0.2s, color 0.2s, border 0.2s',
                  boxShadow: state === 'current' ? '0 0 0 4px color-mix(in srgb, var(--plat-color, var(--plat-supplier)) 18%, transparent)' : 'none',
                }}>
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span style={{
                  fontSize: 11, color: state === 'current' ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: state === 'current' ? 600 : 500, letterSpacing: '0.01em',
                }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <span style={{
                  display: 'inline-block', width: 64, height: 2, marginInline: 12, marginBottom: 18,
                  background: i < currentIdx ? 'var(--plat-color, var(--plat-supplier))' : 'var(--line-2)',
                  borderRadius: 1, transition: 'background 0.2s',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getPlatformSteps(platform, lang) {
  if (platform === "supplier") {
    return [
      { id: "setup", label: lang === "zh" ? "注册" : "Sign up",
        screenIds: ["register"] },
      { id: "build", label: lang === "zh" ? "填写" : "Fill in",
        screenIds: ["onboard", "capabilities", "roles", "details", "pricing", "review"] },
      { id: "done",  label: lang === "zh" ? "完成" : "Done",
        screenIds: ["done"] },
    ];
  }
  if (platform === "curator") {
    return [
      { id: "review",  label: lang === "zh" ? "审阅" : "Review",  screenIds: ["wb_review"] },
      { id: "publish", label: lang === "zh" ? "发布" : "Publish", screenIds: ["wb_publish"] },
    ];
  }
  return [];
}
