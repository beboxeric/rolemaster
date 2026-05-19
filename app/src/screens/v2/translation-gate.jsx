// Shared bilingual-translation gate for partner + curator edit pages.
//
// Two behaviors layered on the same UX:
//   1. Auto-fill (the "auto push"): when the supplier edits one side of a
//      bilingual field and the OTHER side is empty, fire an AI translation
//      in the background and write it back. The user never sees a prompt.
//   2. Drift review: when both sides already have content and the user edits
//      one of them, the other side may now be stale. We mark it as pending
//      and surface a "Review translations (N)" pill + modal at the next
//      save / continue step. The user accepts/edits/skips per row.
//
// All bilingual edit screens (capabilities, roles, role-details) hit the
// same module so we don't reinvent the pattern per page.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { intakes } from '../../api.js';

// ─── Token-level diff (for highlighting what changed in the modal) ───────
// CJK chars are individual tokens; runs of Latin chars form word tokens.
function tokenize(text) {
  if (!text) return [];
  return String(text).match(/[一-鿿]|[A-Za-z0-9_'-]+|\s+|\S/g) || [];
}
// LCS-based diff. Returns spans: [{ text, op: 'same'|'add'|'del' }, ...].
function diffTokens(oldText, newText) {
  const a = tokenize(oldText), b = tokenize(newText);
  const m = a.length, n = b.length;
  if (!m) return b.map(t => ({ text: t, op: 'add' }));
  if (!n) return a.map(t => ({ text: t, op: 'del' }));
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { out.push({ text: a[i - 1], op: 'same' }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { out.push({ text: a[i - 1], op: 'del' }); i--; }
    else { out.push({ text: b[j - 1], op: 'add' }); j--; }
  }
  while (i > 0) { out.push({ text: a[i - 1], op: 'del' }); i--; }
  while (j > 0) { out.push({ text: b[j - 1], op: 'add' }); j--; }
  return out.reverse();
}
// Render the new text with insertions highlighted (marker-pen style).
// Deletions are dropped — we want a clean read of the new state with the
// added/changed spans visually obvious, not a full audit trail.
function DiffSpans({ ops, highlightBg, highlightInk }) {
  return (
    <>
      {ops.map((s, i) => {
        if (s.op === 'del') return null;
        if (s.op === 'add') return (
          <mark key={i} style={{
            background: highlightBg,
            color: highlightInk || 'inherit',
            padding: '0 1px',
            borderRadius: 2,
            fontWeight: 600,
          }}>{s.text}</mark>
        );
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

// ─── Public hook ──────────────────────────────────────────────────────────
export function useTranslationGate({ intakeId }) {
  // pending: Map<key, { capId, field, fieldLabel, rcLabel, capName,
  //                     sourceSide, sourceText, currentTarget }>
  const [pending, setPending] = useState(() => new Map());
  const [reviewOpen, setReviewOpen] = useState(false);

  const markPending = useCallback((entry) => {
    setPending(prev => {
      const next = new Map(prev);
      if (!entry.sourceText || !entry.sourceText.trim()) {
        next.delete(entry.key);
      } else {
        next.set(entry.key, entry);
      }
      return next;
    });
  }, []);

  const clearPending = useCallback((key) => {
    setPending(prev => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev); next.delete(key); return next;
    });
  }, []);

  const clearAll = useCallback(() => setPending(new Map()), []);

  // markEdited is called by the screen on blur after the supplier finishes
  // editing one side of a bilingual field.
  // - If `otherCurrent` is empty: auto-fill (AI translate + applyOther) silently.
  // - If `otherCurrent` has content: mark as drift, will surface in modal.
  // `previousSource` (optional) is the value of the same side BEFORE this
  // edit — lets the modal render a token-level diff highlighting what the
  // supplier just changed.
  const markEdited = useCallback(async ({
    key, capId, field, fieldLabel, rcLabel, capName,
    sourceSide, sourceText, previousSource, otherCurrent, applyOther,
  }) => {
    if (!sourceText || !sourceText.trim()) {
      // Source cleared — drop any pending entry for this key.
      clearPending(key);
      return { autoFilled: false };
    }
    const otherHasContent = !!(otherCurrent && String(otherCurrent).trim());
    if (!otherHasContent && applyOther) {
      // Auto-fill silent path.
      try {
        const targetSide = sourceSide === 'zh' ? 'en' : 'zh';
        const res = await intakes.aiRewrite(intakeId, {
          kind: 'translate',
          target_lang: targetSide,
          input_zh: sourceSide === 'zh' ? sourceText : '',
          input_en: sourceSide === 'en' ? sourceText : '',
          context: { rc_label: rcLabel, name: capName },
        });
        if (res?.ok) {
          const text = (targetSide === 'zh' ? res.output_zh : res.output_en) || '';
          if (text.trim()) {
            applyOther(text.trim());
            return { autoFilled: true, targetSide, targetText: text.trim() };
          }
        }
      } catch { /* swallow — supplier can manually fill or use modal later */ }
      return { autoFilled: false };
    }
    // Drift path — mark as pending for the modal.
    markPending({
      key, capId, field, fieldLabel, rcLabel, capName,
      sourceSide, sourceText: sourceText.trim(),
      previousSource: previousSource || '',
      currentTarget: otherCurrent || '',
    });
    return { autoFilled: false, pending: true };
  }, [intakeId, markPending, clearPending]);

  return {
    pending, pendingCount: pending.size,
    reviewOpen, openReview: () => setReviewOpen(true), closeReview: () => setReviewOpen(false),
    markEdited, markPending, clearPending, clearAll,
    setReviewOpen,
  };
}

// ─── Review modal ────────────────────────────────────────────────────────
export function TranslationReviewModal({
  lang, intakeId, pending, busy,
  onClose, onApplyAndContinue, onSkipAndContinue,
}) {
  // Snapshot pending into rows; fetch AI translation for each on mount.
  const initialRows = [];
  for (const [key, val] of pending.entries()) {
    initialRows.push({
      key,
      capId: val.capId,
      field: val.field,
      fieldLabel: val.fieldLabel,
      rcLabel: val.rcLabel,
      capName: val.capName,
      sourceSide: val.sourceSide,
      targetSide: val.sourceSide === 'zh' ? 'en' : 'zh',
      sourceText: val.sourceText,
      previousSource: val.previousSource || '',
      currentTarget: val.currentTarget,
      suggestion: '', loading: true, error: '', accept: true,
    });
  }
  const [rows, setRows] = useState(initialRows);

  // Fetch AI suggestions in parallel on mount.
  useEffect(() => {
    let abort = false;
    (async () => {
      const out = await Promise.all(rows.map(async (r) => {
        try {
          const body = {
            kind: 'translate',
            target_lang: r.targetSide,
            input_zh: r.sourceSide === 'zh' ? r.sourceText : '',
            input_en: r.sourceSide === 'en' ? r.sourceText : '',
            context: { rc_label: r.rcLabel, name: r.capName },
          };
          const res = await intakes.aiRewrite(intakeId, body);
          if (!res.ok) return { ...r, loading: false, error: res.reason || 'failed' };
          const text = (r.targetSide === 'zh' ? res.output_zh : res.output_en) || '';
          return { ...r, loading: false, suggestion: text };
        } catch (e) {
          return { ...r, loading: false, error: e.message || 'failed' };
        }
      }));
      if (!abort) setRows(out);
    })();
    return () => { abort = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRow = (key, patch) => setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  const acceptedCount = rows.filter(r => r.accept && r.suggestion && !r.loading).length;
  const sideLabel = (s) => s === 'zh' ? (lang === 'zh' ? '中文' : 'Chinese') : (lang === 'zh' ? '英文' : 'English');

  const handleApply = () => {
    const decisions = rows
      .filter(r => r.accept && r.suggestion && !r.loading)
      .map(r => ({
        key: r.key, capId: r.capId, field: r.field,
        targetSide: r.targetSide, targetText: r.suggestion.trim(),
      }));
    onApplyAndContinue(decisions);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,30,60,0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 14, width: 'min(820px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,30,60,0.32)',
      }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
            {lang === 'zh' ? '翻译一致性检查' : 'Translation consistency check'}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy-ink)' }}>
            {lang === 'zh'
              ? `检测到 ${rows.length} 处中英文需要确认`
              : `${rows.length} field${rows.length === 1 ? '' : 's'} need${rows.length === 1 ? 's' : ''} a matching translation`}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.55 }}>
            {lang === 'zh'
              ? '你修改了一种语言,AI 已为另一种语言生成对应译文。可以直接接受,也可以编辑后接受,或跳过保留原内容。'
              : 'You edited one language; AI has drafted a matching version for the other. Accept, edit, or skip each row.'}
          </p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px' }}>
          {rows.length === 0 && (
            <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', padding: 24 }}>
              {lang === 'zh' ? '没有需要审阅的翻译。' : 'No translations to review.'}
            </p>
          )}
          {rows.map((r) => (
            <div key={r.key} style={{
              border: '1px solid var(--border-1)', borderRadius: 10,
              padding: 14, marginBottom: 10,
              background: r.accept ? 'color-mix(in srgb, #2A6EA0 4%, white)' : 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0, flexWrap: 'wrap' }}>
                  {r.rcLabel && <span className="v2-code-label">{r.rcLabel}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>{r.fieldLabel}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {lang === 'zh'
                      ? `你改了 ${sideLabel(r.sourceSide)} → 需要确认 ${sideLabel(r.targetSide)}`
                      : `You edited ${sideLabel(r.sourceSide)} → confirm ${sideLabel(r.targetSide)}`}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={r.accept} disabled={r.loading || !!r.error}
                    onChange={(e) => setRow(r.key, { accept: e.target.checked })} />
                  {lang === 'zh' ? '采用' : 'Accept'}
                </label>
              </div>
              <div className="v2-translation-modal-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <SourceDiffPanel r={r} lang={lang} sideLabel={sideLabel} />
                <TargetDiffPanel r={r} lang={lang} sideLabel={sideLabel}
                  onChange={(text) => setRow(r.key, { suggestion: text })} />
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: '14px 22px', borderTop: '1px solid var(--border-1)',
          display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {lang === 'zh' ? '返回继续编辑' : 'Back to editing'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onSkipAndContinue} disabled={busy}>
              {lang === 'zh' ? '全部跳过,继续' : 'Skip all and continue'}
            </button>
            <button className="btn btn-primary" onClick={handleApply}
              disabled={busy || acceptedCount === 0 || rows.some(r => r.loading)}
              style={{ padding: '10px 16px', fontWeight: 600 }}>
              {busy ? '…' : (lang === 'zh'
                ? `采用 ${acceptedCount} 项并继续 →`
                : `Apply ${acceptedCount} & continue →`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Diff panels ─────────────────────────────────────────────────────────
// Yellow marker-pen highlights for the parts that changed. Used on both
// panels: the source side shows what the supplier added vs. their previous
// text; the target side shows what AI's translation added vs. the existing
// translation. Same colour = same metaphor ("this part is new").
const HIGHLIGHT_BG = 'rgba(255, 224, 51, 0.65)';   // marker-pen yellow
const HIGHLIGHT_INK = '#5a4400';                    // dark amber for legibility on yellow

function SourceDiffPanel({ r, lang, sideLabel }) {
  const ops = useMemo(
    () => r.previousSource
      ? diffTokens(r.previousSource, r.sourceText)
      : [{ text: r.sourceText, op: 'same' }],
    [r.previousSource, r.sourceText],
  );
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4 }}>
        {sideLabel(r.sourceSide)} · {lang === 'zh' ? '你刚修改的内容' : 'your edit'}
      </div>
      <div style={{
        fontSize: 13, padding: '8px 10px', background: 'var(--bg)',
        border: '1px solid var(--border-1)', borderRadius: 6, color: 'var(--ink-1)',
        minHeight: 64, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55,
      }}>
        <DiffSpans ops={ops} highlightBg={HIGHLIGHT_BG} highlightInk={HIGHLIGHT_INK} />
      </div>
    </div>
  );
}

function TargetDiffPanel({ r, lang, sideLabel, onChange }) {
  // The AI translation panel is rendered as plain text — no diff highlights.
  // Highlighting "what AI changed" relative to the existing target is noisy
  // when the supplier is just trying to read the AI's proposed translation.
  // Only the source side (user's edit) gets the yellow marker so the modal
  // is "here's what you changed; here's the matching translation".
  // Two-mode display: read-only by default; click "Edit" to tweak.
  const [editing, setEditing] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{sideLabel(r.targetSide)} · ✦ {lang === 'zh' ? 'AI 译文' : 'AI translation'}</span>
        {!r.loading && !r.error && (
          <button onClick={() => setEditing(e => !e)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--plat-supplier)', fontSize: 11, fontWeight: 600, padding: 0,
            }}>
            {editing ? (lang === 'zh' ? '✓ 完成' : '✓ Done') : (lang === 'zh' ? '编辑' : 'Edit')}
          </button>
        )}
      </div>
      {r.loading ? (
        <div style={{
          fontSize: 13, padding: '8px 10px', background: 'var(--bg)',
          border: '1px dashed var(--border-1)', borderRadius: 6,
          color: 'var(--ink-3)', minHeight: 64, fontStyle: 'italic',
        }}>{lang === 'zh' ? '正在翻译…' : 'Translating…'}</div>
      ) : r.error ? (
        <div style={{
          fontSize: 12, padding: '8px 10px',
          background: 'color-mix(in srgb, var(--st-empty-ink) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--st-empty-ink) 30%, transparent)',
          borderRadius: 6, color: 'var(--st-empty-ink)', minHeight: 64,
        }}>⚠ {lang === 'zh' ? `翻译失败: ${r.error}` : `Translation failed: ${r.error}`}</div>
      ) : editing ? (
        <textarea
          value={r.suggestion}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{
            width: '100%', fontSize: 13, padding: '8px 10px',
            border: '1px solid var(--border-1)', borderRadius: 6,
            background: 'white', resize: 'vertical', minHeight: 64,
            boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.55,
          }} />
      ) : (
        <div style={{
          fontSize: 13, padding: '8px 10px', background: 'white',
          border: '1px solid var(--border-1)', borderRadius: 6, color: 'var(--ink-1)',
          minHeight: 64, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55,
        }}>
          {r.suggestion}
        </div>
      )}
    </div>
  );
}

// ─── Pill button helper ──────────────────────────────────────────────────
export function ReviewTranslationsPill({ lang, count, onClick }) {
  if (!count) return null;
  return (
    <button onClick={onClick}
      className="v2-btn-quiet"
      style={{
        color: '#7a4f00',
        background: 'color-mix(in srgb, #f5b800 14%, transparent)',
        border: '1px solid color-mix(in srgb, #f5b800 35%, transparent)',
        fontWeight: 600,
      }}>
      ✦ {lang === 'zh' ? `审阅翻译 (${count})` : `Review translations (${count})`}
    </button>
  );
}
