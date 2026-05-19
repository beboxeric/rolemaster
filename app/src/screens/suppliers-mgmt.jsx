import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../chrome.jsx';
import { curator } from '../api.js';
import { useAuth, isSuperadmin } from '../auth.jsx';

export function ScreenSupplierMgmt({ lang, setLang, curatorName, onLogout }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await curator.listSuppliers();
        if (abort) return;
        setItems(res.items || []);
      } catch (e) {
        if (!abort) setErr(String(e?.message || e));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(s => (s.name || s.short_name || '').toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
      <div className="curator-inbox v2-curator-inbox" style={{ flex: 1, paddingBottom: 60 }}>
        <div>
          <button onClick={() => navigate('/curators')}
            style={{ background: 'transparent', border: 'none', color: 'var(--plat-curator)', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0, fontFamily: 'inherit' }}>
            ← {lang === 'zh' ? '返回收件箱' : 'Back to inbox'}
          </button>
          <div className="v2-eyebrow">{lang === 'zh' ? '策展人门户 · 合作伙伴管理' : 'Curator portal · Partner management'}</div>
          <div className="v2-title-row" style={{ marginBottom: 6 }}>
            <h1 className="v2-display">{lang === 'zh' ? '能力伙伴' : 'Capability Partners'}</h1>
            <span className="v2-status-pill v2-status-pill--review">
              ✦ {filtered.length} {lang === 'zh' ? '家' : 'partners'}
            </span>
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none', marginBottom: 16 }}>
            {lang === 'zh'
              ? '每位能力伙伴一张卡片;点开查看其公司资料(可编辑)及历次提交的所有 RolePack 与 RoleCapability。'
              : 'One card per Capability Partner. Click to view their company profile (editable) plus every RolePack and RoleCapability they\'ve submitted across intakes.'}
          </p>

          <div style={{ marginBottom: 16 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'zh' ? '按名称搜索能力伙伴…' : 'Search partners by name…'}
              style={{ width: '100%', maxWidth: 360, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', border: '1px solid var(--line)', borderRadius: 8 }} />
          </div>

          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>}
          {err && <div style={{ padding: 16, background: 'rgba(255,200,200,0.3)', borderRadius: 8, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', background: 'white', border: '1px dashed var(--line)', borderRadius: 14, color: 'var(--ink-3)' }}>
              {lang === 'zh' ? '暂无伙伴' : 'No partners yet'}
            </div>
          )}

          {filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(s => (
                <SupplierRow key={s.id} s={s} lang={lang}
                  onOpen={() => navigate(`/curators/suppliers/${s.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierRow({ s, lang, onOpen }) {
  const navigate = useNavigate();
  const { realUser, impersonateSupplier } = useAuth();
  const canImpersonate = isSuperadmin(realUser);
  const latest = s.latest_intake_at
    ? new Date(s.latest_intake_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
  const viewAsPartner = (e) => {
    e.stopPropagation();
    if (!canImpersonate) return;
    // Opens the partner portal in a NEW TAB so the curator session in this
    // tab stays intact. Per-tab impersonation via sessionStorage.
    impersonateSupplier(s.id);
  };
  return (
    <div
      onClick={onOpen}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      style={{
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        background: 'white', border: '1px solid var(--v2-rule, rgba(20,24,42,0.08))',
        borderRadius: 12, padding: '16px 22px',
        boxShadow: '0 1px 2px rgba(15,30,60,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1fr) auto auto auto auto auto',
        alignItems: 'center', gap: 18,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,30,60,0.10)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--plat-curator) 35%, transparent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,30,60,0.04)'; e.currentTarget.style.borderColor = 'var(--v2-rule, rgba(20,24,42,0.08))'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-ink)', lineHeight: 1.3 }}>
          {s.name || s.short_name || '—'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
          {s.hq ? <span>{s.hq}</span> : null}
          {s.hq && s.latest_intake_at ? <span style={{ margin: '0 8px' }}>·</span> : null}
          {s.latest_intake_at ? <span>{lang === 'zh' ? '最近 ' : 'latest '}{latest}</span> : null}
        </div>
      </div>
      <Stat label={lang === 'zh' ? '提交' : 'intakes'} v={s.intake_count} color="var(--ink)" />
      <Stat label="RolePack" v={s.rolepack_count} color="#2A6EA0" />
      <Stat label="RoleCapability" v={s.capability_count} color="var(--plat-curator)" />
      {canImpersonate && (
        <button onClick={viewAsPartner}
          title={lang === 'zh' ? '免登录,以能力伙伴身份查看其门户' : "Open this partner's portal without login"}
          style={{
            background: 'transparent', color: '#2A6EA0',
            border: '1px solid color-mix(in srgb, #3D8CC4 40%, transparent)', borderRadius: 6,
            padding: '6px 12px', fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
          👁 {lang === 'zh' ? '以伙伴身份查看' : 'View as partner'}
        </button>
      )}
      <span style={{ color: 'var(--plat-curator)', fontWeight: 600, fontSize: 12.5, justifySelf: 'end' }}>
        {lang === 'zh' ? '查看 →' : 'Open →'}
      </span>
    </div>
  );
}

function Stat({ label, v, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v || 0}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ─── Supplier detail page ──────────────────────────────────────────────
// All company fields are SINGLE-VALUE (whatever the supplier typed).
// We never translate them; they display the same text in both UI languages.
const COMPANY_FIELDS = [
  { id: 'company_name',    zh: '公司全称',     en: 'Company name'  },
  { id: 'company_hq',      zh: '总部所在地',   en: 'Headquarters'  },
  { id: 'company_founded', zh: '成立年份',     en: 'Founded'       },
  { id: 'company_team',    zh: '团队规模',     en: 'Team size'     },
  { id: 'company_clients', zh: '主要客户群',   en: 'Key clients'   },
];
const SINGLE_FIELDS = [
  { id: 'website',       zh: '网址',     en: 'Website' },
  { id: 'contact_name',  zh: '联系人',   en: 'Contact name' },
  { id: 'contact_phone', zh: '电话',     en: 'Phone' },
  { id: 'contact_email', zh: '邮箱',     en: 'Email' },
];

export function ScreenSupplierDetail({ lang, setLang, supplierId, curatorName, onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  const refetch = async () => {
    try {
      const res = await curator.getSupplier(supplierId);
      setData(res);
      setDraft({
        company: structuredClone(res.company || {}),
        name: res.supplier?.name || '',
        hq: res.supplier?.hq || '',
      });
    } catch (e) {
      setErr(String(e?.message || e));
    }
  };

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await curator.getSupplier(supplierId);
        if (abort) return;
        setData(res);
        setDraft({
          company: structuredClone(res.company || {}),
          name: res.supplier?.name || '',
          hq: res.supplier?.hq || '',
        });
      } catch (e) {
        if (!abort) setErr(String(e?.message || e));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const setCompanyField = (fid, key, val) => {
    setDraft(d => {
      const next = { ...d, company: { ...d.company } };
      const cur = next.company[fid];
      if (key === 'value') next.company[fid] = val;            // SINGLE_FIELDS
      else next.company[fid] = { ...(cur || {}), [key]: val }; // bilingual {zh, en}
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setSaveErr('');
    try {
      const updates = { ...draft.company };
      await curator.patchSupplier(supplierId, { updates, name: draft.name, hq: draft.hq });
      setEditing(false);
      await refetch();
    } catch (e) {
      setSaveErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="screen-anim platform-curator v2" style={{ minHeight: '100%' }}>
        <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="screen-anim platform-curator v2" style={{ minHeight: '100%' }}>
        <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--st-empty-ink)' }}>⚠ {err || 'Supplier not found'}</div>
      </div>
    );
  }

  const intakes = data.intakes || [];
  const rolepacks = data.rolepacks || [];
  const capabilities = data.capabilities || [];

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
      <div className="curator-inbox v2-curator-inbox" style={{ flex: 1, paddingBottom: 60 }}>
        <div>
          <button onClick={() => navigate('/curators/suppliers')}
            style={{ background: 'transparent', border: 'none', color: 'var(--plat-curator)', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0, fontFamily: 'inherit' }}>
            ← {lang === 'zh' ? '返回伙伴列表' : 'Back to partners'}
          </button>
          <div className="v2-eyebrow">{lang === 'zh' ? '策展人门户 · 伙伴档案' : 'Curator portal · Partner profile'}</div>
          <div className="v2-title-row" style={{ marginBottom: 6 }}>
            <h1 className="v2-display">{data.supplier.name || data.supplier.short_name || '—'}</h1>
            <span className="v2-status-pill v2-status-pill--review">
              {intakes.length} {lang === 'zh' ? '提交' : 'intakes'} · {rolepacks.length} RolePack · {capabilities.length} RoleCapability
            </span>
          </div>

          {/* Company info card (editable) */}
          <section style={{
            background: 'white', border: '1px solid var(--line)', borderRadius: 12,
            padding: '18px 22px', marginBottom: 16, marginTop: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>🏢</span>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)' }}>
                {lang === 'zh' ? '公司资料' : 'Company profile'}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                {lang === 'zh' ? '伙伴提交的资料 · 可编辑' : 'as submitted by the partner · editable'}
              </span>
              <div style={{ flex: 1 }} />
              {!editing && (
                <button onClick={() => setEditing(true)}
                  style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {lang === 'zh' ? '编辑' : 'Edit'}
                </button>
              )}
              {editing && (
                <>
                  <button onClick={() => { setEditing(false); setDraft({ company: structuredClone(data.company || {}), name: data.supplier?.name || '', hq: data.supplier?.hq || '' }); setSaveErr(''); }}
                    style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {lang === 'zh' ? '取消' : 'Cancel'}
                  </button>
                  <button onClick={save} disabled={saving}
                    style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {saving ? '…' : (lang === 'zh' ? '保存' : 'Save')}
                  </button>
                </>
              )}
            </div>
            {saveErr && <div style={{ marginBottom: 10, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {saveErr}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 10, columnGap: 14, fontSize: 13 }}>
              {COMPANY_FIELDS.map(f => {
                const v = (editing ? draft.company : data.company)?.[f.id] || {};
                // Each field is a single value; we store the same text in both
                // zh and en slots so the renderer always finds it.
                const display = (typeof v === 'string') ? v : (v.zh || v.en || '');
                return (
                  <Field key={f.id} label={lang === 'zh' ? f.zh : f.en}>
                    {editing ? (
                      <input value={display}
                        onChange={e => { setCompanyField(f.id, 'zh', e.target.value); setCompanyField(f.id, 'en', e.target.value); }}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit' }} />
                    ) : (
                      <span style={{ color: 'var(--ink)' }}>{display || '—'}</span>
                    )}
                  </Field>
                );
              })}
              {SINGLE_FIELDS.map(f => {
                const v = (editing ? draft.company : data.company)?.[f.id] || '';
                return (
                  <Field key={f.id} label={lang === 'zh' ? f.zh : f.en}>
                    {editing ? (
                      <input value={v} onChange={e => setCompanyField(f.id, 'value', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 13, fontFamily: 'inherit' }} />
                    ) : (
                      <span style={{ color: 'var(--ink)' }}>{v || '—'}</span>
                    )}
                  </Field>
                );
              })}
            </div>
          </section>

          {/* Submissions: intakes + their RPs/RCs */}
          <section style={{
            background: 'white', border: '1px solid var(--line)', borderRadius: 12,
            padding: '18px 22px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 15 }}>📥</span>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)' }}>
                {lang === 'zh' ? '历次提交' : 'Submissions'}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {intakes.length} {lang === 'zh' ? '次' : (intakes.length === 1 ? 'intake' : 'intakes')}
              </span>
            </div>
            {intakes.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
                {lang === 'zh' ? '该伙伴尚未提交' : 'No submissions yet'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {intakes.map(intake => {
                const intakeRPs  = rolepacks.filter(r => r.intake_id === intake.id);
                const intakeCaps = capabilities.filter(c => c.intake_id === intake.id);
                return (
                  <div key={intake.id} style={{ background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{intake.id}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)' }}>{intake.name || '—'}</span>
                      {intake.industry_hint && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· {intake.industry_hint}</span>}
                      <StatusPill status={intake.status} lang={lang} />
                      <div style={{ flex: 1 }} />
                      <button onClick={() => navigate(`/curators/intake/${intake.id}`)}
                        style={{ background: 'transparent', border: '1px solid var(--plat-curator)', color: 'var(--plat-curator)', borderRadius: 6, padding: '4px 12px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {lang === 'zh' ? '审阅 →' : 'Open review →'}
                      </button>
                    </div>

                    {intakeRPs.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>RolePacks</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {intakeRPs.map(r => (
                            <button key={r.id}
                              onClick={() => navigate(`/curators/intake/${intake.id}`)}
                              title={lang === 'zh' ? '点击进入编辑' : 'click to edit'}
                              style={{
                                display: 'inline-flex', alignItems: 'baseline', gap: 5,
                                fontSize: 11.5, padding: '4px 10px', borderRadius: 6,
                                background: 'color-mix(in srgb, #3D8CC4 12%, white)',
                                border: '1px solid color-mix(in srgb, #3D8CC4 32%, transparent)',
                                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
                              }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2A6EA0', fontWeight: 700 }}>{r.rp_label}</span>
                              <span style={{ fontWeight: 500 }}>{lang === 'zh' ? (r.name_zh || r.name_en) : (r.name_en || r.name_zh) || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
                              <RPStatusDot status={r.status} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {intakeCaps.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>RoleCapabilities</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {intakeCaps.map(c => (
                            <button key={c.id}
                              onClick={() => navigate(`/curators/intake/${intake.id}`)}
                              title={lang === 'zh' ? '点击进入编辑' : 'click to edit'}
                              style={{
                                display: 'inline-flex', alignItems: 'baseline', gap: 4,
                                fontSize: 11, padding: '3px 9px', borderRadius: 999,
                                background: 'color-mix(in srgb, var(--plat-curator) 6%, white)',
                                border: '1px solid color-mix(in srgb, var(--plat-curator) 18%, transparent)',
                                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
                              }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--plat-curator)', fontWeight: 700 }}>{c.rc_label}</span>
                              <span>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh) || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <>
      <div style={{ color: 'var(--ink-3)', fontSize: 12, paddingTop: 6 }}>{label}</div>
      <div>{children}</div>
    </>
  );
}

function StatusPill({ status, lang }) {
  const labelMap = {
    draft: lang === 'zh' ? '草稿' : 'draft',
    submitted: lang === 'zh' ? '审阅中' : 'in review',
    review: lang === 'zh' ? '审阅中' : 'in review',
    revision: lang === 'zh' ? '需修改' : 'revision',
    approved: lang === 'zh' ? '已批准' : 'approved',
    published: lang === 'zh' ? '已发布' : 'published',
  };
  const colorMap = {
    draft:     { bg: 'var(--bg)', fg: 'var(--ink-3)' },
    submitted: { bg: 'color-mix(in srgb, #C28800 14%, white)', fg: '#8B6200' },
    review:    { bg: 'color-mix(in srgb, #C28800 14%, white)', fg: '#8B6200' },
    revision:  { bg: 'rgba(255,200,200,0.4)', fg: 'var(--st-empty-ink)' },
    approved:  { bg: 'color-mix(in srgb, var(--plat-curator) 12%, white)', fg: 'var(--plat-curator)' },
    published: { bg: 'color-mix(in srgb, var(--plat-supplier) 14%, white)', fg: 'var(--plat-supplier-2)' },
  };
  const c = colorMap[status] || colorMap.draft;
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
      {labelMap[status] || status}
    </span>
  );
}

function RPStatusDot({ status }) {
  const map = {
    published: { color: 'var(--plat-supplier-2)', t: 'published' },
    approved:  { color: 'var(--plat-curator)',    t: 'approved' },
    review:    { color: '#C28800',                t: 'in review' },
    submitted: { color: '#C28800',                t: 'submitted' },
    revision:  { color: 'var(--st-empty-ink)',    t: 'revision' },
    draft:     { color: 'var(--ink-3)',           t: 'draft' },
  };
  const m = map[status] || map.draft;
  return <span title={m.t} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: m.color, marginLeft: 4 }} />;
}
