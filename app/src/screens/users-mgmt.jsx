import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../chrome.jsx';
import { admin } from '../api.js';
import { isSuperadmin } from '../auth.jsx';

// Solution Advisor / sales role removed by product decision. Existing 'sales'
// rows in the DB still render with a neutral label so legacy data is visible.
const ROLE_OPTIONS = [
  { id: 'curator',  zh: '策展人',     en: 'Curator'           },
  { id: 'supplier', zh: '能力伙伴',   en: 'Capability Partner' },
];
const roleLabel = (id, lang) => {
  const m = ROLE_OPTIONS.find(r => r.id === id);
  if (m) return lang === 'zh' ? m.zh : m.en;
  return id || '—';
};
const roleColor = (id) => id === 'curator' ? 'var(--plat-curator)' : id === 'supplier' ? 'var(--plat-supplier-2)' : 'var(--ink-3)';

export function ScreenUserMgmt({ lang, setLang, user, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // user object being edited, or null
  const [creating, setCreating] = useState(false);
  // Tab filter — 'all' | 'curator' | 'supplier'.
  const [roleTab, setRoleTab] = useState('all');

  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  const refetch = async () => {
    try {
      const [u, s] = await Promise.all([admin.listUsers(), admin.listSuppliersLite()]);
      setItems(u.items || []);
      setSuppliers(s.items || []);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { refetch(); }, []);

  // Per-role counts for the tab pills (always computed from the unfiltered
  // list so the badges don't change as the curator types in the search box).
  const roleCounts = useMemo(() => {
    const c = { all: items.length, curator: 0, supplier: 0 };
    for (const u of items) {
      if (u.role === 'curator') c.curator++;
      else if (u.role === 'supplier') c.supplier++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(u => {
      if (roleTab !== 'all' && u.role !== roleTab) return false;
      if (!q) return true;
      return (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.supplier_name || '').toLowerCase().includes(q);
    });
  }, [items, search, roleTab]);

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={user?.name} onLogout={onLogout} />
      <div className="curator-inbox v2-curator-inbox" style={{ flex: 1, paddingBottom: 60 }}>
        <div>
          <button onClick={() => navigate('/curators')}
            style={{ background: 'transparent', border: 'none', color: 'var(--plat-curator)', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0, fontFamily: 'inherit' }}>
            ← {lang === 'zh' ? '返回收件箱' : 'Back to inbox'}
          </button>
          <div className="v2-eyebrow">{lang === 'zh' ? '超级管理员 · 用户管理' : 'Superadmin · User management'}</div>
          <div className="v2-title-row" style={{ marginBottom: 6 }}>
            <h1 className="v2-display">{lang === 'zh' ? '用户与权限' : 'Users & access'}</h1>
            <span className="v2-status-pill v2-status-pill--review">
              ✦ {filtered.length} {lang === 'zh' ? '人' : 'users'}
            </span>
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none', marginBottom: 16 }}>
            {lang === 'zh'
              ? '增加、移除或调整账号:姓名、登录密码、平台角色。能力伙伴账号必须关联到具体的能力伙伴。'
              : 'Add, remove, or update accounts: name, login password, platform role. Capability Partner accounts must link to a specific partner.'}
          </p>

          {/* Role tabs — keeps the curator team and the partner accounts in
              separate views so it's obvious at a glance who has staff access. */}
          <div role="tablist" aria-label={lang === 'zh' ? '按角色筛选' : 'Filter by role'}
            style={{ display: 'flex', gap: 6, marginBottom: 12, borderBottom: '1px solid var(--line-2)' }}>
            {[
              { id: 'all',      zh: '全部',     en: 'All' },
              { id: 'curator',  zh: '策展人',   en: 'Curators' },
              { id: 'supplier', zh: '能力伙伴', en: 'Partners' },
            ].map(t => {
              const active = roleTab === t.id;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={active}
                  onClick={() => setRoleTab(t.id)}
                  style={{
                    background: 'transparent', border: 0, padding: '8px 12px',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    color: active ? 'var(--plat-curator)' : 'var(--ink-2)',
                    borderBottom: '2px solid ' + (active ? 'var(--plat-curator)' : 'transparent'),
                    marginBottom: -1, cursor: 'pointer',
                  }}>
                  {lang === 'zh' ? t.zh : t.en}
                  <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.65 }}>
                    {roleCounts[t.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'zh' ? '按姓名、邮箱、能力伙伴搜索…' : 'Search by name, email, partner…'}
              style={{ flex: 1, maxWidth: 380, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', border: '1px solid var(--line)', borderRadius: 8 }} />
            <div style={{ flex: 1 }} />
            <button onClick={() => setCreating(true)}
              style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + {lang === 'zh' ? '新增用户' : 'Add user'}
            </button>
          </div>

          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>}
          {err && <div style={{ padding: 16, background: 'rgba(255,200,200,0.3)', borderRadius: 8, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}

          {!loading && filtered.length > 0 && (
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1.4fr 2fr 1fr 1.2fr 0.8fr auto',
                gap: 12, padding: '10px 18px', background: 'var(--bg)',
                fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '1px solid var(--line-2)',
              }}>
                <div>{lang === 'zh' ? '姓名' : 'Name'}</div>
                <div>{lang === 'zh' ? '邮箱' : 'Email'}</div>
                <div>{lang === 'zh' ? '角色' : 'Role'}</div>
                <div>{lang === 'zh' ? '能力伙伴' : 'Partner'}</div>
                <div>{lang === 'zh' ? '创建' : 'Created'}</div>
                <div style={{ textAlign: 'right' }}>{lang === 'zh' ? '操作' : 'Actions'}</div>
              </div>

              {filtered.map(u => {
                const isMe = u.id === user?.id;
                const isSuper = isSuperadmin(u);
                return (
                  <div key={u.id} style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 2fr 1fr 1.2fr 0.8fr auto',
                    gap: 12, padding: '12px 18px', alignItems: 'center',
                    borderBottom: '1px solid var(--line-2)', fontSize: 13,
                    background: isMe ? 'color-mix(in srgb, var(--plat-curator) 4%, white)' : 'white',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {u.name || '—'}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--plat-curator)', fontWeight: 700 }}>{lang === 'zh' ? '(我)' : '(you)'}</span>}
                      </div>
                    </div>
                    <div style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{u.email}</div>
                    <div>
                      <span style={{
                        display: 'inline-block', padding: '2px 9px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600, color: 'white', background: roleColor(u.role),
                      }}>
                        {roleLabel(u.role, lang)}
                      </span>
                      {isSuper && (
                        <div style={{ fontSize: 10, color: 'var(--plat-curator)', fontWeight: 700, marginTop: 3, letterSpacing: '0.06em' }}>
                          ★ SUPERADMIN
                        </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                      {u.supplier_name || (u.role === 'supplier' ? <span style={{ color: 'var(--st-empty-ink)' }}>— missing —</span> : '—')}
                    </div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                    </div>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditing(u)}
                        style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 5, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {lang === 'zh' ? '编辑' : 'Edit'}
                      </button>
                      <button onClick={async () => {
                        if (isMe) { alert(lang === 'zh' ? '不能删除自己' : "You can't remove yourself"); return; }
                        if (!confirm(lang === 'zh' ? `确定删除 ${u.name} (${u.email})?` : `Remove ${u.name} (${u.email})?`)) return;
                        // Optimistic remove so the row vanishes immediately;
                        // refetch confirms in the background. If the API call
                        // fails we restore the row and surface the error.
                        const snapshot = items;
                        setItems(prev => prev.filter(it => it.id !== u.id));
                        try { await admin.deleteUser(u.id); refetch(); }
                        catch (e) { setItems(snapshot); alert(String(e?.message || e)); }
                      }}
                        disabled={isMe}
                        style={{ background: 'transparent', border: '1px solid var(--line)', color: isMe ? 'var(--ink-3)' : 'var(--st-empty-ink)', borderRadius: 5, padding: '4px 10px', fontSize: 11.5, cursor: isMe ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {lang === 'zh' ? '删除' : 'Remove'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', background: 'white', border: '1px dashed var(--line)', borderRadius: 14, color: 'var(--ink-3)' }}>
              {lang === 'zh' ? '没有匹配的用户' : 'No matching users'}
            </div>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <UserFormModal
          lang={lang}
          mode={creating ? 'create' : 'edit'}
          existing={editing}
          suppliers={suppliers}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function UserFormModal({ lang, mode, existing, suppliers, onClose, onSaved }) {
  const [name, setName] = useState(existing?.name || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(existing?.role || 'curator');
  const [supplierId, setSupplierId] = useState(existing?.supplier_id || '');
  // Curator tier: 'team' (regular curator) vs 'super' (superadmin powers).
  // Stored as is_superadmin flag (1 = super, 0 = team) on the users row.
  const [isSuper, setIsSuper] = useState(!!existing?.is_superadmin);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (mode === 'create') {
        await admin.createUser({
          email: email.trim().toLowerCase(),
          password, name: name.trim(), role,
          supplier_id: role === 'supplier' ? (supplierId || null) : null,
          is_superadmin: role === 'curator' ? isSuper : false,
        });
      } else {
        const patch = { name: name.trim(), role };
        if (password) patch.password = password;
        if (role === 'supplier') patch.supplier_id = supplierId || null;
        // Only persist is_superadmin for curator role; clear it otherwise.
        patch.is_superadmin = role === 'curator' ? isSuper : false;
        await admin.updateUser(existing.id, patch);
      }
      onSaved?.();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,30,60,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460,
        boxShadow: '0 30px 80px rgba(15,36,64,0.3)',
      }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: 'var(--navy-ink)' }}>
          {mode === 'create'
            ? (lang === 'zh' ? '新增用户' : 'Add user')
            : (lang === 'zh' ? '编辑用户' : 'Edit user')}
        </h2>

        {err && <div style={{ marginBottom: 10, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}

        <div style={{ display: 'grid', gap: 12 }}>
          <Field label={lang === 'zh' ? '姓名' : 'Name'} required>
            <input value={name} onChange={e => setName(e.target.value)}
              style={fieldStyle} autoFocus />
          </Field>

          <Field label={lang === 'zh' ? '登录邮箱' : 'Login email'} required>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={mode === 'edit'}
              style={{ ...fieldStyle, background: mode === 'edit' ? 'var(--bg)' : 'white', color: mode === 'edit' ? 'var(--ink-3)' : 'var(--ink)' }} />
            {mode === 'edit' && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block', marginTop: 3 }}>{lang === 'zh' ? '邮箱不可修改' : 'email cannot be changed'}</span>}
          </Field>

          <Field label={lang === 'zh'
            ? (mode === 'create' ? '初始密码 (≥6)' : '新密码 (留空=不修改)')
            : (mode === 'create' ? 'Password (≥6 chars)' : 'New password (blank = unchanged)')}
            required={mode === 'create'}>
            <input type="text" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'create' ? '' : (lang === 'zh' ? '不修改请留空' : 'leave blank to keep current')}
              style={fieldStyle} />
          </Field>

          <Field label={lang === 'zh' ? '平台角色' : 'Platform role'}>
            <div style={{ display: 'flex', gap: 6 }}>
              {ROLE_OPTIONS.map(r => (
                <button key={r.id} type="button"
                  onClick={() => setRole(r.id)}
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 600,
                    border: '1px solid ' + (role === r.id ? roleColor(r.id) : 'var(--line)'),
                    background: role === r.id ? 'color-mix(in srgb, ' + roleColor(r.id) + ' 12%, white)' : 'white',
                    color: role === r.id ? roleColor(r.id) : 'var(--ink-2)',
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {lang === 'zh' ? r.zh : r.en}
                </button>
              ))}
            </div>
          </Field>

          {role === 'supplier' && (
            <Field label={lang === 'zh' ? '关联能力伙伴' : 'Linked Capability Partner'} required>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                style={fieldStyle}>
                <option value="">{lang === 'zh' ? '— 选择能力伙伴 —' : '— pick a partner —'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}

          {role === 'curator' && (
            <Field label={lang === 'zh' ? '策展人级别' : 'Curator tier'}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setIsSuper(false)}
                  style={{
                    flex: 1, padding: '10px 12px', fontSize: 12.5, fontWeight: 600,
                    border: '1px solid ' + (!isSuper ? 'var(--plat-curator)' : 'var(--line)'),
                    background: !isSuper ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'white',
                    color: !isSuper ? 'var(--plat-curator)' : 'var(--ink-2)',
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div>{lang === 'zh' ? '团队 (Team)' : 'Team'}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 3, color: 'var(--ink-3)' }}>
                    {lang === 'zh' ? '普通策展人,只能查看与编辑收件箱与岗位包' : 'regular curator — review + edit submissions only'}
                  </div>
                </button>
                <button type="button" onClick={() => setIsSuper(true)}
                  style={{
                    flex: 1, padding: '10px 12px', fontSize: 12.5, fontWeight: 600,
                    border: '1px solid ' + (isSuper ? 'var(--plat-curator)' : 'var(--line)'),
                    background: isSuper ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'white',
                    color: isSuper ? 'var(--plat-curator)' : 'var(--ink-2)',
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div>★ {lang === 'zh' ? '超级管理员' : 'Superadmin'}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 3, color: 'var(--ink-3)' }}>
                    {lang === 'zh' ? '可以管理用户、扮演任意能力伙伴、无任何限制' : 'manage users, view as any partner, no restrictions'}
                  </div>
                </button>
              </div>
            </Field>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={busy}
            style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button onClick={submit} disabled={busy}
            style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? '…' : (mode === 'create' ? (lang === 'zh' ? '创建' : 'Create') : (lang === 'zh' ? '保存' : 'Save'))}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle = {
  width: '100%', padding: '8px 10px',
  border: '1px solid var(--line)', borderRadius: 6,
  fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box',
};

function Field({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--st-empty-ink)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
