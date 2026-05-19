// v2 Roles review — AI-derived role cards, supplier edits + confirms.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes, taxonomy } from '../../api.js';
import { KnowledgeCardCarousel } from './KnowledgeCards.jsx';
import { HierarchicalPicker } from './HierarchicalPicker.jsx';
import { UnderReviewBanner, PublishedBanner, isLocked } from './StatusBanner.jsx';

export function ScreenV2Roles({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [phase, setPhase] = useState('loading');
  const [caps, setCaps] = useState([]);
  const [rolepacks, setRolepacks] = useState([]);
  const [intake, setIntake] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fired = useRef(false);
  const locked = isLocked(intake?.status);

  // Load taxonomies once
  useEffect(() => {
    Promise.all([
      taxonomy.industries().catch(() => ({ items: [] })),
      taxonomy.companySizes().catch(() => ({ items: [] })),
      taxonomy.departments().catch(() => ({ items: [] })),
    ]).then(([ind, sz, dp]) => {
      setIndustries(ind.items || []);
      setSizes(sz.items || []);
      setDepartments(dp.items || []);
    });
  }, []);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(id);
        if (abort) return;
        setIntake(det.intake);
        setCaps(det.capabilities || []);
        if (det.rolepacks?.length) {
          setRolepacks(det.rolepacks);
          setPhase('review');
        } else if (!fired.current) {
          fired.current = true;
          setPhase('loading');
          const res = await intakes.matchRoles(id);
          if (abort) return;
          if (!res.ok) { setErr(res.reason || ''); setPhase('error'); return; }
          const det2 = await intakes.get(id);
          if (abort) return;
          setRolepacks(det2.rolepacks || []);
          setPhase('review');
        }
      } catch (e) { setErr(e.message); setPhase('error'); }
    })();
    return () => { abort = true; };
  }, [id]);

  const updateRpLocal = (rpId, patch) => setRolepacks(prev => prev.map(r => r.id === rpId ? { ...r, ...patch } : r));

  const saveRp = async (rp, body) => {
    updateRpLocal(rp.id, body);
    try { await intakes.patchRolepack(id, rp.id, body); } catch (e) { setErr(e.message); }
  };

  const toggleCap = async (rp, capId) => {
    const has = (rp.capability_ids || []).includes(capId);
    const next = has ? rp.capability_ids.filter(x => x !== capId) : [...(rp.capability_ids || []), capId];
    saveRp(rp, { capability_ids: next });
  };

  const removeRp = async (rp) => {
    if (!confirm(lang === 'zh' ? `删除 ${rp.rp_label} ${rp.name_zh}?` : `Delete ${rp.rp_label} ${rp.name_en}?`)) return;
    try {
      await intakes.deleteRolepack(id, rp.id);
      setRolepacks(prev => prev.filter(r => r.id !== rp.id));
    } catch (e) { setErr(e.message); }
  };

  const addRp = async () => {
    try {
      setBusy(true);
      await intakes.addRolepack(id, {
        name: { zh: '', en: '' }, industry: [], company_size: [], department: { zh: '', en: '' }, capability_ids: [],
      });
      const det = await intakes.get(id);
      setRolepacks(det.rolepacks || []);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const rematch = async () => {
    if (!confirm(lang === 'zh' ? '重新匹配会清除当前所有岗位(包括你已编辑的)。继续?' : 'Re-match will wipe all current Roles (including your edits). Continue?')) return;
    fired.current = true;
    setPhase('loading');
    try {
      const res = await intakes.matchRoles(id);
      if (!res.ok) { setErr(res.reason || ''); setPhase('error'); return; }
      const det = await intakes.get(id);
      setRolepacks(det.rolepacks || []);
      setPhase('review');
    } catch (e) { setErr(e.message); setPhase('error'); }
  };

  const continueToDetails = async () => {
    const incomplete = rolepacks.filter(r =>
      (!r.name_zh && !r.name_en) || !(r.capability_ids?.length)
    );
    if (incomplete.length > 0) {
      setErr(lang === 'zh' ? '每个岗位至少需要一个能力和名称' : 'Each Role needs a name + at least one capability');
      return;
    }
    if (rolepacks.length === 0) { setErr(lang === 'zh' ? '至少保留一个岗位' : 'Keep at least one Role'); return; }

    // Prefill any role that doesn't have a questionnaire yet — in parallel.
    const needPrefill = rolepacks.filter(r => !r.questionnaire);
    if (needPrefill.length > 0) {
      setPhase('prefilling');
      await Promise.all(needPrefill.map(r =>
        intakes.prefillRolepack(id, r.id).catch(() => null)
      ));
    }
    navigate(`/supplier/intake/${id}/role/${rolepacks[0].id}/details`);
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />

      {phase === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {lang === 'zh' ? 'AI 正在匹配岗位…' : 'AI is matching Roles…'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 24px' }}>
              {lang === 'zh' ? '我们正在用你的能力配出最适合的岗位组合。' : 'Bundling your capabilities into the best-fit Roles.'}
            </p>
            <KnowledgeCardCarousel stage="roles" lang={lang} etaSeconds={45} />
          </div>
        </div>
      )}

      {phase === 'prefilling' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {lang === 'zh' ? 'AI 正在为每个岗位起草答案…' : 'AI is drafting answers for each Role…'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 24px' }}>
              {lang === 'zh'
                ? '基于这些岗位的常见职责 + 你产品要解决的问题,自动填写每个岗位的画像、痛点、价值。'
                : 'Drafting profile, pain, and value for each Role using common job duties + the problems your product solves.'}
            </p>
            <KnowledgeCardCarousel stage="roles" lang={lang} etaSeconds={45} />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 460, textAlign: 'center' }}>
            <p style={{ color: 'var(--st-empty-ink)', marginBottom: 16 }}>⚠ {err}</p>
            <button className="btn btn-primary" onClick={rematch}>{lang === 'zh' ? '重试匹配' : 'Retry'}</button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
          {locked && (intake.status === 'published' ? <PublishedBanner lang={lang} /> : <UnderReviewBanner lang={lang} intake={intake} />)}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, color: 'var(--cop-border)',
            background: 'var(--cop-bg)', padding: '4px 10px', borderRadius: 999, marginBottom: 12,
          }}>
            <span>✦</span> {lang === 'zh' ? `AI 匹配到 ${rolepacks.length} 个岗位` : `AI matched ${rolepacks.length} Roles`}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            {lang === 'zh' ? '请确认岗位匹配' : 'Confirm Role match'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
            {lang === 'zh'
              ? '每个岗位会担起企业里某个具体职能。同一项能力可以服务多个岗位。下一步会逐个完善每个岗位的细节。'
              : 'Each Role takes on one specific job inside an enterprise. The same Capability can serve multiple Roles. Next step: fill in each Role\'s details.'}
          </p>

          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            {rolepacks.map(rp => (
              <RoleCard key={rp.id} rp={rp} lang={lang} caps={caps} locked={locked}
                industries={industries} sizes={sizes} departments={departments}
                onChange={(patch) => saveRp(rp, patch)}
                onToggleCap={(capId) => toggleCap(rp, capId)}
                onDelete={() => removeRp(rp)} />
            ))}
          </div>

          {!locked && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              <button onClick={addRp} disabled={busy}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: 'transparent', color: 'var(--cop-border)',
                  border: '1px dashed var(--cop-border)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                + {lang === 'zh' ? '添加岗位' : 'Add Role'}
              </button>
              <button onClick={rematch}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'transparent', color: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                ↻ {lang === 'zh' ? '重新匹配' : 'Re-match'}
              </button>
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => navigate(locked ? '/supplier' : `/supplier/intake/${id}/capabilities`)}>
              ← {lang === 'zh' ? (locked ? '返回主页' : '返回能力') : (locked ? 'Back to home' : 'Back to Capabilities')}
            </button>
            {!locked && (
              <button className="btn btn-primary" onClick={continueToDetails} disabled={busy || rolepacks.length === 0}
                style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
                {lang === 'zh' ? '下一步:完善每个岗位 →' : 'Next: fill in each Role →'}
              </button>
            )}
            {locked && rolepacks[0] && (
              <button className="btn btn-primary"
                onClick={() => navigate(`/supplier/intake/${id}/role/${rolepacks[0].id}/details`)}
                style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
                {lang === 'zh' ? '查看岗位详情 →' : 'View Role details →'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCard({ rp, lang, caps, industries, sizes, departments, locked, onChange, onToggleCap, onDelete }) {
  const [name, setName] = useState(lang === 'zh' ? (rp.name_zh || '') : (rp.name_en || ''));
  // Re-sync the input when language changes or the rolepack data refreshes.
  useEffect(() => {
    setName(lang === 'zh' ? (rp.name_zh || '') : (rp.name_en || ''));
  }, [lang, rp.name_zh, rp.name_en]);

  return (
    <div style={{
      background: 'white', border: '1px solid var(--line)',
      borderLeft: '3px solid var(--plat-supplier)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--plat-supplier)', fontWeight: 700 }}>
            {rp.rp_label}
          </span>
          <input value={name} readOnly={locked}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !locked && onChange(lang === 'zh' ? { name: { zh: name, en: rp.name_en || name } } : { name: { zh: rp.name_zh || name, en: name } })}
            placeholder={lang === 'zh' ? '岗位名称(如:反洗钱专员)' : 'Role name (e.g. AML Officer)'}
            style={{
              flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--navy-ink)',
              border: 'none', outline: 'none', background: 'transparent', padding: '2px 4px',
            }} />
        </div>
        {!locked && (
          <button onClick={onDelete}
            style={{ fontSize: 16, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
        )}
      </div>

      {/* Industry — hierarchical multi-select */}
      <Row label={lang === 'zh' ? '行业' : 'Industry'}>
        <HierarchicalPicker
          items={industries}
          selected={rp.industry || []}
          onChange={(next) => onChange({ industry: next })}
          lang={lang}
          disabled={locked}
          placeholder={lang === 'zh' ? '+ 选择行业' : '+ Pick industries'} />
      </Row>

      {/* Company size — flat multi-select with custom (no category wrapper) */}
      <Row label={lang === 'zh' ? '公司规模' : 'Company size'}>
        <HierarchicalPicker
          items={sizes.map(s => ({ id: s.id, parent_id: null, name_zh: s.name_zh, name_en: s.name_en }))}
          selected={rp.company_size || []}
          onChange={(next) => onChange({ company_size: next })}
          lang={lang}
          disabled={locked}
          placeholder={lang === 'zh' ? '+ 选择规模' : '+ Pick sizes'} />
      </Row>

      {/* Department — hierarchical single-select. Stores {_id, zh, en}. */}
      <Row label={lang === 'zh' ? '所属部门' : 'Department'}>
        <HierarchicalPicker
          items={departments}
          selected={
            rp.department?._id ? [rp.department._id]
            : rp.department?.zh
              ? (() => {
                  const match = departments.find(d => d.name_zh === rp.department.zh || d.name_en === rp.department.en);
                  return match ? [match.id] : [`custom:${rp.department.zh}`];
                })()
              : []
          }
          onChange={(next) => {
            const id = next[next.length - 1] || null;
            if (!id) return onChange({ department: { zh: '', en: '' } });
            if (id.startsWith('custom:')) {
              const v = id.slice(7);
              return onChange({ department: { _id: id, zh: v, en: v } });
            }
            const opt = departments.find(d => d.id === id);
            if (opt) onChange({ department: { _id: id, zh: opt.name_zh, en: opt.name_en } });
          }}
          lang={lang}
          multi={false}
          disabled={locked}
          placeholder={lang === 'zh' ? '+ 选择部门' : '+ Pick department'} />
      </Row>

      {/* Capabilities */}
      <Row label={lang === 'zh' ? '包含能力' : 'Capabilities'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {caps.filter(c => !locked || (rp.capability_ids || []).includes(c.id)).map(c => {
            const checked = (rp.capability_ids || []).includes(c.id);
            const name = (lang === 'zh' ? c.name_zh : c.name_en) || c.name_en || c.name_zh || '';
            return (
              <button key={c.id}
                onClick={() => !locked && onToggleCap(c.id)}
                disabled={locked}
                title={name}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 999,
                  background: checked ? 'var(--plat-supplier)' : 'white',
                  color: checked ? 'white' : 'var(--ink-2)',
                  border: `1px solid ${checked ? 'var(--plat-supplier)' : 'var(--line)'}`,
                  cursor: locked ? 'default' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  opacity: locked && !checked ? 0.5 : 1,
                }}>
                {!locked && <span>{checked ? '✓' : '+'}</span>}
                {locked && checked && <span>✓</span>}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.75 }}>{c.rc_label}</span>
                {name && <span>{name}</span>}
              </button>
            );
          })}
        </div>
      </Row>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ minWidth: 80, fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, paddingTop: 4 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function ChipPicker({ options, selected, onChange, lang, placeholder }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {selected.map(id => {
        const opt = options.find(o => o.id === id);
        return (
          <span key={id} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 999,
            background: 'var(--plat-supplier)', color: 'white',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {opt?.label || id}
            <button onClick={() => toggle(id)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12 }}>×</button>
          </span>
        );
      })}
      <button onClick={() => setOpen(!open)}
        style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 999,
          background: 'white', color: 'var(--ink-2)',
          border: '1px dashed var(--line)', cursor: 'pointer',
        }}>{placeholder}</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'white', border: '1px solid var(--line)', borderRadius: 8,
          padding: 8, minWidth: 220, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)', zIndex: 30,
        }} onMouseLeave={() => setOpen(false)}>
          {options.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
