// v2 Shared service & pricing page (one-time, applies to all rolepacks).
// Includes the hierarchical regions picker for "sales coverage".

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes, taxonomy } from '../../api.js';
import { SearchablePicker, HierarchicalPicker } from './HierarchicalPicker.jsx';

const SALES_ASSIST_OPTIONS = [
  { id: 'any_stage',     label_zh: '任何阶段都可参与', label_en: 'Available at any stage' },
  { id: 'high_value',    label_zh: '仅重点/大客户',     label_en: 'High-value clients only' },
  { id: 'demos_only',    label_zh: '仅产品演示',        label_en: 'Product demos only' },
  { id: 'closing_only',  label_zh: '仅在签约阶段',      label_en: 'Closing stage only' },
  { id: 'written_only',  label_zh: '仅书面材料,不出席', label_en: 'Written materials only, no live calls' },
  { id: 'on_request',    label_zh: '按需,需提前预约',   label_en: 'On request, with advance booking' },
];

const DEMO_OPTIONS = [
  { id: 'onsite',         name_zh: '现场演示',     name_en: 'On-site' },
  { id: 'online_live',    name_zh: '线上直播演示', name_en: 'Online live' },
  { id: 'recorded',       name_zh: '录屏演示',     name_en: 'Recorded' },
  { id: 'sandbox',        name_zh: 'Sandbox 试用', name_en: 'Sandbox trial' },
  { id: 'pilot',          name_zh: '小范围 PoC',   name_en: 'Limited PoC' },
];

const DELIVERY_OPTIONS = [
  { id: 'product_only',   name_zh: '产品交付',         name_en: 'Product delivery only' },
  { id: 'with_onboarding', name_zh: '含上线培训',       name_en: 'Incl. onboarding & training' },
  { id: 'full_impl',      name_zh: '全栈实施',         name_en: 'Full-stack implementation' },
  { id: 'integrations',   name_zh: '系统集成',         name_en: 'System integration' },
  { id: 'data_migration', name_zh: '数据迁移',         name_en: 'Data migration' },
  { id: 'managed_service', name_zh: '托管运维',         name_en: 'Managed service' },
];

const LANGUAGE_OPTIONS = [
  { id: 'zh',  name_zh: '中文',     name_en: 'Chinese' },
  { id: 'en',  name_zh: '英文',     name_en: 'English' },
];

// Legacy values came in as plain strings; normalize to arrays.
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return [`custom:${v.trim()}`];
  return [];
}

export function ScreenV2ServicePricing({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [vals, setVals] = useState({
    service: { demo_mode: '', sales_assist_level: '', sales_coverage_regions: [], delivery_scope: '', support_languages: '' },
    pricing: { pricing_model: '', cost_price: '', suggested_retail: '', custom_service_pricing: '', service_fee: '' },
  });
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(id);
        if (abort) return;
        if (det.intake?.service_pricing) {
          const sp = det.intake.service_pricing;
          // Normalize legacy string fields to arrays so the multi-select pickers work.
          if (sp.service) {
            sp.service.demo_mode = toArray(sp.service.demo_mode);
            sp.service.delivery_scope = toArray(sp.service.delivery_scope);
            sp.service.support_languages = toArray(sp.service.support_languages);
          }
          setVals(sp);
        } else {
          // Default empty arrays for the multi-select fields.
          setVals(prev => ({
            ...prev,
            service: { ...prev.service, demo_mode: [], delivery_scope: [], support_languages: [] },
          }));
        }
        const r = await taxonomy.regions().catch(() => ({ items: [] }));
        if (!abort) setRegions(r.items || []);
      } catch (e) { setErr(e.message); }
    })();
    return () => { abort = true; };
  }, [id]);

  const setS = (k, v) => setVals(prev => ({ ...prev, service: { ...prev.service, [k]: v } }));
  const setP = (k, v) => setVals(prev => ({ ...prev, pricing: { ...prev.pricing, [k]: v } }));

  const save = async () => {
    try {
      setBusy(true); setErr('');
      await intakes.patch(id, { service_pricing: vals });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const submitAll = async () => {
    try {
      setBusy(true); setErr('');
      await intakes.patch(id, { service_pricing: vals });
      navigate(`/supplier/intake/${id}/review`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 600, color: 'var(--cop-border)',
          background: 'var(--cop-bg)', padding: '4px 10px', borderRadius: 999, marginBottom: 12,
        }}>🔗 {lang === 'zh' ? '此部分对所有岗位共享' : 'Shared across all Roles'}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? '服务与价格' : 'Service & pricing'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
          {lang === 'zh' ? '只填一次,所有岗位共用。' : 'Fill once — applies to all your Roles.'}
        </p>

        {/* Service */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 14px' }}>{lang === 'zh' ? '服务' : 'Service'}</h3>

          <div style={{ marginBottom: 12 }}>
            <label className="field-label">{lang === 'zh' ? '演示偏好' : 'Demo preferences'}</label>
            <HierarchicalPicker
              items={DEMO_OPTIONS.map(o => ({ ...o, parent_id: null }))}
              selected={vals.service.demo_mode || []}
              onChange={(next) => { setS('demo_mode', next); setTimeout(save, 0); }}
              lang={lang}
              placeholder={lang === 'zh' ? '+ 选择 / 自定义' : '+ Pick / custom'} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="field-label">{lang === 'zh' ? '销售配合意愿' : 'Sales-assist willingness'}</label>
            <SearchablePicker
              items={SALES_ASSIST_OPTIONS}
              selected={vals.service.sales_assist_level || ''}
              onChange={(v) => { setS('sales_assist_level', v); setTimeout(save, 0); }}
              lang={lang}
              placeholder={lang === 'zh' ? '— 选择 / 搜索 / 自定义 —' : '— Pick / search / custom —'} />
          </div>

          <RegionPicker lang={lang} regions={regions}
            label={{ zh: '销售辐射区域', en: 'Sales coverage regions' }}
            selected={vals.service.sales_coverage_regions || []}
            onChange={(next) => { setS('sales_coverage_regions', next); setTimeout(save, 0); }} />

          <div style={{ marginBottom: 12 }}>
            <label className="field-label">{lang === 'zh' ? '交付范围' : 'Delivery scope'}</label>
            <HierarchicalPicker
              items={DELIVERY_OPTIONS.map(o => ({ ...o, parent_id: null }))}
              selected={vals.service.delivery_scope || []}
              onChange={(next) => { setS('delivery_scope', next); setTimeout(save, 0); }}
              lang={lang}
              placeholder={lang === 'zh' ? '+ 选择 / 自定义' : '+ Pick / custom'} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="field-label">{lang === 'zh' ? '客户服务语言' : 'Support languages'}</label>
            <HierarchicalPicker
              items={LANGUAGE_OPTIONS.map(o => ({ ...o, parent_id: null }))}
              selected={vals.service.support_languages || []}
              onChange={(next) => { setS('support_languages', next); setTimeout(save, 0); }}
              lang={lang}
              placeholder={lang === 'zh' ? '+ 中文 / 英文 / 自定义' : '+ Chinese / English / custom'} />
          </div>
        </div>

        {/* Pricing */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 14px' }}>{lang === 'zh' ? '价格' : 'Pricing'}</h3>

          <Field lang={lang} label={{ zh: '定价模式', en: 'Pricing model' }}
            value={vals.pricing.pricing_model}
            onChange={v => setP('pricing_model', v)} onBlur={save}
            placeholder={{ zh: '年度许可 / 按用量 / 项目制', en: 'Annual license / Usage-based / Project' }} />

          <Field lang={lang} label={{ zh: '成本价', en: 'Cost price' }}
            value={vals.pricing.cost_price}
            onChange={v => setP('cost_price', v)} onBlur={save}
            placeholder={{ zh: '一次性 20 万', en: 'CNY 200K one-off' }} />

          <Field lang={lang} label={{ zh: '建议零售价', en: 'Suggested retail' }}
            value={vals.pricing.suggested_retail}
            onChange={v => setP('suggested_retail', v)} onBlur={save}
            placeholder={{ zh: '一次性 50 万', en: 'CNY 500K one-off' }} />

          <Field lang={lang} label={{ zh: '私有化部署起价(可选)', en: 'Private deployment from (optional)' }}
            value={vals.pricing.custom_service_pricing}
            onChange={v => setP('custom_service_pricing', v)} onBlur={save}
            placeholder={{ zh: '20 万起', en: 'From CNY 200K' }} optional />

          <Field lang={lang} label={{ zh: '定制服务费(可选)', en: 'Custom service fee (optional)' }}
            value={vals.pricing.service_fee}
            onChange={v => setP('service_fee', v)} onBlur={save}
            placeholder={{ zh: '3,000/人天', en: 'CNY 3,000/person-day' }} optional />
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>← {lang === 'zh' ? '返回' : 'Back'}</button>
          <button className="btn btn-primary" onClick={submitAll} disabled={busy}
            style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
            {busy ? '…' : (lang === 'zh' ? '下一步:最终确认 →' : 'Next: review & submit →')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ lang, label, value, onChange, onBlur, placeholder, optional }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field-label">
        {label[lang]}
        {optional && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink-3)', fontWeight: 400 }}>{lang === 'zh' ? '(可选)' : '(optional)'}</span>}
      </label>
      <input className="text-input" value={value || ''} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        placeholder={placeholder?.[lang] || ''} style={{ fontSize: 13 }} />
    </div>
  );
}

// Hierarchical region picker with search (zh+en) and custom self-type.
function RegionPicker({ lang, regions, label, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [customText, setCustomText] = useState('');
  const ref = useRef(null);
  const byParent = {};
  for (const r of regions) {
    const p = r.parent_id || '_root';
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(r);
  }
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const lbl = (r) => lang === 'zh' ? r.name_zh : r.name_en;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Search across name_zh + name_en.
  const flatMatches = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return regions.filter(r =>
      (r.name_zh || '').toLowerCase().includes(q)
      || (r.name_en || '').toLowerCase().includes(q));
  })();

  const addCustom = () => {
    const v = customText.trim();
    if (!v) return;
    const id = 'custom:' + v;
    if (!selected.includes(id)) onChange([...selected, id]);
    setCustomText('');
  };

  const labelForId = (id) => {
    if (id.startsWith('custom:')) return id.slice(7);
    const r = regions.find(x => x.id === id);
    return r ? lbl(r) : id;
  };

  return (
    <div ref={ref} style={{ marginBottom: 12, position: 'relative' }}>
      <label className="field-label">{label[lang]}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', minHeight: 36, border: '1px solid var(--line)', borderRadius: 8, background: 'white' }}>
        {selected.map(id => (
          <span key={id} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 999,
            background: 'var(--plat-supplier)', color: 'white',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {labelForId(id)}
            {id.startsWith('custom:') && <span style={{ fontSize: 9, opacity: 0.7, fontStyle: 'italic' }}>(自定义)</span>}
            <button onClick={() => toggle(id)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12 }}>×</button>
          </span>
        ))}
        <button onClick={() => setOpen(!open)}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'white', color: 'var(--ink-2)', border: '1px dashed var(--line)', cursor: 'pointer' }}>
          {lang === 'zh' ? '+ 选择区域' : '+ Pick regions'}
        </button>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30,
          background: 'white', border: '1px solid var(--line)', borderRadius: 8,
          minWidth: 320, maxWidth: 420, maxHeight: 360, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--line-2)' }}>
            <input autoFocus value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'zh' ? '搜索区域(中/英)…' : 'Search regions (zh/en)…'}
              style={{
                width: '100%', padding: '6px 10px', fontSize: 12.5,
                border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
              }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {flatMatches ? (
              flatMatches.length === 0
                ? <div style={{ padding: 12, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                    {lang === 'zh' ? '没有匹配项,可在下方自定义。' : 'No matches — add custom below.'}
                  </div>
                : flatMatches.map(r => {
                    const checked = selected.includes(r.id);
                    const parent = regions.find(x => x.id === r.parent_id);
                    return (
                      <div key={r.id}
                        onClick={() => toggle(r.id)}
                        style={{
                          padding: '6px 10px', cursor: 'pointer', borderRadius: 6,
                          fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
                          background: checked ? 'var(--plat-supplier-tint)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                        <span style={{ width: 14 }}>{checked ? '✓' : ''}</span>
                        <span>{lbl(r)}</span>
                        {parent && <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>{lbl(parent)}</span>}
                      </div>
                    );
                  })
            ) : (
              (byParent['_root'] || []).map(top => {
                const children = byParent[top.id] || [];
                const isExp = !!expanded[top.id];
                return (
                  <div key={top.id} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px' }}>
                      {children.length > 0 ? (
                        <button onClick={() => setExpanded(e => ({ ...e, [top.id]: !e[top.id] }))}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--ink-3)', padding: 0, width: 14 }}>
                          {isExp ? '▾' : '▸'}
                        </button>
                      ) : <span style={{ width: 14 }} />}
                      <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                        <input type="checkbox" checked={selected.includes(top.id)} onChange={() => toggle(top.id)} />
                        <span style={{ fontWeight: 600 }}>{lbl(top)}</span>
                      </label>
                    </div>
                    {isExp && children.map(child => {
                      const grand = byParent[child.id] || [];
                      const isExp2 = !!expanded[child.id];
                      return (
                        <div key={child.id} style={{ marginLeft: 18 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px' }}>
                            {grand.length > 0 ? (
                              <button onClick={() => setExpanded(e => ({ ...e, [child.id]: !e[child.id] }))}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--ink-3)', padding: 0, width: 14 }}>
                                {isExp2 ? '▾' : '▸'}
                              </button>
                            ) : <span style={{ width: 14 }} />}
                            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                              <input type="checkbox" checked={selected.includes(child.id)} onChange={() => toggle(child.id)} />
                              <span>{lbl(child)}</span>
                            </label>
                          </div>
                          {isExp2 && grand.map(g => (
                            <div key={g.id} style={{ marginLeft: 22, padding: '3px 6px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5 }}>
                                <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggle(g.id)} />
                                <span>{lbl(g)}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 6 }}>
            <input value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder={lang === 'zh' ? '+ 自定义区域' : '+ Custom region'}
              style={{
                flex: 1, padding: '6px 10px', fontSize: 12,
                border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
              }} />
            <button onClick={addCustom} disabled={!customText.trim()}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                background: customText.trim() ? 'var(--plat-supplier)' : 'var(--bg)',
                color: customText.trim() ? 'white' : 'var(--ink-3)',
                border: 'none', borderRadius: 6,
                cursor: customText.trim() ? 'pointer' : 'not-allowed',
              }}>
              {lang === 'zh' ? '加入' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
