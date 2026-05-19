// Public RolePack catalog at /rolepacks — visible without login. Lists every
// rolepack curators have published. Privacy: NO supplier company name and NO
// product name. Buyers see the FUNCTION (RP/RC labels, role name, industries,
// capabilities, pain it solves, value it delivers); the curator team controls
// who gets introduced when a buyer raises a hand.
//
// Aesthetic: reuses the landing-page .lr-* card classes so the catalogue sits
// visually inside the same marketing surface and scrolls in the same way.

import { useState, useEffect, useMemo } from 'react';
import { SiteHeader } from './landing/SiteHeader.jsx';
import { SiteFooter } from './landing/SiteFooter.jsx';
import { RcPopover } from './landing/RcPopover.jsx';
import { publicApi, taxonomy } from '../api.js';

export function ScreenRolepackCatalog({ lang, setLang }) {
  // Toggle the same root flag the landing uses so the marketing chrome takes
  // over (suppresses the platform stepper / themed background).
  useEffect(() => {
    document.documentElement.classList.add('lr-active');
    return () => document.documentElement.classList.remove('lr-active');
  }, []);

  const [items, setItems] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [filterInd, setFilterInd] = useState('all');
  // `search` is the live input value; `query` is the committed search the
  // filter actually uses. Decoupled so Chinese IME composition (pinyin →
  // candidate → commit) doesn't trigger spurious filters on partial input.
  // Submit via the search button or Enter key.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // Open RC popover — { cap, anchorEl } pair so the popover can position
  // itself next to the clicked chip. Click the same chip again to toggle.
  const [popover, setPopover] = useState(null);
  const handleRcClick = (cap, anchorEl) => {
    setPopover(prev => prev && prev.cap?.id === cap.id ? null : { cap, anchorEl });
  };
  const submitSearch = () => setQuery(search.trim());
  const clearSearch = () => { setSearch(''); setQuery(''); };

  useEffect(() => {
    let abort = false;
    Promise.all([
      publicApi.rolepacks().catch(e => { setErr(e.message); return { items: [] }; }),
      taxonomy.industries().catch(() => ({ items: [] })),
    ]).then(([rp, ind]) => {
      if (abort) return;
      setItems(rp.items || []);
      setIndustries(ind.items || []);
      setLoading(false);
    });
    return () => { abort = true; };
  }, []);

  const indById = useMemo(() => Object.fromEntries(industries.map(i => [i.id, i])), [industries]);
  const labelOf = (id) => {
    if (!id) return '';
    if (typeof id !== 'string') return String(id);
    if (id.startsWith('custom:')) return id.slice(7);
    const it = indById[id]; if (!it) return id;
    return lang === 'zh' ? (it.name_zh || it.name_en || id) : (it.name_en || it.name_zh || id);
  };

  // Build the industry filter list. The API buckets every rolepack's
  // industries onto top-level taxonomy categories (cat_finance, cat_tech,
  // cat_logistics …), so we filter the taxonomy down to its parent rows
  // (`!i.parent_id`) that actually appear on a published card.
  const usedIndustryIds = useMemo(() => {
    const used = new Set();
    items.forEach(it => (it.industry || []).forEach(i => used.add(i)));
    return used;
  }, [items]);
  const filterOptions = industries.filter(i => !i.parent_id && usedIndustryIds.has(i.id));

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(it => {
      if (filterInd !== 'all' && !(it.industry || []).includes(filterInd)) return false;
      if (q) {
        const hay = [
          it.name?.zh, it.name?.en, it.rp_label,
          (it.industry || []).map(i => labelOf(i)).join(' '),
          (it.capabilities || []).map(c => `${c.rc_label} ${c.name?.zh || ''} ${c.name?.en || ''}`).join(' '),
          it.pain?.zh, it.pain?.en, it.value?.zh, it.value?.en,
          (it.department?.zh || it.department?.en || ''),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterInd, query, indById, lang]);

  return (
    <div className="lr-root">
      <SiteHeader lang={lang} setLang={setLang} />
      <main>
        <section className="lr-section lr-catalog-section lr-rolepacks-page">
          <div className="lr-container">
            <div className="lr-section-head">
              <div className="lr-left lr-fade lr-in">
                <span className="lr-section-eyebrow">
                  {lang === 'zh' ? '公开目录' : 'Public catalogue'}
                </span>
                <h2 className="lr-section-title">
                  {lang === 'zh' ? '已发布的 RolePack' : 'Published RolePacks'}
                </h2>
                <p className="lr-section-lede">
                  {lang === 'zh'
                    ? '由策展团队审阅并发布的所有岗位包。每个包打包了一组能力,可以直接落地为企业里的某个岗位。'
                    : 'Every Role Pack the curator team has reviewed and published. Each pack bundles a set of capabilities into one role an enterprise can deploy.'}
                </p>
              </div>
            </div>

            {/* Sticky filter stack — chip-bar + search-form stay pinned at the
                top while the user scrolls through the catalogue, so they can
                always retarget the filter or fire a new search without
                scrolling back up. */}
            <div className="lr-filter-stack">
            <div className="lr-domain-nav" aria-label={lang === 'zh' ? '行业筛选' : 'Industry filter'}>
              <button onClick={() => setFilterInd('all')}
                className={'lr-domain-chip' + (filterInd === 'all' ? ' is-active' : '')}>
                {lang === 'zh' ? '全部' : 'All'}
                <span className="count">{items.length}</span>
              </button>
              {filterOptions.map(i => {
                const count = items.filter(it => (it.industry || []).includes(i.id)).length;
                const catKey = i.id.startsWith('cat_') ? i.id.slice(4) : i.id;
                return (
                  <button key={i.id} onClick={() => setFilterInd(i.id)}
                    data-cat={catKey}
                    className={'lr-domain-chip' + (filterInd === i.id ? ' is-active' : '')}>
                    {lang === 'zh' ? (i.name_zh || i.name_en) : (i.name_en || i.name_zh)}
                    <span className="count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="lr-rp-mobile-controls">
              <label className="lr-rp-mobile-filter">
                <span className="lr-rp-mobile-filter-label">
                  {lang === 'zh' ? '行业' : 'Industry'}
                </span>
                <select
                  value={filterInd}
                  onChange={e => setFilterInd(e.target.value)}
                  aria-label={lang === 'zh' ? '行业筛选' : 'Industry filter'}
                >
                  <option value="all">
                    {(lang === 'zh' ? '全部' : 'All')} ({items.length})
                  </option>
                  {filterOptions.map(i => {
                    const count = items.filter(it => (it.industry || []).includes(i.id)).length;
                    const name = lang === 'zh' ? (i.name_zh || i.name_en) : (i.name_en || i.name_zh);
                    return <option key={i.id} value={i.id}>{name} ({count})</option>;
                  })}
                </select>
              </label>
              <form className="lr-rp-search-form" onSubmit={e => { e.preventDefault(); submitSearch(); }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'zh' ? '搜索岗位、能力或痛点…' : 'Search role, capability, pain point…'}
                  className="lr-rp-search-input"
                  aria-label={lang === 'zh' ? '搜索' : 'Search'}
                />
                {query && (
                  <button type="button" className="lr-rp-search-clear" onClick={clearSearch}
                    aria-label={lang === 'zh' ? '清除搜索' : 'Clear search'}>
                    ✕
                  </button>
                )}
                <button type="submit" className="lr-rp-search-btn">
                  {lang === 'zh' ? '搜索' : 'Search'}
                </button>
              </form>
            </div>
            </div>

            {loading ? (
              <p style={{ color: 'var(--lr-ink-3)', textAlign: 'center', padding: 60 }}>
                {lang === 'zh' ? '加载中…' : 'Loading…'}
              </p>
            ) : err ? (
              <p style={{ color: '#a02a2a', textAlign: 'center', padding: 60 }}>⚠ {err}</p>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--lr-ink-3)' }}>
                <p style={{ fontSize: 16, marginBottom: 8 }}>
                  {lang === 'zh' ? '暂无符合的岗位包。' : 'No matching role packs yet.'}
                </p>
                <p style={{ fontSize: 13 }}>
                  {lang === 'zh' ? '换个筛选条件试试,或回到首页查看示例。' : 'Try a different filter or browse the showcase on the homepage.'}
                </p>
              </div>
            ) : (
              <div className="lr-catalog-grid">
                {filtered.map(rp => <PublicCard key={rp.id} rp={rp} lang={lang} labelOf={labelOf} query={query} onRcClick={handleRcClick} openCapId={popover?.cap?.id} />)}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
      <RcPopover cap={popover?.cap} anchor={popover?.anchorEl} lang={lang} onClose={() => setPopover(null)} />
    </div>
  );
}

function PublicCard({ rp, lang, labelOf, query, onRcClick, openCapId }) {
  const name = (lang === 'zh' ? rp.name?.zh : rp.name?.en) || rp.name?.en || rp.name?.zh || rp.rp_label;
  const dept = lang === 'zh' ? (rp.department?.zh || rp.department?.en) : (rp.department?.en || rp.department?.zh);
  const tags = (rp.industry || []).map(labelOf).filter(Boolean);
  const caps = rp.capabilities || [];
  const pain = lang === 'zh' ? rp.pain?.zh : rp.pain?.en;
  const value = lang === 'zh' ? rp.value?.zh : rp.value?.en;
  // First parent industry → light-shade class so each card carries its
  // primary domain colour. "All" filter shows a mix.
  const primaryInd = (rp.industry || []).find(i => typeof i === 'string') || 'cat_other';
  const catClass = primaryInd.startsWith('cat_') ? `cat-${primaryInd}` : 'cat-cat_other';
  // When a search query is active, search-match highlighting takes over from
  // the brand/number bolding (renderHighlighted) — the matches are what the
  // user wants to see, not generic emphasis.
  const renderBody = (text) => query ? highlightMatches(text, query) : renderHighlighted(text);
  return (
    <div className={`lr-rp-card lr-rp-card-public lr-rp-card-row ${catClass}`}>
      <div className="lr-rp-card-row__left">
        <div className="lr-rp-id-row">
          <span className="lr-rp-id">{highlightMatches(rp.rp_label, query)}</span>
          <span>· {lang === 'zh' ? '已发布' : 'Published'}</span>
        </div>
        <h3 style={{ margin: 0 }}>{highlightMatches(name, query)}</h3>
        {tags.length > 0 && (
          <div className="lr-rp-tags">
            {tags.map((tag, i) => (
              <span key={i} className="lr-rp-tag">{highlightMatches(tag, query)}</span>
            ))}
          </div>
        )}
        {/* Department lifted into its own row + class so it reads as a sub-
            category badge (squarer, dashed-divider above) instead of looking
            like a stray industry chip. */}
        <div className="lr-rp-subtags">
          <span className="lr-rp-subtag">
            {highlightMatches(dept || (lang === 'zh' ? '未指定部门' : 'Cross-functional'), query)}
          </span>
        </div>
      </div>

      <div className="lr-rp-card-row__right">
        {pain && (
          <div className="lr-rp-section lr-rp-section--pain">
            <span className="lr-rp-section__label">
              {lang === 'zh' ? '痛点' : 'Pain'}
            </span>
            <p className="lr-rp-section__body">{renderBody(pain)}</p>
          </div>
        )}
        {value && (
          <div className="lr-rp-section lr-rp-section--solution">
            <span className="lr-rp-section__label">
              {lang === 'zh' ? '解决方式' : 'How'}
            </span>
            <p className="lr-rp-section__body">{renderBody(value)}</p>
          </div>
        )}
        {caps.length > 0 && (
          <div className="lr-rp-caps">
            {caps.map((c) => {
              const nameZh = c.name?.zh || c.name?.en || '';
              const nameEn = c.name?.en || c.name?.zh || '';
              const descZh = c.description?.zh || c.description?.en || '';
              const descEn = c.description?.en || c.description?.zh || '';
              const isOpen = openCapId === c.id;
              return (
                <button key={c.id} type="button" className="lr-rp-cap"
                  data-cap-id={c.id}
                  data-name-zh={nameZh}
                  data-name-en={nameEn}
                  data-desc-zh={descZh}
                  data-desc-en={descEn}
                  aria-expanded={isOpen}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRcClick && onRcClick(c, e.currentTarget); }}
                  title={lang === 'zh' ? '查看能力详情' : 'View capability details'}>
                  <span className="lr-rp-cap__id">{highlightMatches(c.rc_label, query)}</span>
                  {nameZh && <span className="lr-rp-cap__name lr-cap-name-zh">{highlightMatches(nameZh, query)}</span>}
                  {nameEn && <span className="lr-rp-cap__name lr-cap-name-en">{highlightMatches(nameEn, query)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap every case-insensitive occurrence of `query` in `text` with a <mark>
// element. Used everywhere the search query could appear so users see
// exactly which words triggered a match. Returns the original text untouched
// when there's no query or no match.
function highlightMatches(text, query) {
  if (!text) return text;
  if (!query) return text;
  const t = String(text);
  const tl = t.toLowerCase();
  const ql = String(query).toLowerCase();
  if (!tl.includes(ql)) return t;
  const out = [];
  let i = 0;
  let key = 0;
  while (i < t.length) {
    const idx = tl.indexOf(ql, i);
    if (idx < 0) { out.push(t.slice(i)); break; }
    if (idx > i) out.push(t.slice(i, idx));
    out.push(<mark key={`m${key++}`} className="lr-search-hi">{t.slice(idx, idx + ql.length)}</mark>);
    i = idx + ql.length;
  }
  return <>{out.map((p, j) => typeof p === 'string' ? <span key={`s${j}`}>{p}</span> : p)}</>;
}

// Render pain/value text with key terms emphasised so cards stop reading as
// flat grey prose. Two passes:
//   1. **double-asterisk** spans → <strong> (Markdown-style; use this in
//      AI-prefilled pain/value going forward — newer prompts wrap 2-3
//      keywords this way).
//   2. Common product/tech brands (WhatsApp, WeChat, Excel, Zoom, …) and
//      number-with-unit chunks (200+, 5–7 个, 18 分钟) get bolded by regex
//      so existing pre-bolded data still gets visual emphasis.
const BRAND_REGEX = /\b(WhatsApp|WeChat|Zoom|Teams|Excel|Word|PPT|PDF|RAG|API|OCR|KYC|AML|EDD|STR|Aselo|Slack|Notion|SharePoint|SOP|FAQ|SKU|VPN|SAS|Actimize)\b/g;
const NUM_UNIT_REGEX = /(\d+\+?(?:\s*[—–-]\s*\d+)?\s*[%个时秒]?(?:分钟|小时|天|周|月|年|min|hrs?|hours?|days?|weeks?|months?)?)/g;

function renderHighlighted(text) {
  if (!text) return null;
  // Split on **bold** spans first.
  const segments = String(text).split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (/^\*\*[^*]+\*\*$/.test(seg)) {
      return <strong key={i} style={{ color: 'var(--lr-ink-2)' }}>{seg.slice(2, -2)}</strong>;
    }
    // Within plain segments, regex-highlight brand + number tokens.
    return <Highlights key={i} text={seg} />;
  });
}

function Highlights({ text }) {
  if (!text) return null;
  // Run brand regex first, then number regex on the remaining literal pieces.
  const out = [];
  let last = 0; let key = 0;
  const matches = [];
  for (const re of [BRAND_REGEX, NUM_UNIT_REGEX]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] && m[0].trim()) matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  // Sort and de-overlap.
  matches.sort((a, b) => a.start - b.start);
  const clean = [];
  for (const m of matches) {
    if (clean.length && m.start < clean[clean.length - 1].end) continue;
    clean.push(m);
  }
  for (const m of clean) {
    if (m.start > last) out.push(text.slice(last, m.start));
    out.push(<strong key={key++} style={{ color: 'var(--lr-ink-2)', fontWeight: 600 }}>{m.text}</strong>);
    last = m.end;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
