// Landing-page hero catalogue. Pulls the curator-starred subset of published
// RolePacks and renders simplified cards (ID, name, industry tags, dept,
// brief one-liner). Full details + pain/how text live on /rolepacks; the
// hero teaser keeps the home page tight.
//
// Layout: industry chip-bar (auto-rotates) → grid of starred RP cards →
// single CTA button "查看完整公开目录 →" (no purple gradient panel).

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi, taxonomy } from '../../api.js';

export function Catalog({ lang }) {
  const [items, setItems] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [filterInd, setFilterInd] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    Promise.all([
      publicApi.featuredRolepacks().catch(() => ({ items: [] })),
      taxonomy.industries().catch(() => ({ items: [] })),
    ]).then(([fp, ind]) => {
      if (abort) return;
      setItems(fp.items || []);
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

  // Industry chips show the BIG parent categories (cat_finance, cat_tech …)
  // — the API already buckets every rolepack's industries to parent ids, so
  // we just collect the distinct parents that actually appear in the data.
  const usedIndustryIds = useMemo(() => {
    const used = new Set();
    items.forEach(it => (it.industry || []).forEach(i => used.add(i)));
    return used;
  }, [items]);
  // !i.parent_id filters down to top-level categories only.
  const filterOptions = industries.filter(i => !i.parent_id && usedIndustryIds.has(i.id));

  // Hero shows up to 6 cards. The full catalogue at /rolepacks lists every
  // published pack; the hero is just a teaser.
  const HERO_LIMIT = 6;
  const filtered = useMemo(() => {
    const base = filterInd === 'all'
      ? items
      : items.filter(it => (it.industry || []).includes(filterInd));
    return base.slice(0, HERO_LIMIT);
  }, [items, filterInd]);

  return (
    <section className="lr-section lr-catalog-section" id="catalog">
      <div className="lr-container">
        {/* Industry chip-bar (filter) — replaces the section eyebrow/title/lede.
            Mirrors the chip-bar on /rolepacks. */}
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

        {loading ? (
          <p style={{ color: 'var(--lr-ink-3)', textAlign: 'center', padding: 60 }}>
            {lang === 'zh' ? '加载中…' : 'Loading…'}
          </p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--lr-ink-3)' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              {lang === 'zh' ? '尚未精选任何岗位包。' : 'No featured Role Packs yet.'}
            </p>
            <p style={{ fontSize: 13 }}>
              {lang === 'zh'
                ? '策展团队挑选精选岗位后会出现在这里。'
                : 'Curator-starred packs surface here once selected.'}
            </p>
          </div>
        ) : (
          <div className="lr-catalog-grid">
            {filtered.map(rp => <FeaturedCardSimple key={rp.id} rp={rp} lang={lang} labelOf={labelOf} />)}
          </div>
        )}

        {/* Single CTA button — no purple gradient panel, no extra paragraph. */}
        <div style={{ textAlign: 'center', margin: '36px 0 0' }}>
          <Link to="/rolepacks" className="lr-btn lr-btn-primary lr-btn-lg" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            minHeight: 50, padding: '14px 28px',
            fontSize: 15, fontWeight: 700,
            boxShadow: '0 6px 18px rgba(79,70,229,0.30)',
          }}>
            {lang === 'zh' ? '查看完整公开目录 →' : 'View complete catalogue →'}
          </Link>
        </div>
      </div>
    </section>
  );
}

// Simplified hero card — RP id, name, big-category industry tags, and 3–5
// short bullets listing what the role CAN DO (capability names, no RC
// labels, no pain text). Detailed pain/how/outcomes + capability codes live
// on the /rolepacks catalogue.
function FeaturedCardSimple({ rp, lang, labelOf }) {
  const name = (lang === 'zh' ? rp.name?.zh : rp.name?.en) || rp.name?.en || rp.name?.zh || rp.rp_label;
  const dept = lang === 'zh' ? (rp.department?.zh || rp.department?.en) : (rp.department?.en || rp.department?.zh);
  const tags = (rp.industry || []).map(labelOf).filter(Boolean);

  // Bullets = capability names. No RC code, no pain — just "what they can
  // do". Hard cap at 5 lines TOTAL (including the "+ N more" line if shown).
  const HERO_LIMIT = 5;
  const caps = rp.capabilities || [];
  const allBullets = caps
    .map(c => (lang === 'zh' ? c.name?.zh : c.name?.en) || c.name?.en || c.name?.zh || '')
    .filter(Boolean);
  const showExtra = allBullets.length > HERO_LIMIT;
  const bullets = showExtra ? allBullets.slice(0, HERO_LIMIT - 1) : allBullets;
  const extraCount = showExtra ? allBullets.length - bullets.length : 0;
  // First parent industry → card-shade class (cat-cat_finance, etc.) so the
  // grid gets a colour mix in the "All" view.
  const primaryInd = (rp.industry || []).find(i => typeof i === 'string') || 'cat_other';
  const catClass = primaryInd.startsWith('cat_') ? `cat-${primaryInd}` : 'cat-cat_other';

  return (
    <Link to="/rolepacks" className={`lr-rp-card lr-rp-card-public lr-rp-card-simple ${catClass}`}>
      <div className="lr-rp-id-row">
        <span className="lr-rp-id">{rp.rp_label}</span>
        <span>· {lang === 'zh' ? '已发布' : 'Published'}</span>
      </div>
      <h3>{name}</h3>
      {/* Big-category industry tags directly below the title. */}
      <div className="lr-rp-tags" aria-label={lang === 'zh' ? '行业标签' : 'Industry tags'}>
        {tags.length > 0 ? (
          tags.map((tag, i) => (
            <span key={i} className="lr-rp-tag">{tag}</span>
          ))
        ) : (
          <span className="lr-rp-tag" style={{ opacity: 0.55, fontStyle: 'italic' }}>
            {lang === 'zh' ? '未指定行业' : 'Industry TBD'}
          </span>
        )}
      </div>
      {/* What the role can do — up to 5 capability names, no RC codes. */}
      {bullets.length > 0 && (
        <ul className="lr-rp-caps">
          {bullets.map((text, i) => <li key={i}>{text}</li>)}
          {extraCount > 0 && (
            <li style={{ color: 'var(--lr-ink-3)', fontStyle: 'italic' }}>
              {lang === 'zh' ? `+ 还有 ${extraCount} 项能力` : `+ ${extraCount} more`}
            </li>
          )}
        </ul>
      )}
      <div className="lr-rp-foot" style={{ marginTop: 'auto' }}>
        <span className="lr-rp-tag">{dept || (lang === 'zh' ? '未指定部门' : 'Cross-functional')}</span>
        <span className="lr-more" style={{ marginLeft: 'auto' }}>
          {lang === 'zh' ? '查看详情 →' : 'View details →'}
        </span>
      </div>
    </Link>
  );
}
