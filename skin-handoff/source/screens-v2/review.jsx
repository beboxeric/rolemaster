// v2 Final review — read-only summary of every role + service+pricing.
// User clicks "Submit for review" here; that's the only place that triggers finalize.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes, taxonomy } from '../../api.js';

export function ScreenV2Review({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [det, setDet] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let abort = false;
    Promise.all([
      intakes.get(id),
      taxonomy.industries().catch(() => ({ items: [] })),
      taxonomy.companySizes().catch(() => ({ items: [] })),
      taxonomy.departments().catch(() => ({ items: [] })),
      taxonomy.regions().catch(() => ({ items: [] })),
    ]).then(([d, ind, sz, dp, rg]) => {
      if (abort) return;
      setDet(d);
      setIndustries(ind.items || []);
      setSizes(sz.items || []);
      setDepartments(dp.items || []);
      setRegions(rg.items || []);
    });
    return () => { abort = true; };
  }, [id]);

  const submit = async () => {
    try {
      setBusy(true); setErr('');
      await intakes.finalize(id);
      navigate(`/supplier/intake/${id}/done`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!det) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  if (det.intake?.status === 'submitted' || det.intake?.status === 'published') {
    // Already submitted — bounce to /done
    navigate(`/supplier/intake/${id}/done`, { replace: true });
    return null;
  }

  const rolepacks = det.rolepacks || [];
  const caps = det.capabilities || [];
  const indById = Object.fromEntries(industries.map(i => [i.id, i]));
  const sizeById = Object.fromEntries(sizes.map(s => [s.id, s]));
  const regionById = Object.fromEntries(regions.map(r => [r.id, r]));
  const sp = det.intake.service_pricing || {};

  const lookup = (id, dict) => {
    if (!id) return id;
    if (id.startsWith('custom:')) return id.slice(7);
    const it = dict[id];
    if (!it) return id;
    return lang === 'zh' ? (it.name_zh || it.name_en) : (it.name_en || it.name_zh);
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 600, color: 'var(--cop-border)',
          background: 'var(--cop-bg)', padding: '4px 10px', borderRadius: 999, marginBottom: 12,
        }}>📋 {lang === 'zh' ? '提交前最后确认' : 'Final review before submission'}</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? '请确认全部内容' : 'Review everything'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
          {lang === 'zh'
            ? '提交后内容会被锁定,审阅团队会在 1-3 个工作日内联系你。如需修改请先返回上一步。'
            : 'Once submitted, content will be locked. The review team will contact you within 1-3 business days. To make edits, go back first.'}
        </p>

        {/* Product header */}
        <Section title={lang === 'zh' ? '产品' : 'Product'} edit={() => navigate(`/supplier/onboard/${id}`)}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {det.intake.name || (lang === 'zh' ? '(未命名产品)' : '(Unnamed product)')}
          </div>
          {det.intake.free_text && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{det.intake.free_text}</div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
            {(det.files || []).length > 0 && `${(det.files || []).length} ${lang === 'zh' ? '份材料' : 'file(s) uploaded'}`}
          </div>
        </Section>

        {/* Capabilities */}
        <Section title={lang === 'zh' ? '能力' : 'Capabilities'} count={caps.length}
          edit={() => navigate(`/supplier/intake/${id}/capabilities`)}>
          <div style={{ display: 'grid', gap: 6 }}>
            {caps.map(c => (
              <div key={c.id} style={{ fontSize: 12.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--plat-supplier)', fontWeight: 700, marginRight: 8 }}>
                  {c.rc_label}
                </span>
                <span style={{ fontWeight: 600 }}>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Roles */}
        <Section title={lang === 'zh' ? '岗位' : 'Roles'} count={rolepacks.length}
          edit={() => navigate(`/supplier/intake/${id}/roles`)}>
          <div style={{ display: 'grid', gap: 14 }}>
            {rolepacks.map(rp => {
              const q = rp.questionnaire || {};
              const inds = (rp.industry || []).map(id => lookup(id, indById)).filter(Boolean);
              const szs = (rp.company_size || []).map(id => lookup(id, sizeById)).filter(Boolean);
              const dept = lang === 'zh' ? (rp.department?.zh || rp.department?.en) : (rp.department?.en || rp.department?.zh);
              return (
                <div key={rp.id} style={{ borderLeft: '3px solid var(--plat-supplier)', paddingLeft: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--plat-supplier)', fontWeight: 700 }}>{rp.rp_label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{(lang === 'zh' ? rp.name_zh : rp.name_en) || '—'}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 6 }}>
                    {[inds.join(' · '), dept, szs.join(' · ')].filter(Boolean).join(' · ')}
                    {rp.capability_ids?.length > 0 && (
                      <> · {rp.capability_ids.length} {lang === 'zh' ? '项能力' : 'capabilities'}</>
                    )}
                  </div>
                  <FieldLine label={lang === 'zh' ? '主要痛点' : 'Main pain'}
                    value={fieldValue(q, 'pain', 'main_pain', lang)} />
                  <FieldLine label={lang === 'zh' ? '价值/能力如何嵌入' : 'How it helps'}
                    value={fieldValue(q, 'how_it_helps', 'workflow_integration', lang)} />
                  <FieldLine label={lang === 'zh' ? '部署 / API' : 'Deployment / API'}
                    value={[
                      fieldValue(q, 'deployment', 'deployment_mode', lang),
                      fieldValue(q, 'deployment', 'api_endpoint', lang),
                    ].filter(Boolean).join(' · ')} />
                  <button onClick={() => navigate(`/supplier/intake/${id}/role/${rp.id}/details`)}
                    style={{ marginTop: 4, fontSize: 11.5, color: 'var(--plat-supplier)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {lang === 'zh' ? '查看完整 →' : 'View full →'}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Service & Pricing */}
        <Section title={lang === 'zh' ? '服务与价格' : 'Service & pricing'}
          edit={() => navigate(`/supplier/intake/${id}/service-pricing`)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12.5 }}>
            <KV label={lang === 'zh' ? '演示' : 'Demo'}
              v={renderList(sp.service?.demo_mode, lang)} />
            <KV label={lang === 'zh' ? '销售配合' : 'Sales assist'}
              v={renderId(sp.service?.sales_assist_level, [
                { id: 'any_stage', zh: '任何阶段都可参与', en: 'Available at any stage' },
                { id: 'high_value', zh: '仅重点/大客户', en: 'High-value clients only' },
                { id: 'demos_only', zh: '仅产品演示', en: 'Product demos only' },
                { id: 'closing_only', zh: '仅在签约阶段', en: 'Closing stage only' },
                { id: 'written_only', zh: '仅书面材料,不出席', en: 'Written materials only' },
                { id: 'on_request', zh: '按需,需提前预约', en: 'On request, with advance booking' },
              ], lang)} />
            <KV label={lang === 'zh' ? '辐射区域' : 'Coverage'}
              v={(sp.service?.sales_coverage_regions || []).map(r => lookup(r, regionById)).join(' · ')} />
            <KV label={lang === 'zh' ? '交付' : 'Delivery'} v={renderList(sp.service?.delivery_scope, lang)} />
            <KV label={lang === 'zh' ? '客服语言' : 'Support langs'} v={renderList(sp.service?.support_languages, lang)} />
            <KV label={lang === 'zh' ? '定价模式' : 'Model'} v={sp.pricing?.pricing_model} />
            <KV label={lang === 'zh' ? '成本价' : 'Cost'} v={sp.pricing?.cost_price} />
            <KV label={lang === 'zh' ? '建议零售价' : 'Suggested retail'} v={sp.pricing?.suggested_retail} />
            <KV label={lang === 'zh' ? '私有化起价' : 'Private from'} v={sp.pricing?.custom_service_pricing} />
            <KV label={lang === 'zh' ? '定制服务费' : 'Service fee'} v={sp.pricing?.service_fee} />
          </div>
        </Section>

        {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => navigate(`/supplier/intake/${id}/service-pricing`)}>
            ← {lang === 'zh' ? '返回修改' : 'Back to edit'}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}
            style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
            {busy ? '…' : (lang === 'zh' ? '确认无误,提交审阅 →' : 'Looks good — submit for review →')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, edit, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-ink)', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {title}
          {count != null && <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 500 }}>{count}</span>}
        </h3>
        {edit && (
          <button onClick={edit}
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--ink-2)', cursor: 'pointer' }}>
            ✎ Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function KV({ label, v }) {
  return (
    <>
      <div style={{ color: 'var(--ink-3)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color: v ? 'var(--ink)' : 'var(--ink-3)', fontStyle: v ? 'normal' : 'italic' }}>
        {v && (v.startsWith?.('custom:') ? v.slice(7) : v) || '—'}
      </div>
    </>
  );
}

function FieldLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.55 }}>
      <span style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 6 }}>{label}</span>
      <span style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function fieldValue(q, section, fid, lang) {
  const v = q[section]?.[fid];
  if (!v) return '';
  if (Array.isArray(v.value_zh)) return v.value_zh.join(' · ');
  return lang === 'zh' ? (v.value_zh || v.value_en || '') : (v.value_en || v.value_zh || '');
}

const DEMO_LABELS = [
  { id: 'onsite', zh: '现场演示', en: 'On-site' },
  { id: 'online_live', zh: '线上直播演示', en: 'Online live' },
  { id: 'recorded', zh: '录屏演示', en: 'Recorded' },
  { id: 'sandbox', zh: 'Sandbox 试用', en: 'Sandbox trial' },
  { id: 'pilot', zh: '小范围 PoC', en: 'Limited PoC' },
];
const DELIVERY_LABELS = [
  { id: 'product_only', zh: '产品交付', en: 'Product delivery only' },
  { id: 'with_onboarding', zh: '含上线培训', en: 'Incl. onboarding & training' },
  { id: 'full_impl', zh: '全栈实施', en: 'Full-stack implementation' },
  { id: 'integrations', zh: '系统集成', en: 'System integration' },
  { id: 'data_migration', zh: '数据迁移', en: 'Data migration' },
  { id: 'managed_service', zh: '托管运维', en: 'Managed service' },
];
const LANG_LABELS = [
  { id: 'zh', zh: '中文', en: 'Chinese' },
  { id: 'en', zh: '英文', en: 'English' },
];

function renderList(arr, lang) {
  if (!Array.isArray(arr)) return arr || '';
  const all = [...DEMO_LABELS, ...DELIVERY_LABELS, ...LANG_LABELS];
  return arr.map(id => {
    if (typeof id !== 'string') return '';
    if (id.startsWith('custom:')) return id.slice(7);
    const it = all.find(x => x.id === id);
    return it ? (lang === 'zh' ? it.zh : it.en) : id;
  }).filter(Boolean).join(' · ');
}

function renderId(v, options, lang) {
  if (!v) return '';
  if (typeof v !== 'string') return v;
  if (v.startsWith('custom:')) return v.slice(7);
  const it = options.find(o => o.id === v);
  return it ? (lang === 'zh' ? it.zh : it.en) : v;
}
