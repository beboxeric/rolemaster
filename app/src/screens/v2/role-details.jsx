// v2 Per-role details — questionnaire (AI-prefilled) + Copilot.
// Tab strip across the top for all roles. CTA goes to shared service+pricing.
// Bilingual edits go through the shared translation gate (./translation-gate)
// — auto-fill empty other side, drift modal at Continue.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes, taxonomy } from '../../api.js';
import { isLocked } from './StatusBanner.jsx';
import { useTranslationGate, TranslationReviewModal, ReviewTranslationsPill } from './translation-gate.jsx';

const SECTIONS = [
  {
    key: 'profile', titleZh: '岗位画像', titleEn: 'Role profile',
    fields: [
      { id: 'daily_activities', zh: '日常工作内容', en: 'Daily activities', placeholder: { zh: '3-5 件具体的事,用 · 分隔', en: '3-5 concrete things, separated by ·' }, multiline: true },
      { id: 'decision_maker',   zh: '决策者',       en: 'Decision-maker',  placeholder: { zh: '谁拍板买这个产品', en: 'Who signs off on the purchase' } },
      { id: 'decision_priorities', zh: '决策者关注点', en: 'Their priorities', placeholder: { zh: '决策者最看重的 3 个因素', en: 'Top 3 factors they weigh' }, multiline: true },
    ],
  },
  {
    key: 'pain', titleZh: '痛点', titleEn: 'Pain',
    fields: [
      { id: 'main_pain',        zh: '主要痛点',     en: 'Main pain',     placeholder: { zh: '这个岗位现在最头疼的事', en: 'The biggest day-to-day pain' }, multiline: true },
      { id: 'current_workflow', zh: '现有处理方式', en: 'Current workflow', placeholder: { zh: '没有你产品时,他们怎么做', en: 'What they do today, without your product' }, multiline: true },
      { id: 'quantified_value', zh: '量化代价(可选)', en: 'Quantified cost (optional)', placeholder: { zh: '比如:每天 2 小时,每月 5 万', en: 'e.g. 2 hrs/day, USD 5K/month' } },
    ],
  },
  {
    key: 'how_it_helps', titleZh: '能力如何帮上忙', titleEn: 'How capabilities help',
    fields: [
      { id: 'workflow_integration', zh: '能力如何嵌入工作流', en: 'Workflow integration', placeholder: { zh: '产品的能力如何嵌入这个岗位的日常', en: 'How capabilities slot into the day-to-day' }, multiline: true },
      { id: 'outcomes',         zh: '上线后改变(可选)', en: 'Outcomes (optional)', placeholder: { zh: '客户能感受到的改变,有数据更好', en: 'Visible changes — numbers if you have them' }, multiline: true },
      { id: 'case_study',       zh: '客户案例(可选)',   en: 'Case study (optional)', placeholder: { zh: '某客户的真实经历', en: 'A real customer story' }, multiline: true },
    ],
  },
  {
    key: 'deployment', titleZh: '部署', titleEn: 'Deployment',
    fields: [
      { id: 'deployment_mode',  zh: '部署方式',     en: 'Deployment mode',  placeholder: { zh: '私有化 / 公有云 / 混合', en: 'Private / Public Cloud / Hybrid' }, multiline: true },
      { id: 'api_endpoint',     zh: 'API 接入(强烈推荐)', en: 'API endpoint (highly recommended)', placeholder: { zh: '描述 API 或上传文档', en: 'Describe API or upload docs' }, multiline: true,
        hint: { zh: '最终你的产品会作为智能体可调用的能力,因此需要提供能调用产品各种核心能力的 API。', en: 'Your product will be agent-callable; APIs that expose its core functions are highly recommended.' } },
    ],
  },
];

export function ScreenV2RoleDetails({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id, rpId } = useParams();
  const [intake, setIntake] = useState(null);
  const [rolepack, setRolepack] = useState(null);
  const [allRolepacks, setAllRolepacks] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [questionnaire, setQuestionnaire] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [apiFiles, setApiFiles] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const prefilled = useRef({});
  const gate = useTranslationGate({ intakeId: id });
  const [searchParams] = useSearchParams();
  const fromReview = searchParams.get('from') === 'review';
  const nextStepUrl = fromReview
    ? `/partners/intake/${id}/review`
    : `/partners/intake/${id}/service-pricing`;

  // Load industries + company-sizes once for localizing the meta line.
  useEffect(() => {
    taxonomy.industries().then(r => setIndustries(r.items || [])).catch(() => {});
    taxonomy.companySizes().then(r => setSizes(r.items || [])).catch(() => {});
  }, []);

  // Hydrate
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(id);
        if (abort) return;
        setIntake(det.intake);
        setAllRolepacks(det.rolepacks || []);
        const rp = (det.rolepacks || []).find(r => r.id === rpId);
        if (!rp) { setErr('not_found'); return; }
        setRolepack(rp);
        setQuestionnaire(rp.questionnaire || {});
        setApiFiles((det.files || []).filter(f => f.rolepack_id === rpId));
        // First-time prefill (also runs from /roles, but be safe).
        if (!rp.questionnaire && !prefilled.current[rpId]) {
          prefilled.current[rpId] = true;
          try {
            const r = await intakes.prefillRolepack(id, rpId);
            if (r.ok && r.questionnaire) {
              setQuestionnaire(r.questionnaire);
              await refreshOnce();
            }
          } catch {}
        }
      } catch (e) { if (!abort) setErr(e.message); }
    })();
    return () => { abort = true; };
  }, [id, rpId]);

  const uploadApiDocs = async (incoming, presetName) => {
    if (!incoming?.length) return;
    try {
      setUploadBusy(true);
      const fd = new FormData();
      for (const f of incoming) fd.append('files', f);
      fd.append('rolepack_id', rpId);
      fd.append('kind', 'api_doc');
      const res = await intakes.uploadFile(id, fd);
      const created = res.files || [];
      // If user typed a name first, apply it to the first uploaded file.
      if (presetName && created[0]) {
        try { await intakes.renameFile(id, created[0].id, presetName); } catch {}
        created[0].display_name = presetName;
      }
      setApiFiles(prev => [...prev, ...created]);
    } catch (e) { setErr(e.message); }
    finally { setUploadBusy(false); }
  };

  const removeApiDoc = async (fid) => {
    try {
      await intakes.deleteFile(id, fid);
      setApiFiles(prev => prev.filter(f => f.id !== fid));
    } catch (e) { setErr(e.message); }
  };

  const refreshOnce = async () => {
    const det = await intakes.get(id);
    setAllRolepacks(det.rolepacks || []);
    const rp = (det.rolepacks || []).find(r => r.id === rpId);
    if (rp) {
      setRolepack(rp);
      setQuestionnaire(rp.questionnaire || {});
    }
  };

  const setField = (section, field, value, statusOverride = 'filled') => {
    setQuestionnaire(prev => {
      const next = { ...prev };
      if (!next[section]) next[section] = {};
      next[section][field] = {
        value_zh: lang === 'zh' ? value : (next[section][field]?.value_zh ?? value),
        value_en: lang === 'en' ? value : (next[section][field]?.value_en ?? value),
        confidence: 1,
        source_quote: '',
        _state: 'user_edited',
      };
      // Persist debounced
      saveDebounced(next);
      return next;
    });
  };

  const saveTimer = useRef(null);
  const saveDebounced = (next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      intakes.patchRolepack(id, rpId, { questionnaire: next }).catch(() => {});
    }, 400);
  };

  // Per-(field, side) snapshot of the last value we ran through the gate.
  // Lets onFieldBlur skip when the supplier blurred without actually editing
  // AND lets the modal show a meaningful pre-edit baseline for the diff.
  const lastGateRun = useRef(new Map());

  // Seed lastGateRun whenever the questionnaire is freshly loaded/refreshed
  // so the first blur after load has the loaded value as its baseline
  // (otherwise the diff would treat the entire field as "added").
  useEffect(() => {
    if (!questionnaire) return;
    for (const [sectionKey, fields] of Object.entries(questionnaire)) {
      for (const [fieldId, v] of Object.entries(fields || {})) {
        if (v?.value_zh) lastGateRun.current.set(`${sectionKey}.${fieldId}:zh`, v.value_zh);
        if (v?.value_en) lastGateRun.current.set(`${sectionKey}.${fieldId}:en`, v.value_en);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpId]);

  // Called on blur of each questionnaire field. Tells the translation gate
  // that the active language was just edited; gate decides whether to
  // auto-fill the empty other side (silent AI translate) or mark as drift
  // for the review modal at Continue.
  const onFieldBlur = async (sectionKey, fieldId, sectionTitle, fieldLabel) => {
    if (locked) return;
    const v = questionnaire?.[sectionKey]?.[fieldId];
    if (!v) return;
    const sourceText = lang === 'zh' ? v.value_zh : v.value_en;
    const otherCurrent = lang === 'zh' ? v.value_en : v.value_zh;
    if (!sourceText || !String(sourceText).trim()) return;
    // Skip if unchanged since last gate run (blur without editing).
    const runKey = `${sectionKey}.${fieldId}:${lang}`;
    const previousSource = lastGateRun.current.get(runKey) ?? '';
    if (previousSource === sourceText) return;
    lastGateRun.current.set(runKey, sourceText);
    await gate.markEdited({
      key: `${rpId}:${sectionKey}.${fieldId}`,
      capId: rpId,
      field: `${sectionKey}.${fieldId}`,
      fieldLabel: `${sectionTitle} · ${fieldLabel}`,
      rcLabel: rolepack?.rp_label,
      capName: rolepack?.name_zh || rolepack?.name_en || rolepack?.rp_label,
      sourceSide: lang,
      sourceText,
      previousSource,
      otherCurrent,
      applyOther: async (translated) => {
        // Update the field's other-side value in the local questionnaire.
        setQuestionnaire(prev => {
          const next = { ...prev };
          if (!next[sectionKey]) next[sectionKey] = {};
          const cur = next[sectionKey][fieldId] || {};
          next[sectionKey][fieldId] = {
            ...cur,
            value_zh: lang === 'zh' ? cur.value_zh : translated,
            value_en: lang === 'en' ? cur.value_en : translated,
            confidence: 1, source_quote: '', _state: 'auto_translated',
          };
          // Persist immediately (don't wait for debounce).
          intakes.patchRolepack(id, rpId, { questionnaire: next }).catch(() => {});
          return next;
        });
      },
    });
  };

  // Apply N AI translations from the modal then proceed to service+pricing.
  const applyTranslationsAndContinue = async (decisions) => {
    try {
      setBusy(true); setErr('');
      // Apply each decision into the local questionnaire and save once.
      const updated = { ...questionnaire };
      for (const d of decisions) {
        // d.field is "section.fieldId"
        const [sectionKey, fieldId] = d.field.split('.');
        if (!updated[sectionKey]) updated[sectionKey] = {};
        const cur = updated[sectionKey][fieldId] || {};
        updated[sectionKey][fieldId] = {
          ...cur,
          value_zh: d.targetSide === 'zh' ? d.targetText : (cur.value_zh ?? ''),
          value_en: d.targetSide === 'en' ? d.targetText : (cur.value_en ?? ''),
          confidence: 1, source_quote: '', _state: 'user_edited',
        };
      }
      setQuestionnaire(updated);
      await intakes.patchRolepack(id, rpId, { questionnaire: updated });
      gate.clearAll();
      gate.closeReview();
      navigate(nextStepUrl);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Required keys = every field except those marked (optional) in the labels.
  const REQUIRED_KEYS = SECTIONS.flatMap(s =>
    s.fields
      .filter(f => !/optional|可选/i.test(`${f.zh} ${f.en}`))
      .map(f => `${s.key}.${f.id}`)
  );

  // A field counts as filled only if the active language has content. Deleting
  // value_zh shouldn't be cancelled out by a stale value_en (AI prefill).
  const filledForLang = (v) => {
    if (!v) return false;
    const raw = lang === 'zh' ? v.value_zh : v.value_en;
    if (Array.isArray(raw)) return raw.length > 0;
    return raw != null && String(raw).trim().length > 0;
  };

  const completionPct = (rp) => {
    const q = rp.questionnaire || {};
    const all = SECTIONS.flatMap(s => s.fields.map(f => `${s.key}.${f.id}`));
    const done = all.filter(k => {
      const [s, f] = k.split('.');
      return filledForLang(q[s]?.[f]);
    }).length;
    return Math.round((done / all.length) * 100);
  };

  const missingRequired = (rp) => {
    const q = rp.questionnaire || {};
    return REQUIRED_KEYS.filter(k => {
      const [s, f] = k.split('.');
      return !filledForLang(q[s]?.[f]);
    });
  };

  const incompleteRoles = allRolepacks
    .map(r => ({ rp: r, missing: missingRequired(r) }))
    .filter(({ missing }) => missing.length > 0);
  const allReady = incompleteRoles.length === 0 && allRolepacks.length > 0;

  const continueShared = () => {
    if (!allReady) {
      const first = incompleteRoles[0];
      setErr(lang === 'zh'
        ? `请先完成 ${first.rp.rp_label} (${first.rp.name_zh || first.rp.name_en}) 的必填项`
        : `Please complete required fields on ${first.rp.rp_label} (${first.rp.name_en || first.rp.name_zh}) first`);
      // Jump to the first incomplete role so the user sees what's missing.
      if (first.rp.id !== rpId) navigate(`/partners/intake/${id}/role/${first.rp.id}/details`);
      return;
    }
    if (gate.pendingCount > 0) { gate.openReview(); return; }
    navigate(nextStepUrl);
  };

  const removeRolepack = async (r) => {
    if (allRolepacks.length <= 1) {
      setErr(lang === 'zh' ? '至少保留一个岗位' : 'Keep at least one Role');
      return;
    }
    if (!confirm(lang === 'zh'
      ? `删除 ${r.rp_label} (${r.name_zh || r.name_en})?`
      : `Delete ${r.rp_label} (${r.name_en || r.name_zh})?`)) return;
    try {
      await intakes.deleteRolepack(id, r.id);
      const det = await intakes.get(id);
      setAllRolepacks(det.rolepacks || []);
      // If we removed the active one, navigate to the first remaining role.
      if (r.id === rpId) {
        const first = (det.rolepacks || [])[0];
        if (first) navigate(`/partners/intake/${id}/role/${first.id}/details`);
        else navigate(`/partners/intake/${id}/roles`);
      }
    } catch (e) { setErr(e.message); }
  };

  if (err && !rolepack) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--st-empty-ink)' }}>⚠ {err}</div>
    );
  }
  if (!rolepack) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>;
  }

  const locked = isLocked(intake?.status);

  // Localize an industry/size id → label in the active language (with fallback).
  const industriesById = Object.fromEntries(industries.map(i => [i.id, i]));
  const sizesById = Object.fromEntries(sizes.map(s => [s.id, s]));
  const localizeId = (id, dict) => {
    if (!id) return '';
    if (typeof id !== 'string') return String(id);
    if (id.startsWith('custom:')) return id.slice(7);
    const it = dict?.[id];
    if (!it) return id;
    return lang === 'zh' ? (it.name_zh || it.name_en || id) : (it.name_en || it.name_zh || id);
  };

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />

      {/* Tab strip — sticky directly under the app header. */}
      <div style={{
        borderBottom: '1px solid var(--line)', background: 'white',
        padding: '8px 16px', display: 'flex', gap: 6, overflowX: 'auto',
        position: 'sticky', top: 60, zIndex: 9,
      }}>
        {allRolepacks.map(r => {
          const isActive = r.id === rpId;
          const pct = completionPct(r);
          const idx = allRolepacks.indexOf(r) + 1;
          return (
            <div key={r.id} style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 0,
              borderRadius: 8, overflow: 'hidden',
              background: isActive ? 'var(--plat-supplier)' : 'white',
              color: isActive ? 'white' : 'var(--ink-2)',
              border: `1px solid ${isActive ? 'var(--plat-supplier)' : 'var(--line)'}`,
            }}>
              <button
                onClick={() => navigate(`/partners/intake/${id}/role/${r.id}/details`)}
                style={{
                  padding: '6px 12px', fontSize: 12.5,
                  background: 'transparent', color: 'inherit', border: 'none',
                  fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7 }}>{r.rp_label}</span>
                <span>{lang === 'zh' ? `岗位 ${idx}` : `Role ${idx}`}</span>
                <span style={{ opacity: 0.85 }}>· {(lang === 'zh' ? r.name_zh : r.name_en) || r.name_zh || r.name_en || '—'}</span>
                {!locked && <span style={{ fontSize: 10, opacity: 0.7 }}>{pct}%</span>}
              </button>
              {!locked && (
                <button
                  onClick={() => removeRolepack(r)}
                  disabled={allRolepacks.length <= 1}
                  title={lang === 'zh' ? '删除此岗位' : 'Delete this role'}
                  style={{
                    padding: '6px 8px', fontSize: 14, lineHeight: 1,
                    background: 'transparent', color: 'inherit', border: 'none',
                    cursor: allRolepacks.length <= 1 ? 'not-allowed' : 'pointer',
                    opacity: allRolepacks.length <= 1 ? 0.3 : 0.6,
                  }}
                  onMouseEnter={e => { if (allRolepacks.length > 1) e.currentTarget.style.opacity = 1; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = allRolepacks.length <= 1 ? 0.3 : 0.6; }}
                >×</button>
              )}
            </div>
          );
        })}
        {!locked && (
          <button onClick={() => setCopilotOpen(!copilotOpen)}
            style={{
              marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12,
              background: copilotOpen ? 'white' : 'var(--cop-border)',
              color: copilotOpen ? 'var(--cop-border)' : 'white',
              border: `1px solid ${copilotOpen ? 'var(--cop-border)' : 'transparent'}`,
              cursor: 'pointer', fontWeight: 600,
            }}>
            {copilotOpen ? '✕ Copilot' : '✦ Copilot'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="v2-page">
            {/* Role-card header — left-aligned, transparent (sits on the green
                mesh background), NOT sticky. Only header + tab strip stick. */}
            <div className="v2-eyebrow">
              <span className="v2-code-label">{rolepack.rp_label}</span>
              {' '}{lang === 'zh' ? `岗位 ${allRolepacks.findIndex(r => r.id === rpId) + 1}` : `Role ${allRolepacks.findIndex(r => r.id === rpId) + 1}`}
            </div>
            <div className="v2-title-row">
              <h1 className="v2-display">{(lang === 'zh' ? rolepack.name_zh : rolepack.name_en) || '—'}</h1>
              {locked && (rolepack.status === 'published'
                ? <span className="v2-status-pill v2-status-pill--ok">✓ {lang === 'zh' ? '已发布' : 'Published'}</span>
                : <span className="v2-status-pill v2-status-pill--review">✦ {lang === 'zh' ? '审阅中' : 'In review'}</span>)}
            </div>
            <p className="v2-meta" style={{ marginTop: 0, marginBottom: 18 }}>
              {[
                (rolepack.industry || []).map(i => localizeId(i, industriesById)).filter(Boolean).join(' · '),
                (rolepack.department?.[lang]) || '',
                (rolepack.company_size || []).map(s => localizeId(s, sizesById)).filter(Boolean).join(' · '),
              ].filter(Boolean).join(' · ')}
            </p>

            {SECTIONS.map(section => (
              <div key={section.key} className="v2-input-card" style={{ marginBottom: 14 }}>
                <div className="v2-h3">
                  {lang === 'zh' ? section.titleZh : section.titleEn}
                </div>
                {section.fields.map(f => {
                  const v = questionnaire[section.key]?.[f.id];
                  let display = '';
                  if (v) {
                    const raw = lang === 'zh' ? v.value_zh : v.value_en;
                    if (Array.isArray(raw)) display = raw.join(' · ');
                    else display = raw == null ? '' : String(raw);
                  }
                  const isAi = v?._state !== 'user_edited' && v != null;
                  const isWeak = v?._state === 'copilot_weak';
                  const isRequired = !/optional|可选/i.test(`${f.zh} ${f.en}`);
                  const isMissing = !locked && isRequired && !display.trim();
                  const stateClass = isMissing ? 'error' : (isWeak ? 'weak' : isAi ? 'ai' : '');
                  return (
                    <div key={f.id} style={{ marginBottom: 12 }} data-field-wrap={`${section.key}.${f.id}`}>
                      <label className={`field-label${isMissing ? ' error' : ''}`}>
                        {lang === 'zh' ? f.zh : f.en}
                        {isRequired && <span style={{ color: '#DC2A4A', marginLeft: 4 }}>*</span>}
                      </label>
                      {f.multiline
                        ? <textarea className={`text-input ${stateClass}`}
                            data-field={`${section.key}.${f.id}`}
                            value={display} rows={4} readOnly={locked}
                            onChange={(e) => !locked && setField(section.key, f.id, e.target.value)}
                            onBlur={() => onFieldBlur(section.key, f.id, lang === 'zh' ? section.titleZh : section.titleEn, lang === 'zh' ? f.zh : f.en)}
                            placeholder={f.placeholder?.[lang] || ''}
                            style={{ fontSize: 13, resize: 'vertical', minHeight: 96, lineHeight: 1.55, background: locked ? 'var(--bg)' : undefined }} />
                        : <input className={`text-input ${stateClass}`}
                            data-field={`${section.key}.${f.id}`}
                            value={display} readOnly={locked}
                            onChange={(e) => !locked && setField(section.key, f.id, e.target.value)}
                            onBlur={() => onFieldBlur(section.key, f.id, lang === 'zh' ? section.titleZh : section.titleEn, lang === 'zh' ? f.zh : f.en)}
                            placeholder={f.placeholder?.[lang] || ''}
                            style={{ fontSize: 13, background: locked ? 'var(--bg)' : undefined }} />
                      }
                      {isMissing && (
                        <div className="field-error">
                          ⚠ {lang === 'zh' ? '此字段为必填' : 'This field is required'}
                        </div>
                      )}
                      {f.hint && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontStyle: 'italic' }}>💡 {f.hint[lang]}</div>}
                    </div>
                  );
                })}

                {/* API doc upload — only inside the deployment section */}
                {section.key === 'deployment' && (
                  <div style={{ marginTop: 14 }}>
                    <label className="field-label">{lang === 'zh' ? 'API 文档(可上传多份)' : 'API documentation (upload multiple)'}</label>
                    {!locked && (
                      <ApiUploadRow lang={lang} busy={uploadBusy} onUpload={uploadApiDocs} />
                    )}
                    {apiFiles.length > 0 && (
                      <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                        {apiFiles.map(f => (
                          <ApiDocRow key={f.id} f={f} lang={lang} locked={locked}
                            onRename={async (name) => {
                              setApiFiles(prev => prev.map(x => x.id === f.id ? { ...x, display_name: name } : x));
                              try { await intakes.renameFile(id, f.id, name); } catch {}
                            }}
                            onRemove={() => removeApiDoc(f.id)} />
                        ))}
                      </div>
                    )}
                    {locked && apiFiles.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                        {lang === 'zh' ? '未上传 API 文档' : 'No API docs uploaded'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {err && <div className="v2-banner-error" style={{ marginTop: 10 }}>⚠ {err}</div>}

            <div className="v2-cluster" style={{ marginTop: 22 }}>
              {locked ? (
                <button className="btn btn-primary" onClick={() => navigate('/partners')}
                  style={{ flex: 1, padding: '12px 18px', fontWeight: 600 }}>
                  ← {lang === 'zh' ? '返回主页' : 'Back to home'}
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => navigate(`/partners/intake/${id}/roles`)}>
                    ← {lang === 'zh' ? '返回岗位列表' : 'Back to Roles'}
                  </button>
                  <div className="v2-grow"></div>
                  <ReviewTranslationsPill lang={lang} count={gate.pendingCount} onClick={gate.openReview} />
                  <button className="btn btn-primary" onClick={continueShared} disabled={busy}
                    style={{ padding: '12px 18px', fontWeight: 600 }}>
                    {allReady
                      ? (lang === 'zh' ? '下一步:服务与价格 →' : 'Next: Service & pricing →')
                      : (lang === 'zh'
                          ? `请先完成所有必填(${incompleteRoles.length} 个岗位待补充)`
                          : `Complete required fields first (${incompleteRoles.length} role${incompleteRoles.length === 1 ? '' : 's'} left)`)}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {!locked && copilotOpen && (
          <div style={{
            position: 'sticky', top: 105, alignSelf: 'flex-start',
            height: 'calc(100vh - 105px)', flexShrink: 0,
          }}>
            <RoleCopilot intakeId={id} rpId={rpId} lang={lang}
              sections={SECTIONS} questionnaire={questionnaire}
              rolepack={rolepack}
              onUpdated={refreshOnce} />
          </div>
        )}
      </div>

      {gate.reviewOpen && (
        <TranslationReviewModal
          lang={lang}
          intakeId={id}
          pending={gate.pending}
          busy={busy}
          onClose={gate.closeReview}
          onApplyAndContinue={applyTranslationsAndContinue}
          onSkipAndContinue={async () => { gate.clearAll(); gate.closeReview(); navigate(nextStepUrl); }}
        />
      )}
    </div>
  );
}

function RoleCopilot({ intakeId, rpId, lang, sections, questionnaire, rolepack, onUpdated }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    intakes.rolepackCopilotHistory(intakeId, rpId)
      .then(r => setHistory((r.items || []).map(m => ({ role: m.role, content: m.content }))))
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [intakeId, rpId]);

  // Compute weak/empty fields from the current questionnaire — used for the
  // proactive intro card when there's no chat history yet.
  const gaps = (() => {
    if (!sections || !questionnaire) return [];
    const list = [];
    for (const s of sections) {
      for (const f of s.fields) {
        if (/optional|可选/i.test(`${f.zh} ${f.en}`)) continue;
        const v = questionnaire[s.key]?.[f.id];
        const raw = v ? (lang === 'zh' ? v.value_zh : v.value_en) : null;
        const display = Array.isArray(raw) ? raw.join('') : (raw == null ? '' : String(raw));
        if (!display.trim()) {
          list.push({ section: s.key, id: f.id, zh: f.zh, en: f.en });
        }
      }
    }
    return list;
  })();

  const proactiveIntro = historyLoaded && history.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, busy]);

  const send = async (text) => {
    if (!text.trim() || busy) return;
    setHistory(h => [...h, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      const r = await intakes.rolepackCopilot(intakeId, rpId, text);
      setHistory(h => [...h, { role: 'bot', content: r.reply || '', updates: r.updates || [] }]);
      if (r.updates?.length) {
        onUpdated?.();
        // Briefly highlight + scroll the first field that was just filled,
        // so the supplier can see the change land.
        const first = r.updates[0]?.id;
        if (first) {
          // Wait a tick so the new value has a chance to render.
          setTimeout(() => focusField(first), 250);
        }
      }
    } catch (e) {
      setHistory(h => [...h, { role: 'system', content: '⚠ ' + e.message }]);
    } finally { setBusy(false); }
  };

  // Scroll the role-details panel so the named field comes into view, and
  // briefly highlight it. `id` is "section.fieldKey" e.g. "pain.main_pain".
  const focusField = (id) => {
    const el = document.querySelector(`[data-field="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'box-shadow 0.4s ease';
    el.style.boxShadow = '0 0 0 3px var(--cop-bg)';
    setTimeout(() => { el.style.boxShadow = ''; }, 1600);
  };

  return (
    <div style={{
      width: 360, flexShrink: 0, background: 'white',
      borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--cop-border)', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✦</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cop-ink)' }}>Copilot</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {proactiveIntro && gaps.length > 0
              ? (lang === 'zh' ? `${gaps.length} 项可起草` : `${gaps.length} field${gaps.length === 1 ? '' : 's'} I can draft`)
              : (lang === 'zh' ? '边聊边帮你填' : "I'll fill as we chat")}
          </div>
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proactiveIntro && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--cop-border)', fontWeight: 600, letterSpacing: '0.04em', marginLeft: 4 }}>COPILOT</div>
            <div className="bubble bot" style={{ maxWidth: '92%', lineHeight: 1.6 }}>
              {gaps.length === 0 ? (
                <>{lang === 'zh'
                  ? `所有字段都填好了 ✓。要调整任何内容,直接告诉我即可,我会改在对应字段上。`
                  : `All fields are filled ✓. To tweak anything, just tell me and I'll update the relevant field.`}</>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {lang === 'zh'
                      ? `「${rolepack?.name_zh || rolepack?.name_en}」还差 ${gaps.length} 项必填。我可以根据 ${rolepack?.name_zh || rolepack?.name_en} 这个岗位的常见职责帮你起草——选一个开始?`
                      : `"${rolepack?.name_en || rolepack?.name_zh}" still needs ${gaps.length} required field${gaps.length === 1 ? '' : 's'}. I can draft each one based on what this role typically does — pick one to start:`}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {gaps.slice(0, 6).map(g => (
                      <button key={`${g.section}.${g.id}`}
                        onClick={() => send(lang === 'zh'
                          ? `帮我起草「${g.zh}」。基于这个岗位的常见职责 + 我们产品想解决的痛点写。`
                          : `Draft "${g.en}". Base it on the role's typical duties + the pain our product solves.`)}
                        disabled={busy}
                        style={{
                          fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
                          background: 'white', color: 'var(--cop-border)',
                          border: '1px solid var(--cop-border)', cursor: 'pointer', fontWeight: 500,
                        }}>
                        ✦ {lang === 'zh' ? g.zh : g.en}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
                    {lang === 'zh' ? '或直接告诉我:你印象里这个岗位最头疼的事是什么?' : "Or tell me: what's the biggest pain for this role in your view?"}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {history.map((m, i) => {
          const isLastBot = m.role === 'bot' && i === history.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'bot' || m.role === 'system' ? 'flex-start' : 'flex-end' }}>
              {m.role === 'bot' && (
                <div style={{ fontSize: 9, color: 'var(--cop-border)', fontWeight: 600, marginLeft: 4, letterSpacing: '0.04em', marginBottom: 2 }}>COPILOT</div>
              )}
              <div className={`bubble ${m.role}`} style={{ maxWidth: '85%' }}>
                {m.updates?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {m.updates.map((u, j) => (
                      <button key={j}
                        onClick={() => focusField(u.id)}
                        title={lang === 'zh' ? '滚动到此字段' : 'Scroll to this field'}
                        style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 999,
                          background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
                          border: '1px solid var(--st-fill-border)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>✓ {(u.label?.[lang]) || u.id} ↗</button>
                    ))}
                  </div>
                )}
                {m.role === 'bot' ? renderMarkdown(m.content) : m.content}
              </div>
              {/* Next-action pills under the LATEST bot reply: surface remaining gaps */}
              {isLastBot && !busy && gaps.length > 0 && (
                <div style={{ marginTop: 8, marginLeft: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {lang === 'zh' ? '下一步可以填:' : 'Next up:'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {gaps.slice(0, 4).map(g => (
                      <button key={`next-${g.section}.${g.id}`}
                        onClick={() => send(lang === 'zh'
                          ? `帮我起草「${g.zh}」。基于这个岗位的常见职责 + 我们产品想解决的痛点写。`
                          : `Draft "${g.en}". Base it on the role's typical duties + the pain our product solves.`)}
                        disabled={busy}
                        style={{
                          fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
                          background: 'white', color: 'var(--cop-border)',
                          border: '1px solid var(--cop-border)', cursor: 'pointer', fontWeight: 500,
                        }}>
                        ✦ {lang === 'zh' ? g.zh : g.en}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '6px 0' }}>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> Copilot...
          </div>
        )}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <div style={{ background: 'white', border: '1px solid #D8C9EC', borderRadius: 10, padding: 8, display: 'flex', gap: 6 }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={lang === 'zh' ? '一次回答多个问题也行…' : 'Answer multiple at once…'}
            rows={2}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 13, fontFamily: 'inherit' }} />
          <button onClick={() => send(input)} disabled={!input.trim() || busy}
            style={{ background: 'var(--cop-border)', color: 'white', padding: '6px 12px', borderRadius: 6, fontWeight: 500, fontSize: 12, border: 'none', cursor: 'pointer' }}>
            {lang === 'zh' ? '发送' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Light markdown rendering for Copilot bot replies. Supports **bold** and
// preserves newlines. Not a general parser — intentionally tiny.
function renderMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const renderLine = (line, lineKey) => {
    const out = [];
    let last = 0;
    const re = /\*\*([^*]+?)\*\*/g;
    let m;
    let n = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out.push(<span key={`${lineKey}-t${n++}`}>{line.slice(last, m.index)}</span>);
      out.push(<strong key={`${lineKey}-b${n++}`}>{m[1]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push(<span key={`${lineKey}-t${n++}`}>{line.slice(last)}</span>);
    return out;
  };
  return lines.map((line, i) => (
    <span key={i}>
      {renderLine(line, i)}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

function ApiUploadRow({ lang, busy, onUpload }) {
  const [name, setName] = useState('');
  const fileRef = useRef(null);
  const trigger = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const presetName = name.trim();
    onUpload(files, presetName);
    setName('');
    e.target.value = '';
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: 8,
      background: 'var(--bg)', border: '1px dashed var(--line)', borderRadius: 8,
    }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={lang === 'zh' ? '为文档起个名字(如:生产 OpenAPI v2)' : 'Name this doc (e.g. Production OpenAPI v2)'}
        style={{
          flex: 1, fontSize: 12.5, padding: '7px 10px',
          border: '1px solid var(--line)', borderRadius: 6,
          background: 'white', outline: 'none', fontFamily: 'inherit',
        }} />
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={onFileChange} />
      <button onClick={trigger} disabled={busy}
        style={{
          padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
          background: busy ? 'var(--bg)' : 'var(--plat-supplier)',
          color: busy ? 'var(--ink-3)' : 'white',
          border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}>
        {busy
          ? (lang === 'zh' ? '上传中…' : 'Uploading…')
          : (lang === 'zh' ? '+ 上传文件' : '+ Upload file')}
      </button>
    </div>
  );
}

function ApiDocRow({ f, lang, locked, onRename, onRemove }) {
  const [name, setName] = useState(f.display_name || '');
  const [included, setIncluded] = useState(true);
  useEffect(() => { setName(f.display_name || ''); }, [f.display_name]);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', fontSize: 12,
      background: 'white', border: '1px solid var(--line-2)', borderRadius: 6,
      opacity: included ? 1 : 0.55,
    }}>
      {!locked && (
        <input type="checkbox" checked={included}
          onChange={(e) => setIncluded(e.target.checked)}
          title={lang === 'zh' ? '包含 / 排除此文档' : 'Include / exclude this doc'}
          style={{ width: 16, height: 16, accentColor: 'var(--plat-supplier)', cursor: 'pointer', flexShrink: 0 }} />
      )}
      <input
        value={name}
        readOnly={locked}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if ((name || '') !== (f.display_name || '')) onRename(name); }}
        placeholder={lang === 'zh' ? '为文档起个名字(如:生产 OpenAPI v2)' : 'Name this doc (e.g. Production OpenAPI v2)'}
        style={{
          flex: 1, fontSize: 12.5, padding: '4px 6px',
          border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', outline: 'none',
          fontWeight: name ? 600 : 400, color: name ? 'var(--ink)' : 'var(--ink-3)',
        }}
        onFocus={(e) => { if (!locked) e.target.style.border = '1px solid var(--line)'; }}
        onMouseDown={(e) => { if (!locked) e.currentTarget.style.border = '1px solid var(--line)'; }}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.border = '1px solid transparent'; }}
      />
      <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {f.filename}
      </span>
      {!locked && (
        <button onClick={onRemove}
          style={{ background: 'transparent', border: 0, fontSize: 14, color: 'var(--ink-3)', cursor: 'pointer', flexShrink: 0 }}>×</button>
      )}
    </div>
  );
}
