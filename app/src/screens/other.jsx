// Curator screens: Queue (S6 inbox redesign) + Publish (S8). The legacy
// supplier-side ScreenConfirm / ScreenThanks were removed when the v2
// supplier flow replaced them.

import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { t } from '../i18n.js';
import { AppHeader, ProcessStepper, getPlatformSteps } from '../chrome.jsx';
import { curator, intakes, curators as curatorsApi } from '../api.js';

// Dirty-tracking: each editable section calls useDirtyTracker(id, isDirty).
// The workbench top bar reads `dirtySections` to show an unsaved-changes
// warning + register a beforeunload handler. Section-level Save/Cancel
// remains the only way to commit changes.
const DirtyContext = createContext({ dirty: new Set(), set: () => {} });
function useDirtyTracker(sectionId, isDirty) {
  const { set } = useContext(DirtyContext);
  useEffect(() => {
    set(sectionId, isDirty);
    return () => set(sectionId, false);
  }, [sectionId, isDirty, set]);
}

// Listen for the global "rm-save-all" event the top bar dispatches when the
// curator clicks Save all. The ref pattern keeps the listener bound while
// pointing at the latest save closure (avoids stale captures).
function useSaveAllListener(active, saveFn) {
  const saveRef = useRef(saveFn);
  useEffect(() => { saveRef.current = saveFn; }, [saveFn]);
  useEffect(() => {
    if (!active) return;
    const handler = () => { try { saveRef.current && saveRef.current(); } catch {} };
    window.addEventListener('rm-save-all', handler);
    return () => window.removeEventListener('rm-save-all', handler);
  }, [active]);
}

// ─── Curator workbench: localStorage helpers ───────────────────────────
// Meeting notes history + AI summary cache live in localStorage (the
// migration that would add server columns is in scripts/migrate-curator-
// workbench.sql, blocked on D1 token perms). Capability/RolePack edits
// go directly to the existing intakes API.
function wbReadJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function wbWriteJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const wbKey = (kind, intakeId) => `wb-${kind}:${intakeId}`;

// Semantic-code overlay: AI-suggested RP-XXX / RC-XXX names live in
// localStorage under wb-semantic:<intakeId> = { rp: { rpId: 'RP-AML' }, rc: { capId: 'RC-DD' } }.
// Original RP-NN / RC-NN stays in the DB (rp_label / rc_label).
function semKey(intakeId) { return wbKey('semantic', intakeId); }
function getSemMap(intakeId) { return wbReadJson(semKey(intakeId), { rp: {}, rc: {} }); }
function setSemForRp(intakeId, rpId, code) {
  const m = getSemMap(intakeId);
  m.rp = { ...(m.rp || {}), [rpId]: code };
  wbWriteJson(semKey(intakeId), m);
}
function setSemForCap(intakeId, capId, code) {
  const m = getSemMap(intakeId);
  m.rc = { ...(m.rc || {}), [capId]: code };
  wbWriteJson(semKey(intakeId), m);
}

// Compare single-language _qfields draft against the bilingual server questionnaire.
function qfieldsDirty(draft, server, lang) {
  for (const section of Object.keys(draft || {})) {
    for (const fid of Object.keys(draft[section] || {})) {
      const v = draft[section][fid] || '';
      const sv = (server || {})[section]?.[fid];
      const svz = Array.isArray(sv?.value_zh) ? sv.value_zh.join(' · ') : (sv?.value_zh || '');
      const sve = Array.isArray(sv?.value_en) ? sv.value_en.join(' · ') : (sv?.value_en || '');
      const orig = lang === 'zh' ? (svz || sve) : (sve || svz);
      if (v !== orig) return true;
    }
  }
  return false;
}

// Convert capability rows into the single-language draft shape.
function seedDraft(caps, lang, intakeId) {
  const sem = intakeId ? getSemMap(intakeId).rc : {};
  return (caps || []).map(c => ({
    ...c,
    _name: lang === 'zh' ? (c.name_zh || c.name_en || '') : (c.name_en || c.name_zh || ''),
    _desc: lang === 'zh' ? (c.description_zh || c.description_en || '') : (c.description_en || c.description_zh || ''),
    _semantic: sem[c.id] || '',
  }));
}

// Translate-on-save helper. Copilot features removed by design — we no
// longer call AI to translate. Save the same text into both language slots
// so the renderer (which prefers current lang, falls back to the other)
// always shows what the curator typed.
async function translatePair(_intakeId, _sourceLang, sourceText) {
  const t = (sourceText || '');
  return { zh: t, en: t };
}

// Simple pen-edit icon — neutral, no emoji.
function PenIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}
function TrashIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" />
    </svg>
  );
}
function PlusIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
function DownloadIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13h10" />
    </svg>
  );
}
function PaperclipIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5L5.5 10.5a2 2 0 102.83 2.83L13 8.5a3.5 3.5 0 10-4.95-4.95L3.5 8.1a5 5 0 007.07 7.07L13 13" />
    </svg>
  );
}

// No demo padding — the inbox shows live data only so KPI counts always tally
// with what's in the database. Seed via /api/admin/seed-3-suppliers when needed.
const QUEUE = [];

// Map a curator-side intake from /api/admin/intakes onto the card shape
// ScreenQueue expects. Lets the kanban consume real data alongside the QUEUE
// demo fallback.
// Defensive helpers — workbench data shape varies (industry as array of IDs,
// department as { _id, zh, en } object, etc.). These never throw.
function joinSafe(v, lang) {
  if (Array.isArray(v) && v.length) return v.map(x => typeof x === 'string' ? x : (x?.[lang] || x?.zh || x?.en || '')).filter(Boolean).join(', ') || '—';
  if (v && typeof v === 'object') return v[lang] || v.zh || v.en || '—';
  if (typeof v === 'string' && v) return v;
  return '—';
}
function deptLabel(d, lang) {
  if (!d) return '—';
  if (Array.isArray(d)) return d.join(', ') || '—';
  if (typeof d === 'object') return d[lang] || d.zh || d.en || '—';
  return String(d) || '—';
}

function adaptIntake(it) {
  const totalRolepacks = it.rolepack_count || (it.rolepacks?.length ?? 0);
  const totalCaps = it.capability_count || (it.capabilities?.length ?? 0);
  const ready = it.rolepack_ready || 0;
  const prefill = totalRolepacks > 0 ? Math.round((ready / totalRolepacks) * 100) : 0;
  const supplierLabel = it.supplier_name
    || it.supplier_short_name
    || it.name
    || `Capability Partner ${(it.id || '').slice(-4)}`;
  return {
    id: it.id,
    supplier: supplierLabel,
    contact: '',
    product: it.name || it.industry_hint || it.id,
    productSub: { zh: it.industry_hint || '', en: it.industry_hint || '' },
    // The intake.status column tracks wizard progress (draft → submitted)
    // and isn't allowed to hold 'published' (CHECK constraint). Publish is
    // an orthogonal flag on `is_published` — once it's 1 the frontend treats
    // the intake as published regardless of what `status` says.
    status: it.is_published ? 'published'
      : (it.status === 'submitted' ? 'review' : it.status),
    is_published: !!it.is_published,
    prefill,
    rolepackCount: totalRolepacks,
    capabilityCount: totalCaps,
    rolepacks: it.rolepacks || [],
    capabilities: it.capabilities || [],
    materials: [],
    submittedAt: it.finalized_at || it.updated_at,
    createdAt: it.created_at,
  };
}


// ─── Curator inbox helpers ─────────────────────────────────────────────

const PHASES = ['new', 'review', 'disc', 'final', 'pub'];

// Pre-API fallback so the kanban renders something on first paint. Replaced
// by live data from /api/curator/curators as soon as it loads — that way a
// brand-new curator account becomes assignable without redeploying.
const DEMO_CURATORS = [
  { id: 'cur-eric',   name: 'Eric',  short: 'E', color: '#8E7AB5' },
  { id: 'cur-libin',  name: 'Libin', short: 'L', color: '#6E9CC9' },
];

// Stable avatar palette — picked deterministically by id hash so the same
// curator always gets the same chip color across sessions.
const CURATOR_COLOR_PALETTE = [
  '#8E7AB5', '#6E9CC9', '#5C9F8C', '#C28B5E', '#A66E9C', '#7E8BC9', '#B5876E', '#5E9CB7',
];
function curatorAvatarColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CURATOR_COLOR_PALETTE[h % CURATOR_COLOR_PALETTE.length];
}
function curatorShort(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'C';
}
// Map an API user row → kanban curator shape.
function adaptCuratorRow(u) {
  return { id: u.id, name: u.name || u.email || 'Curator', short: curatorShort(u.name || u.email), color: curatorAvatarColor(u.id) };
}

const SUPPLIER_INDUSTRY = {
  'Vigil Advisory Limited': 'banking',
  'Aselo Inc.': 'retail',
  'Lumon AI': 'prosvc',
  'Anthropic Edge': 'prosvc',
  'Helix Compliance': 'insurance',
  'MarketBase': 'prosvc',
  'Stratify HK': 'banking',
  'Cobalt Labs': 'prosvc',
};

const INDUSTRY_LABEL = {
  banking:   { zh: '银行',     en: 'Banking' },
  insurance: { zh: '保险',     en: 'Insurance' },
  retail:    { zh: '零售',     en: 'Retail' },
  prosvc:    { zh: '专业服务', en: 'Pro services' },
  other:     { zh: '其他',     en: 'Other' },
};

// Stable, deterministic hash from id → bucket index.
function hashIdx(id, n) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % n;
}

// LocalStorage helpers — namespace per submission so the demo state survives reloads.
function readMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function writeMap(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

// True when the intake has anything visible in the public catalog. The
// catalog filters on individual rolepack status, so even a partially-
// published intake (e.g. 3 of 4 rolepacks live) belongs in 已发布 — that
// way the curator's published tab always mirrors what buyers see.
function hasPublishedRolepack(item) {
  return !!(item.rolepacks?.some && item.rolepacks.some(rp => rp.status === 'published'));
}

function defaultPhaseFor(item) {
  // Three stages: new (just submitted, untouched) / review (curator working
  // on it) / pub (published). Freshly-submitted intakes land in 'new' so the
  // curator team sees them in the inbox; opening the workbench (or starting
  // the AI summary) flips them to 'review' via the click handler.
  // Published is the union of:
  //   - is_published flag (set by publish-all when EVERY rolepack is live)
  //   - any rolepack with status='published' (so partially-published intakes
  //     still show up here, matching the public catalog)
  //   - legacy status values from older data
  if (item.is_published) return 'pub';
  if (hasPublishedRolepack(item)) return 'pub';
  const s = item.status;
  if (s === 'published' || s === 'approved') return 'pub';
  if (s === 'review' || s === 'revision' || s === 'in_review') return 'review';
  return 'new'; // submitted, draft, anything else
}

function defaultAssigneeFor(item, curators) {
  return curators[hashIdx(item.id + '-a', curators.length)].id;
}

function ageDays(item) {
  const ts = item.submittedAt || item.createdAt;
  if (!ts) return 0;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
function ageLabel(item, lang) {
  const ts = item.submittedAt || item.createdAt;
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60 * 60 * 1000) return t('s6_age_just', lang);
  if (ms < 24 * 60 * 60 * 1000) return t('s6_age_today', lang);
  if (ms < 48 * 60 * 60 * 1000) return t('s6_age_yesterday', lang);
  return t('s6_age_days', lang, { n: Math.floor(ms / 86400000) });
}

function fmtDate(ymd, lang) {
  if (!ymd) return '—';
  const d = new Date(ymd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

function callRelative(ymd, lang) {
  if (!ymd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(ymd + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return { label: t('s6_call_today', lang), kind: 'today' };
  if (diff === 1)  return { label: t('s6_call_tomorrow', lang), kind: 'soon' };
  if (diff > 1)    return { label: t('s6_call_on', lang, { date: fmtDate(ymd, lang) }), kind: 'upcoming' };
  // Past — return null (caller renders the post-call notes chip instead)
  return null;
}

function notesChipFor(callDate, lang) {
  if (!callDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(callDate + 'T00:00:00');
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diff < 1) return null; // not past yet
  return {
    overdue: diff >= 3,
    label: diff >= 3 ? t('s6_notes_overdue', lang) : t('s6_notes_pending', lang),
    when: t('s6_notes_call_was', lang, { date: fmtDate(callDate, lang) }),
  };
}

function MatChip({ m }) {
  const M = { pdf: 'PDF', ppt: 'PPT', url: 'URL', voice: 'VOX', doc: 'DOC' };
  return <span className={`mat-chip ${m}`}>{M[m] || m.toUpperCase()}</span>;
}

function Avatar({ curator, size }) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  return (
    <span className={cls} style={{ background: curator.color }} title={curator.name}>
      {curator.short}
    </span>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────

function KanbanCard({ item, lang, phase, assignee, curators, onOpen, onDragStart, onDragEnd, isLead, scope, showAssignee, currentCuratorId, onAssignChange, allCurators, onPhaseChange }) {
  const cur = assignee && assignee !== 'unassigned' ? (curators.find(c => c.id === assignee) || null) : null;
  const isMine = assignee === currentCuratorId;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const submittedDate = item.submittedAt
    ? new Date(item.submittedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
    : '';

  const rps = item.rolepacks || [];
  const caps = item.capabilities || [];
  const nameOf = (x) => (lang === 'zh' ? (x.name_zh || x.name_en) : (x.name_en || x.name_zh)) || '';

  return (
    <div
      className="kanban-card v2-card-curator"
      draggable={true}
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(item.id)}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item.id); }}
      style={{ padding: '16px 18px' }}
    >
      {/* Header row: title (full Product) + inline counts + assignee chip + 3-dot menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-ink)', lineHeight: 1.25, wordBreak: 'break-word' }}>
              {item.product}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>{rps.length || item.rolepackCount || 0}</strong> RolePack
              <span style={{ margin: '0 5px' }}>·</span>
              <strong style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>{caps.length || item.capabilityCount || 0}</strong> RoleCapability
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1, lineHeight: 1.3, wordBreak: 'break-word' }}>
            {item.supplier}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{submittedDate || ageLabel(item, lang)}</span>
          {showAssignee !== false && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: cur ? 'color-mix(in srgb, var(--plat-curator) 10%, white)' : 'var(--bg)', border: '1px solid var(--line-2)' }}>
              {cur
                ? (<>
                    <Avatar curator={cur} size="sm" />
                    <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>
                      {isMine && lang === 'zh' ? '我' : isMine ? 'me' : cur.name}
                    </span>
                  </>)
                : <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>{lang === 'zh' ? '未指派' : 'Unassigned'}</span>}
            </span>
          )}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
              title={lang === 'zh' ? '指派 / 操作' : 'Assign / actions'}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '2px 6px', borderRadius: 4, fontSize: 18, lineHeight: 1, color: 'var(--ink-3)',
              }}
            >⋯</button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 30,
                background: 'white', border: '1px solid var(--line)', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, padding: 4,
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  {lang === 'zh' ? '指派给' : 'Assign to'}
                </div>
                <button
                  onClick={() => { onAssignChange?.(item.id, 'unassigned'); setMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                    background: assignee === 'unassigned' || !cur ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'transparent',
                    border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 4,
                    fontSize: 13, color: 'var(--ink-2)', fontFamily: 'inherit', fontStyle: 'italic',
                  }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--ink-3)' }}>—</span>
                  <span style={{ flex: 1 }}>{lang === 'zh' ? '未指派' : 'Unassigned'}</span>
                  {(assignee === 'unassigned' || !cur) && <span style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>✓</span>}
                </button>
                {(allCurators || curators).map(c => (
                  <button key={c.id}
                    onClick={() => { onAssignChange?.(item.id, c.id); setMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      background: c.id === assignee ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'transparent',
                      border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 4,
                      fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
                    }}>
                    <Avatar curator={c} size="sm" />
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {c.id === assignee && <span style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>✓</span>}
                  </button>
                ))}

                {/* Status switcher: move card between stages */}
                <div style={{ height: 1, background: 'var(--line-2)', margin: '6px 4px' }} />
                <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  {lang === 'zh' ? '移动到' : 'Move to'}
                </div>
                {[
                  { id: 'new',    zh: '新提交', en: 'New submission' },
                  { id: 'review', zh: '审阅中', en: 'In review' },
                  { id: 'pub',    zh: '已发布', en: 'Published' },
                ].map(s => (
                  <button key={s.id}
                    onClick={() => { onPhaseChange?.(item.id, s.id); setMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      background: phase === s.id ? 'color-mix(in srgb, var(--plat-curator) 12%, white)' : 'transparent',
                      border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 4,
                      fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit',
                    }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.id === 'new' ? 'var(--ink-3)' : s.id === 'review' ? '#C28800' : 'var(--plat-supplier-2)' }} />
                    <span style={{ flex: 1 }}>{lang === 'zh' ? s.zh : s.en}</span>
                    {phase === s.id && <span style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RolePack list — horizontal pills, blue (differentiated from RC purple) */}
      {rps.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {rps.map(r => (
            <span key={r.id} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 5,
              fontSize: 11.5, padding: '4px 10px', borderRadius: 6,
              background: 'color-mix(in srgb, #3D8CC4 12%, white)',
              border: '1px solid color-mix(in srgb, #3D8CC4 32%, transparent)',
              color: 'var(--ink)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2A6EA0', fontWeight: 700 }}>{r.rp_label}</span>
              <span style={{ fontWeight: 500 }}>{nameOf(r) || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
            </span>
          ))}
        </div>
      )}

      {/* RoleCapability list — horizontal pills, purple (curator color) */}
      {caps.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {caps.map(c => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              fontSize: 11, padding: '3px 9px', borderRadius: 999,
              background: 'color-mix(in srgb, var(--plat-curator) 6%, white)',
              border: '1px solid color-mix(in srgb, var(--plat-curator) 18%, transparent)',
              color: 'var(--ink)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--plat-curator)', fontWeight: 700 }}>{c.rc_label}</span>
              <span>{nameOf(c) || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Filter chip dropdown ──────────────────────────────────────────────

// ─── KPI summary cards + period selector ───────────────────────────────
function KpiSummary({ lang, counts, period, setPeriod, activeStage, setActiveStage, supplierCount, onOpenSuppliers }) {
  const periodOptions = [
    { id: 'today', zh: '今天',   en: 'Today' },
    { id: '7d',    zh: '近 7 天', en: 'Last 7 days' },
    { id: '30d',   zh: '近 30 天', en: 'Last 30 days' },
    { id: 'all',   zh: '全部',   en: 'All time' },
  ];
  const stageCards = [
    { id: 'new',    label: lang === 'zh' ? '新提交' : 'New submission', count: counts.new },
    { id: 'review', label: lang === 'zh' ? '审阅中' : 'In review',      count: counts.review },
    { id: 'pub',    label: lang === 'zh' ? '已发布' : 'Published',      count: counts.pub },
  ];
  const sumCount = (key) => stageCards.reduce((s, c) => s + (counts[c.id + '_' + key] || 0), 0);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lang === 'zh' ? '本期间内' : 'This period'}
        </span>
        <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'rgba(255,255,255,0.7)', border: '1px solid var(--v2-rule, rgba(20,24,42,0.08))', borderRadius: 8 }}>
          {periodOptions.map(o => (
            <button key={o.id} onClick={() => setPeriod(o.id)}
              style={{
                background: period === o.id ? 'white' : 'transparent',
                border: 'none', cursor: 'pointer',
                padding: '5px 11px', borderRadius: 6, fontSize: 12,
                color: period === o.id ? 'var(--plat-curator)' : 'var(--ink-2)',
                fontWeight: period === o.id ? 600 : 500,
                boxShadow: period === o.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}>
              {lang === 'zh' ? o.zh : o.en}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* 1st card (leftmost): Capability Partners — clicking opens Supplier Management.
            Layout matches the stage cards: label + 'click →' on top, big +N below, secondary line. */}
        <button onClick={onOpenSuppliers}
          style={{
            textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            background: 'white',
            border: '1px solid var(--v2-rule, rgba(20,24,42,0.08))',
            borderRadius: 12, padding: '16px 18px',
            boxShadow: '0 1px 2px rgba(15,30,60,0.04)',
            transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
            display: 'flex', flexDirection: 'column', gap: 6, minHeight: 122,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,30,60,0.08)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--plat-curator) 35%, transparent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,30,60,0.04)'; e.currentTarget.style.borderColor = 'var(--v2-rule, rgba(20,24,42,0.08))'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{lang === 'zh' ? '能力伙伴' : 'Capability Partners'}</span>
            <span style={{ fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>{lang === 'zh' ? '点击 →' : 'click →'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--plat-curator)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>+{supplierCount || 0}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{lang === 'zh' ? '能力伙伴' : 'Capability Partners'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
            {lang === 'zh' ? '进入合作伙伴管理' : 'open partner management'}
          </div>
        </button>

        {/* Stage cards. Headline number is the INTAKE count so it ties to the
            tab badge below (which counts intakes per phase). RolePack and
            RoleCapability totals follow as a secondary line so the curator can
            still see how much downstream content sits in each stage. */}
        {stageCards.map(c => {
          const isActive = activeStage === c.id;
          const intakeN = c.count || 0;
          const rpN  = counts[c.id + '_rp'] || 0;
          const capN = counts[c.id + '_cap'] || 0;
          return (
            <button key={c.id}
              onClick={() => setActiveStage?.(c.id)}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: isActive ? 'color-mix(in srgb, var(--plat-curator) 8%, white)' : 'white',
                border: isActive
                  ? '1px solid color-mix(in srgb, var(--plat-curator) 45%, transparent)'
                  : '1px solid var(--v2-rule, rgba(20,24,42,0.08))',
                borderRadius: 12, padding: '16px 18px',
                boxShadow: isActive ? '0 4px 14px rgba(110,90,180,0.12)' : '0 1px 2px rgba(15,30,60,0.04)',
                transition: 'box-shadow 0.15s, border-color 0.15s, background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 6, minHeight: 122,
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,30,60,0.08)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--plat-curator) 35%, transparent)'; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,30,60,0.04)'; e.currentTarget.style.borderColor = 'var(--v2-rule, rgba(20,24,42,0.08))'; } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                  {isActive ? (lang === 'zh' ? '· 当前' : '· current') : (lang === 'zh' ? '点击 →' : 'click →')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--plat-curator)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>+{intakeN}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{lang === 'zh' ? '提交' : 'submissions'}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: '#2A6EA0', fontWeight: 600 }}>{rpN}</span> RolePack
                <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                <span style={{ color: 'var(--plat-curator)', fontWeight: 600 }}>{capN}</span> RoleCapability
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3-stage tabbed layout ─────────────────────────────────────────────
function ThreeStageLayout({ lang, byPhase, assigneeOf, curators, currentCuratorId, scope, isLead, onOpen, onCardDragStart, onCardDragEnd, onAssignChange, onPhaseChange, activeStage, setActiveStage }) {
  const stages = [
    { id: 'new',    label: lang === 'zh' ? '新提交' : 'New submission' },
    { id: 'review', label: lang === 'zh' ? '审阅中' : 'In review' },
    { id: 'pub',    label: lang === 'zh' ? '已发布' : 'Published' },
  ];
  const items = byPhase[activeStage] || [];
  return (
    <div>
      {/* Tab strip */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--line)',
        marginBottom: 14, padding: '0 4px',
      }}>
        {stages.map(s => {
          const count = (byPhase[s.id] || []).length;
          const isActive = activeStage === s.id;
          return (
            <button key={s.id}
              onClick={() => setActiveStage(s.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '10px 16px', fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--plat-curator)' : 'var(--ink-2)',
                borderBottom: isActive ? '2px solid var(--plat-curator)' : '2px solid transparent',
                marginBottom: -1, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <span>{s.label}</span>
              <span style={{
                fontSize: 11, padding: '1px 7px', borderRadius: 999,
                background: isActive ? 'var(--plat-curator)' : 'var(--bg)',
                color: isActive ? 'white' : 'var(--ink-3)',
                fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Active stage cards */}
      {items.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.55)', border: '1px dashed var(--line)',
          borderRadius: 10, padding: '32px 16px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center',
        }}>
          {lang === 'zh' ? '暂无' : 'None'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map(it => (
            <KanbanCard
              key={it.id}
              item={it}
              lang={lang}
              phase={activeStage}
              assignee={assigneeOf(it)}
              curators={curators}
              allCurators={curators}
              currentCuratorId={currentCuratorId}
              showAssignee={true}
              isLead={isLead}
              scope={scope}
              onOpen={onOpen}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onAssignChange={onAssignChange}
              onPhaseChange={onPhaseChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterDropdown({ label, value, options, onChange, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const active = value && value !== 'all';
  const cur = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className={'filter-chip' + (active ? ' active' : '') + (open ? ' open' : '')}
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}{active ? `: ${cur?.label || value}` : ''}</span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="filter-popover">
          {options.map(o => (
            <label key={o.value}>
              <input
                type="radio"
                name={label}
                checked={value === o.value}
                onChange={() => { onChange(o.value); setOpen(false); }}
                style={{ accentColor: 'var(--plat-curator)' }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sticky progress line — sits below the RoleMaster header ──────────

function CuratorProgressLine({ lang, current = 'inbox' }) {
  const steps = [
    { id: 'inbox',   label: lang === 'zh' ? '审阅队列' : 'Inbox' },
    { id: 'review',  label: lang === 'zh' ? '策展审核' : 'Review' },
    { id: 'publish', label: lang === 'zh' ? '发布上线' : 'Publish' },
  ];
  const currentIdx = steps.findIndex(s => s.id === current);
  return (
    <div className="curator-progress" role="navigation" aria-label="Curator workflow">
      {steps.map((s, i) => {
        const state = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 22 }}>
            <span className={'step ' + state}>
              <span className="num">{state === 'done' ? '✓' : i + 1}</span>
              <span>{s.label}</span>
            </span>
            {i < steps.length - 1 && <span className="arrow">›</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────

export function ScreenQueue({ lang, setLang, openSubmission, curatorName, onLogout }) {
  // Toggle a body-class while this screen is mounted so the global stepper
  // (rendered above the header in App.jsx) is hidden and the purple hero
  // gradient is applied. Restored on unmount.
  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  // Live API + demo augmentation. The live API may return only a couple of
  // submissions in demo deployments; pad with QUEUE samples so the kanban view
  // has enough cards to feel real. Demo items use the same id format so per-id
  // localStorage state survives across reloads.
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Hydrate localStorage AI-summary + semantic-code caches from canned seed
  // data. Always overwrite — the server canned content is the source of truth
  // for the demo intakes, so each inbox load brings the latest copy.
  useEffect(() => {
    (async () => {
      try {
        const res = await curator.seedSummaries();
        for (const [intakeId, summary] of Object.entries(res?.summaries || {})) {
          localStorage.setItem(`wb-summary:${intakeId}`, JSON.stringify(summary));
        }
        for (const [intakeId, sem] of Object.entries(res?.semantics || {})) {
          localStorage.setItem(`wb-semantic:${intakeId}`, JSON.stringify(sem));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const { items: liveRaw } = await curator.listIntakes('all');
        if (abort) return;
        // Curators only care about intakes a partner has actually finalized,
        // not abandoned drafts. Drop draft / null-status rows.
        const live = (liveRaw || [])
          .filter(it => it.status && it.status !== 'draft')
          .map(adaptIntake);
        const haveIds = new Set(live.map(x => x.id));
        const demoFill = QUEUE.filter(q => !haveIds.has(q.id)).map(q => ({
          id: q.id,
          supplier: q.supplier,
          contact: q.contact,
          product: q.product,
          productSub: q.productSub,
          status: q.status,
          prefill: q.prefill,
          materials: q.materials,
          // Spread fake submitted dates over recent days so age sorting + "Past 24h" filter work
          submittedAt: new Date(Date.now() - (1 + hashIdx(q.id, 9)) * 86400000).toISOString(),
        }));
        setItems([...live, ...demoFill]);
      } catch (e) {
        if (!abort) {
          // If API isn't reachable fall back to QUEUE directly so the prototype
          // still shows the redesigned UI rather than an error wall.
          setErr(e.message);
          setItems(QUEUE.map(q => ({
            id: q.id,
            supplier: q.supplier,
            contact: q.contact,
            product: q.product,
            productSub: q.productSub,
            status: q.status,
            prefill: q.prefill,
            materials: q.materials,
            submittedAt: new Date(Date.now() - (1 + hashIdx(q.id, 9)) * 86400000).toISOString(),
          })));
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  // Curator scope: 'self' (only my queue) or 'leader' (team-wide). Driven by
  // the View-as dropdown in the header. Listen for changes via custom event
  // so the inbox re-renders the moment the curator picks a different view.
  const [isLead, setIsLead] = useState(() => {
    try { return localStorage.getItem('rm_curator_lead') === '1'; } catch { return false; }
  });
  useEffect(() => {
    const onScopeChange = (e) => setIsLead(e.detail?.scope === 'leader');
    window.addEventListener('rm-curator-scope-changed', onScopeChange);
    return () => window.removeEventListener('rm-curator-scope-changed', onScopeChange);
  }, []);
  useEffect(() => {
    // Sync inbox scope to the lead/self toggle.
    setScope(isLead ? 'team' : 'my');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLead]);

  // Per-item demo state (phase / assignee / callDate). Persisted so the demo
  // feels alive between reloads.
  const [phaseMap, setPhaseMap]       = useState(() => readMap('rm_phaseMap'));
  const [assignMap, setAssignMap]     = useState(() => readMap('rm_assignMap'));
  const [callDateMap, setCallDateMap] = useState(() => readMap('rm_callDateMap'));
  useEffect(() => writeMap('rm_phaseMap', phaseMap),     [phaseMap]);
  useEffect(() => writeMap('rm_assignMap', assignMap),   [assignMap]);
  useEffect(() => writeMap('rm_callDateMap', callDateMap), [callDateMap]);

  // View mode + scope.
  const [period, setPeriod] = useState('all');    // today | 7d | 30d | all
  const [scope, setScope] = useState('my');       // my | team
  const [activeStage, setActiveStage] = useState('new'); // new | review | pub

  // Filters.
  const [search,    setSearch]    = useState('');
  const [filterInd, setFilterInd] = useState('all');
  const [filterSup, setFilterSup] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterAss, setFilterAss] = useState('all');
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Drag state.
  const [dragId, setDragId]   = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [dropRow, setDropRow] = useState(null);

  // Pending call-date prompt (when dropping into Discussion).
  const [callPrompt, setCallPrompt] = useState(null); // { id, defaultDate }

  // Live curator directory — pulled from /api/curator/curators so brand-new
  // curator accounts show up in the assign menu without redeploying. Falls
  // back to DEMO_CURATORS until the call resolves so the kanban renders on
  // first paint.
  const [liveCurators, setLiveCurators] = useState(null);
  useEffect(() => {
    let abort = false;
    curatorsApi.list().then(r => {
      if (abort) return;
      const items = (r.items || []).map(adaptCuratorRow);
      if (items.length > 0) setLiveCurators(items);
    }).catch(() => {});
    return () => { abort = true; };
  }, []);
  const curators = liveCurators || DEMO_CURATORS;

  // Identify the current user as a curator (so "My queue" works). Resolves
  // against the live curator list when available so a freshly-created curator
  // sees their own queue without a redeploy.
  const currentCurator = useMemo(() => {
    if (!curatorName) return curators[0];
    const match = curators.find(c =>
      c.name.toLowerCase() === curatorName.toLowerCase() ||
      c.name.split(' ')[0].toLowerCase() === curatorName.split(' ')[0].toLowerCase()
    );
    return match || { ...curators[0], name: curatorName, short: initials(curatorName) };
  }, [curatorName, curators]);

  function initials(n) {
    return (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'C';
  }

  // Resolve phase / assignee / callDate for an item — override or default.
  // The local phaseMap override always wins so the curator can move an
  // intake between phases via the 3-dot menu / drag-drop — including
  // moving a published intake back to 审阅中 if they want to revise.
  // Stale-override-pinning-published-intakes-to-review (the historical
  // Aselo bug) is prevented at write time: doPublish clears phaseMap[id]
  // on success, and the kanban phase-change handler writes the matching
  // is_published value back to the server so a refresh picks up either
  // tab correctly.
  // Phase resolver. Default order is override-wins so the curator can drag
  // an intake to a different stage and have it stick. ONE exception: when
  // the data says the intake is published (is_published flag OR any
  // rolepack live in the public catalog), the data wins. Otherwise the
  // 已发布 tab can drift from the catalog because of a stale localStorage
  // entry — exactly the bug the user reported with Vigil's AML/EDD/STR.
  const phaseOf = (it) => {
    const def = defaultPhaseFor(it);
    if (def === 'pub') return 'pub';
    return phaseMap[it.id] || def;
  };
  const assigneeOf = (it) => assignMap[it.id] || defaultAssigneeFor(it, curators);
  const callDateOf = (it) => callDateMap[it.id] || (() => {
    // Deterministic demo date — only used when phase is disc and no override.
    if (phaseOf(it) !== 'disc') return null;
    const offset = -3 + hashIdx(it.id + '-d', 9); // -3 .. +5 days
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  })();

  // Apply filters (used by both views).
  const filtered = useMemo(() => items.filter(it => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!(it.supplier.toLowerCase().includes(q) ||
            it.product?.toLowerCase().includes(q) ||
            (it.productSub?.[lang] || '').toLowerCase().includes(q))) return false;
    }
    if (filterInd !== 'all' && (SUPPLIER_INDUSTRY[it.supplier] || 'other') !== filterInd) return false;
    if (filterSup !== 'all' && it.supplier !== filterSup) return false;
    if (filterAge !== 'all') {
      const age = ageDays(it);
      if (filterAge === 'recent' && age > 1) return false;
      if (filterAge === 'week'   && age > 7) return false;
      if (filterAge === 'old'    && age <= 7) return false;
    }
    if (filterAss !== 'all' && assigneeOf(it) !== filterAss) return false;
    // Period selector: filter by submittedAt within today / 7d / 30d / all
    if (period !== 'all') {
      const ts = new Date(it.submittedAt || it.createdAt || 0).getTime();
      if (!ts) return false;
      const days = Math.floor((Date.now() - ts) / 86400000);
      if (period === 'today' && days > 0) return false;
      if (period === '7d'    && days > 7) return false;
      if (period === '30d'   && days > 30) return false;
    }
    return true;
  }), [items, search, filterInd, filterSup, filterAge, filterAss, period, lang, assignMap, phaseMap]);

  // Apply scope (My queue vs Team view) — only relevant in kanban for cards.
  const inScope = (it) => scope === 'team' ? true : assigneeOf(it) === currentCurator.id;

  // Distribute items across the 3 stages. Sort: newest first within each stage.
  const byPhase = useMemo(() => {
    const map = { new: [], review: [], pub: [] };
    filtered.filter(inScope).forEach(it => {
      const p = phaseOf(it);
      if (map[p]) map[p].push(it);
    });
    const byNewest = (a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0);
    map.new.sort(byNewest);
    map.review.sort(byNewest);
    map.pub.sort(byNewest);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, scope, currentCurator.id, phaseMap, assignMap]);

  const allInScope = filtered.filter(inScope);
  const totalCount = allInScope.length;

  // Per-stage RolePack/RoleCapability totals for the KPI cards. The 已发布
  // stage counts ONLY rolepacks whose row in the DB has status='published'
  // (i.e. exactly what the public catalog renders), not every rolepack
  // under a partially-published intake. That way the curator's 已发布
  // RolePack count ties to the public /rolepacks page.
  const kpiCounts = useMemo(() => {
    const out = {
      new: byPhase.new.length, review: byPhase.review.length, pub: byPhase.pub.length,
      new_rp: 0, new_cap: 0, review_rp: 0, review_cap: 0, pub_rp: 0, pub_cap: 0,
    };
    for (const stage of ['new', 'review', 'pub']) {
      for (const it of byPhase[stage]) {
        if (stage === 'pub') {
          // Only published RPs (matches public catalog).
          out.pub_rp += (it.rolepacks || []).filter(rp => rp.status === 'published').length;
        } else {
          out[stage + '_rp'] += (it.rolepacks?.length || it.rolepackCount || 0);
        }
        out[stage + '_cap'] += (it.capabilities?.length || it.capabilityCount || 0);
      }
    }
    return out;
  }, [byPhase]);

  // Distinct supplier count in the current period scope.
  const supplierCount = useMemo(() => {
    const set = new Set(allInScope.map(it => it.supplier).filter(Boolean));
    return set.size;
  }, [allInScope]);

  // Aggregate counters strip (lead + team scope).
  const stats = useMemo(() => {
    const counts = { newCount: byPhase.new.length, review: byPhase.review.length, pub: byPhase.pub.length };
    const ages   = allInScope.filter(it => phaseOf(it) !== 'pub').map(ageDays);
    const avg    = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const oldest = ages.length ? Math.max(...ages) : 0;
    return { ...counts, avg, oldest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byPhase, allInScope]);

  // Team load distribution per curator (lead + team scope only).
  const teamLoad = useMemo(() => curators.map(c => {
    const mine = filtered.filter(it => assigneeOf(it) === c.id && phaseOf(it) !== 'pub');
    const dist = { new: 0, review: 0, disc: 0, final: 0 };
    mine.forEach(it => { const p = phaseOf(it); if (dist[p] != null) dist[p]++; });
    return { curator: c, count: mine.length, dist };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, phaseMap, assignMap]);

  // Drag handlers.
  const onCardDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onCardDragEnd = () => { setDragId(null); setDropCol(null); setDropRow(null); };

  const onColDragOver = (e, phase) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropCol(phase);
  };
  const onColDrop = (e, phase) => {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain');
    if (!id) return;
    setPhaseMap(m => ({ ...m, [id]: phase }));
    setDragId(null); setDropCol(null);
  };
  const confirmCallPrompt = (date) => {
    if (!callPrompt) return;
    setPhaseMap(m => ({ ...m, [callPrompt.id]: 'disc' }));
    setCallDateMap(m => ({ ...m, [callPrompt.id]: date }));
    setCallPrompt(null);
  };

  const onTeamRowDragOver = (e, curId) => {
    if (!dragId || !isLead || scope !== 'team') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropRow(curId);
  };
  const onTeamRowDrop = (e, curId) => {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain');
    if (!id) return;
    setAssignMap(m => ({ ...m, [id]: curId }));
    setDragId(null); setDropRow(null);
  };

  // Open via observe-mode hint when lead is in Team view.
  // Auto-promote any 'new' card to 'review' the moment the curator opens it
  // (matches the user's mental model: "they clicked into review, so it IS in review").
  const handleOpen = (id) => {
    if (isLead && scope === 'team') {
      try { sessionStorage.setItem('rm_observe', '1'); } catch {}
    } else {
      try { sessionStorage.removeItem('rm_observe'); } catch {}
    }
    const item = items.find(it => it.id === id);
    if (item && (phaseMap[id] || defaultPhaseFor(item)) === 'new') {
      setPhaseMap(m => ({ ...m, [id]: 'review' }));
      // Best-effort server status patch (curators are allowed to PATCH intakes now).
      if (id && !id.startsWith('DEMO-')) {
        intakes.patch(id, { status: 'submitted' }).catch(() => {});
      }
    }
    openSubmission(id);
  };

  const supplierOptions = useMemo(() => {
    const set = new Map();
    items.forEach(it => set.set(it.supplier, true));
    return [{ value: 'all', label: lang === 'zh' ? '全部' : 'All' },
      ...Array.from(set.keys()).map(s => ({ value: s, label: s }))];
  }, [items, lang]);

  const industryOptions = [
    { value: 'all', label: lang === 'zh' ? '全部' : 'All' },
    ...Object.entries(INDUSTRY_LABEL).map(([k, v]) => ({ value: k, label: v[lang] })),
  ];
  const ageOptions = [
    { value: 'all',    label: t('s6_age_all', lang) },
    { value: 'recent', label: t('s6_age_recent', lang) },
    { value: 'week',   label: t('s6_age_week', lang) },
    { value: 'old',    label: t('s6_age_old', lang) },
  ];
  const assigneeOptions = [
    { value: 'all', label: lang === 'zh' ? '全部' : 'All' },
    ...curators.map(c => ({ value: c.id, label: c.name })),
  ];

  // Team-load rail removed; this flag only kept so the v2-curator-inbox grid stays single-column.
  const showRail = false;
  const showTeamStrip = isLead && scope === 'team';

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />

      <div className={'curator-inbox v2-curator-inbox' + (showRail ? ' with-rail' : '')}>
        <div>
          {/* Title + toggles — v2 typography matching the partner side */}
          <div className="v2-eyebrow">{lang === 'zh' ? '策展人门户 · 收件箱' : 'Curator portal · Inbox'}</div>
          <div className="v2-title-row" style={{ marginBottom: 6 }}>
            <h1 className="v2-display">{t('s6_title', lang)}</h1>
            <span className="v2-status-pill v2-status-pill--review">
              ✦ {t('s6_count_items', lang, { n: totalCount })}
            </span>
            <button onClick={() => window.location.assign('/curators/library')}
              style={{
                marginLeft: 10, background: 'transparent',
                border: '1px solid color-mix(in srgb, var(--plat-curator) 35%, transparent)',
                color: 'var(--plat-curator)', borderRadius: 8,
                padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              ★ {lang === 'zh' ? '公开目录管理' : 'Manage public catalogue'}
            </button>
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none' }}>
            {scope === 'team' && isLead
              ? (lang === 'zh' ? '团队全局视图 — 浏览所有 RolePack 提交,点开任意条目进入审阅。' : 'Team-wide view — browse every RolePack submission and click any to review.')
              : (lang === 'zh' ? '点开任意条目即可审阅,完成后一步到发布。' : 'Click any submission to review; one step from there to publish.')}
          </p>

          {/* KPI summary + period selector */}
          <KpiSummary
            lang={lang}
            counts={kpiCounts}
            period={period}
            setPeriod={setPeriod}
            activeStage={activeStage}
            setActiveStage={setActiveStage}
            supplierCount={supplierCount}
            onOpenSuppliers={() => { window.location.assign('/curators/suppliers'); }}
          />

          {/* View + scope toggles — moved into a section head row mirroring partner */}
          <div className="v2-section__head--actions" style={{ marginBottom: 14, padding: '0 4px' }}>
            <div className="v2-section__head-left">
              <h2 className="v2-h2--sm">{lang === 'zh' ? 'RolePack 提交流' : 'RolePack submission flow'}</h2>
              <span className="v2-meta">
                {totalCount} {lang === 'zh' ? '项' : 'items'}
              </span>
            </div>
            <div className="v2-section__head-actions">
              {isLead && (
                <div className="seg-ctrl lead-only">
                  <button className={scope === 'my' ? 'active' : ''} onClick={() => setScope('my')}>
                    {t('s6_scope_my', lang)}
                  </button>
                  <button className={scope === 'team' ? 'active' : ''} onClick={() => setScope('team')}>
                    {t('s6_scope_team', lang)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="curator-filter-bar">
            <FilterDropdown label={t('s6_filter_industry', lang)} value={filterInd} onChange={setFilterInd} options={industryOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_supplier', lang)} value={filterSup} onChange={setFilterSup} options={supplierOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_age', lang)}      value={filterAge} onChange={setFilterAge} options={ageOptions} lang={lang} />
            <FilterDropdown label={t('s6_filter_assignee', lang)} value={filterAss} onChange={setFilterAss} options={assigneeOptions} lang={lang} />
            <div className="grow">
              <input
                className="text-input"
                placeholder={t('s6_search', lang)}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(filterInd !== 'all' || filterSup !== 'all' || filterAge !== 'all' || filterAss !== 'all' || search) && (
              <button className="clear" onClick={() => {
                setFilterInd('all'); setFilterSup('all'); setFilterAge('all'); setFilterAss('all'); setSearch('');
              }}>{t('s6_clear_filters', lang)}</button>
            )}
          </div>

          {loading && (
            <div style={{ padding: 60, color: 'var(--ink-3)', textAlign: 'center' }}>
              <span className="rm-loading-dots" aria-live="polite">
                <span>{lang === 'zh' ? '加载中' : 'Loading'}</span>
                <span className="rm-dots"><i /><i /><i /></span>
              </span>
            </div>
          )}

          {!loading && allInScope.length === 0 && (
            <div style={{
              padding: 60, textAlign: 'center', background: 'white',
              border: '1px dashed var(--line)', borderRadius: 14,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'var(--plat-curator-tint)', color: 'var(--plat-curator)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, marginBottom: 14,
              }}>📭</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
                {lang === 'zh' ? '暂无待审提交' : 'Nothing to review yet'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, maxWidth: 380, marginInline: 'auto' }}>
                {items.length > 0 ? t('s6_empty_filtered', lang) :
                 (lang === 'zh' ? '当能力伙伴完成提交后,新条目会出现在这里。'
                                : 'New submissions will appear here when Capability Partners finish their forms.')}
              </p>
            </div>
          )}

          {/* 3-stage tabbed layout. KPI cards above switch tabs on click. */}
          {!loading && allInScope.length > 0 && (
            <ThreeStageLayout
              lang={lang}
              byPhase={byPhase}
              assigneeOf={assigneeOf}
              curators={curators}
              currentCuratorId={currentCurator.id}
              scope={scope}
              isLead={isLead}
              onOpen={handleOpen}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              onAssignChange={(id, curId) => setAssignMap(m => ({ ...m, [id]: curId }))}
              onPhaseChange={(id, nextPhase) => {
                setPhaseMap(m => ({ ...m, [id]: nextPhase }));
                if (id && !id.startsWith('DEMO-')) {
                  // is_published is the canonical published flag (intakes.status
                  // has a CHECK constraint that doesn't allow 'published'). For
                  // pub ↔ non-pub transitions we toggle the flag; for new/review
                  // moves between non-pub stages we update intakes.status to a
                  // value the constraint allows.
                  const patch = {};
                  if (nextPhase === 'pub') {
                    patch.is_published = true;
                  } else {
                    patch.is_published = false;
                    patch.status = nextPhase === 'review' ? 'submitted' : 'roles_ready';
                  }
                  intakes.patch(id, patch).catch(() => {});
                }
              }}
              activeStage={activeStage}
              setActiveStage={setActiveStage}
            />
          )}
        </div>

      </div>

      {/* Call-date prompt modal */}
      {callPrompt && (
        <CallDatePrompt
          lang={lang}
          defaultDate={callPrompt.defaultDate}
          onCancel={() => setCallPrompt(null)}
          onConfirm={confirmCallPrompt}
        />
      )}

      {err && !loading && (
        <div style={{
          position: 'fixed', bottom: 16, left: 16,
          background: 'white', border: '1px solid var(--line)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
          color: 'var(--ink-3)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}>
          {lang === 'zh' ? '使用演示数据' : 'Showing demo data'}
        </div>
      )}
    </div>
  );
}

// ─── Call-date prompt ──────────────────────────────────────────────────

function CallDatePrompt({ lang, defaultDate, onCancel, onConfirm }) {
  const [date, setDate] = useState(defaultDate);
  return (
    <div className="cura-modal" onClick={onCancel}>
      <div className="cura-modal-card" onClick={e => e.stopPropagation()}>
        <h3>{t('s6_call_prompt_title', lang)}</h3>
        <p>{t('s6_call_prompt_sub', lang)}</p>
        <input
          type="date"
          value={date}
          autoFocus
          onChange={e => setDate(e.target.value)}
        />
        <div className="cura-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>{t('s6_call_prompt_cancel', lang)}</button>
          <button className="btn btn-primary" onClick={() => onConfirm(date)} disabled={!date}>
            {t('s6_call_prompt_save', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Workbench (S7) ───────────────────────────────────────────────────

const WB_PHASES = ['review', 'meeting', 'finalize'];

const DEMO_INTAKE = {
  intake: {
    id: 'INT-DEMO',
    name: 'Vigil — AML & Compliance Suite',
    status: 'submitted',
    website: 'vigil.hk',
    industry_hint: '银行 · 保险 · SVF',
    free_text: '我们做合规科技,主推 AML 监控、客户尽调、制裁筛查,客户多是中型持牌银行。',
    finalized_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  capabilities: [
    { id: 'cap-1',  rc_label: 'CAP-01', name_zh: '双模告警引擎', name_en: 'Dual-mode alert engine', description_zh: '规则 + CNN/LSTM 协同评分,降低误报', description_en: 'Rules + CNN/LSTM co-scoring, reduces false positives', source: 'extracted', confirmed: 1 },
    { id: 'cap-2',  rc_label: 'CAP-02', name_zh: '异常归因',     name_en: 'Anomaly attribution', description_zh: '对每条告警输出可解释的特征贡献', description_en: 'Explainable feature attribution per alert', source: 'extracted', confirmed: 1 },
    { id: 'cap-3',  rc_label: 'CAP-03', name_zh: 'AI 辅助复核',  name_en: 'AI-assisted review', description_zh: '为分析师推荐相似案例与处置建议', description_en: 'Surfaces similar past cases and disposition suggestions', source: 'extracted', confirmed: 1 },
    { id: 'cap-4',  rc_label: 'CAP-04', name_zh: 'SAR 自动起草', name_en: 'SAR auto-drafting', description_zh: '基于告警与处置记录自动生成 SAR 草稿', description_en: 'Generates SAR drafts from alert + disposition records', source: 'extracted', confirmed: 0 },
    { id: 'cap-5',  rc_label: 'CAP-05', name_zh: '动态风险评级', name_en: 'Dynamic risk rating', description_zh: '基于交易行为持续重新评级客户风险', description_en: 'Continuously re-rates customer risk based on transaction behavior', source: 'Capability Partner', confirmed: 1 },
    { id: 'cap-6',  rc_label: 'CAP-06', name_zh: 'BRRA 自评估',  name_en: 'BRRA self-assessment', description_zh: '业务范围风险自评工具', description_en: '', source: 'Capability Partner', confirmed: 0 },
  ],
  rolepacks: [
    { id: 'rp-1', rp_label: 'RP-AML',  name_zh: 'AML 分析师助手',  name_en: 'AML Analyst Assistant',  industry: ['banking', 'svf'], company_size: ['mid'], department: ['compliance'], capability_ids: ['cap-1','cap-2','cap-3','cap-4'], generated: { ready: true }, status: 'ready' },
    { id: 'rp-2', rp_label: 'RP-RISK', name_zh: '风险经理副驾',     name_en: 'Risk Manager Copilot',   industry: ['banking', 'insurance'], company_size: ['mid'], department: ['risk'], capability_ids: ['cap-5','cap-6'], generated: { ready: true }, status: 'ready' },
    { id: 'rp-3', rp_label: 'RP-CCO',  name_zh: 'MLRO 仪表盘',     name_en: 'MLRO Dashboard',         industry: ['banking'], company_size: ['mid','large'], department: ['compliance'], capability_ids: ['cap-1','cap-5'], generated: null, status: 'pending' },
  ],
  files: [
    { id: 'f1', kind: 'pdf', display_name: 'TMX product overview.pdf', size_bytes: 2_400_000 },
    { id: 'f2', kind: 'ppt', display_name: 'Vigil deck Q2.pptx',       size_bytes: 5_100_000 },
    { id: 'f3', kind: 'url', display_name: 'vigil.hk',                 size_bytes: 0 },
  ],
};

function buildBriefing(data, lang) {
  if (!data) return null;
  const totalCaps = data.capabilities.length;
  const confirmed = data.capabilities.filter(c => c.confirmed).length;
  const totalRolepacks = data.rolepacks.length;
  const ready = data.rolepacks.filter(r => r.generated || r.status === 'published' || r.status === 'ready').length;
  const supplierName = data.intake.name?.split(/[—–-]/)[0]?.trim() || data.intake.id;
  const industry = data.intake.industry_hint || '—';

  const bullets = lang === 'zh' ? [
    `${supplierName} 提交了 ${totalCaps} 项能力,围绕 ${industry} 行业。`,
    `生成了 ${totalRolepacks} 个候选岗位,其中 ${ready} 个已就绪。`,
    `${confirmed}/${totalCaps} 项能力已确认,其余需要在会议中追问。`,
  ] : [
    `${supplierName} submitted ${totalCaps} capabilities focused on ${industry}.`,
    `${totalRolepacks} candidate roles generated; ${ready} ready, ${totalRolepacks - ready} pending.`,
    `${confirmed}/${totalCaps} capabilities confirmed — the rest need follow-up on the call.`,
  ];

  const strong = data.capabilities
    .filter(c => c.confirmed && (c.description_zh || c.description_en))
    .slice(0, 3)
    .map(c => ({ id: c.id, label: c.rc_label, value: lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh) }));

  const thin = [];
  data.capabilities
    .filter(c => !c.confirmed || !(c.description_zh || c.description_en))
    .slice(0, 3)
    .forEach(c => thin.push({ id: c.id, label: c.rc_label, value: lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh) }));
  data.rolepacks
    .filter(r => !r.industry || (Array.isArray(r.industry) && r.industry.length === 0))
    .slice(0, 2)
    .forEach(r => thin.push({ id: r.id, label: r.rp_label, value: lang === 'zh' ? '缺少目标行业' : 'missing target industry' }));

  const questions = lang === 'zh' ? [
    { q: 'BRRA 自评估这块可以举一两个客户用法吗?', target: 'cap-6', tlbl: 'RC-06' },
    { q: 'SAR 自动起草目前的合规通过率有数据吗?', target: 'cap-4', tlbl: 'RC-04' },
    { q: 'MLRO 仪表盘这版还缺什么才能上线?', target: 'rp-3', tlbl: 'RP-CCO' },
    { q: '中型银行客户大概预算区间是多少?', target: null, tlbl: null },
    { q: '私有化部署最快多久能上线?', target: null, tlbl: null },
  ] : [
    { q: 'Can you give one or two customer examples for BRRA self-assessment?', target: 'cap-6', tlbl: 'RC-06' },
    { q: 'Do you have compliance pass-rate data for the SAR auto-drafting?', target: 'cap-4', tlbl: 'RC-04' },
    { q: 'What\'s missing on the MLRO Dashboard before it can go live?', target: 'rp-3', tlbl: 'RP-CCO' },
    { q: 'What\'s a typical mid-tier bank budget range for this stack?', target: null, tlbl: null },
    { q: 'Fastest realistic timeline for an on-prem deploy?', target: null, tlbl: null },
  ];

  return { bullets, strong, thin, questions };
}

function buildAuditLog(data, applied, lang) {
  if (!data) return [];
  const log = [];
  log.push({
    when: data.intake.created_at, kind: 'Capability Partner',
    field: data.intake.id,
    text: lang === 'zh' ? '能力伙伴创建提交' : 'Capability Partner created intake',
    who: lang === 'zh' ? '能力伙伴' : 'Capability Partner',
  });
  if (data.intake.finalized_at) log.push({
    when: data.intake.finalized_at, kind: 'Capability Partner',
    field: '—',
    text: lang === 'zh' ? '能力伙伴提交审阅' : 'Capability Partner submitted for review',
    who: lang === 'zh' ? '能力伙伴' : 'Capability Partner',
  });
  applied.forEach(d => log.push({
    when: d.when, kind: 'call',
    field: d.field,
    text: (lang === 'zh' ? '通过通话纪要更新:' : 'Updated via call notes: ') + d.label,
    who: lang === 'zh' ? '会议纪要 → Copilot' : 'call notes → Copilot',
  }));
  return log.sort((a, b) => new Date(b.when) - new Date(a.when));
}

function buildDemoDiffs(notes, data, lang) {
  if (!notes || !notes.trim()) return [];
  // Toy "extraction" — surface a few canned suggestions when the curator hits Process.
  const isZh = lang === 'zh';
  return [
    {
      id: 'd-1',
      field: 'cap-6',
      label: 'RC-06',
      from: '',
      to: isZh ? '业务条线风险自评估,银行实际部署案例 2 例(港 / 新)' : 'Self-assessment of business-line risk; 2 production cases (HK / SG)',
      source: notes.split(/[。.\n]/).find(s => /BRRA|self|自评/i.test(s))?.trim() || notes.slice(0, 80),
      checked: true, when: new Date().toISOString(),
    },
    {
      id: 'd-2',
      field: 'cap-4',
      label: 'RC-04',
      from: isZh ? '基于告警与处置记录自动生成 SAR 草稿' : 'Generates SAR drafts from alert + disposition records',
      to: isZh
        ? '基于告警与处置记录自动生成 SAR 草稿;监管通过率约 96%(过去 6 个月)'
        : 'Generates SAR drafts from alert + disposition records; ~96% regulator pass-rate (last 6 months)',
      source: notes.split(/[。.\n]/).find(s => /SAR|96|pass|通过/i.test(s))?.trim() || notes.slice(0, 80),
      checked: true, when: new Date().toISOString(),
    },
    {
      id: 'd-3',
      field: 'intake.industry_hint',
      label: 'INTAKE',
      from: data?.intake.industry_hint || '',
      to: isZh ? '银行 · 保险 · SVF · 证券' : 'Banking · Insurance · SVF · Securities',
      source: notes.split(/[。.\n]/).find(s => /证券|SVF|securities/i.test(s))?.trim() || notes.slice(0, 80),
      checked: false, when: new Date().toISOString(),
    },
  ];
}

function PhaseIndicator({ lang, phase, setPhase, onAdvanceMeeting, onPublish, observeMode }) {
  const i = WB_PHASES.indexOf(phase);
  return (
    <div className="workbench-phase">
      {WB_PHASES.map((p, idx) => {
        const state = idx < i ? 'done' : idx === i ? 'active' : '';
        return (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
            <button
              className={'step ' + state}
              onClick={() => !observeMode && setPhase(p)}
              disabled={observeMode}
            >
              <span className="num">{state === 'done' ? '✓' : idx + 1}</span>
              <span>{t('s7_phase_' + p, lang)}</span>
            </button>
            {idx < WB_PHASES.length - 1 && <span className="arrow">›</span>}
          </span>
        );
      })}
      {!observeMode && (
        <button
          className="advance-btn"
          onClick={() => {
            if (phase === 'review') onAdvanceMeeting();
            else if (phase === 'meeting') setPhase('finalize');
            else if (phase === 'finalize') onPublish();
          }}
        >
          {phase === 'finalize'
            ? t('s7_publish_now', lang)
            : t('s7_phase_advance', lang, { phase: t('s7_phase_' + (phase === 'review' ? 'meeting' : 'finalize'), lang) })}
        </button>
      )}
      <div className="hint">{t('s7_phase_locked_intro', lang)}</div>
    </div>
  );
}

function BriefingBanner({ lang, briefing, open, onToggle, onCopyAll, onScrollToField }) {
  if (!briefing) return null;
  return (
    <div className={'briefing' + (open ? ' open' : '')}>
      <div className="briefing-head" onClick={onToggle}>
        <span className="title">{t('s7_briefing_title', lang)}</span>
        {!open && (
          <span className="meta">
            · {t('s7_briefing_expand', lang, { n: briefing.bullets.length, q: briefing.questions.length })}
          </span>
        )}
        <div className="actions" onClick={e => e.stopPropagation()}>
          <button className="icon-btn" onClick={onCopyAll}>{t('s7_briefing_copy', lang)}</button>
          <button className="icon-btn">{t('s7_briefing_regen', lang)}</button>
        </div>
        <span className="chev">▾</span>
      </div>
      {open && (
        <div className="briefing-body">
          <div className="briefing-section">
            <h4>{t('s7_briefing_what', lang)}</h4>
            {briefing.bullets.map((b, i) => (
              <div key={i} className="briefing-bullet">{b}</div>
            ))}
          </div>
          <div className="briefing-section">
            <h4>{t('s7_briefing_strong', lang)} · {t('s7_briefing_thin', lang)}</h4>
            <div className="briefing-fields">
              {briefing.strong.map(s => (
                <div key={s.id} className="row">
                  <span className="lbl">{s.label}</span>
                  <span className="val">{s.value}</span>
                </div>
              ))}
              {briefing.thin.map(s => (
                <div key={s.id} className="row thin">
                  <span className="lbl">{s.label}</span>
                  <span className="val" onClick={() => onScrollToField(s.id)} style={{ cursor: 'pointer' }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="briefing-section">
            <h4>{t('s7_briefing_questions', lang)}</h4>
            {briefing.questions.map((q, i) => (
              <div key={i} className="briefing-question">
                <span className="qnum">Q{i + 1}</span>
                <div style={{ flex: 1 }}>
                  {q.q}
                  {q.tlbl && (
                    <div className="target">
                      → <span className="field-link" onClick={() => onScrollToField(q.target)}>{q.tlbl}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CopilotPane({ lang, phase, data, applied, onApply, onReject, onUpdates }) {
  const [pasteText, setPasteText] = useState('');
  const [diffs, setDiffs] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const phaseTag = phase === 'review' ? t('s7_phase_review', lang)
    : phase === 'meeting' ? t('s7_phase_meeting', lang)
    : t('s7_phase_finalize', lang);

  // Curator copilot targets the FIRST rolepack of the intake. (If the intake
  // has multiple rolepacks, MVP picks the first; future: rolepack picker.)
  const intakeId = data?.intake?.id;
  const targetRp = data?.rolepacks?.[0];
  const canChat = !!(intakeId && targetRp?.id);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || chatBusy) return;
    setChatHistory(h => [...h, { who: 'user', text: trimmed }]);
    setChatInput('');
    if (!canChat) {
      setChatHistory(h => [...h, { who: 'bot', text: lang === 'zh' ? '需要至少一个岗位才能调用 Copilot。' : 'Copilot needs at least one RolePack on this intake.' }]);
      return;
    }
    setChatBusy(true);
    try {
      // Approval flow: dryrun first — surface suggestions for curator review
      // before any field is mutated.
      const res = await intakes.rolepackCopilot(intakeId, targetRp.id, trimmed, { dryrun: true });
      const reply = res?.reply || (lang === 'zh' ? '我理解你的输入了。' : 'Got it.');
      const proposals = (res?.updates || []).map(u => ({ ...u, _state: 'pending', _msg: trimmed }));
      setChatHistory(h => [...h, { who: 'bot', text: reply, proposals }]);
    } catch (e) {
      setChatHistory(h => [...h, { who: 'bot', text: '⚠ ' + (e?.message || 'AI error') }]);
    } finally {
      setChatBusy(false);
    }
  };

  // Apply one proposed update by patching the rolepack questionnaire directly.
  const applyProposal = async (msgIdx, propIdx) => {
    const msg = chatHistory[msgIdx];
    const p = msg?.proposals?.[propIdx];
    if (!p || !canChat) return;
    const [section, field] = (p.id || '').split('.');
    if (!section || !field) return;
    // Build patched questionnaire from current rolepack
    const current = (() => { try { return JSON.parse(targetRp.questionnaire_json || '{}'); } catch { return {}; } })()
                 || (targetRp.questionnaire || {});
    const next = { ...current, [section]: { ...(current[section] || {}) } };
    next[section][field] = {
      value_zh: p.value?.zh, value_en: p.value?.en,
      confidence: null, source_quote: '',
      _state: p.vague ? 'curator_weak' : 'curator_filled',
    };
    try {
      await intakes.patchRolepack(intakeId, targetRp.id, { questionnaire: next });
      setChatHistory(h => h.map((m, i) => i === msgIdx
        ? { ...m, proposals: m.proposals.map((q, j) => j === propIdx ? { ...q, _state: 'applied' } : q) }
        : m));
      if (onUpdates) onUpdates([p]);
    } catch (e) {
      setChatHistory(h => h.map((m, i) => i === msgIdx
        ? { ...m, proposals: m.proposals.map((q, j) => j === propIdx ? { ...q, _state: 'error', _err: e?.message } : q) }
        : m));
    }
  };
  const rejectProposal = (msgIdx, propIdx) => {
    setChatHistory(h => h.map((m, i) => i === msgIdx
      ? { ...m, proposals: m.proposals.map((q, j) => j === propIdx ? { ...q, _state: 'rejected' } : q) }
      : m));
  };

  return (
    <div className="copilot-pane">
      <div className="head">
        <span className="icon">✦</span>
        <span className="title">{t('s7_copilot_pane_title', lang)}</span>
        <span className="phase-tag">{phaseTag}</span>
      </div>

      <div className="body">
        {phase === 'review' && (
          <>
            <div className="copilot-bubble">{t('s7_copilot_review_greet', lang)}</div>
            {chatHistory.map((m, i) => (
              <div key={i}>
                <div className={'copilot-bubble' + (m.who === 'user' ? ' user' : '')}>{m.text}</div>
                {(m.proposals || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0 12px', padding: 8, background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {lang === 'zh' ? `建议更新 ${m.proposals.length} 项 — 请审核` : `${m.proposals.length} proposed update${m.proposals.length === 1 ? '' : 's'} — review:`}
                    </div>
                    {m.proposals.map((p, j) => {
                      const value = Array.isArray(p.value?.zh) ? p.value.zh.join(' · ') : (p.value?.zh || p.value?.en || '');
                      const labelZh = p.label?.zh || p.id;
                      const labelEn = p.label?.en || p.id;
                      return (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderTop: j > 0 ? '1px solid var(--line-2)' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>
                              {lang === 'zh' ? labelZh : labelEn}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 2, lineHeight: 1.5 }}>{value}</div>
                            {p.vague && (
                              <div style={{ fontSize: 10.5, color: 'var(--st-empty-ink)', marginTop: 2 }}>
                                ⚠ {lang === 'zh' ? '内容偏弱,可能需要追问' : 'looks vague — may need follow-up'}
                              </div>
                            )}
                          </div>
                          {p._state === 'pending' && (
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button onClick={() => applyProposal(i, j)}
                                style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ✓ {lang === 'zh' ? '应用' : 'Apply'}
                              </button>
                              <button onClick={() => rejectProposal(i, j)}
                                style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ✕ {lang === 'zh' ? '拒绝' : 'Reject'}
                              </button>
                            </div>
                          )}
                          {p._state === 'applied' && (
                            <span style={{ fontSize: 11, color: 'var(--plat-curator)', fontWeight: 600, alignSelf: 'center' }}>
                              ✓ {lang === 'zh' ? '已应用' : 'Applied'}
                            </span>
                          )}
                          {p._state === 'rejected' && (
                            <span style={{ fontSize: 11, color: 'var(--ink-3)', alignSelf: 'center' }}>
                              {lang === 'zh' ? '已拒绝' : 'Rejected'}
                            </span>
                          )}
                          {p._state === 'error' && (
                            <span style={{ fontSize: 11, color: 'var(--st-empty-ink)', alignSelf: 'center' }} title={p._err || ''}>
                              ⚠ {lang === 'zh' ? '失败' : 'Error'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {phase === 'meeting' && (
          <>
            <div className="paste-notes">
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cop-ink)' }}>
                {t('s7_copilot_meet_label', lang)}
              </label>
              <textarea
                placeholder={t('s7_copilot_meet_ph', lang)}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <div className="actions">
                <button
                  className="process-btn"
                  disabled={!pasteText.trim()}
                  onClick={() => setDiffs(buildDemoDiffs(pasteText, data, lang))}
                >
                  {t('s7_copilot_meet_process', lang)}
                </button>
              </div>
            </div>

            {diffs.length > 0 ? (
              <div className="diff-list">
                <div className="head">{t('s7_copilot_meet_proposed', lang, { n: diffs.length })}</div>
                {diffs.map(d => (
                  <div key={d.id} className="diff-item">
                    <input
                      type="checkbox"
                      checked={d.checked}
                      onChange={e => setDiffs(ds => ds.map(x => x.id === d.id ? { ...x, checked: e.target.checked } : x))}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="field">{d.label}</div>
                      <div className="change">
                        {d.from && <span className="from">{d.from}</span>}
                        {d.from && <span className="arrow">→</span>}
                        <span className="to">{d.to}</span>
                      </div>
                      <div className="source">{t('s7_copilot_meet_source', lang, { snippet: d.source })}</div>
                    </div>
                  </div>
                ))}
                <div className="footer">
                  <button
                    className="apply"
                    onClick={() => {
                      const checked = diffs.filter(d => d.checked);
                      onApply(checked);
                      setDiffs([]);
                      setPasteText('');
                    }}
                  >
                    {t('s7_copilot_meet_apply', lang, { n: diffs.filter(d => d.checked).length })}
                  </button>
                  <button className="reject" onClick={() => setDiffs([])}>{t('s7_copilot_meet_reject', lang)}</button>
                </div>
              </div>
            ) : (
              <div className="copilot-bubble" style={{ fontStyle: 'italic', opacity: 0.8 }}>
                {t('s7_copilot_meet_empty', lang)}
              </div>
            )}
          </>
        )}

        {phase === 'finalize' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cop-ink)', marginBottom: 4 }}>
              {t('s7_copilot_finalize_log', lang)}
            </div>
            <div className="audit-log">
              {buildAuditLog(data, applied, lang).map((e, i) => (
                <div key={i} className={'audit-entry ' + e.kind}>
                  <div className="when">{new Date(e.when).toLocaleDateString()} {new Date(e.when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="body">
                    <div className="field">{e.field}</div>
                    <div className="change">{e.text}</div>
                    <div className="who">— {e.who}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {(phase === 'review' || phase === 'finalize') && (
        <div className="composer">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(chatInput); }}
            placeholder={phase === 'review' ? t('s7_copilot_review_ph', lang) : t('s7_copilot_finalize_ph', lang)}
          />
          <button onClick={() => send(chatInput)}>{t('s7_copilot_send', lang)}</button>
        </div>
      )}
    </div>
  );
}

// Tiny inline-markdown renderer for the AI summary: bullet lists, **bold**,
// and bare emoji/text. Emojis pass through unchanged. No HTML in source —
// each piece is rendered as React nodes.
function renderInline(line, keyPrefix) {
  const parts = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(<strong key={keyPrefix + ':b' + i++} style={{ color: 'var(--navy-ink)', fontWeight: 700 }}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : [line];
}
function renderSummaryMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const out = [];
  let bullets = null;
  const flush = (k) => { if (bullets && bullets.length) { out.push(<ul key={'ul' + k} style={{ margin: '4px 0 10px', paddingLeft: 22 }}>{bullets}</ul>); } bullets = null; };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (/^[-•]\s+/.test(trimmed)) {
      if (!bullets) bullets = [];
      bullets.push(<li key={'li' + i} style={{ marginBottom: 3 }}>{renderInline(trimmed.replace(/^[-•]\s+/, ''), 'li' + i)}</li>);
    } else if (trimmed === '') {
      flush(i);
      out.push(<div key={'sp' + i} style={{ height: 6 }} />);
    } else {
      flush(i);
      out.push(<div key={'p' + i} style={{ marginBottom: 4 }}>{renderInline(trimmed, 'p' + i)}</div>);
    }
  }
  flush('end');
  return out;
}

// ─── AI Summary section ────────────────────────────────────────────────
function AISummarySection({ lang, intakeId, intakeName }) {
  const [summary, setSummary] = useState(() => wbReadJson(wbKey('summary', intakeId), null));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const generate = async (force = false) => {
    if (!intakeId || intakeId === 'demo') return;
    if (busy) return;
    if (!force && summary) return;
    setBusy(true); setErr('');
    try {
      const res = await curator.generateSummary(intakeId);
      if (res.ok) {
        const next = { summary_zh: res.summary_zh, summary_en: res.summary_en, generated_at: res.generated_at };
        setSummary(next);
        wbWriteJson(wbKey('summary', intakeId), next);
      } else {
        setErr(res.reason === 'no_api_key'
          ? (lang === 'zh' ? 'AI 未配置' : 'AI not configured')
          : (lang === 'zh' ? '生成失败,请重试' : 'Generation failed; try again'));
      }
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // Auto-load on first mount if cache is empty.
  useEffect(() => { if (!summary) generate(false); /* eslint-disable-line */ }, []);

  const text = summary ? ((lang === 'zh' ? summary.summary_zh : summary.summary_en) || summary.summary_en || summary.summary_zh) : '';
  const at = summary?.generated_at ? new Date(summary.generated_at) : null;

  return (
    <section style={{
      background: 'white', border: '1px solid var(--line)', borderRadius: 12,
      padding: '18px 22px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--plat-curator)' }}>✦</span>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', letterSpacing: '-0.005em' }}>
            {lang === 'zh' ? 'AI 简报' : 'AI Summary'}
          </h2>
          {at && (
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {lang === 'zh' ? '生成于 ' : 'generated '}{at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button onClick={() => generate(true)} disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px solid var(--line)', borderRadius: 6,
            padding: '4px 10px', fontSize: 12, color: 'var(--ink-2)',
            cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
          }}>
          <span style={{ fontSize: 13 }}>↻</span>
          <span>{busy ? (lang === 'zh' ? '生成中…' : 'Generating…') : (lang === 'zh' ? '重新生成' : 'Regenerate')}</span>
        </button>
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 8 }}>⚠ {err}</div>}
      {!summary && busy && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
          {lang === 'zh' ? `正在为 ${intakeName || '该提交'} 生成简报…` : `Generating briefing for ${intakeName || 'this submission'}…`}
        </div>
      )}
      {!summary && !busy && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
          {lang === 'zh' ? '点击"重新生成"开始。' : 'Click Regenerate to start.'}
        </div>
      )}
      {summary && (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--ink)', maxHeight: 360, overflowY: 'auto' }}>
          {renderSummaryMarkdown(text)}
        </div>
      )}
    </section>
  );
}

// ─── Meeting Notes section ─────────────────────────────────────────────
function MeetingNotesSection({ lang, intakeId, copilotIntakeId, copilotRpId }) {
  const stored = wbReadJson(wbKey('meeting', intakeId), { date: '', notes: '' });
  const [date, setDate] = useState(stored.date || '');
  const [notes, setNotes] = useState(stored.notes || '');
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [err, setErr] = useState('');

  // Persist as the curator types (debounced lightly).
  useEffect(() => {
    const tmr = setTimeout(() => {
      wbWriteJson(wbKey('meeting', intakeId), { date, notes });
    }, 400);
    return () => clearTimeout(tmr);
  }, [intakeId, date, notes]);

  const cleanup = async () => {
    if (!notes.trim() || busy) return;
    if (!copilotIntakeId || !copilotRpId) {
      setErr(lang === 'zh' ? '需要至少一个 RolePack 才能调用 AI 整理。' : 'AI cleanup needs at least one RolePack.');
      return;
    }
    setBusy(true); setErr(''); setAiResult(null);
    try {
      const prompt = (lang === 'zh' ? '会议笔记如下,请按问卷结构提取并整理(只建议,不直接更新):\n\n' : 'Meeting notes below; extract and structure into questionnaire updates (suggest only, do not auto-apply):\n\n') + notes;
      const res = await intakes.rolepackCopilot(copilotIntakeId, copilotRpId, prompt, { dryrun: true });
      if (res.ok) setAiResult(res);
      else setErr(res.reason === 'no_api_key'
        ? (lang === 'zh' ? 'AI 未配置' : 'AI not configured')
        : (lang === 'zh' ? '整理失败,请重试' : 'Cleanup failed; try again'));
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{
      background: 'white', border: '1px solid var(--line)', borderRadius: 12,
      padding: '18px 22px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>📝</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', letterSpacing: '-0.005em' }}>
          {lang === 'zh' ? '会议笔记' : 'Meeting Notes'}
        </h2>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {lang === 'zh' ? '可粘贴会议记录,然后让 Copilot 整理' : 'paste raw notes, then let Copilot tidy them'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--ink-3)' }}>{lang === 'zh' ? '会议日期' : 'Meeting date'}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ink)' }} />
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={lang === 'zh' ? '把会议中的关键观点、决策、待办粘贴在这里…' : 'Paste key points, decisions, action items from the meeting…'}
        style={{
          width: '100%', minHeight: 110, fontSize: 13, fontFamily: 'inherit',
          padding: 10, border: '1px solid var(--line)', borderRadius: 8,
          resize: 'vertical', lineHeight: 1.55, color: 'var(--ink)',
        }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button onClick={cleanup} disabled={!notes.trim() || busy}
          style={{
            background: 'var(--plat-curator)', color: 'white', border: 'none',
            borderRadius: 6, padding: '7px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: !notes.trim() || busy ? 'not-allowed' : 'pointer',
            opacity: !notes.trim() || busy ? 0.5 : 1, fontFamily: 'inherit',
          }}>
          ✦ {busy ? (lang === 'zh' ? '整理中…' : 'Tidying…') : (lang === 'zh' ? 'AI 整理为问卷建议' : 'AI cleanup → suggestions')}
        </button>
        {err && <span style={{ fontSize: 12, color: 'var(--st-empty-ink)' }}>{err}</span>}
      </div>
      {aiResult && (
        <div style={{ marginTop: 12, padding: 10, background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            {lang === 'zh' ? `AI 建议 (${aiResult.updates?.length || 0} 项)` : `AI suggestions (${aiResult.updates?.length || 0})`}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 8 }}>
            {aiResult.reply}
          </div>
          {(aiResult.updates || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(aiResult.updates).map(u => (
                <div key={u.id} style={{ fontSize: 12, color: 'var(--ink)', padding: '4px 0' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--plat-curator)', fontWeight: 700, marginRight: 6 }}>{u.id}</span>
                  <span>{Array.isArray(u.value?.zh) ? u.value.zh.join(' · ') : (u.value?.zh || u.value?.en || '')}</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 4 }}>
                {lang === 'zh' ? '在右侧 Copilot 中可应用每条建议。' : 'Use the Copilot rail to apply each suggestion.'}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Editable section wrapper (pencil edit + restore-original) ─────────
function EditableSection({ lang, intakeId, sectionId, originalValue, displayOriginal, onChange, kind = 'text' }) {
  // overrides keyed by sectionId on the intake
  const overrides = wbReadJson(wbKey('overrides', intakeId), {});
  const hasOverride = sectionId in overrides;
  const currentValue = hasOverride ? overrides[sectionId] : originalValue;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue || '');

  // Keep draft in sync if not editing & override changes externally
  useEffect(() => { if (!editing) setDraft(currentValue || ''); /* eslint-disable-line */ }, [currentValue, editing]);

  const saveOverride = () => {
    const next = { ...overrides, [sectionId]: draft };
    wbWriteJson(wbKey('overrides', intakeId), next);
    setEditing(false);
    onChange?.();
  };
  const restore = () => {
    const next = { ...overrides };
    delete next[sectionId];
    wbWriteJson(wbKey('overrides', intakeId), next);
    setDraft(originalValue || '');
    setEditing(false);
    onChange?.();
  };

  return (
    <div style={{ position: 'relative', paddingRight: 80 }}>
      {/* Action buttons: pencil + restore */}
      <div style={{ position: 'absolute', top: -4, right: 0, display: 'inline-flex', gap: 4 }}>
        {!editing && (
          <button onClick={() => { setDraft(currentValue || ''); setEditing(true); }}
            title={lang === 'zh' ? '编辑' : 'Edit'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <PenIcon size={14} />
          </button>
        )}
        {hasOverride && !editing && (
          <button onClick={restore}
            title={lang === 'zh' ? '恢复原始' : 'Restore original'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--plat-curator)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
            ↺ {lang === 'zh' ? '恢复' : 'Restore'}
          </button>
        )}
      </div>
      {editing ? (
        <div>
          {kind === 'multiline' ? (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus
              style={{ width: '100%', minHeight: 80, padding: 8, border: '1px solid var(--plat-curator)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', lineHeight: 1.55 }} />
          ) : (
            <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--plat-curator)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={saveOverride}
              style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {lang === 'zh' ? '保存' : 'Save'}
            </button>
            <button onClick={() => { setDraft(currentValue || ''); setEditing(false); }}
              style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 5, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
            {hasOverride && (
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)', alignSelf: 'center', marginLeft: 4 }}>
                {lang === 'zh' ? '已被策展人编辑' : 'edited by curator'}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div>
          {hasOverride ? (
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{currentValue || (lang === 'zh' ? '(空)' : '(empty)')}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>
                {lang === 'zh' ? '原始: ' : 'Original: '}<span style={{ textDecoration: 'line-through' }}>{(displayOriginal || originalValue || '—')}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
              {displayOriginal || originalValue || (lang === 'zh' ? '未填写' : 'not set')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScreenWorkbench({ lang, setLang, intakeId, curatorName, onLogout, onBack, observeMode = false }) {
  // Body class — share gradient + sticky behaviour with the inbox.
  useEffect(() => {
    document.documentElement.classList.add('curator-workbench-page');
    return () => document.documentElement.classList.remove('curator-workbench-page');
  }, []);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState('review');
  const [callDate, setCallDate] = useState(null);
  const [callPrompt, setCallPrompt] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [applied, setApplied] = useState([]);   // list of accepted diffs (timestamped)
  const [toast, setToast] = useState('');

  // Dirty-section tracker: each editable card registers its own dirty state.
  // Used by WorkbenchTopBar to show unsaved-changes warning + beforeunload.
  const [dirtySections, setDirtySectionsRaw] = useState(() => new Set());
  const setDirty = useMemo(() => (id, isDirty) => {
    setDirtySectionsRaw(prev => {
      const has = prev.has(id);
      if (isDirty && has) return prev;
      if (!isDirty && !has) return prev;
      const next = new Set(prev);
      if (isDirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const dirtyCtx = useMemo(() => ({ dirty: dirtySections, set: setDirty }), [dirtySections, setDirty]);

  // Load real intake; fall back to demo data on error so the prototype always renders.
  useEffect(() => {
    let abort = false;
    if (!intakeId || intakeId === 'demo') {
      setData(DEMO_INTAKE); setLoading(false);
      return () => { abort = true; };
    }
    (async () => {
      try {
        const res = await fetch(`/api/intakes/${intakeId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('fetch_failed');
        const d = await res.json();
        if (!abort) setData(d);
      } catch (e) {
        if (!abort) {
          setErr('demo');
          setData({ ...DEMO_INTAKE, intake: { ...DEMO_INTAKE.intake, id: intakeId } });
        }
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [intakeId]);

  // Snapshot the supplier's original submission once per intake so the
  // "Restore default" button has something to roll back to.
  useEffect(() => {
    if (data?.intake?.id) ensureOriginalSnapshot(data.intake.id, data);
  }, [data?.intake?.id]);

  // Hydrate seed canned semantic codes for THIS intake on workbench load,
  // so users who land directly on /curators/intake/:id (without going through
  // the inbox first) still see their RP-XXX / RC-XXX codes immediately.
  useEffect(() => {
    if (!data?.intake?.id || intakeId === 'demo') return;
    (async () => {
      try {
        const res = await curator.seedSummaries();
        const sem = res?.semantics?.[data.intake.id];
        if (sem && (Object.keys(sem.rp || {}).length || Object.keys(sem.rc || {}).length)) {
          // Merge: if curator has typed any code, keep it; otherwise fill from canned
          const cur = getSemMap(data.intake.id);
          const merged = {
            rp: { ...(sem.rp || {}), ...(cur.rp || {}) },
            rc: { ...(sem.rc || {}), ...(cur.rc || {}) },
          };
          wbWriteJson(semKey(data.intake.id), merged);
          setData(d => d ? { ...d } : d);
        }
        const sum = res?.summaries?.[data.intake.id];
        if (sum) {
          const k = `wb-summary:${data.intake.id}`;
          if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(sum));
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.intake?.id]);

  // Auto-suggest unique semantic RP/RC codes the moment workbench opens
  // (any non-draft status). Curator types over them in edit mode.
  useEffect(() => {
    if (!data?.intake?.id) return;
    if (intakeId === 'demo') return;
    const status = data.intake.status;
    if (status === 'draft') return;
    const sem = getSemMap(data.intake.id);
    const items = [];
    for (const r of data.rolepacks || []) {
      if (!sem.rp[r.id]) items.push({ kind: 'rp', id: r.id, current_label: r.rp_label, name_zh: r.name_zh, name_en: r.name_en });
    }
    for (const c of data.capabilities || []) {
      if (!sem.rc[c.id]) items.push({ kind: 'rc', id: c.id, current_label: c.rc_label, name_zh: c.name_zh, name_en: c.name_en, description_zh: c.description_zh, description_en: c.description_en });
    }
    if (items.length === 0) return;
    let abort = false;
    (async () => {
      try {
        const res = await curator.rewriteAi(data.intake.id, { kind: 'suggest_labels', input: 'batch', context: { items } });
        if (abort || !res?.ok) return;
        const m = getSemMap(data.intake.id);
        const usedRp = new Set(Object.values(m.rp || {}));
        const usedRc = new Set(Object.values(m.rc || {}));
        for (const s of res.suggestions || []) {
          let lbl = (s.suggested_label || '').trim().toUpperCase();
          if (!lbl) continue;
          // Enforce 5-char suffix max + uniqueness within this intake.
          const prefix = lbl.startsWith('RP-') ? 'RP' : lbl.startsWith('RC-') ? 'RC' : null;
          if (!prefix) continue;
          lbl = clampSemCode(lbl, prefix);
          const used = prefix === 'RP' ? usedRp : usedRc;
          if (used.has(lbl)) {
            const base = lbl.slice(0, 7); // 'RP-XXXX' so suffix+digit fits
            for (let n = 2; n <= 9; n++) {
              const candidate = base.length + 1 <= 8 ? base + n : (lbl.slice(0, 7) + n);
              if (!used.has(candidate)) { lbl = candidate; break; }
            }
          }
          if (prefix === 'RP') { m.rp = { ...m.rp, [s.id]: lbl }; usedRp.add(lbl); }
          else { m.rc = { ...m.rc, [s.id]: lbl }; usedRc.add(lbl); }
        }
        wbWriteJson(semKey(data.intake.id), m);
        setData(d => d ? { ...d } : d);
      } catch {}
    })();
    return () => { abort = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.intake?.id, data?.rolepacks?.length, data?.capabilities?.length]);

  // `b` toggles briefing, `p` advances phase (proposal §5.5).
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'b') setBriefingOpen(o => !o);
      if (e.key === 'p' && !observeMode) {
        setPhase(p => p === 'review' ? 'meeting'
          : p === 'meeting' ? 'finalize'
          : p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [observeMode]);

  const briefing = useMemo(() => buildBriefing(data, lang), [data, lang]);

  const scrollToField = (fid) => {
    if (!fid) return;
    const el = document.getElementById('wb-field-' + fid);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('field-pulse');
      setTimeout(() => el.classList.remove('field-pulse'), 1500);
    }
  };

  const copyAllQuestions = () => {
    if (!briefing) return;
    const text = briefing.questions.map((q, i) => `Q${i + 1}. ${q.q}`).join('\n');
    navigator.clipboard?.writeText(text);
    setToast(t('s7_briefing_copied', lang, { n: briefing.questions.length }));
    setTimeout(() => setToast(''), 1800);
  };

  const onApplyDiffs = (checked) => {
    setApplied(prev => [...prev, ...checked]);
    setToast(lang === 'zh' ? `已应用 ${checked.length} 项` : `Applied ${checked.length}`);
    setTimeout(() => setToast(''), 1800);
  };

  const onAdvanceMeeting = () => setCallPrompt(true);
  const confirmCallDate = (date) => {
    setCallDate(date);
    setPhase('meeting');
    setCallPrompt(false);
  };

  const onPublishAll = () => {
    setToast(lang === 'zh' ? '已发布(模拟)' : 'Published (demo)');
    setTimeout(() => setToast(''), 1800);
  };

  // Render
  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />

      <div className="curator-workbench">
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
            <span className="rm-loading-dots" aria-live="polite">
              <span>{lang === 'zh' ? '加载中' : 'Loading'}</span>
              <span className="rm-dots"><i /><i /><i /></span>
            </span>
          </div>
        )}

        {!loading && data && (
          <DirtyContext.Provider value={dirtyCtx}>
            {/* Sub-header strip with right-side Save indicator */}
            <div className="workbench-subhead">
              <button className="back" onClick={onBack}>{t('s7_back_queue', lang)}</button>
              <span className="crumb">{data.intake.id}</span>
              <span className="supplier-name">{data.intake.name || '—'}</span>
              {data.intake.industry_hint && <span className="role-name">· {data.intake.industry_hint}</span>}
              <span className={'status-badge ' + (data.intake.status === 'published' ? 'filled' : 'ai')} style={{ marginLeft: 8 }}>
                {data.intake.status === 'published' ? t('s7_status_published', lang) : t('s7_status_submitted', lang)}
              </span>
              {observeMode && <span className="observe">{t('s7_observe_banner', lang)}</span>}
              <div style={{ flex: 1 }} />
              <WorkbenchTopBar lang={lang} intakeId={data.intake.id}
                dirtySections={dirtySections}
                getCurrentData={() => data}
                onRefetch={async () => {
                  if (!intakeId || intakeId === 'demo') return;
                  try { setData(await intakes.get(intakeId)); } catch {}
                }} />
            </div>

            {/* 2-step process stepper — same visual as supplier */}
            <ProcessStepper
              steps={getPlatformSteps('curator', lang)}
              currentScreen={'wb_review'}
            />

            {/* Editable workbench — single column, no Copilot rail */}
            <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
              <div>
                {/* AI Summary */}
                <AISummarySection lang={lang} intakeId={data.intake.id} intakeName={data.intake.name} />

                {/* Company Profile (supplier-scoped, read-only) */}
                <CompanyProfileCard lang={lang} data={data}
                  onOpenSupplierMgmt={() => data.intake.supplier_id
                    ? window.location.assign('/curators/suppliers/' + data.intake.supplier_id)
                    : window.location.assign('/curators/suppliers')} />

                {/* Product Info (intake-scoped, editable — name, industry, website, free text) */}
                <ProductInfoCard lang={lang} data={data}
                  onChange={async () => { try { setData(await intakes.get(intakeId)); } catch {} }} />

                {/* Uploaded materials for THIS intake (not 1-1 with supplier) */}
                <MaterialsSection lang={lang} data={data} />

                {/* Capabilities (editable list) */}
                <CapabilitiesEditor lang={lang} data={data}
                  onChange={async () => { try { setData(await intakes.get(intakeId)); } catch {} }} />

                {/* RolePacks (tabs, mandatory rename, full edit, RC sync) */}
                <RolePackTabsEditor lang={lang} data={data}
                  onChange={async () => { try { setData(await intakes.get(intakeId)); } catch {} }} />

                {/* Service & Pricing (editable) */}
                <ServicePricingEditor lang={lang} data={data}
                  onChange={async () => { try { setData(await intakes.get(intakeId)); } catch {} }} />

                {/* Meeting Notes (history + Organize with Copilot — no RP needed) */}
                <MeetingNotesV2 lang={lang} intakeId={data.intake.id} />

                {/* Continue to publish CTA */}
                <PublishCTA lang={lang} data={data} />
              </div>
            </div>
          </DirtyContext.Provider>
        )}

        {err === 'demo' && (
          <div style={{ position: 'fixed', bottom: 16, left: 16, fontSize: 11, color: 'var(--ink-3)', background: 'white', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px' }}>
            {lang === 'zh' ? '使用演示数据' : 'Showing demo data'}
          </div>
        )}
      </div>

      {callPrompt && (
        <CallDatePrompt
          lang={lang}
          defaultDate={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })()}
          onCancel={() => setCallPrompt(false)}
          onConfirm={confirmCallDate}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Section-level Copilot rewrite — appears above the editable fields when
// in edit mode. Sends the section's current draft text to /ai/rewrite and
// returns improved text the curator can apply per-field.
function SectionCopilotBar({ lang, intakeId, onRewrite, hint }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const trigger = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { await onRewrite(); } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: 'color-mix(in srgb, var(--plat-curator) 6%, white)',
      border: '1px dashed color-mix(in srgb, var(--plat-curator) 35%, transparent)',
      borderRadius: 8, marginBottom: 14,
    }}>
      <span style={{ fontSize: 14, color: 'var(--plat-curator)' }}>✦</span>
      <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--navy-ink)' }}>Copilot</strong> {hint || (lang === 'zh' ? '可以帮你改写、补充、翻译这一节内容。' : 'can rewrite, expand, or translate this section.')}
        {err && <span style={{ color: 'var(--st-empty-ink)', marginLeft: 8 }}>⚠ {err}</span>}
      </div>
      <button onClick={trigger} disabled={busy}
        style={{
          background: 'var(--plat-curator)', color: 'white', border: 'none',
          borderRadius: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
        ✦ {busy ? (lang === 'zh' ? '改写中…' : 'Rewriting…') : (lang === 'zh' ? '改写整节' : 'Rewrite section')}
      </button>
    </div>
  );
}

// ─── Section card wrapper with pencil ──────────────────────────────────
function SectionCard({ title, icon, editing, onEdit, onSave, onCancel, dirty, children, hint, extra }) {
  return (
    <section style={{
      background: 'white', border: '1px solid var(--line)', borderRadius: 12,
      padding: '16px 20px 18px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {icon && (typeof icon === 'string'
          ? <span style={{ fontSize: 15 }}>{icon}</span>
          : <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink-2)' }}>{icon}</span>)}
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', letterSpacing: '-0.005em' }}>{title}</h2>
        {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>{hint}</span>}
        <div style={{ flex: 1 }} />
        {extra}
        {!editing && onEdit && (
          <button onClick={onEdit}
            title="edit"
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12 }}>
            <PenIcon size={13} />
          </button>
        )}
        {editing && (
          <>
            <button onClick={onCancel}
              style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={onSave}
              style={{ background: dirty ? 'var(--plat-curator)' : 'var(--ink-3)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              disabled={!dirty}>
              Save section
            </button>
          </>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Capability Partner Profile card — supplier company info ONLY ──────
// Mirrors what the supplier filled in their company-info section. Read-only
// here; "Manage →" jumps to the per-supplier detail page where curator can edit.
function CompanyProfileCard({ lang, data, onOpenSupplierMgmt }) {
  const company = data.company || {};
  const supplier = data.supplier || {};
  const fields = [
    { id: 'company_name',    zh: '公司全称',    en: 'Company name' },
    { id: 'company_hq',      zh: '总部',        en: 'Headquarters' },
    { id: 'company_founded', zh: '成立年份',    en: 'Founded' },
    { id: 'company_team',    zh: '团队规模',    en: 'Team size' },
    { id: 'company_clients', zh: '主要客户群',  en: 'Key clients' },
    { id: 'website',         zh: '网址',        en: 'Website' },
    { id: 'contact_name',    zh: '联系人',      en: 'Contact name' },
    { id: 'contact_phone',   zh: '电话',        en: 'Phone' },
    { id: 'contact_email',   zh: '邮箱',        en: 'Email' },
  ];
  // Fall back to supplier name when company_name not filled.
  const displayName = company.company_name || supplier.name || '';
  return (
    <SectionCard
      title={lang === 'zh' ? '能力伙伴档案' : 'Capability Partner Profile'}
      icon="🏢"
      hint={lang === 'zh' ? '能力伙伴提交的公司信息(只读)' : "partner-supplied company info (read-only)"}
      extra={
        <button onClick={onOpenSupplierMgmt}
          style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', color: 'var(--plat-curator)', fontWeight: 600, fontFamily: 'inherit' }}>
          {lang === 'zh' ? '管理 →' : 'Manage →'}
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
        {fields.map(f => {
          const v = f.id === 'company_name' ? displayName : (company[f.id] || '');
          return (
            <div key={f.id} style={{ display: 'contents' }}>
              <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{lang === 'zh' ? f.zh : f.en}</div>
              <div style={{ color: 'var(--ink)', fontWeight: f.id === 'company_name' ? 600 : 400, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v || '—'}</div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Product Info card — per-intake (editable) ─────────────────────────
// Mirrors EXACTLY the supplier's intake form (app/src/screens/v2/onboard.jsx):
// the supplier sees only Product name + Product description. Materials are a
// separate section. Nothing else is collected at intake time.
function ProductInfoCard({ lang, data, onChange }) {
  const intakeId = data.intake.id;
  const intake = data.intake || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setDraft({
      name: intake.name || '',
      free_text: intake.free_text || '',
    });
  }, [intake.name, intake.free_text, editing]);

  const dirty = (
    draft.name !== (intake.name || '') ||
    draft.free_text !== (intake.free_text || '')
  );

  useDirtyTracker('product-info', editing && dirty);
  useSaveAllListener(editing && dirty, () => save());

  const save = async () => {
    if (!intakeId || intakeId === 'demo') { setEditing(false); return; }
    setBusy(true); setErr('');
    try {
      await intakes.patch(intakeId, {
        name: draft.name,
        free_text: draft.free_text,
      });
      setEditing(false);
      onChange?.();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally { setBusy(false); }
  };

  // Supplier-form labels — match exactly what onboard.jsx displays so the
  // curator sees the same field titles the partner saw.
  const labelName = lang === 'zh' ? '产品名称' : 'Product name';
  const labelDesc = lang === 'zh' ? '产品介绍(可粘贴文本)' : 'Product description (paste text)';
  const placeholderName = lang === 'zh' ? '例如:智能合规平台 / RPA 客服助手' : 'e.g. Smart Compliance Platform / RPA Customer Assistant';
  const placeholderDesc = lang === 'zh'
    ? '简单描述这款产品做什么、面向哪些客户、有哪些核心能力。可以直接粘贴官网或介绍文案。'
    : 'What does it do, who is it for, what are the core capabilities. Paste from your website or pitch deck.';

  return (
    <SectionCard
      title={lang === 'zh' ? '产品信息' : 'Product Info'}
      icon="📦"
      hint={lang === 'zh' ? '能力伙伴在意向表中填写的内容 · 可编辑' : 'what the partner submitted in the intake form · editable'}
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={save}
      onCancel={() => { setEditing(false); setErr(''); }}
      dirty={dirty && !busy}
    >
      {err && <div style={{ marginBottom: 8, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: editing ? 14 : 10, columnGap: 12, fontSize: 13 }}>
        <div style={{ color: 'var(--ink-3)', fontSize: 12, paddingTop: editing ? 7 : 0 }}>{labelName}</div>
        {editing
          ? <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder={placeholderName}
              style={{ padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', fontWeight: 600, color: 'var(--ink)' }} />
          : <div style={{ color: 'var(--ink)', fontWeight: 600 }}>{intake.name || '—'}</div>}

        <div style={{ color: 'var(--ink-3)', fontSize: 12, paddingTop: editing ? 7 : 0 }}>{labelDesc}</div>
        {editing
          ? <textarea value={draft.free_text} onChange={e => setDraft(d => ({ ...d, free_text: e.target.value }))}
              rows={5}
              placeholder={placeholderDesc}
              style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, minHeight: 110 }} />
          : <div style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{intake.free_text || '—'}</div>}
      </div>
    </SectionCard>
  );
}

// ─── Materials uploaded for this product (intake-scoped) ───────────────
function MaterialsSection({ lang, data }) {
  const files = Array.isArray(data.files) ? data.files : [];
  return (
    <SectionCard
      title={lang === 'zh' ? '本产品上传材料' : 'Materials for this product'}
      icon={<PaperclipIcon size={15} />}
      hint={lang === 'zh' ? `本次提交相关文件 · ${files.length} 项` : `attached to this intake · ${files.length} item${files.length === 1 ? '' : 's'}`}
    >
      {files.length === 0 ? (
        <div style={{ padding: 18, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
          {lang === 'zh' ? '能力伙伴未上传任何材料' : 'no materials uploaded by the partner'}
        </div>
      ) : (
        <FilesDownloadList files={files} intakeId={data.intake.id} />
      )}
    </SectionCard>
  );
}

function FilesDownloadList({ files, intakeId }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {files.map(f => (
        <a key={f.id}
           href={`/api/intakes/${intakeId}/files/${f.id}`}
           download={f.display_name || f.filename}
           style={{
             display: 'inline-flex', alignItems: 'center', gap: 6,
             color: 'var(--plat-curator)', fontSize: 12.5, textDecoration: 'none',
             padding: '4px 0',
           }}>
          <DownloadIcon size={13} />
          <span style={{ fontWeight: 500 }}>{f.display_name || f.filename}</span>
          {f.size_bytes ? <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>· {Math.round(f.size_bytes / 1024)} KB</span> : null}
        </a>
      ))}
    </div>
  );
}

// ─── Capabilities editor (whole-section edit toggle) ───────────────────
function CapabilitiesEditor({ lang, data, onChange }) {
  const intakeId = data.intake.id;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => seedDraft(data.capabilities, lang, intakeId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setDraft(seedDraft(data.capabilities, lang, intakeId)); /* eslint-disable */ }, [data.capabilities, editing, lang, intakeId]);

  // Single-language inputs: store curator text per-row in `_name` and `_desc`
  // (the language they're typing in). On save we translate the missing side.
  const dirty = useMemo(() => {
    if (!editing) return false;
    if (draft.length !== (data.capabilities || []).length) return true;
    const sem = getSemMap(intakeId).rc;
    for (let i = 0; i < draft.length; i++) {
      const orig = data.capabilities[i] || {};
      const d = draft[i];
      if (d._new || d._delete) return true;
      if (d.id !== orig.id) return true;
      const origName = lang === 'zh' ? (orig.name_zh || orig.name_en || '') : (orig.name_en || orig.name_zh || '');
      const origDesc = lang === 'zh' ? (orig.description_zh || orig.description_en || '') : (orig.description_en || orig.description_zh || '');
      if ((d._name || '') !== origName) return true;
      if ((d._desc || '') !== origDesc) return true;
      if ((d._semantic || '') !== (sem[d.id] || '')) return true;
    }
    return false;
  }, [draft, editing, data.capabilities, lang, intakeId]);

  // Mandatory: every non-deleted row must have a name (in current lang).
  const missingNames = useMemo(() => {
    if (!editing) return [];
    return draft
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !d._delete && !(d._name || '').trim())
      .map(({ i }) => i);
  }, [draft, editing]);

  useDirtyTracker('capabilities', editing && dirty);
  useSaveAllListener(editing && dirty, () => save());

  const nextRcLabel = () => {
    // RC-NN auto-numbering — pick max existing + 1.
    let max = 0;
    for (const c of draft) {
      const m = String(c.rc_label || '').match(/^RC-(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return 'RC-' + String(max + 1).padStart(2, '0');
  };
  const addRow = () => {
    setDraft(d => [...d, { id: '_new_' + Date.now() + Math.random(), rc_label: nextRcLabel(), name_zh: '', name_en: '', description_zh: '', description_en: '', _name: '', _desc: '', confirmed: 1, _new: true }]);
  };
  const removeRow = (i) => {
    setDraft(d => d.map((row, idx) => idx === i ? { ...row, _delete: !row._delete } : row));
  };
  const updateRow = (i, patch) => {
    setDraft(d => d.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  };

  const save = async () => {
    if (missingNames.length > 0) {
      setErr(lang === 'zh' ? `请填写第 ${missingNames.map(i => i + 1).join('、')} 行能力名称(必填)` : `Name required for row${missingNames.length === 1 ? '' : 's'} ${missingNames.map(i => i + 1).join(', ')}`);
      return;
    }
    if (!intakeId || intakeId === 'demo') { setEditing(false); return; }
    setBusy(true); setErr('');
    try {
      // For each changed/new row, translate name + desc to fill the OTHER language
      const translated = await Promise.all(draft.map(async (d, i) => {
        if (d._delete) return d;
        const orig = (data.capabilities || []).find(c => c.id === d.id) || {};
        const origName = lang === 'zh' ? (orig.name_zh || orig.name_en || '') : (orig.name_en || orig.name_zh || '');
        const origDesc = lang === 'zh' ? (orig.description_zh || orig.description_en || '') : (orig.description_en || orig.description_zh || '');
        const nameChanged = (d._name || '') !== origName;
        const descChanged = (d._desc || '') !== origDesc;
        let name_zh = orig.name_zh || '';
        let name_en = orig.name_en || '';
        let desc_zh = orig.description_zh || '';
        let desc_en = orig.description_en || '';
        if (d._new || nameChanged) {
          // Translate name to fill the other side
          const pair = await translatePair(intakeId, lang, d._name || '');
          name_zh = pair.zh;
          name_en = pair.en;
        }
        if (d._new || descChanged) {
          if ((d._desc || '').trim()) {
            const pair = await translatePair(intakeId, lang, d._desc || '');
            desc_zh = pair.zh;
            desc_en = pair.en;
          } else {
            desc_zh = ''; desc_en = '';
          }
        }
        return { ...d, name_zh, name_en, description_zh: desc_zh, description_en: desc_en };
      }));

      const ops = [];
      for (const d of translated) {
        if (d._delete && !d._new && d.id) ops.push(intakes.deleteCapability(intakeId, d.id));
      }
      for (const d of translated) {
        if (d._new && !d._delete) {
          ops.push(intakes.addCapability(intakeId, {
            rc_label: (d.rc_label || '').trim().toUpperCase(),
            name: { zh: d.name_zh || '', en: d.name_en || '' },
            description: { zh: d.description_zh || '', en: d.description_en || '' },
            source: 'curator',
            confirmed: 1,
          }));
        }
      }
      for (const d of translated) {
        if (d._new || d._delete) continue;
        const orig = (data.capabilities || []).find(c => c.id === d.id);
        if (!orig) continue;
        const patch = {};
        if ((d.name_zh || '') !== (orig.name_zh || '') || (d.name_en || '') !== (orig.name_en || '')) {
          patch.name = { zh: d.name_zh || '', en: d.name_en || '' };
        }
        if ((d.description_zh || '') !== (orig.description_zh || '') || (d.description_en || '') !== (orig.description_en || '')) {
          patch.description = { zh: d.description_zh || '', en: d.description_en || '' };
        }
        if (Object.keys(patch).length > 0) ops.push(intakes.patchCapability(intakeId, d.id, patch));
      }
      await Promise.all(ops);
      // Persist semantic-code overlay only on Save (Cancel discards changes).
      const semMap = getSemMap(intakeId);
      let semDirty = false;
      const nextRc = { ...(semMap.rc || {}) };
      for (const d of translated) {
        if (d._delete || d._new) continue; // new rows have no stable id yet
        const v = clampSemCode(d._semantic || '', 'RC');
        if ((nextRc[d.id] || '') !== v) {
          if (v) nextRc[d.id] = v; else delete nextRc[d.id];
          semDirty = true;
        }
      }
      if (semDirty) wbWriteJson(semKey(intakeId), { ...semMap, rc: nextRc });
      setEditing(false);
      onChange?.();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const visible = editing ? draft : (data.capabilities || []);
  return (
    <SectionCard
      title={lang === 'zh' ? '能力清单' : 'Capabilities'}
      icon="🧩"
      hint={editing ? (lang === 'zh' ? '所有字段已开启编辑' : 'all fields editable') : `${(data.capabilities || []).length} ${lang === 'zh' ? '项' : 'items'}`}
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={save}
      onCancel={() => { setEditing(false); setErr(''); }}
      dirty={dirty && !busy}
    >
      {err && <div style={{ marginBottom: 10, padding: 10, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', padding: 18 }}>{t('s7_no_caps', lang)}</div>}
        {visible.map((c, i) => {
          const isMissingName = editing && missingNames.includes(i);
          return (
            <div key={c.id || i} style={{
              display: 'grid', gridTemplateColumns: editing ? '70px 1fr 36px' : '60px 1fr 22px',
              gap: 14, padding: editing ? '14px 16px' : '10px 12px',
              background: c._delete ? 'rgba(255,200,200,0.25)' : 'var(--bg)',
              borderRadius: 10, opacity: c._delete ? 0.55 : 1,
              border: editing ? '1px solid ' + (isMissingName ? 'rgba(220,80,80,0.5)' : 'var(--line-2)') : 'none',
              alignItems: 'flex-start',
            }}>
              {/* RC-NN locked + AI-suggested semantic code (editable in edit mode) */}
              <CapLabelStack
                originalLabel={c.rc_label}
                displayValue={getSemMap(intakeId).rc[c.id] || ''}
                editing={editing}
                value={c._semantic !== undefined ? c._semantic : (getSemMap(intakeId).rc[c.id] || '')}
                onChange={(v) => updateRow(i, { _semantic: v })}
              />

              <div style={{ minWidth: 0 }}>
                {editing ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 10.5, color: isMissingName ? 'var(--st-empty-ink)' : 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
                        {lang === 'zh' ? '能力名称' : 'Capability name'} <span style={{ color: 'var(--st-empty-ink)' }}>*</span>
                        <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontWeight: 500, fontSize: 10, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>
                          {lang === 'zh' ? '保存时自动翻译为英文' : 'auto-translates to Chinese on save'}
                        </span>
                      </label>
                      <input value={c._name || ''} onChange={e => updateRow(i, { _name: e.target.value })}
                        placeholder={lang === 'zh' ? '例:AI 电商详情页全自动生成' : 'e.g. Automated AI E-Commerce Detail Page Generation'}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid ' + (isMissingName ? 'rgba(220,80,80,0.5)' : 'var(--line)'), borderRadius: 6, fontSize: 13.5, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
                        {lang === 'zh' ? '能力描述' : 'Capability description'}
                        <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontWeight: 500, fontSize: 10, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>
                          {lang === 'zh' ? '可选 · 保存时自动翻译' : 'optional · auto-translates on save'}
                        </span>
                      </label>
                      <textarea value={c._desc || ''} onChange={e => updateRow(i, { _desc: e.target.value })}
                        placeholder={lang === 'zh' ? '可选:能力详情、技术原理、客户证据' : 'optional: details, technical basis, customer evidence'}
                        rows={5}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, minHeight: 120 }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</div>
                    {(c.description_zh || c.description_en) && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.6 }}>
                        {lang === 'zh' ? (c.description_zh || c.description_en) : (c.description_en || c.description_zh)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {editing ? (
                <button onClick={() => removeRow(i)} title={c._delete ? 'undo' : 'remove'}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: c._delete ? 'var(--plat-curator)' : 'var(--ink-3)', alignSelf: 'flex-start', padding: '8px 6px', fontSize: 14 }}>
                  {c._delete ? '↺' : <TrashIcon size={14} />}
                </button>
              ) : (
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)', alignSelf: 'center', justifySelf: 'end' }}>{c.confirmed ? '✓' : '?'}</span>
              )}
            </div>
          );
        })}
        {editing && (
          <button onClick={addRow}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              background: 'transparent', border: '1px dashed var(--plat-curator)', borderRadius: 6,
              padding: '8px 14px', fontSize: 12, color: 'var(--plat-curator)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
            }}>
            <PlusIcon size={12} /> {lang === 'zh' ? '添加能力' : 'Add capability'}
          </button>
        )}
      </div>
    </SectionCard>
  );
}

// ✦ Suggest a semantic RP-XXX / RC-XXX label. Strict: never derive from
// supplier brand or product name (enforced server-side too).
function RpLabelSuggestButton({ lang, intakeId, item, onApply }) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  const ask = async () => {
    if (busy) return;
    setBusy(true); setErr(''); setSuggestion(null);
    try {
      const res = await curator.rewriteAi(intakeId, {
        kind: 'suggest_labels',
        input: 'one item',
        context: {
          items: [{
            id: item.id,
            current_label: item.current_label,
            name_zh: item.kind === 'rp' ? item.name : (item.name_zh || item.name),
            name_en: item.kind === 'rp' ? item.name : (item.name_en || item.name),
            description_zh: item.description_zh || '',
            description_en: item.description_en || '',
          }],
        },
      });
      if (res?.ok && res.suggestions?.[0]) {
        setSuggestion(res.suggestions[0]);
        setOpen(true);
      } else setErr(lang === 'zh' ? '建议失败' : 'Suggest failed');
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={ask} disabled={busy}
        title={lang === 'zh' ? 'AI 建议语义代码 (如 RP-AML)' : 'AI suggest semantic code (e.g. RP-AML)'}
        style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--plat-curator) 35%, transparent)', color: 'var(--plat-curator)', borderRadius: 5, padding: '4px 9px', fontSize: 11, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
        ✦ {busy
          ? <><span>{lang === 'zh' ? '生成中' : 'Generating'}</span><span className="rm-dots" style={{ marginLeft: 4 }}><i /><i /><i /></span></>
          : (lang === 'zh' ? 'AI 建议代码' : 'AI suggest code')}
      </button>
      {err && <span style={{ fontSize: 11, color: 'var(--st-empty-ink)', alignSelf: 'center', marginLeft: 6 }}>{err}</span>}
      {open && suggestion && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30, width: 280, background: 'white', border: '1px solid color-mix(in srgb, var(--plat-curator) 35%, transparent)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--plat-curator)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            ✦ {lang === 'zh' ? '建议代码' : 'Suggestion'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#2A6EA0', marginBottom: 4 }}>
            {suggestion.current_label} → {suggestion.suggested_label}
          </div>
          {suggestion.rationale && <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 8 }}>{suggestion.rationale}</div>}
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => { onApply(suggestion.suggested_label); setOpen(false); }}
              style={{ background: 'var(--plat-curator)', color: 'white', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✓ {lang === 'zh' ? '应用' : 'Apply'}
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-2)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Clamp a typed semantic code to the format `RP-XXXXX` / `RC-XXXXX` —
// 5 uppercase chars max after the prefix.
function clampSemCode(text, prefix) {
  if (!text) return '';
  let t = String(text).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!t.startsWith(prefix + '-')) {
    // strip any leading prefix bits + auto-prepend
    t = t.replace(/^(RP-|RC-)?/, '');
    t = prefix + '-' + t;
  }
  const m = t.match(/^(RP|RC)-([A-Z0-9]+)$/);
  if (!m) return t.slice(0, prefix.length + 1);
  return m[1] + '-' + m[2].slice(0, 5);
}

// Stack: original RP-NN (locked, neutral box) on top, semantic code (purple
// box, same font size, manually editable) directly underneath. No arrow.
// CONTROLLED in edit mode — parent owns `value` + `onChange`; we only persist
// to localStorage when the parent calls `setSemForRp` from its Save handler.
function RpLabelStack({ originalLabel, displayValue, editing, value, onChange }) {
  const sharedBoxStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
    padding: '4px 10px', borderRadius: 5, lineHeight: 1.2,
    minWidth: 88, textAlign: 'center', display: 'inline-block',
  };
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <span style={{ ...sharedBoxStyle, color: 'var(--ink-3)', background: 'var(--bg)' }}>{originalLabel}</span>
      {editing ? (
        <input value={value || ''}
          onChange={e => onChange(clampSemCode(e.target.value, 'RP'))}
          onBlur={() => onChange(clampSemCode(value || '', 'RP'))}
          placeholder="RP-AML"
          maxLength={8}
          style={{
            ...sharedBoxStyle,
            color: 'var(--plat-curator)',
            background: 'color-mix(in srgb, var(--plat-curator) 10%, white)',
            border: '1px solid var(--plat-curator)',
            textTransform: 'uppercase', textAlign: 'center', padding: '4px 8px', width: 100,
          }} />
      ) : (
        <span style={{
          ...sharedBoxStyle,
          color: 'var(--plat-curator)',
          background: 'color-mix(in srgb, var(--plat-curator) 12%, white)',
          border: '1px solid color-mix(in srgb, var(--plat-curator) 30%, transparent)',
        }}>{displayValue || '—'}</span>
      )}
    </div>
  );
}

// Same shape for RoleCapability rows. Controlled in edit mode.
function CapLabelStack({ originalLabel, displayValue, editing, value, onChange }) {
  const sharedBoxStyle = {
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
    padding: '3px 8px', borderRadius: 4, lineHeight: 1.2,
    minWidth: 70, textAlign: 'center', display: 'inline-block',
  };
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
      paddingTop: editing ? 6 : 0,
    }}>
      <span style={{ ...sharedBoxStyle, color: 'var(--ink-3)', background: 'var(--bg)' }}>{originalLabel}</span>
      {editing ? (
        <input value={value || ''}
          onChange={e => onChange(clampSemCode(e.target.value, 'RC'))}
          onBlur={() => onChange(clampSemCode(value || '', 'RC'))}
          placeholder="RC-DD"
          maxLength={8}
          style={{
            ...sharedBoxStyle,
            color: 'var(--plat-curator)',
            background: 'color-mix(in srgb, var(--plat-curator) 10%, white)',
            border: '1px solid var(--plat-curator)',
            textTransform: 'uppercase', padding: '3px 7px', width: 80,
          }} />
      ) : (
        <span style={{
          ...sharedBoxStyle,
          color: 'var(--plat-curator)',
          background: 'color-mix(in srgb, var(--plat-curator) 12%, white)',
          border: '1px solid color-mix(in srgb, var(--plat-curator) 30%, transparent)',
        }}>{displayValue || '—'}</span>
      )}
    </div>
  );
}

// ─── RolePack tabs editor (mandatory rename, full edit, RC link sync) ──
function RolePackTabsEditor({ lang, data, onChange }) {
  const intakeId = data.intake.id;
  const rolepacks = data.rolepacks || [];
  const [activeId, setActiveId] = useState(rolepacks[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  useEffect(() => {
    if (!activeId && rolepacks[0]?.id) setActiveId(rolepacks[0].id);
    if (activeId && !rolepacks.find(r => r.id === activeId)) setActiveId(rolepacks[0]?.id || null);
  }, [rolepacks, activeId]);

  const addRolePack = async () => {
    if (adding || !intakeId || intakeId === 'demo') return;
    setAdding(true); setAddErr('');
    try {
      // Auto-numbered RP-NN — pick next slot.
      let max = 0;
      for (const r of rolepacks) {
        const m = String(r.rp_label || '').match(/^RP-(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      const nextLabel = 'RP-' + String(max + 1).padStart(2, '0');
      const res = await intakes.addRolepack(intakeId, {
        rp_label: nextLabel,
        name: { zh: '', en: '' },
        position: rolepacks.length,
      });
      onChange?.();
      // Switch to newly created tab if we got an id back
      if (res?.id) setActiveId(res.id);
    } catch (e) {
      setAddErr(String(e?.message || e));
    } finally {
      setAdding(false);
    }
  };

  const showAddBtnOnly = rolepacks.length === 0;
  const active = !showAddBtnOnly ? (rolepacks.find(r => r.id === activeId) || rolepacks[0]) : null;

  return (
    <section style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 18px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15 }}>📦</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', letterSpacing: '-0.005em' }}>
          {lang === 'zh' ? '岗位包' : 'RolePacks'}
        </h2>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{rolepacks.length} {lang === 'zh' ? '个 · 每个标签页可单独编辑 · RP 名称必须填写后才能发布' : '· each tab independently editable · name required before publish'}</span>
        <div style={{ flex: 1 }} />
        <button onClick={addRolePack} disabled={adding}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px dashed var(--plat-curator)',
            color: 'var(--plat-curator)', borderRadius: 6,
            padding: '5px 12px', fontSize: 12, fontWeight: 600,
            cursor: adding ? 'wait' : 'pointer', fontFamily: 'inherit',
          }}>
          <PlusIcon size={12} /> {adding ? '…' : (lang === 'zh' ? '添加岗位包' : 'Add RolePack')}
        </button>
      </div>
      {addErr && <div style={{ marginBottom: 8, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {addErr}</div>}

      {showAddBtnOnly ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', padding: 14, textAlign: 'center' }}>
          {t('s7_no_rolepacks', lang)} — {lang === 'zh' ? '点上方"添加岗位包"开始' : 'click "Add RolePack" above to start'}
        </div>
      ) : (
      <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line)', marginBottom: 14, overflowX: 'auto' }}>
        {rolepacks.map(r => {
          const isActive = r.id === active.id;
          const hasName = !!(r.name_zh || r.name_en);
          return (
            <button key={r.id} onClick={() => setActiveId(r.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '8px 14px', fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2A6EA0' : 'var(--ink-2)',
                borderBottom: isActive ? '2px solid #3D8CC4' : '2px solid transparent',
                marginBottom: -1, fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#2A6EA0', fontWeight: 700 }}>{r.rp_label}</span>
              <span>{lang === 'zh' ? (r.name_zh || r.name_en || '(未命名)') : (r.name_en || r.name_zh || '(unnamed)')}</span>
              {!hasName && <span title={lang === 'zh' ? '必须命名' : 'name required'} style={{ color: 'var(--st-empty-ink)', fontSize: 11 }}>●</span>}
            </button>
          );
        })}
      </div>
      <RolePackEditor key={active.id} lang={lang} intakeId={intakeId} rp={active} allCaps={data.capabilities || []} onChange={onChange} />
      </>
      )}
    </section>
  );
}

function RolePackEditor({ lang, intakeId, rp, allCaps, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Snapshot rp into draft when entering edit mode. _name and _qfields are
  // single-language drafts (current UI lang); we translate on save.
  useEffect(() => {
    const q = rp.questionnaire || {};
    const _qfields = {};
    for (const [section, fields] of Object.entries(q)) {
      _qfields[section] = {};
      for (const [fid, fv] of Object.entries(fields || {})) {
        const vz = Array.isArray(fv?.value_zh) ? fv.value_zh.join(' · ') : (fv?.value_zh || '');
        const ve = Array.isArray(fv?.value_en) ? fv.value_en.join(' · ') : (fv?.value_en || '');
        _qfields[section][fid] = lang === 'zh' ? (vz || ve) : (ve || vz);
      }
    }
    setDraft({
      rp_label: rp.rp_label || '',
      name_zh: rp.name_zh || '', name_en: rp.name_en || '',
      _name: lang === 'zh' ? (rp.name_zh || rp.name_en || '') : (rp.name_en || rp.name_zh || ''),
      capability_ids: rp.capability_ids || [],
      questionnaire: q,
      _qfields,
      _semantic: getSemMap(intakeId).rp[rp.id] || '',
    });
    // `editing` included so Cancel re-seeds the draft from the server (otherwise
    // canceling would leave the typed text in the draft and re-show it next time).
  }, [rp.id, rp.rp_label, rp.name_zh, rp.name_en, rp.capability_ids, rp.questionnaire, lang, editing]);

  const origName = lang === 'zh' ? (rp.name_zh || rp.name_en || '') : (rp.name_en || rp.name_zh || '');
  const origSem = getSemMap(intakeId).rp[rp.id] || '';
  const dirty = !!(draft && (
    draft.rp_label !== (rp.rp_label || '') ||
    (draft._name || '') !== origName ||
    (draft._semantic || '') !== origSem ||
    JSON.stringify([...(draft.capability_ids || [])].sort()) !== JSON.stringify([...(rp.capability_ids || [])].sort()) ||
    qfieldsDirty(draft._qfields, rp.questionnaire || {}, lang)
  ));

  // useDirtyTracker MUST run before the early return so the hook count stays
  // stable across renders (Rules of Hooks).
  useDirtyTracker('rolepack:' + rp.id, editing && dirty);
  useSaveAllListener(editing && dirty, () => save());

  if (!draft) return null;

  const setQuestionField = (sectionKey, fieldId, value) => {
    setDraft(d => {
      const next = { ...(d._qfields || {}) };
      next[sectionKey] = { ...(next[sectionKey] || {}) };
      next[sectionKey][fieldId] = value;
      return { ...d, _qfields: next };
    });
  };

  const toggleCapLink = (capId) => {
    setDraft(d => {
      const has = d.capability_ids.includes(capId);
      return { ...d, capability_ids: has ? d.capability_ids.filter(x => x !== capId) : [...d.capability_ids, capId] };
    });
  };

  const save = async () => {
    if (!intakeId || intakeId === 'demo') { setEditing(false); return; }
    if (!(draft._name || '').trim()) {
      setErr(lang === 'zh' ? '岗位名称必须填写' : 'Role name is required');
      return;
    }
    setBusy(true); setErr('');
    try {
      const patch = {};
      if (draft.rp_label.trim().toUpperCase() !== (rp.rp_label || '')) patch.rp_label = draft.rp_label.trim().toUpperCase();

      // Name: translate on save
      const nameChanged = (draft._name || '') !== origName;
      if (nameChanged) {
        const pair = await translatePair(intakeId, lang, draft._name);
        patch.name = { zh: pair.zh, en: pair.en };
      }

      if (JSON.stringify([...draft.capability_ids].sort()) !== JSON.stringify([...(rp.capability_ids || [])].sort())) {
        patch.capability_ids = draft.capability_ids;
      }

      // Questionnaire: per-field translate on save
      if (qfieldsDirty(draft._qfields || {}, rp.questionnaire || {}, lang)) {
        const nextQ = JSON.parse(JSON.stringify(rp.questionnaire || {}));
        for (const section of Object.keys(draft._qfields || {})) {
          if (!nextQ[section]) nextQ[section] = {};
          for (const fid of Object.keys(draft._qfields[section] || {})) {
            const text = draft._qfields[section][fid] || '';
            const orig = nextQ[section][fid] || {};
            const origDisplay = lang === 'zh'
              ? (Array.isArray(orig.value_zh) ? orig.value_zh.join(' · ') : (orig.value_zh || orig.value_en || ''))
              : (Array.isArray(orig.value_en) ? orig.value_en.join(' · ') : (orig.value_en || orig.value_zh || ''));
            if (text === origDisplay) continue;
            if (!text.trim()) {
              nextQ[section][fid] = { ...orig, value_zh: '', value_en: '' };
            } else {
              const pair = await translatePair(intakeId, lang, text);
              nextQ[section][fid] = { ...orig, value_zh: pair.zh, value_en: pair.en };
            }
          }
        }
        patch.questionnaire = nextQ;
      }

      if (Object.keys(patch).length > 0) {
        await intakes.patchRolepack(intakeId, rp.id, patch);
      }
      // Persist semantic-code overlay only on Save (Cancel discards changes).
      const semNext = clampSemCode(draft._semantic || '', 'RP');
      if (semNext !== origSem) {
        const m = getSemMap(intakeId);
        const rpMap = { ...(m.rp || {}) };
        if (semNext) rpMap[rp.id] = semNext; else delete rpMap[rp.id];
        wbWriteJson(semKey(intakeId), { ...m, rp: rpMap });
      }
      setEditing(false);
      onChange?.();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const linkedCaps = (allCaps || []).filter(c => draft.capability_ids.includes(c.id));

  return (
    <div>
      {/* Header row: rp_label (stack: original locked + semantic editable) + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <RpLabelStack
          originalLabel={rp.rp_label}
          displayValue={getSemMap(intakeId).rp[rp.id] || ''}
          editing={editing}
          value={draft._semantic !== undefined ? draft._semantic : (getSemMap(intakeId).rp[rp.id] || '')}
          onChange={(v) => setDraft(d => ({ ...d, _semantic: v }))}
        />
        {editing ? (
          <>
            <input value={draft._name || ''} onChange={e => setDraft(d => ({ ...d, _name: e.target.value }))}
              placeholder={lang === 'zh' ? '岗位名(必填,保存时自动翻译)' : 'Role name (required; auto-translates on save)'}
              style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', minWidth: 240, flex: 1, fontWeight: 600 }} />
          </>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{lang === 'zh' ? (rp.name_zh || rp.name_en) : (rp.name_en || rp.name_zh) || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
        )}
        <div style={{ flex: 1 }} />
        {!editing && (
          <button onClick={() => setEditing(true)}
            title="edit"
            style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12 }}>
            <PenIcon size={13} />
          </button>
        )}
        {editing && (
          <>
            <button onClick={() => { setEditing(false); setErr(''); }}
              style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={save} disabled={!dirty || busy}
              style={{ background: dirty ? 'var(--plat-curator)' : 'var(--ink-3)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: dirty && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              Save section
            </button>
          </>
        )}
      </div>
      {err && <div style={{ marginBottom: 10, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}

      {/* Linked RoleCapabilities (sync with current cap list) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {lang === 'zh' ? '关联能力 RoleCapability' : 'Linked RoleCapabilities'}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(allCaps || []).length === 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{lang === 'zh' ? '尚无能力 — 在上面添加' : 'no capabilities yet — add some above'}</span>}
            {(allCaps || []).map(c => {
              const linked = draft.capability_ids.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCapLink(c.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: 4,
                    fontSize: 11.5, padding: '4px 10px', borderRadius: 999,
                    background: linked ? 'color-mix(in srgb, var(--plat-curator) 15%, white)' : 'transparent',
                    border: '1px solid ' + (linked ? 'color-mix(in srgb, var(--plat-curator) 40%, transparent)' : 'var(--line)'),
                    color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--plat-curator)', fontWeight: 700 }}>{c.rc_label}</span>
                  <span>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</span>
                  {linked && <span style={{ color: 'var(--plat-curator)', fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {linkedCaps.length === 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{lang === 'zh' ? '未关联能力' : 'no capabilities linked'}</span>}
            {linkedCaps.map(c => (
              <span key={c.id} style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 4,
                fontSize: 11.5, padding: '3px 9px', borderRadius: 999,
                background: 'color-mix(in srgb, var(--plat-curator) 8%, white)',
                border: '1px solid color-mix(in srgb, var(--plat-curator) 22%, transparent)',
                color: 'var(--ink)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--plat-curator)', fontWeight: 700 }}>{c.rc_label}</span>
                <span>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Questionnaire — single-language inputs, taller textareas */}
      <div style={{ display: 'grid', gap: 18 }}>
        {QUESTIONNAIRE_SECTIONS.map(section => (
          <div key={section.key}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-ink)', marginBottom: 10, paddingBottom: 5, borderBottom: '1px solid var(--line-2)' }}>
              {lang === 'zh' ? section.titleZh : section.titleEn}
            </div>
            {section.fields.map(f => {
              const editVal = draft._qfields?.[section.key]?.[f.id] || '';
              const v = rp.questionnaire?.[section.key]?.[f.id] || {};
              const valZh = Array.isArray(v.value_zh) ? v.value_zh.join(' · ') : (v.value_zh || '');
              const valEn = Array.isArray(v.value_en) ? v.value_en.join(' · ') : (v.value_en || '');
              return (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 5 }}>
                    {lang === 'zh' ? f.zh : f.en}
                    {editing && (
                      <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontWeight: 500, fontSize: 10, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic' }}>
                        {lang === 'zh' ? '保存时自动翻译' : 'auto-translates on save'}
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <textarea value={editVal}
                      onChange={e => setQuestionField(section.key, f.id, e.target.value)}
                      rows={3}
                      placeholder={lang === 'zh' ? '请填写中文回答' : 'Type your English answer'}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55, minHeight: 72 }} />
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {(lang === 'zh' ? valZh : valEn) || valZh || valEn || <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>{lang === 'zh' ? '未填写' : 'not set'}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Service & Pricing editor (single-language inputs, " · "-separated lists) ─
// Storage shape: each value is either a string or an array of strings.
// We render arrays as " · "-joined strings so curators can type freely.
// Save converts back to arrays for fields meant to be lists.
const SP_FIELDS = {
  service: {
    demo_mode:               { isList: true,  zh: '演示偏好',     en: 'Demo preferences' },
    sales_assist_level:      { isList: false, zh: '销售配合',     en: 'Sales-assist' },
    sales_coverage_regions:  { isList: true,  zh: '辐射区域',     en: 'Coverage' },
    delivery_scope:          { isList: true,  zh: '交付范围',     en: 'Delivery scope' },
    support_languages:       { isList: true,  zh: '客服语言',     en: 'Support languages' },
  },
  pricing: {
    pricing_model:           { isList: true,  zh: '定价模式',     en: 'Pricing model' },
    cost_price:              { isList: false, zh: '成本价',       en: 'Cost price' },
    suggested_retail:        { isList: false, zh: '建议零售价',   en: 'Suggested retail' },
    custom_service_pricing:  { isList: false, zh: '私有化起价',   en: 'Private deployment from' },
    service_fee:             { isList: false, zh: '定制服务费',   en: 'Custom service fee' },
  },
};

// Display value as plain text (curator-typeable). Strips "custom:" prefix legacy.
function spDisplay(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x.replace(/^custom:/, '') : (x?.zh || x?.en || '')).filter(Boolean).join(' · ');
  if (typeof v === 'string') return v.replace(/^custom:/, '');
  if (typeof v === 'object') return v.zh || v.en || '';
  return String(v);
}
// Parse user input back into the storage shape.
function spParse(text, isList) {
  if (!text || !text.trim()) return isList ? [] : '';
  if (isList) return text.split(/\s*[·,;|]\s*/).filter(Boolean);
  return text;
}

function ServicePricingEditor({ lang, data, onChange }) {
  const intakeId = data.intake.id;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Hydrate draft from server values whenever we ENTER edit mode (or data changes outside edit)
  useEffect(() => {
    const sp = data.intake.service_pricing || {};
    const next = {};
    for (const group of Object.keys(SP_FIELDS)) {
      next[group] = {};
      for (const k of Object.keys(SP_FIELDS[group])) {
        next[group][k] = spDisplay(sp?.[group]?.[k]);
      }
    }
    setDraft(next);
  }, [data.intake.service_pricing, editing]);

  const dirty = useMemo(() => {
    const sp = data.intake.service_pricing || {};
    for (const group of Object.keys(SP_FIELDS)) {
      for (const k of Object.keys(SP_FIELDS[group])) {
        if ((draft?.[group]?.[k] || '') !== spDisplay(sp?.[group]?.[k])) return true;
      }
    }
    return false;
  }, [draft, data.intake.service_pricing]);

  useDirtyTracker('service-pricing', editing && dirty);
  useSaveAllListener(editing && dirty, () => save());

  const set = (group, key, val) => setDraft(d => ({ ...d, [group]: { ...(d[group] || {}), [key]: val } }));

  const Row = ({ label, group, k }) => {
    const cfg = SP_FIELDS[group][k];
    const text = draft?.[group]?.[k] || '';
    const display = spDisplay(data.intake.service_pricing?.[group]?.[k]);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, padding: editing ? '8px 0' : '6px 0', fontSize: 13, borderBottom: '1px solid var(--line-2)', alignItems: editing ? 'flex-start' : 'center' }}>
        <div style={{ color: 'var(--ink-3)', fontSize: 12, paddingTop: editing ? 6 : 0 }}>
          {label}
          {cfg.isList && editing && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2, fontStyle: 'italic' }}>{lang === 'zh' ? '多项用 · 或逗号分隔' : 'separate items with · or comma'}</div>}
        </div>
        {editing ? (
          <input value={text}
            onChange={e => set(group, k, e.target.value)}
            placeholder={cfg.isList ? (lang === 'zh' ? '例:SaaS · API · 私有化' : 'e.g. SaaS · API · private') : ''}
            style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', width: '100%' }} />
        ) : (
          <div style={{ color: 'var(--ink)' }}>{display || '—'}</div>
        )}
      </div>
    );
  };

  const save = async () => {
    if (!intakeId || intakeId === 'demo') { setEditing(false); return; }
    setBusy(true); setErr('');
    try {
      // Convert text drafts back into the storage shape
      const sp = { service: {}, pricing: {} };
      for (const group of Object.keys(SP_FIELDS)) {
        for (const k of Object.keys(SP_FIELDS[group])) {
          sp[group][k] = spParse(draft?.[group]?.[k] || '', SP_FIELDS[group][k].isList);
        }
      }
      await intakes.patch(intakeId, { service_pricing: sp });
      setEditing(false);
      onChange?.();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title={lang === 'zh' ? '服务与价格' : 'Service & Pricing'}
      icon="💰"
      editing={editing}
      onEdit={() => setEditing(true)}
      onSave={save}
      onCancel={() => { setEditing(false); setErr(''); }}
      dirty={dirty && !busy}
    >
      {err && <div style={{ marginBottom: 8, padding: 8, background: 'rgba(255,200,200,0.3)', borderRadius: 6, color: 'var(--st-empty-ink)', fontSize: 12 }}>⚠ {err}</div>}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', marginTop: 4, marginBottom: 4 }}>{lang === 'zh' ? '服务' : 'Service'}</div>
      {Object.entries(SP_FIELDS.service).map(([k, cfg]) => (
        <Row key={k} label={lang === 'zh' ? cfg.zh : cfg.en} group="service" k={k} />
      ))}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', marginTop: 14, marginBottom: 4 }}>{lang === 'zh' ? '价格' : 'Pricing'}</div>
      {Object.entries(SP_FIELDS.pricing).map(([k, cfg]) => (
        <Row key={k} label={lang === 'zh' ? cfg.zh : cfg.en} group="pricing" k={k} />
      ))}
    </SectionCard>
  );
}

// ─── Meeting Notes — paste + Save + history (no Copilot) ───────────────
function MeetingNotesV2({ lang, intakeId }) {
  const [history, setHistory] = useState(() => wbReadJson(wbKey('meeting_history', intakeId), []));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [text, setText] = useState('');

  const persist = (next) => { setHistory(next); wbWriteJson(wbKey('meeting_history', intakeId), next); };

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry = { id: 'mn_' + Date.now(), date, text: trimmed, saved_at: new Date().toISOString() };
    persist([entry, ...history]);
    setText('');
  };
  const remove = (id) => persist(history.filter(h => h.id !== id));

  return (
    <SectionCard
      title={lang === 'zh' ? '会议笔记' : 'Meeting Notes'}
      icon="📝"
      hint={lang === 'zh' ? '可保存多条历史记录' : 'save multiple entries'}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--ink-3)' }}>{lang === 'zh' ? '会议日期' : 'Date'}</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ fontSize: 13, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ink)' }} />
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder={lang === 'zh' ? '把会议要点、决策、待办粘贴在这里…' : 'Paste key points, decisions, action items…'}
        style={{ width: '100%', minHeight: 130, fontSize: 13, fontFamily: 'inherit', padding: 10, border: '1px solid var(--line)', borderRadius: 8, resize: 'vertical', lineHeight: 1.55, color: 'var(--ink)' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={save} disabled={!text.trim()}
          style={{ background: text.trim() ? 'var(--plat-curator)' : 'var(--ink-3)', color: 'white', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {lang === 'zh' ? '保存这条笔记' : 'Save note'}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {lang === 'zh' ? '历史会议笔记' : 'Past meeting notes'} ({history.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <div key={h.id} style={{ background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{h.date}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{new Date(h.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => remove(h.id)} title="delete"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>
                    <TrashIcon size={12} />
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{h.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Save indicator + manual Save (auto-save lives in each editor section) ───
// Snapshot helpers: on first workbench load we stash the supplier-original
// shape in localStorage. The Restore button replays it.
function origKey(intakeId) { return wbKey('original', intakeId); }
function ensureOriginalSnapshot(intakeId, data) {
  if (!intakeId || intakeId === 'demo') return;
  const k = origKey(intakeId);
  if (localStorage.getItem(k)) return;
  // Strip server timestamps and IDs that we won't restore; keep editable content.
  const snapshot = {
    intake: {
      name: data.intake?.name || '',
      industry_hint: data.intake?.industry_hint || '',
      website: data.intake?.website || '',
      free_text: data.intake?.free_text || '',
      service_pricing: data.intake?.service_pricing || {},
    },
    capabilities: (data.capabilities || []).map(c => ({
      id: c.id, rc_label: c.rc_label, name_zh: c.name_zh, name_en: c.name_en,
      description_zh: c.description_zh, description_en: c.description_en,
    })),
    rolepacks: (data.rolepacks || []).map(r => ({
      id: r.id, rp_label: r.rp_label, name_zh: r.name_zh, name_en: r.name_en,
      capability_ids: r.capability_ids || [],
      questionnaire: r.questionnaire || {},
    })),
  };
  try { localStorage.setItem(k, JSON.stringify(snapshot)); } catch {}
}

// Top-right toolbar: shows "unsaved changes" warning when any section is in
// edit mode AND dirty, plus a "Restore default" one-shot button. No auto-save:
// each section owns its own Save (inside the section card).
function WorkbenchTopBar({ lang, intakeId, dirtySections, onRefetch, getCurrentData }) {
  const [restoring, setRestoring] = useState(false);
  const [restoreErr, setRestoreErr] = useState('');
  const hasUnsaved = dirtySections.size > 0;

  // Browser-level guard so closing the tab / hitting back doesn't silently drop edits.
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  const restore = async () => {
    if (!intakeId || intakeId === 'demo') return;
    const raw = localStorage.getItem(origKey(intakeId));
    if (!raw) { setRestoreErr(lang === 'zh' ? '未找到原始快照' : 'no snapshot to restore'); return; }
    if (!confirm(lang === 'zh'
      ? '确定要恢复为能力伙伴最初提交的内容?所有策展人的修改将被覆盖。'
      : 'Restore the partner’s original submission? All curator edits will be overwritten.')) return;
    setRestoring(true); setRestoreErr('');
    try {
      const snap = JSON.parse(raw);
      await intakes.patch(intakeId, {
        name: snap.intake.name,
        industry_hint: snap.intake.industry_hint,
        website: snap.intake.website,
        free_text: snap.intake.free_text,
        service_pricing: snap.intake.service_pricing,
      });
      const cur = getCurrentData?.();
      const curCapIds = new Set((cur?.capabilities || []).map(c => c.id));
      for (const c of snap.capabilities || []) {
        if (!curCapIds.has(c.id)) continue;
        await intakes.patchCapability(intakeId, c.id, {
          rc_label: c.rc_label,
          name: { zh: c.name_zh || '', en: c.name_en || '' },
          description: { zh: c.description_zh || '', en: c.description_en || '' },
        });
      }
      const curRpIds = new Set((cur?.rolepacks || []).map(r => r.id));
      for (const r of snap.rolepacks || []) {
        if (!curRpIds.has(r.id)) continue;
        await intakes.patchRolepack(intakeId, r.id, {
          rp_label: r.rp_label,
          name: { zh: r.name_zh || '', en: r.name_en || '' },
          capability_ids: r.capability_ids,
          questionnaire: r.questionnaire,
        });
      }
      try { localStorage.removeItem(semKey(intakeId)); } catch {}
      await onRefetch?.();
    } catch (e) {
      setRestoreErr(String(e?.message || e));
    } finally { setRestoring(false); }
  };

  const [saving, setSaving] = useState(false);
  const saveAll = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Each editor section listens for this and saves itself if dirty.
      window.dispatchEvent(new CustomEvent('rm-save-all'));
      // Give save handlers a moment to commence; the await of any inflight
      // patches happens inside each editor.
      await new Promise(r => setTimeout(r, 800));
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {hasUnsaved && (
        <span style={{
          fontSize: 11.5, color: '#A85A00', fontWeight: 600,
          background: 'color-mix(in srgb, #C28800 14%, white)',
          border: '1px solid color-mix(in srgb, #C28800 35%, transparent)',
          borderRadius: 6, padding: '4px 10px',
        }}>
          ⚠ {lang === 'zh' ? '有未保存的修改' : 'Unsaved changes'}
        </span>
      )}
      {restoreErr && <span style={{ fontSize: 11, color: 'var(--st-empty-ink)' }}>⚠ {restoreErr}</span>}
      <button onClick={restore} disabled={restoring}
        title={lang === 'zh' ? '恢复为能力伙伴最初提交的内容' : "Restore the partner's original submission"}
        style={{
          background: 'transparent', color: 'var(--ink-2)',
          border: '1px solid var(--line)', borderRadius: 6,
          padding: '6px 12px', fontSize: 12, fontWeight: 500,
          cursor: restoring ? 'wait' : 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
        ↺ {restoring ? '…' : (lang === 'zh' ? '恢复初稿' : 'Restore default')}
      </button>
      <button onClick={saveAll} disabled={saving || !hasUnsaved}
        title={hasUnsaved
          ? (lang === 'zh' ? '保存所有打开编辑的节' : 'Save every section currently in edit mode')
          : (lang === 'zh' ? '没有未保存的修改' : 'Nothing to save')}
        style={{
          background: hasUnsaved ? 'var(--plat-curator)' : 'var(--ink-3)',
          color: 'white', border: 'none', borderRadius: 6,
          padding: '6px 14px', fontSize: 12, fontWeight: 600,
          cursor: saving || !hasUnsaved ? 'not-allowed' : 'pointer',
          opacity: saving || !hasUnsaved ? 0.65 : 1, fontFamily: 'inherit',
        }}>
        {saving ? '…' : (lang === 'zh' ? '全部保存' : 'Save all')}
      </button>
    </div>
  );
}

function PublishCTA({ lang, data }) {
  const rps = data.rolepacks || [];
  const unnamed = rps.filter(r => !(r.name_zh || '').trim() && !(r.name_en || '').trim());
  const canPublish = rps.length > 0 && unnamed.length === 0;
  return (
    <div style={{
      marginTop: 24, padding: 18,
      background: canPublish ? 'var(--plat-curator-tint)' : 'rgba(255,200,200,0.25)',
      border: '1px solid ' + (canPublish ? 'color-mix(in srgb, var(--plat-curator) 30%, transparent)' : 'rgba(220,80,80,0.4)'),
      borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-ink)' }}>
          {canPublish ? (lang === 'zh' ? '准备发布?' : 'Ready to publish?')
                      : (lang === 'zh' ? '还差一步:每个 RolePack 必须有名称' : 'One step left: every RolePack needs a name')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
          {canPublish
            ? (lang === 'zh' ? '下一页只是确认所有内容,然后发布到销售库。' : 'Next page is a final confirmation before publishing to the sales library.')
            : (lang === 'zh' ? `请先在岗位包标签页给以下未命名的岗位起名: ${unnamed.map(r => r.rp_label).join(', ')}` : `Name these RolePacks first: ${unnamed.map(r => r.rp_label).join(', ')}`)}
        </div>
      </div>
      <button
        disabled={!canPublish}
        onClick={() => { if (canPublish) window.location.assign(`/curators/publish/${data.intake.id}`); }}
        style={{
          background: canPublish ? 'var(--plat-curator)' : 'var(--ink-3)',
          color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px',
          fontSize: 13, fontWeight: 600, cursor: canPublish ? 'pointer' : 'not-allowed',
          opacity: canPublish ? 1 : 0.65, fontFamily: 'inherit',
        }}>
        {lang === 'zh' ? '前往发布 →' : 'Continue to publish →'}
      </button>
    </div>
  );
}

// ─── Original Submission section (legacy — replaced by editable sections) ───────
function OriginalSubmissionSection({ lang, data, applied, onOverride }) {
  const intakeId = data.intake.id;
  return (
    <section style={{
      background: 'white', border: '1px solid var(--line)', borderRadius: 12,
      padding: '18px 22px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>📥</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', letterSpacing: '-0.005em' }}>
          {lang === 'zh' ? '能力伙伴原始提交' : 'Original Submission'}
        </h2>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {lang === 'zh' ? '只读 · 编辑会标记为策展人覆盖,可一键恢复' : 'read-only · edits become curator overrides with one-click restore'}
        </span>
      </div>

      {/* Top-level intake fields */}
      <div style={{ display: 'grid', gap: 14 }}>
        <FieldBlock label={t('s7_field_industry', lang)}>
          <EditableSection lang={lang} intakeId={intakeId} sectionId="industry_hint"
            originalValue={data.intake.industry_hint || ''} onChange={onOverride} />
        </FieldBlock>
        {(data.intake.website || true) && (
          <FieldBlock label={t('s7_field_website', lang)}>
            <EditableSection lang={lang} intakeId={intakeId} sectionId="website"
              originalValue={data.intake.website || ''} onChange={onOverride} />
          </FieldBlock>
        )}
        <FieldBlock label={t('s7_field_freetext', lang)}>
          <EditableSection lang={lang} intakeId={intakeId} sectionId="free_text"
            originalValue={data.intake.free_text || ''} kind="multiline" onChange={onOverride} />
        </FieldBlock>
      </div>

      {/* Capabilities */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('s7_section_caps', lang)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {t('s7_section_caps_count', lang, { n: data.capabilities.length })} · {t('s7_section_caps_confirmed', lang, { n: data.capabilities.filter(c => c.confirmed).length })}
          </span>
        </div>
        {data.capabilities.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{t('s7_no_caps', lang)}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.capabilities.map(c => (
            <div key={c.id} id={'wb-field-' + c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--plat-curator)', fontWeight: 700, minWidth: 44 }}>{c.rc_label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</div>
                {(c.description_zh || c.description_en) && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.5 }}>
                    {lang === 'zh' ? (c.description_zh || c.description_en) : (c.description_en || c.description_zh)}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{c.confirmed ? '✓' : '?'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RolePacks (collapsed by default) */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('s7_section_rolepacks', lang)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {t('s7_section_rolepacks_count', lang, { n: data.rolepacks.length })}
          </span>
        </div>
        {data.rolepacks.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{t('s7_no_rolepacks', lang)}</div>}
        {data.rolepacks.map((r, idx) => (
          <RolepackFull key={r.id} r={r} idx={idx} lang={lang} caps={data.capabilities} />
        ))}
      </div>

      {/* Service & Pricing */}
      {data.intake.service_pricing && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {lang === 'zh' ? '服务与价格' : 'Service & Pricing'}
            </span>
          </div>
          <ServicePricingFull sp={data.intake.service_pricing} lang={lang} />
        </div>
      )}

      {/* Files */}
      {Array.isArray(data.files) && data.files.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {lang === 'zh' ? '材料文件' : 'Uploaded files'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{data.files.length}</span>
          </div>
          {data.files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{f.kind || 'file'}</span>
              <span style={{ fontWeight: 500 }}>{f.display_name || f.filename}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 11 }}>
                {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function WorkbenchForm({ lang, data, applied }) {
  // applied diffs override the original capability descriptions for visual demo.
  const overrideMap = useMemo(() => {
    const m = {};
    applied.forEach(d => { m[d.field] = d; });
    return m;
  }, [applied]);

  const hasOverride = (id) => !!overrideMap[id];
  const auditFor = (id) => overrideMap[id];

  return (
    <div className="workbench-form">
      {/* Basics */}
      <div className="wb-section">
        <div className="wb-section-head">
          <span className="title">{t('s7_section_basics', lang)}</span>
        </div>
        <div className="wb-section-body">
          <div className="wb-field" id={'wb-field-intake.industry_hint'}>
            <span className="lbl">{t('s7_field_industry', lang)}</span>
            <span className={'val' + (data.intake.industry_hint ? '' : ' empty')}>
              {hasOverride('intake.industry_hint')
                ? auditFor('intake.industry_hint').to
                : (data.intake.industry_hint || (lang === 'zh' ? '未填写' : 'not set'))}
            </span>
            {hasOverride('intake.industry_hint') ? (
              <span className="audit-chip call">{t('s7_audit_call', lang)} · {t('s7_audit_at', lang, { time: new Date(auditFor('intake.industry_hint').when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>
            ) : (
              <span className="audit-chip">{t('s7_audit_supplier', lang)}</span>
            )}
          </div>
          {data.intake.website && (
            <div className="wb-field">
              <span className="lbl">{t('s7_field_website', lang)}</span>
              <span className="val">{data.intake.website}</span>
              <span className="audit-chip">{t('s7_audit_supplier', lang)}</span>
            </div>
          )}
          {data.intake.free_text && (
            <div className="wb-field">
              <span className="lbl">{t('s7_field_freetext', lang)}</span>
              <span className="val" style={{ whiteSpace: 'pre-wrap' }}>{data.intake.free_text}</span>
              <span className="audit-chip">{t('s7_audit_supplier', lang)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div className="wb-section">
        <div className="wb-section-head">
          <span className="title">{t('s7_section_caps', lang)}</span>
          <span className="count">{t('s7_section_caps_count', lang, { n: data.capabilities.length })}</span>
          <span className="count">{t('s7_section_caps_confirmed', lang, { n: data.capabilities.filter(c => c.confirmed).length })}</span>
        </div>
        <div className="wb-section-body">
          {data.capabilities.length === 0 && <div className="wb-empty">{t('s7_no_caps', lang)}</div>}
          {data.capabilities.map(c => {
            const overridden = hasOverride(c.id);
            const desc = overridden ? auditFor(c.id).to
              : (lang === 'zh' ? c.description_zh : c.description_en) || (lang === 'zh' ? c.description_en : c.description_zh) || '';
            return (
              <div key={c.id} id={'wb-field-' + c.id} className={'cap-row' + (c.confirmed ? ' confirmed' : '')}>
                <span className="conf">{c.confirmed ? '✓' : '?'}</span>
                <span className="label">{c.rc_label}</span>
                <div>
                  <div className="name">{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</div>
                  {desc && <div className="desc">{desc}</div>}
                </div>
                <span className="source">
                  {overridden
                    ? t('s7_audit_call', lang)
                    : c.source === 'supplier' ? t('s7_cap_source_supplier', lang)
                    : c.source === 'curator' ? t('s7_cap_source_curator', lang)
                    : t('s7_cap_source_extracted', lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rolepacks — each expandable to reveal full questionnaire */}
      <div className="wb-section">
        <div className="wb-section-head">
          <span className="title">{t('s7_section_rolepacks', lang)}</span>
          <span className="count">{t('s7_section_rolepacks_count', lang, { n: data.rolepacks.length })}</span>
        </div>
        <div className="wb-section-body">
          {data.rolepacks.length === 0 && <div className="wb-empty">{t('s7_no_rolepacks', lang)}</div>}
          {data.rolepacks.map((r, idx) => (
            <RolepackFull key={r.id} r={r} idx={idx} lang={lang} caps={data.capabilities} />
          ))}
        </div>
      </div>

      {/* Service & Pricing — what the partner submitted in step 6 */}
      {data.intake.service_pricing && (
        <div className="wb-section">
          <div className="wb-section-head">
            <span className="title">{lang === 'zh' ? '服务与价格' : 'Service & Pricing'}</span>
          </div>
          <div className="wb-section-body">
            <ServicePricingFull sp={data.intake.service_pricing} lang={lang} />
          </div>
        </div>
      )}

      {/* Uploaded materials */}
      {Array.isArray(data.files) && data.files.length > 0 && (
        <div className="wb-section">
          <div className="wb-section-head">
            <span className="title">{lang === 'zh' ? '材料文件' : 'Uploaded files'}</span>
            <span className="count">{data.files.length}</span>
          </div>
          <div className="wb-section-body">
            {data.files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{f.kind || 'file'}</span>
                <span style={{ fontWeight: 500 }}>{f.display_name || f.filename}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{f.filename !== (f.display_name || f.filename) ? f.filename : ''}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 11 }}>
                  {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Full rolepack card with expandable questionnaire ───────────────────────

const QUESTIONNAIRE_SECTIONS = [
  { key: 'profile',       titleZh: '岗位画像',       titleEn: 'Role profile',
    fields: [
      { id: 'daily_activities',     zh: '日常工作内容',  en: 'Daily activities' },
      { id: 'decision_maker',       zh: '决策者',        en: 'Decision-maker' },
      { id: 'decision_priorities',  zh: '决策者关注点',  en: 'Their priorities' },
    ],
  },
  { key: 'pain',          titleZh: '痛点',           titleEn: 'Pain',
    fields: [
      { id: 'main_pain',         zh: '主要痛点',       en: 'Main pain' },
      { id: 'current_workflow',  zh: '现有处理方式',   en: 'Current workflow' },
      { id: 'quantified_value',  zh: '量化代价',       en: 'Quantified cost' },
    ],
  },
  { key: 'how_it_helps',  titleZh: '能力如何帮上忙', titleEn: 'How capabilities help',
    fields: [
      { id: 'workflow_integration', zh: '能力如何嵌入工作流', en: 'Workflow integration' },
      { id: 'outcomes',             zh: '上线后改变',         en: 'Outcomes' },
      { id: 'case_study',           zh: '客户案例',           en: 'Case study' },
    ],
  },
  { key: 'deployment',    titleZh: '部署',           titleEn: 'Deployment',
    fields: [
      { id: 'deployment_mode', zh: '部署方式',  en: 'Deployment mode' },
      { id: 'api_endpoint',    zh: 'API 接入',  en: 'API endpoint' },
    ],
  },
];

function fieldVal(q, section, field, lang) {
  const v = q?.[section]?.[field];
  if (!v) return '';
  const raw = lang === 'zh' ? v.value_zh : v.value_en;
  if (Array.isArray(raw)) return raw.join(' · ');
  return raw == null ? '' : String(raw);
}

function RolepackFull({ r, idx, lang, caps }) {
  const [open, setOpen] = useState(false);
  const ready = r.generated || r.status === 'published' || r.status === 'ready';
  const pillKey = r.status === 'published' ? 'published' : ready ? 'ready' : 'pending';
  const pillLabel = pillKey === 'published' ? t('s7_rolepack_published', lang)
    : pillKey === 'ready' ? t('s7_rolepack_ready', lang)
    : t('s7_rolepack_pending', lang);
  const linkedCapIds = r.capability_ids || [];
  const linkedCaps = (caps || []).filter(c => linkedCapIds.includes(c.id));
  const hasQ = r.questionnaire && Object.keys(r.questionnaire).length > 0;
  return (
    <div id={'wb-field-' + r.id} className="rp-card-wb" style={{ marginBottom: 12 }}>
      <div className="head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="label">{r.rp_label}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{lang === 'zh' ? `岗位 ${idx + 1}` : `Role ${idx + 1}`}</span>
        <span className="name">· {lang === 'zh' ? (r.name_zh || r.name_en) : (r.name_en || r.name_zh)}</span>
        <span className={'status-pill ' + pillKey}>{pillLabel}</span>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            marginLeft: 'auto', fontSize: 12, color: 'var(--plat-curator)',
            background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}>
          {open
            ? (lang === 'zh' ? '收起 ▴' : 'Collapse ▴')
            : (lang === 'zh' ? '查看完整问卷 ▾' : 'View full submission ▾')}
        </button>
      </div>
      <div className="meta-grid">
        <div><span className="lbl">{t('s7_rolepack_industry', lang)}</span>{joinSafe(r.industry, lang)}</div>
        <div><span className="lbl">{t('s7_rolepack_size', lang)}</span>{joinSafe(r.company_size, lang)}</div>
        <div><span className="lbl">{t('s7_rolepack_dept', lang)}</span>{deptLabel(r.department, lang)}</div>
        <div><span className="lbl">{t('s7_section_caps', lang)}</span>{t('s7_rolepack_caps_linked', lang, { n: linkedCapIds.length })}</div>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-2)' }}>
          {/* Linked capabilities by name */}
          {linkedCaps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {lang === 'zh' ? '使用的能力' : 'Linked capabilities'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {linkedCaps.map(c => (
                  <span key={c.id} style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 999,
                    background: 'color-mix(in srgb, var(--plat-curator) 12%, white)',
                    color: 'var(--plat-curator)',
                    border: '1px solid color-mix(in srgb, var(--plat-curator) 25%, transparent)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginRight: 4 }}>{c.rc_label}</span>
                    {lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Full questionnaire */}
          {hasQ ? (
            <div style={{ display: 'grid', gap: 14 }}>
              {QUESTIONNAIRE_SECTIONS.map(section => {
                const filledFields = section.fields.filter(f => fieldVal(r.questionnaire, section.key, f.id, lang).trim());
                if (filledFields.length === 0) return null;
                return (
                  <div key={section.key}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', marginBottom: 6 }}>
                      {lang === 'zh' ? section.titleZh : section.titleEn}
                    </div>
                    {filledFields.map(f => (
                      <div key={f.id} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>
                          {lang === 'zh' ? f.zh : f.en}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {fieldVal(r.questionnaire, section.key, f.id, lang)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
              {lang === 'zh' ? '能力伙伴尚未填写问卷' : 'Capability Partner has not filled the questionnaire yet'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Service & pricing read-only display for the curator workbench.
function ServicePricingFull({ sp, lang }) {
  const service = sp?.service || {};
  const pricing = sp?.pricing || {};
  const renderVal = (v) => {
    if (v == null) return '—';
    if (Array.isArray(v)) return v.length ? v.map(x => typeof x === 'string' ? (x.startsWith('custom:') ? x.slice(7) : x) : (x?.[lang] || x?.zh || x?.en || '')).join(' · ') : '—';
    if (typeof v === 'string') return v.startsWith('custom:') ? v.slice(7) : (v || '—');
    if (typeof v === 'object') return v[lang] || v.zh || v.en || JSON.stringify(v);
    return String(v);
  };
  const Row = ({ label, v }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--line-2)' }}>
      <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{label}</div>
      <div style={{ color: 'var(--ink)' }}>{renderVal(v)}</div>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', marginTop: 4, marginBottom: 6 }}>
        {lang === 'zh' ? '服务' : 'Service'}
      </div>
      <Row label={lang === 'zh' ? '演示偏好' : 'Demo preferences'} v={service.demo_mode} />
      <Row label={lang === 'zh' ? '销售配合' : 'Sales-assist'} v={service.sales_assist_level} />
      <Row label={lang === 'zh' ? '辐射区域' : 'Coverage'} v={service.sales_coverage_regions} />
      <Row label={lang === 'zh' ? '交付范围' : 'Delivery scope'} v={service.delivery_scope} />
      <Row label={lang === 'zh' ? '客服语言' : 'Support languages'} v={service.support_languages} />
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-ink)', marginTop: 14, marginBottom: 6 }}>
        {lang === 'zh' ? '价格' : 'Pricing'}
      </div>
      <Row label={lang === 'zh' ? '定价模式' : 'Pricing model'} v={pricing.pricing_model} />
      <Row label={lang === 'zh' ? '成本价' : 'Cost price'} v={pricing.cost_price} />
      <Row label={lang === 'zh' ? '建议零售价' : 'Suggested retail'} v={pricing.suggested_retail} />
      <Row label={lang === 'zh' ? '私有化起价' : 'Private deployment from'} v={pricing.custom_service_pricing} />
      <Row label={lang === 'zh' ? '定制服务费' : 'Custom service fee'} v={pricing.service_fee} />
    </div>
  );
}

// ─── Publish: confirm only (RP/RC rename happens in workbench) ─────────
export function ScreenPublish({ lang, setLang, goBack, onBackToQueue, onViewListing, onPublish, submissionId, curatorName, onLogout }) {
  // Backwards-compat: older callers passed a single `onPublish` for both
  // post-publish actions. New callers pass split `onBackToQueue` + `onViewListing`.
  const handleBackToQueue = onBackToQueue || onPublish;
  const handleViewListing = onViewListing || onPublish;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!submissionId || submissionId === 'demo') { setLoading(false); return; }
    let abort = false;
    (async () => {
      try {
        const d = await intakes.get(submissionId);
        if (!abort) setData(d);
      } catch (e) {
        if (!abort) setLoadErr(String(e?.message || e));
      } finally { if (!abort) setLoading(false); }
    })();
    return () => { abort = true; };
  }, [submissionId]);

  const rps = data?.rolepacks || [];
  const caps = data?.capabilities || [];
  const unnamedRPs = rps.filter(r => !(r.name_zh || '').trim() && !(r.name_en || '').trim());
  const canPublish = rps.length > 0 && unnamedRPs.length === 0;

  // Conflict modal state — when publish-all returns reason='label_conflict'
  // we open a modal with one input per conflicting label so the curator can
  // rename inline and retry without leaving the publish page.
  const [conflicts, setConflicts] = useState(null);
  const [renameDraft, setRenameDraft] = useState({});

  const submitPublish = async (extraRenames = {}) => {
    if (!canPublish) { setErr(lang === 'zh' ? '请先在工作台为所有 RolePack 命名' : 'Name all RolePacks in the workbench first'); return; }
    if (!submissionId || submissionId === 'demo') { setPublished(true); return; }
    setBusy(true); setErr('');
    try {
      // Apply semantic-code overlays from localStorage AND any conflict-modal
      // renames as final relabels at publish time.
      const sem = getSemMap(submissionId);
      const mergedRp = { ...(sem.rp || {}) };
      const mergedRc = { ...(sem.rc || {}) };
      for (const [id, label] of Object.entries(extraRenames.rp || {})) mergedRp[id] = label;
      for (const [id, label] of Object.entries(extraRenames.cap || {})) mergedRc[id] = label;
      const rp_renames = Object.entries(mergedRp)
        .filter(([id, label]) => id && label && rps.find(r => r.id === id) && rps.find(r => r.id === id).rp_label !== label)
        .map(([id, label]) => ({ id, label }));
      const cap_renames = Object.entries(mergedRc)
        .filter(([id, label]) => id && label && caps.find(c => c.id === id) && caps.find(c => c.id === id).rc_label !== label)
        .map(([id, label]) => ({ id, label }));
      const res = await curator.publishAll(submissionId, { rp_renames, cap_renames });
      if (res?.ok === false && res.reason === 'label_conflict') {
        // Surface conflicts; do NOT mark published.
        setConflicts(res.conflicts || { rp: [], cap: [] });
        setRenameDraft({});
        return;
      }
      // Clear the local phase override (set to 'review' when curator first
      // clicked into the workbench) so the curator inbox now picks up the
      // intake's NEW status='published' and shows the card in the 已发布 tab.
      // Without this, defaultPhaseFor never gets a chance — the cached
      // 'review' override pinned the intake in 审阅中 forever.
      try {
        const m = JSON.parse(localStorage.getItem('rm_phaseMap') || '{}');
        if (m[submissionId]) {
          delete m[submissionId];
          localStorage.setItem('rm_phaseMap', JSON.stringify(m));
        }
      } catch {}
      setPublished(true);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (published) {
    return (
      <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 10px', letterSpacing: '-0.01em' }}>{t('s8_published', lang)}</h2>
            <p style={{ color: 'var(--ink-2)', margin: '0 0 24px' }}>{t('s8_notified', lang)}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleBackToQueue}>{t('s8_back_queue', lang)}</button>
              <button className="btn btn-primary" onClick={handleViewListing}>{t('s8_view_listing', lang)}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={curatorName} onLogout={onLogout} />
      <ProcessStepper steps={getPlatformSteps('curator', lang)} currentScreen="wb_publish" />
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '12px 24px 60px' }}>
        <button onClick={goBack} style={{ background: 'transparent', border: 'none', color: 'var(--plat-curator)', cursor: 'pointer', fontSize: 13, marginBottom: 10, padding: 0, fontFamily: 'inherit' }}>
          ← {lang === 'zh' ? '返回审阅' : 'Back to review'}
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? '确认并发布' : 'Confirm and publish'}
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 13.5, margin: '0 0 18px' }}>
          {lang === 'zh' ? '审阅一下要发布的内容,确认无误后点击发布。' : 'Review what you\'re about to publish, then confirm.'}
        </p>

        {loading && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)' }}>
            <span className="rm-loading-dots" aria-live="polite">
              <span>{lang === 'zh' ? '加载中' : 'Loading'}</span>
              <span className="rm-dots"><i /><i /><i /></span>
            </span>
          </div>
        )}
        {loadErr && <div style={{ padding: 16, background: 'rgba(255,200,200,0.3)', borderRadius: 8, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {loadErr}</div>}

        {data && (
          <>
            {/* Final-summary card */}
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                {lang === 'zh' ? '即将发布' : 'About to publish'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', marginBottom: 4 }}>
                {data.intake.name || data.intake.id}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>
                {rps.length} RolePack{rps.length === 1 ? '' : 's'} · {caps.length} RoleCapability
              </div>
              {/* RolePacks list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rps.map(r => {
                  const name = lang === 'zh' ? (r.name_zh || r.name_en) : (r.name_en || r.name_zh);
                  const named = !!(r.name_zh || r.name_en);
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#2A6EA0', fontWeight: 700, minWidth: 70 }}>{r.rp_label}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, flex: 1 }}>{name || (lang === 'zh' ? '(未命名)' : '(unnamed)')}</span>
                      {!named && <span style={{ fontSize: 11, color: 'var(--st-empty-ink)' }}>● {lang === 'zh' ? '需命名' : 'needs name'}</span>}
                    </div>
                  );
                })}
              </div>
              {/* RoleCapabilities pills */}
              {caps.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {lang === 'zh' ? '能力' : 'Capabilities'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {caps.map(c => (
                      <span key={c.id} style={{
                        display: 'inline-flex', alignItems: 'baseline', gap: 4,
                        fontSize: 11.5, padding: '3px 9px', borderRadius: 999,
                        background: 'color-mix(in srgb, var(--plat-curator) 8%, white)',
                        border: '1px solid color-mix(in srgb, var(--plat-curator) 22%, transparent)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--plat-curator)', fontWeight: 700 }}>{c.rc_label}</span>
                        <span>{lang === 'zh' ? (c.name_zh || c.name_en) : (c.name_en || c.name_zh)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!canPublish && (
              <div style={{ padding: 14, background: 'rgba(255,200,200,0.25)', border: '1px solid rgba(220,80,80,0.4)', borderRadius: 10, marginBottom: 14, fontSize: 13, color: 'var(--st-empty-ink)' }}>
                ⚠ {lang === 'zh' ? `还有 ${unnamedRPs.length} 个 RolePack 未命名 — 请回到审阅页填写。` : `${unnamedRPs.length} RolePack${unnamedRPs.length === 1 ? '' : 's'} unnamed — please return to review and name them.`}
              </div>
            )}
          </>
        )}

        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 20px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('s8_will', lang)}</div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            <li>{t('s8_will1', lang)}</li>
            <li>{t('s8_will2', lang)}</li>
            <li>{t('s8_will3', lang)}</li>
          </ul>
        </div>

        {err && <div style={{ marginTop: 8, color: 'var(--st-empty-ink)', fontSize: 13 }}>⚠ {err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={goBack}
            style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('s8_cancel', lang)}
          </button>
          <button onClick={() => submitPublish()} disabled={busy || !canPublish}
            style={{
              background: !canPublish ? 'var(--ink-3)' : 'var(--plat-curator)',
              color: 'white', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700,
              cursor: busy || !canPublish ? 'not-allowed' : 'pointer', opacity: busy || !canPublish ? 0.7 : 1,
              fontFamily: 'inherit',
            }}>
            {busy
              ? <><span>{lang === 'zh' ? '正在发布' : 'Publishing'}</span><span className="rm-dots" style={{ marginLeft: 6 }}><i /><i /><i /></span></>
              : t('s8_confirm_pub', lang)}
          </button>
        </div>
      </div>
      {conflicts && (
        <LabelConflictModal
          lang={lang}
          conflicts={conflicts}
          rps={rps}
          caps={caps}
          renameDraft={renameDraft}
          setRenameDraft={setRenameDraft}
          busy={busy}
          onCancel={() => { setConflicts(null); setRenameDraft({}); }}
          onApplyAndRetry={() => {
            // Build extraRenames map from the inputs and re-call publish.
            const rpRen = {}, capRen = {};
            for (const c of conflicts.rp || []) {
              const v = (renameDraft['rp:' + c.id] || '').trim().toUpperCase();
              if (v && v !== c.label) rpRen[c.id] = v;
            }
            for (const c of conflicts.cap || []) {
              const v = (renameDraft['cap:' + c.id] || '').trim().toUpperCase();
              if (v && v !== c.label) capRen[c.id] = v;
            }
            setConflicts(null);
            submitPublish({ rp: rpRen, cap: capRen });
          }}
        />
      )}
    </div>
  );
}

// Modal shown when publish-all returns reason='label_conflict'. One row per
// conflicting label with: the offending label, who's using it (other product
// + supplier), and an input for the curator to type a new label inline. They
// can also choose "Replace" which submits a marker that asks the user to
// confirm overwriting the public catalog. Currently we only support rename;
// "replace" requires unpublishing the older one which is a separate flow.
function LabelConflictModal({ lang, conflicts, rps, caps, renameDraft, setRenameDraft, busy, onCancel, onApplyAndRetry }) {
  const rpRows = (conflicts.rp || []).map(c => {
    const rp = rps.find(r => r.id === c.id);
    return { ...c, name: rp ? (lang === 'zh' ? (rp.name_zh || rp.name_en) : (rp.name_en || rp.name_zh)) : '' };
  });
  const capRows = (conflicts.cap || []).map(c => {
    const cap = caps.find(x => x.id === c.id);
    return { ...c, name: cap ? (lang === 'zh' ? (cap.name_zh || cap.name_en) : (cap.name_en || cap.name_zh)) : '' };
  });
  const totalRows = rpRows.length + capRows.length;
  const allFilled = [...rpRows, ...capRows].every(r => {
    const v = (renameDraft[(r.label.startsWith('RP-') ? 'rp:' : 'cap:') + r.id] || '').trim().toUpperCase();
    return v && v !== r.label && /^(RP|RC)-[A-Z0-9]{1,5}$/.test(v);
  });
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,30,60,0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,30,60,0.32)',
      }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
            {lang === 'zh' ? '代码冲突' : 'Label conflict'}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy-ink)' }}>
            {lang === 'zh'
              ? `${totalRows} 个代码已被其它已发布岗位占用`
              : `${totalRows} label${totalRows === 1 ? '' : 's'} already used by other published items`}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.55 }}>
            {lang === 'zh'
              ? '为每个冲突代码输入新代码 (RP-XXX / RC-XXX,后缀 1–5 个大写字母数字),发布后这些代码将作为该岗位/能力的最终公开代码。'
              : 'Type a new label for each (RP-XXX / RC-XXX, 1–5 uppercase letters/digits in the suffix). The new label becomes the public-facing code once published.'}
          </p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px' }}>
          {rpRows.map((r, idx) => (
            <ConflictRow key={'rp-' + r.id} kind="rp" row={r} renameDraft={renameDraft} setRenameDraft={setRenameDraft} lang={lang} />
          ))}
          {capRows.map((r, idx) => (
            <ConflictRow key={'cap-' + r.id} kind="cap" row={r} renameDraft={renameDraft} setRenameDraft={setRenameDraft} lang={lang} />
          ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button className="btn btn-primary" onClick={onApplyAndRetry}
            disabled={busy || !allFilled}
            style={{ padding: '10px 18px', fontWeight: 600 }}>
            {busy
              ? <><span>{lang === 'zh' ? '正在发布' : 'Publishing'}</span><span className="rm-dots" style={{ marginLeft: 6 }}><i /><i /><i /></span></>
              : (lang === 'zh' ? '应用重命名并发布 →' : 'Apply rename & publish →')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConflictRow({ kind, row, renameDraft, setRenameDraft, lang }) {
  const key = (kind === 'rp' ? 'rp:' : 'cap:') + row.id;
  const value = renameDraft[key] || '';
  const valid = value.trim() === '' || /^(RP|RC)-[A-Z0-9]{1,5}$/.test(value.trim().toUpperCase());
  const same = value.trim().toUpperCase() === row.label;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          background: 'color-mix(in srgb, var(--st-empty-ink) 12%, white)',
          color: 'var(--st-empty-ink)', padding: '3px 8px', borderRadius: 4,
        }}>{row.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>{row.name}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {lang === 'zh' ? '已被以下已发布产品占用:' : 'Already used by:'}{' '}
          <strong>{row.conflictWith?.supplier || '—'}</strong>
          {row.conflictWith?.product && <> · {row.conflictWith.product}</>}
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => setRenameDraft(d => ({ ...d, [key]: e.target.value.toUpperCase() }))}
        placeholder={kind === 'rp' ? 'RP-XXX' : 'RC-XXX'}
        autoFocus={kind === 'rp' && Object.keys(renameDraft).length === 0}
        style={{
          width: '100%', padding: '9px 12px', fontSize: 14,
          fontFamily: 'var(--font-mono)', fontWeight: 600,
          border: '1px solid ' + (valid && !same ? 'var(--line)' : '#a02a2a'),
          borderRadius: 6, outline: 'none', boxSizing: 'border-box',
        }}
      />
      {!valid && (
        <div style={{ fontSize: 11, color: '#a02a2a', marginTop: 4 }}>
          {lang === 'zh' ? '格式: RP-XXX 或 RC-XXX (1–5 位大写字母数字)' : 'Format: RP-XXX or RC-XXX (1–5 uppercase alphanumeric)'}
        </div>
      )}
      {same && value && (
        <div style={{ fontSize: 11, color: '#a02a2a', marginTop: 4 }}>
          {lang === 'zh' ? '请输入与原代码不同的新代码' : 'Please enter a different label'}
        </div>
      )}
    </div>
  );
}
