// Shared chrome: app header, screen picker, language switcher, stepper, bell.

import { useEffect, useState } from 'react';
import { t } from './i18n.js';
import { notifications as notifApi } from './api.js';

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
            background: '#DC2626', color: 'white',
            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
            minWidth: 16, textAlign: 'center',
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
                  background: n.read ? 'white' : 'var(--cop-bg)',
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
  const labels = {
    supplier: { zh: "供应商", en: "Supplier" },
    curator:  { zh: "策展人", en: "Curator" },
    sales:    { zh: "销售",   en: "Sales" },
  };
  return (
    <span className="platform-pill">
      <span className="dot" />
      <span className="label">{labels[platform][lang]}</span>
    </span>
  );
}

export function PlatformHeader({ platform, lang, setLang, right, nav, contextLabel, onLogout }) {
  return (
    <header className={"app-header platform-header-" + platform}>
      <div className="brand">
        <BrandMark />
        RoleMaster
      </div>
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

export function AppHeader({ lang, setLang, productLabel, savedAt, progress, supplierName, onLogout, onNavigate }) {
  const right = (
    <>
      {typeof progress === "number" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("progress_overall", lang)}</span>
          <div style={{ width: 80, height: 5, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--plat-supplier)", transition: "width 0.4s ease" }} />
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
  return (
    <PlatformHeader
      platform="supplier"
      lang={lang} setLang={setLang}
      contextLabel={productLabel || supplierName || ''}
      right={right}
      onLogout={onLogout}
    />
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

export function ProcessStepper({ steps, currentScreen, onJump }) {
  const currentIdx = steps.findIndex(
    s => s.screenId === currentScreen || (Array.isArray(s.screenIds) && s.screenIds.includes(currentScreen))
  );
  return (
    <div className="proc-stepper">
      <div className="proc-stepper-inner">
        {steps.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
          const clickable = !!onJump && (state === "done" || state === "current");
          const Tag = clickable ? "button" : "div";
          return (
            <Tag key={s.id}
              className={"proc-step " + state + (clickable ? " clickable" : "")}
              onClick={clickable ? () => onJump(s.screenId) : undefined}>
              <div className="proc-step-dot-wrap">
                <span className="proc-dot">{state === "done" ? "✓" : i + 1}</span>
              </div>
              <span className="proc-step-label">{s.label}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

export function getPlatformSteps(platform, lang) {
  if (platform === "supplier") {
    return [
      { id: "register",     label: lang === "zh" ? "概览"       : "Overview",    screenId: "register" },
      { id: "onboard",      label: lang === "zh" ? "产品资料"   : "Product",     screenId: "onboard" },
      { id: "capabilities", label: lang === "zh" ? "能力梳理"   : "Capabilities", screenId: "capabilities" },
      { id: "roles",        label: lang === "zh" ? "岗位匹配"   : "Roles",       screenId: "roles" },
      { id: "details",      label: lang === "zh" ? "完善岗位"   : "Details",     screenId: "details" },
      { id: "pricing",      label: lang === "zh" ? "服务与价格" : "Pricing",     screenId: "pricing" },
      { id: "review",       label: lang === "zh" ? "最终确认"   : "Review",      screenId: "review" },
      { id: "done",         label: lang === "zh" ? "完成"       : "Done",        screenId: "done" },
    ];
  }
  return [];
}
