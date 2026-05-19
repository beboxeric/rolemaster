// v2 Capabilities review — list AI-extracted RC-NN, supplier edits + confirms.
// Bilingual edits go through the shared translation gate (./translation-gate):
// - empty other side → auto-AI-translate + auto-save (no UI)
// - other side has content → mark drift, surface in Review modal at Continue

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes } from '../../api.js';
import { KnowledgeCardCarousel } from './KnowledgeCards.jsx';
import { isLocked } from './StatusBanner.jsx';
import { useTranslationGate, TranslationReviewModal, ReviewTranslationsPill } from './translation-gate.jsx';

export function ScreenV2Capabilities({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?regen=1 from the onboard step (set when supplier reuploads / edits Step 2)
  // forces a fresh AI extraction even if cached caps already exist.
  const forceRegen = searchParams.get('regen') === '1';
  // ?from=review means the supplier came back from the final review step to
  // fix one card — Continue should jump back there, not the next stage.
  const fromReview = searchParams.get('from') === 'review';
  const [phase, setPhase] = useState('loading');  // loading | review | error
  const [caps, setCaps] = useState([]);
  const [intake, setIntake] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fired = useRef(false);
  const locked = isLocked(intake?.status);
  const gate = useTranslationGate({ intakeId: id });

  // Load capabilities, run extraction if absent OR if ?regen=1 was set.
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(id);
        if (abort) return;
        setIntake(det.intake);
        const isLockedNow = isLocked(det.intake?.status);
        // Don't force regen on a locked intake — it's already submitted/published.
        const shouldRegen = forceRegen && !isLockedNow && !fired.current;
        if (det.capabilities?.length && !shouldRegen) {
          setCaps(det.capabilities);
          setPhase('review');
        } else if (shouldRegen || !fired.current) {
          fired.current = true;
          // Strip ?regen=1 so reloads don't re-trigger and so the user can't
          // accidentally re-burn AI tokens by hitting refresh repeatedly.
          if (forceRegen) {
            const next = new URLSearchParams(searchParams);
            next.delete('regen');
            setSearchParams(next, { replace: true });
          }
          setPhase('loading');
          const res = await intakes.extractCapabilities(id);
          if (abort) return;
          if (!res.ok) {
            const friendly = (lang === 'zh' ? res.message_zh : res.message_en) || res.message || res.reason || '';
            setErr(friendly);
            setPhase('error');
            return;
          }
          const det2 = await intakes.get(id);
          if (abort) return;
          setCaps(det2.capabilities || []);
          setPhase('review');
        }
      } catch (e) { setErr(e.message); setPhase('error'); }
    })();
    return () => { abort = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateLocal = (capId, patch) => setCaps(prev => prev.map(c => c.id === capId ? { ...c, ...patch } : c));

  // Persist a single-side edit, then either auto-fill the empty other side
  // (silent AI translate) or mark drift for the review modal.
  const saveSide = async (cap, field, side, text) => {
    const otherSide = side === 'zh' ? 'en' : 'zh';
    const dbField = field === 'name' ? 'name' : 'description';
    const sideKey = `${dbField}_${side}`;
    const otherKey = `${dbField}_${otherSide}`;
    const otherCurrent = cap[otherKey] || '';
    const previousSource = cap[sideKey] || '';
    // Skip if the field is unchanged from what we already have — blur alone
    // shouldn't fire AI translate or mark drift.
    if ((text || '') === previousSource) return;
    // Optimistic local update + DB save for the typed side.
    updateLocal(cap.id, { [sideKey]: text });
    try {
      await intakes.patchCapability(id, cap.id, {
        [dbField]: { zh: side === 'zh' ? text : (cap[`${dbField}_zh`] || ''),
                     en: side === 'en' ? text : (cap[`${dbField}_en`] || '') },
      });
    } catch (e) { setErr(e.message); }
    // Gate: auto-fill empty other side, OR mark drift.
    const result = await gate.markEdited({
      key: `${cap.id}:${field}`,
      capId: cap.id,
      field,
      fieldLabel: field === 'name'
        ? (lang === 'zh' ? '能力名称' : 'Capability name')
        : (lang === 'zh' ? '能力描述' : 'Capability description'),
      rcLabel: cap.rc_label,
      capName: cap.name_zh || cap.name_en || cap.rc_label,
      sourceSide: side,
      sourceText: text,
      previousSource,
      otherCurrent,
      applyOther: async (translated) => {
        updateLocal(cap.id, { [otherKey]: translated });
        try {
          await intakes.patchCapability(id, cap.id, {
            [dbField]: { zh: side === 'zh' ? text : translated,
                         en: side === 'en' ? text : translated },
          });
        } catch {}
      },
    });
    return result;
  };

  const removeCap = async (cap) => {
    if (!confirm(lang === 'zh' ? `删除 ${cap.rc_label}?` : `Delete ${cap.rc_label}?`)) return;
    try {
      await intakes.deleteCapability(id, cap.id);
      setCaps(prev => prev.filter(c => c.id !== cap.id));
      gate.clearPending(`${cap.id}:name`);
      gate.clearPending(`${cap.id}:description`);
    } catch (e) { setErr(e.message); }
  };

  const addCap = async () => {
    try {
      setBusy(true);
      const res = await intakes.addCapability(id, {
        name: { zh: '', en: '' },
        description: { zh: '', en: '' },
      });
      const det = await intakes.get(id);
      setCaps(det.capabilities || []);
      setTimeout(() => {
        const el = document.querySelector(`[data-cap-id="${res.id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const reextract = async () => {
    if (!confirm(lang === 'zh' ? '重新分析会覆盖所有 AI 生成的能力(你手动添加的会保留)。继续?' : 'Re-analyze overwrites AI-generated capabilities (your manual additions are kept). Continue?')) return;
    fired.current = true;
    setPhase('loading');
    try {
      const res = await intakes.extractCapabilities(id);
      if (!res.ok) {
        const friendly = (lang === 'zh' ? res.message_zh : res.message_en) || res.message || res.reason || '';
        setErr(friendly);
        setPhase('error');
        return;
      }
      const det = await intakes.get(id);
      setCaps(det.capabilities || []);
      setPhase('review');
    } catch (e) { setErr(e.message); setPhase('error'); }
  };

  const confirmAndContinue = async () => {
    const missing = caps.filter(c => !((lang === 'zh' ? c.name_zh : c.name_en) || '').trim());
    if (missing.length > 0) {
      setErr(lang === 'zh'
        ? `还有 ${missing.length} 项能力没有填名称(红色框标出)。`
        : `${missing.length} capabilit${missing.length === 1 ? 'y is' : 'ies are'} missing a name (highlighted in red).`);
      setTimeout(() => {
        const el = document.querySelector(`[data-cap-id="${missing[0].id}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    if (gate.pendingCount > 0) {
      gate.openReview();
      return;
    }
    await proceedToRoles();
  };

  const proceedToRoles = async () => {
    try {
      setBusy(true); setErr('');
      await intakes.confirmCapabilities(id);
      navigate(fromReview ? `/partners/intake/${id}/review` : `/partners/intake/${id}/roles`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Apply N AI translations in one go, then clear pending and continue.
  const applyTranslationsAndContinue = async (decisions) => {
    try {
      setBusy(true); setErr('');
      for (const d of decisions) {
        const cap = caps.find(c => c.id === d.capId);
        if (!cap) continue;
        const dbField = d.field === 'name' ? 'name' : 'description';
        const body = {};
        body[dbField] = {
          zh: d.targetSide === 'zh' ? d.targetText : (cap[`${dbField}_zh`] || ''),
          en: d.targetSide === 'en' ? d.targetText : (cap[`${dbField}_en`] || ''),
        };
        await intakes.patchCapability(id, d.capId, body);
        const k = `${dbField}_${d.targetSide}`;
        updateLocal(d.capId, { [k]: d.targetText });
      }
      gate.clearAll();
      gate.closeReview();
      await intakes.confirmCapabilities(id);
      navigate(fromReview ? `/partners/intake/${id}/review` : `/partners/intake/${id}/roles`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />

      {phase === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ maxWidth: 560, width: '100%', textAlign: 'left' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {lang === 'zh' ? 'AI 正在阅读你的材料…' : 'AI is reading your materials…'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 24px' }}>
              {lang === 'zh' ? '大约 30–60 秒,等待时了解一下整体流程。' : 'About 30–60 seconds. Here\'s a quick primer while you wait.'}
            </p>
            <KnowledgeCardCarousel stage="capabilities" lang={lang} etaSeconds={45} />
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ maxWidth: 520, textAlign: 'center' }}>
            <p style={{ color: 'var(--st-empty-ink)', marginBottom: 16, lineHeight: 1.6 }}>⚠ {err || (lang === 'zh' ? '分析失败' : 'Analysis failed')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate(`/partners/onboard/${id}`)}>
                {lang === 'zh' ? '返回填写产品介绍' : 'Back to product description'}
              </button>
              <button className="btn btn-primary" onClick={reextract}>
                {lang === 'zh' ? '重试分析' : 'Retry analysis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="v2-page">
          <div className="v2-eyebrow">{lang === 'zh' ? '步骤 3 · 能力梳理' : 'Step 3 · Capabilities'}</div>
          <div className="v2-title-row">
            <h1 className="v2-display">{lang === 'zh' ? '请确认你产品的能力' : 'Confirm your product\'s capabilities'}</h1>
            {locked
              ? (intake.status === 'published'
                  ? <span className="v2-status-pill v2-status-pill--ok">✓ {lang === 'zh' ? '已发布' : 'Published'}</span>
                  : <span className="v2-status-pill v2-status-pill--review">✦ {lang === 'zh' ? '审阅中' : 'In review'}</span>)
              : <span className="v2-status-pill v2-status-pill--ai">✦ {lang === 'zh' ? `AI 识别到 ${caps.length} 项能力` : `AI identified ${caps.length} capabilit${caps.length === 1 ? 'y' : 'ies'}`}</span>}
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none' }}>
            {lang === 'zh'
              ? '一项能力 = 产品能独立完成的一件事。你可以编辑、增删,确认后我们会帮你匹配岗位角色。'
              : 'A capability = one thing your product can do independently. Edit/add/remove freely. Once confirmed, we match these to Roles.'}
          </p>

          <div style={{ marginTop: 8 }}>
            <div className="v2-section__head--actions" style={{ marginBottom: 14, padding: '0 4px' }}>
              <div className="v2-section__head-left">
                <h2 className="v2-h2--sm">{lang === 'zh' ? '能力清单' : 'Capabilities'}</h2>
                <span className="v2-meta">{caps.length} {lang === 'zh' ? '项' : (caps.length === 1 ? 'item' : 'items')}</span>
              </div>
              {!locked && (
                <div className="v2-section__head-actions">
                  <ReviewTranslationsPill lang={lang} count={gate.pendingCount} onClick={gate.openReview} />
                  <button onClick={addCap} disabled={busy} className="v2-btn-quiet">
                    + {lang === 'zh' ? '添加能力' : 'Add capability'}
                  </button>
                  <button onClick={reextract} className="v2-btn-quiet">
                    ↻ {lang === 'zh' ? 'AI 重新分析' : 'Re-analyze'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {caps.map((c, idx) => (
                <CapabilityCard key={c.id} cap={c} index={idx + 1} lang={lang} locked={locked}
                  onSave={(field, side, text) => saveSide(c, field, side, text)}
                  onDelete={() => removeCap(c)} />
              ))}
            </div>
          </div>

          {err && <div className="v2-banner-error" style={{ marginTop: 14 }}>⚠ {err}</div>}

          <div className="v2-cluster" style={{ marginTop: 24, marginBottom: 32 }}>
            <button className="btn btn-ghost" onClick={() => navigate(locked ? '/partners' : `/partners/onboard/${id}`)}>
              ← {lang === 'zh' ? (locked ? '返回主页' : '返回产品资料') : (locked ? 'Back to home' : 'Back to Product')}
            </button>
            <div className="v2-grow"></div>
            {!locked && (
              <button className="btn btn-primary" onClick={confirmAndContinue} disabled={busy || caps.length === 0}
                style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
                {busy ? '…' : (lang === 'zh' ? `确认 ${caps.length} 项能力,匹配岗位 →` : `Confirm ${caps.length} capabilities, match Roles →`)}
              </button>
            )}
            {locked && (
              <button className="btn btn-primary" onClick={() => navigate(`/partners/intake/${id}/roles`)}
                style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
                {lang === 'zh' ? `查看 ${caps.length} 项能力对应的岗位 →` : `View Roles using these ${caps.length} capabilities →`}
              </button>
            )}
          </div>
        </div>
      )}

      {gate.reviewOpen && (
        <TranslationReviewModal
          lang={lang}
          intakeId={id}
          pending={gate.pending}
          busy={busy}
          onClose={gate.closeReview}
          onApplyAndContinue={applyTranslationsAndContinue}
          onSkipAndContinue={async () => { gate.clearAll(); gate.closeReview(); await proceedToRoles(); }}
        />
      )}
    </div>
  );
}

function CapabilityCard({ cap, index, lang, locked, onSave, onDelete }) {
  const [name, setName] = useState(lang === 'zh' ? (cap.name_zh || '') : (cap.name_en || ''));
  const [desc, setDesc] = useState(lang === 'zh' ? (cap.description_zh || '') : (cap.description_en || ''));
  useEffect(() => {
    setName(lang === 'zh' ? (cap.name_zh || '') : (cap.name_en || ''));
    setDesc(lang === 'zh' ? (cap.description_zh || '') : (cap.description_en || ''));
  }, [lang, cap.name_zh, cap.name_en, cap.description_zh, cap.description_en]);

  const nameError = !locked && !name.trim();
  // Show a small "auto-translatable" hint when one side is filled and the other
  // is empty; this is the case the gate will silently fill on next blur.
  const nameOtherEmpty = lang === 'zh' ? !cap.name_en : !cap.name_zh;
  const descOtherEmpty = lang === 'zh' ? !cap.description_en : !cap.description_zh;
  const nameFilled = !!(lang === 'zh' ? cap.name_zh : cap.name_en);
  const descFilled = !!(lang === 'zh' ? cap.description_zh : cap.description_en);

  return (
    <div data-cap-id={cap.id} className="v2-input-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span className="v2-code-label">{cap.rc_label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>
            {lang === 'zh' ? `能力 ${index}` : `Capability ${index}`}
          </span>
        </div>
        {!locked && (
          <button onClick={onDelete}
            title={lang === 'zh' ? '删除' : 'Delete'}
            style={{ padding: '4px 10px', fontSize: 18, lineHeight: 1, color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--st-empty-ink)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--st-empty-ink) 8%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}
          >×</button>
        )}
      </div>
      <input className={`text-input${nameError ? ' error' : ''}`} value={name} readOnly={locked}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !locked && onSave('name', lang, name)}
        placeholder={lang === 'zh' ? '能力名称(动词+对象)' : 'Capability name (verb + object)'}
        style={{ fontSize: 14, fontWeight: 600, padding: '8px 12px', marginBottom: nameError ? 4 : 8, background: locked ? 'var(--bg)' : 'white' }} />
      {nameError && (
        <div className="field-error" style={{ marginBottom: 8 }}>
          ⚠ {lang === 'zh' ? '请填写能力名称' : 'Capability name is required'}
        </div>
      )}
      {nameFilled && nameOtherEmpty && !locked && (
        <div style={{ fontSize: 11, color: '#7a4f00', marginBottom: 8, marginTop: -2 }}>
          ✦ {lang === 'zh' ? '保存后将自动翻译为英文' : 'Will auto-translate to Chinese on save'}
        </div>
      )}
      <textarea className="text-input" value={desc} rows={4} readOnly={locked}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => !locked && onSave('description', lang, desc)}
        placeholder={lang === 'zh' ? '一句话描述这项能力是怎么工作的' : 'One sentence: how this capability works'}
        style={{ fontSize: 13, padding: '8px 12px', resize: 'vertical', minHeight: 88, lineHeight: 1.55, background: locked ? 'var(--bg)' : 'white' }} />
      {descFilled && descOtherEmpty && !locked && (
        <div style={{ fontSize: 11, color: '#7a4f00', marginTop: 4 }}>
          ✦ {lang === 'zh' ? '保存后将自动翻译为英文' : 'Will auto-translate to Chinese on save'}
        </div>
      )}
      {(() => {
        // Pick the source_quote in the active UI language. Older rows only
        // have a single `source_quote` (treated as zh). If the active-lang
        // quote is empty, fall back to the other side rather than showing
        // nothing — but mark it visually so the supplier knows.
        const wanted = lang === 'zh' ? (cap.source_quote || '') : (cap.source_quote_en || '');
        const fallback = lang === 'zh' ? (cap.source_quote_en || '') : (cap.source_quote || '');
        const text = wanted || fallback;
        if (!text) return null;
        const usingFallback = !wanted && !!fallback;
        return (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 10 }}>
            {lang === 'zh' ? '来源: ' : 'Source: '}"{text.slice(0, 120)}"
            {usingFallback && (
              <span style={{ marginLeft: 6, fontStyle: 'normal', color: '#7a4f00' }}>
                ({lang === 'zh' ? '原文为英文' : 'original is Chinese'})
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
