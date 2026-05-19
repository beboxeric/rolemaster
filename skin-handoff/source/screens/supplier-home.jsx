// Supplier dashboard — two panes: company info (editable) on the left,
// products (intakes) list with add/delete on the right.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../chrome.jsx';
import { intakes, companyInfo as companyApi } from '../api.js';
import { useAuth } from '../auth.jsx';

function nextRouteForIntake(intake) {
  const id = intake.id;
  switch (intake.status) {
    case 'draft':                  return `/supplier/onboard/${id}`;
    case 'analyzing_capabilities':
    case 'capabilities_ready':     return `/supplier/intake/${id}/capabilities`;
    case 'matching_roles':
    case 'roles_ready':            return `/supplier/intake/${id}/roles`;
    case 'filling_details':        return `/supplier/intake/${id}/roles`;
    case 'pricing':                return `/supplier/intake/${id}/service-pricing`;
    case 'submitted':              return `/supplier/intake/${id}/done`;
    default:                       return `/supplier/intake/${id}/capabilities`;
  }
}

const COMPANY_FIELDS = [
  { key: 'company_name',    zh: '公司名称',     en: 'Company name',     required: true },
  { key: 'company_hq',      zh: '总部',         en: 'Headquarters',     required: true },
  { key: 'website',         zh: '官网',         en: 'Website',          single: true },
  { key: 'company_team',    zh: '团队规模',     en: 'Team size' },
  { key: 'company_founded', zh: '成立年份',     en: 'Founded' },
  { key: 'company_clients', zh: '现有企业客户', en: 'Enterprise clients' },
];

function stageLabel(status, lang) {
  const labels = {
    draft: { zh: '草稿', en: 'Draft' },
    analyzing_capabilities: { zh: 'AI 分析中', en: 'Analyzing' },
    capabilities_ready: { zh: '能力待确认', en: 'Capabilities' },
    matching_roles: { zh: 'AI 匹配岗位', en: 'Matching' },
    roles_ready: { zh: '岗位待确认', en: 'Roles' },
    filling_details: { zh: '完善岗位', en: 'Details' },
    pricing: { zh: '服务与价格', en: 'Pricing' },
    submitted: { zh: '已提交审阅', en: 'In review' },
  };
  return labels[status]?.[lang] || status;
}

export function ScreenSupplierHome({ lang, setLang, onLogout }) {
  const navigate = useNavigate();
  const { supplier, refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const [{ items }, co] = await Promise.all([
          intakes.list().catch(() => ({ items: [] })),
          companyApi.get().catch(() => ({ company: {} })),
        ]);
        if (abort) return;
        setItems(items || []);
        setCompany(co?.company || {});
        // First-time supplier with no company info → push to setup.
        const hasCompany = co?.company?.company_name?.zh || co?.company?.company_name?.en;
        if (!hasCompany) navigate('/supplier/company-setup', { replace: true });
      } finally { if (!abort) setLoading(false); }
    })();
    return () => { abort = true; };
  }, []);

  const startNew = () => navigate('/supplier/onboard');

  const removeIntake = async (intake) => {
    const label = intake.name || intake.id;
    if (!confirm(lang === 'zh' ? `删除产品「${label}」?此操作不可撤销。` : `Delete "${label}"? This cannot be undone.`)) return;
    try {
      const r = await intakes.remove(intake.id);
      if (!r.ok) {
        alert(lang === 'zh' ? '该产品已发布,无法删除。' : 'This product is published and cannot be deleted.');
        return;
      }
      setItems(prev => prev.filter(i => i.id !== intake.id));
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="platform-supplier hero-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout}
        supplierName={supplier?.short_name ?? supplier?.name} />
      <main style={{ flex: 1, padding: '32px 24px 64px', maxWidth: 1180, width: '100%', margin: '0 auto' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24, alignItems: 'flex-start' }}>
            <CompanyPane lang={lang} company={company || {}}
              onSaved={async () => { const co = await companyApi.get(); setCompany(co?.company || {}); await refresh?.(); }} />
            <ProductsPane lang={lang} items={items} onAdd={startNew} onOpen={(it) => navigate(nextRouteForIntake(it))} onDelete={removeIntake} />
          </div>
        )}
      </main>
    </div>
  );
}

function CompanyPane({ lang, company, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState(() => ({
    company_name: company.company_name?.zh || company.company_name?.en || '',
    company_hq: company.company_hq?.zh || company.company_hq?.en || '',
    company_team: company.company_team?.zh || company.company_team?.en || '',
    company_founded: company.company_founded?.zh || company.company_founded?.en || '',
    company_clients: company.company_clients?.zh || company.company_clients?.en || '',
    website: company.website || '',
  }));
  const [busy, setBusy] = useState(false);

  // Re-sync when external company prop changes (e.g. after save).
  useEffect(() => {
    if (editing) return;
    setVals({
      company_name: company.company_name?.zh || company.company_name?.en || '',
      company_hq: company.company_hq?.zh || company.company_hq?.en || '',
      company_team: company.company_team?.zh || company.company_team?.en || '',
      company_founded: company.company_founded?.zh || company.company_founded?.en || '',
      company_clients: company.company_clients?.zh || company.company_clients?.en || '',
      website: company.website || '',
    });
  }, [company]);

  const save = async () => {
    try {
      setBusy(true);
      await companyApi.patch({
        company_name: vals.company_name,
        company_hq: vals.company_hq,
        company_team: vals.company_team,
        company_founded: vals.company_founded,
        company_clients: vals.company_clients,
        website: vals.website,
      });
      setEditing(false);
      await onSaved?.();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 14, padding: 22, position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>
          {lang === 'zh' ? '公司资料' : 'Company info'}
        </h2>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
            {lang === 'zh' ? '编辑' : 'Edit'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(false)} disabled={busy}
              style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, color: 'var(--ink-3)', cursor: 'pointer' }}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button onClick={save} disabled={busy}
              style={{ background: 'var(--plat-supplier)', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, color: 'white', cursor: 'pointer', fontWeight: 600 }}>
              {busy ? '…' : (lang === 'zh' ? '保存' : 'Save')}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {COMPANY_FIELDS.map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {f[lang]}
              {f.required && <span style={{ color: 'var(--st-empty-ink)', marginLeft: 3 }}>*</span>}
            </div>
            {editing ? (
              <input className="text-input" value={vals[f.key] || ''}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                style={{ fontSize: 13, padding: '6px 10px' }} />
            ) : (
              <div style={{ fontSize: 13, color: vals[f.key] ? 'var(--ink)' : 'var(--ink-3)', wordBreak: 'break-word' }}>
                {vals[f.key] || (lang === 'zh' ? '— 未填 —' : '— not set —')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsPane({ lang, items, onAdd, onOpen, onDelete }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: 0, letterSpacing: '-0.01em' }}>
            {lang === 'zh' ? '我的产品入驻' : 'My products'}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: '4px 0 0' }}>
            {lang === 'zh'
              ? '每款产品独立入驻。提交审阅后,审阅团队会逐一处理。'
              : 'Each product is submitted separately. Once submitted, the review team works through them.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}
          style={{ padding: '10px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          + {lang === 'zh' ? '入驻新产品' : 'New product'}
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px dashed var(--line)', borderRadius: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--plat-supplier-tint)', color: 'var(--plat-supplier)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>📦</div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
            {lang === 'zh' ? '还没入驻产品' : 'No products yet'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            {lang === 'zh'
              ? '上传一款产品的资料,AI 会帮你梳理出能担起的岗位角色。'
              : 'Upload one product\'s materials and AI will organize them into Capabilities + Roles.'}
          </p>
          <button className="btn btn-primary" onClick={onAdd}>
            {lang === 'zh' ? '入驻第一款产品 →' : 'Add your first product →'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(it => {
            const ts = it.updated_at || it.created_at;
            const label = it.name || (lang === 'zh' ? '(未命名产品)' : '(Unnamed product)');
            // Once submitted, the curator owns the queue — delete is locked.
            const canDelete = !['submitted', 'published'].includes(it.status);
            return (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'white', border: '1px solid var(--line)',
                borderLeft: '3px solid var(--plat-supplier)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                    {(() => {
                      // Single pill: prefer "已发布" if any rolepack is published; else "审阅中" once submitted; else stage label.
                      const isPublished = it.rolepack_published > 0;
                      const isInReview = it.status === 'submitted' && !isPublished;
                      const text = isPublished
                        ? (lang === 'zh' ? '已发布' : 'Published')
                        : isInReview
                          ? (lang === 'zh' ? '审阅中' : 'In review')
                          : stageLabel(it.status, lang);
                      const klass = isPublished ? 'filled' : isInReview ? 'ai' : 'ai';
                      return <span className={`status-badge ${klass}`} style={{ fontSize: 10.5, padding: '2px 8px' }}>{text}</span>;
                    })()}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {it.id} · {ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString() : ''}
                  </div>
                  {it.free_text && (
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {it.free_text}
                    </div>
                  )}
                </div>
                <button onClick={() => onOpen(it)}
                  style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    color: 'var(--plat-supplier)', background: 'transparent',
                    borderRadius: 6, border: '1px solid var(--plat-supplier)', cursor: 'pointer' }}>
                  {it.status === 'submitted' ? (lang === 'zh' ? '查看' : 'View') : (lang === 'zh' ? '继续' : 'Continue')} →
                </button>
                {canDelete && (
                  <button onClick={() => onDelete(it)}
                    title={lang === 'zh' ? '删除' : 'Delete'}
                    style={{ padding: '6px 10px', fontSize: 16, lineHeight: 1,
                      color: 'var(--ink-3)', background: 'transparent',
                      border: '1px solid transparent', cursor: 'pointer', borderRadius: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--st-empty-ink)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
