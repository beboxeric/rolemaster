// Curator portal — Published RolePack Library.
//
// Layout: each card has a compact sticky header (RP id + name + edit/delete/
// star) and a scrollable body below (industry tags, pain, how, capability
// pills, dept). Cards are draggable — drop reorders the grid and persists
// the new order to rolepacks_v2.library_order, which both this page and the
// public catalogue ORDER BY.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../chrome.jsx';
import { RcPopover } from './landing/RcPopover.jsx';
import { curator, taxonomy, intakes } from '../api.js';

export function ScreenCuratorLibrary({ lang, setLang, user, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [filterInd, setFilterInd] = useState('all');
  const [filterFeatured, setFilterFeatured] = useState('all'); // all | featured | not
  // Search uses explicit submit (button + Enter) like /rolepacks so Chinese
   // IME composition doesn't trigger spurious filters during pinyin typing.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const submitSearch = () => setQuery(search.trim());
  const clearSearch = () => { setSearch(''); setQuery(''); };
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  // Drag-drop state — index of dragged card + index it's currently hovering.
  const [dragId, setDragId] = useState(null);
  const [dropAfterId, setDropAfterId] = useState(null);
  // Inline industry edit — editingIndustriesId is the RP currently in edit
  // mode; editingIndustriesValues is the in-progress checkbox selection.
  // Only one card can be in edit mode at a time.
  const [editingIndustriesId, setEditingIndustriesId] = useState(null);
  const [editingIndustriesValues, setEditingIndustriesValues] = useState(new Set());
  // Open RC popover — { cap, anchorEl } for chip-anchored positioning.
  // Click the same chip again to close.
  const [popover, setPopover] = useState(null);
  const handleRcClick = (cap, anchorEl) => {
    setPopover(prev => prev && prev.cap?.id === cap.id ? null : { cap, anchorEl });
  };

  useEffect(() => {
    document.documentElement.classList.add('curator-inbox-page');
    return () => document.documentElement.classList.remove('curator-inbox-page');
  }, []);

  const refetch = () => {
    setLoading(true);
    Promise.all([
      curator.listPublishedRolepacks().catch(e => { setErr(String(e?.message || e)); return { items: [] }; }),
      taxonomy.industries().catch(() => ({ items: [] })),
    ]).then(([rp, ind]) => {
      setItems(rp.items || []);
      setIndustries(ind.items || []);
      setLoading(false);
    });
  };
  useEffect(refetch, []);

  const indById = useMemo(() => Object.fromEntries(industries.map(i => [i.id, i])), [industries]);
  const labelOf = (id) => {
    if (!id) return '';
    if (typeof id !== 'string') return String(id);
    if (id.startsWith('custom:')) return id.slice(7);
    const it = indById[id]; if (!it) return id;
    return lang === 'zh' ? (it.name_zh || it.name_en || id) : (it.name_en || it.name_zh || id);
  };

  const usedIndustryIds = useMemo(() => {
    const used = new Set();
    items.forEach(it => (it.industry || []).forEach(i => used.add(i)));
    return used;
  }, [items]);
  // Big parent categories only (the API buckets every industry up).
  const filterOptions = industries.filter(i => !i.parent_id && usedIndustryIds.has(i.id));

  const featuredCount = useMemo(() => items.filter(rp => rp.is_featured).length, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(it => {
      if (filterInd !== 'all' && !(it.industry || []).includes(filterInd)) return false;
      if (filterFeatured === 'featured' && !it.is_featured) return false;
      if (filterFeatured === 'not' && it.is_featured) return false;
      if (q) {
        const hay = [
          it.name?.zh, it.name?.en, it.rp_label,
          (it.industry || []).map(i => labelOf(i)).join(' '),
          (it.capabilities || []).map(c => `${c.rc_label} ${c.name?.zh || ''} ${c.name?.en || ''}`).join(' '),
          it.pain?.zh, it.pain?.en, it.value?.zh, it.value?.en,
          it.supplier_name, it.supplier_short_name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterInd, filterFeatured, query, indById, lang]);

  // Drag is only meaningful when no filter / search is active — partial views
  // would let the curator move card B "after" card A while card C is hidden,
  // producing surprising final orders. Lock drag to the unfiltered view.
  const dragEnabled = filterInd === 'all' && filterFeatured === 'all' && !query;

  // Optimistic toggle so the star UI feels instant; revert on API failure.
  const toggleStar = async (rp) => {
    if (busyId) return;
    setBusyId(rp.id);
    const next = !rp.is_featured;
    setItems(prev => prev.map(it => it.id === rp.id ? { ...it, is_featured: next } : it));
    try {
      await curator.toggleRolepackFeature(rp.id, next);
    } catch (e) {
      setItems(prev => prev.map(it => it.id === rp.id ? { ...it, is_featured: !next } : it));
      alert(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  const editRolepack = async (rp) => {
    if (busyId) return;
    const ok = confirm(lang === 'zh'
      ? `编辑「${rp.name?.zh || rp.name?.en || rp.rp_label}」会先把它从公开目录撤下,跳转到工作台修改后重新发布。继续吗?`
      : `Editing "${rp.name?.en || rp.name?.zh || rp.rp_label}" will pull it back from the public catalogue and jump to the workbench. Re-publish when you're done. Continue?`);
    if (!ok) return;
    setBusyId(rp.id);
    try {
      await curator.unpublishRolepack(rp.id);
      navigate(`/curators/intake/${rp.intake_id}`);
    } catch (e) {
      alert(String(e?.message || e));
      setBusyId(null);
    }
  };

  // Industry inline edit — start: open editor for this card, pre-populated
   // with whatever cat_* values are currently on the rolepack (filtered to
   // canonical parents; legacy custom:xxx values are dropped from the
   // initial selection so the curator can deliberately re-pick).
  const startEditIndustries = (rp) => {
    if (busyId) return;
    const current = (rp.industry || []).filter(v => typeof v === 'string' && v.startsWith('cat_'));
    setEditingIndustriesValues(new Set(current));
    setEditingIndustriesId(rp.id);
  };
  const toggleEditIndustryValue = (catId) => {
    setEditingIndustriesValues(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };
  const cancelEditIndustries = () => {
    setEditingIndustriesId(null);
    setEditingIndustriesValues(new Set());
  };
  const saveEditIndustries = async (rp) => {
    if (busyId) return;
    // Sort by canonical taxonomy display_order (cat_finance: 10, cat_tech:
    // 20, … cat_other: 999) so the saved array always matches the order
    // shown in the chip-bar/filters/edit panel — independent of the user's
    // click order. Falls back to the user's checkbox set if industries
    // hasn't loaded for some reason.
    const orderedParents = (industries || []).filter(i => !i.parent_id);
    const sorted = orderedParents.length
      ? orderedParents.filter(c => editingIndustriesValues.has(c.id)).map(c => c.id)
      : [...editingIndustriesValues];
    setBusyId(rp.id);
    setItems(prev => prev.map(it => it.id === rp.id ? { ...it, industry: sorted } : it));
    cancelEditIndustries();
    try {
      await curator.updateRolepackIndustries(rp.id, sorted);
    } catch (e) {
      alert(String(e?.message || e));
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  const deleteRolepack = async (rp) => {
    if (busyId) return;
    const ok = confirm(lang === 'zh'
      ? `永久删除「${rp.name?.zh || rp.name?.en || rp.rp_label}」?能力链接也会一并删除,无法撤销。`
      : `Permanently delete "${rp.name?.en || rp.name?.zh || rp.rp_label}"? Capability links will be removed too. Cannot be undone.`);
    if (!ok) return;
    setBusyId(rp.id);
    setItems(prev => prev.filter(it => it.id !== rp.id));
    try {
      await intakes.deleteRolepack(rp.intake_id, rp.id);
    } catch (e) {
      alert(String(e?.message || e));
      refetch();
    } finally {
      setBusyId(null);
    }
  };

  // Drag-drop handlers ---------------------------------------------------
  const onDragStart = (e, id) => {
    if (!dragEnabled) { e.preventDefault(); return; }
    setDragId(id);
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); } catch {}
  };
  const onDragOver = (e, id) => {
    if (!dragEnabled || !dragId) return;
    e.preventDefault();
    if (id !== dropAfterId) setDropAfterId(id);
  };
  const onDragEnd = () => { setDragId(null); setDropAfterId(null); };
  const onDrop = async (e, targetId) => {
    if (!dragEnabled || !dragId) return;
    e.preventDefault();
    if (dragId === targetId) { onDragEnd(); return; }
    // Reorder client-side first (optimistic), then persist.
    const ids = items.map(it => it.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const next = items.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItems(next);
    onDragEnd();
    try {
      await curator.reorderRolepacks(next.map(it => it.id));
      // Server groups cards by parent industry; refetch so a cross-industry
      // drag reflects the actual grouped order instead of the flat optimistic
      // one. Within-industry drags look the same before and after.
      refetch();
    } catch (e2) {
      alert(String(e2?.message || e2));
      refetch();
    }
  };

  return (
    <div className="screen-anim platform-curator v2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} platform="curator" userName={user?.name} onLogout={onLogout} />
      <div className="curator-inbox v2-curator-inbox" style={{ flex: 1, paddingBottom: 60 }}>
        <div>
          <button onClick={() => navigate('/curators')}
            style={{ background: 'transparent', border: 'none', color: 'var(--plat-curator)', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0, fontFamily: 'inherit' }}>
            ← {lang === 'zh' ? '返回收件箱' : 'Back to inbox'}
          </button>
          <div className="v2-eyebrow">{lang === 'zh' ? '策展人门户 · 公开目录管理' : 'Curator portal · Public catalogue'}</div>
          <div className="v2-title-row" style={{ marginBottom: 6 }}>
            <h1 className="v2-display">{lang === 'zh' ? '已发布 RolePack 库' : 'Published RolePack Library'}</h1>
            <span className="v2-status-pill v2-status-pill--review">
              ✦ {items.length} {lang === 'zh' ? '个' : 'packs'} · ★ {featuredCount} {lang === 'zh' ? '已精选' : 'featured'}
            </span>
          </div>
          <p className="v2-lede" style={{ maxWidth: 'none', marginBottom: 16 }}>
            {lang === 'zh'
              ? '所有已发布的岗位包都会出现在公开目录 /rolepacks。点击右上角的 ★ 把岗位包额外精选到首页 hero 目录。拖拽卡片可调整顺序(需先清除筛选)。'
              : 'Every published RolePack appears in the public catalogue at /rolepacks. Tap the ★ to feature it in the landing hero. Drag a card to reorder (clear filters first).'}
          </p>

          {/* Sticky filter stack — chip-bar + featured pill + search-form
              all stay pinned at the top so the curator can refilter or
              search without scrolling back up the long card list. */}
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

          <div className="curator-filter-row">
            <div className="curator-featured-pill">
              {[
                { id: 'all',      zh: '全部',     en: 'All' },
                { id: 'featured', zh: '★ 已精选', en: '★ Featured' },
                { id: 'not',      zh: '未精选',   en: 'Not featured' },
              ].map(o => (
                <button key={o.id} onClick={() => setFilterFeatured(o.id)}
                  className={'curator-featured-pill__btn' + (filterFeatured === o.id ? ' is-active' : '')}>
                  {lang === 'zh' ? o.zh : o.en}
                </button>
              ))}
            </div>
            <form className="lr-rp-search-form" onSubmit={e => { e.preventDefault(); submitSearch(); }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'zh' ? '搜索岗位、能力或能力伙伴…' : 'Search role, capability, partner…'}
                className="lr-rp-search-input"
                aria-label={lang === 'zh' ? '搜索' : 'Search'} />
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

          {err && <div style={{ padding: 16, background: 'rgba(255,200,200,0.3)', borderRadius: 8, color: 'var(--st-empty-ink)', fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}
          {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, background: 'white', border: '1px dashed var(--line)', borderRadius: 14, color: 'var(--ink-3)' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                {lang === 'zh' ? '没有符合条件的岗位包。' : 'No matching role packs.'}
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="lr-catalog-grid">
              {filtered.map(rp => (
                <CuratorCard key={rp.id} rp={rp} lang={lang} labelOf={labelOf}
                  onToggleStar={() => toggleStar(rp)}
                  onEdit={() => editRolepack(rp)}
                  onDelete={() => deleteRolepack(rp)}
                  busy={busyId === rp.id}
                  draggable={dragEnabled}
                  isDragging={dragId === rp.id}
                  isDropTarget={dropAfterId === rp.id && dragId !== rp.id}
                  onDragStart={(e) => onDragStart(e, rp.id)}
                  onDragOver={(e) => onDragOver(e, rp.id)}
                  onDragEnd={onDragEnd}
                  onDrop={(e) => onDrop(e, rp.id)}
                  parentCats={industries.filter(i => !i.parent_id)}
                  isEditingIndustries={editingIndustriesId === rp.id}
                  editingIndustriesValues={editingIndustriesValues}
                  onStartEditIndustries={() => startEditIndustries(rp)}
                  onToggleEditIndustryValue={toggleEditIndustryValue}
                  onSaveEditIndustries={() => saveEditIndustries(rp)}
                  onCancelEditIndustries={cancelEditIndustries}
                  onRcClick={handleRcClick}
                  openCapId={popover?.cap?.id} />
              ))}
            </div>
          )}
        </div>
      </div>
      <RcPopover cap={popover?.cap} anchor={popover?.anchorEl} lang={lang} onClose={() => setPopover(null)} />
    </div>
  );
}

function CuratorCard({
  rp, lang, labelOf, onToggleStar, onEdit, onDelete, busy,
  draggable, isDragging, isDropTarget,
  onDragStart, onDragOver, onDragEnd, onDrop,
  parentCats, isEditingIndustries, editingIndustriesValues,
  onStartEditIndustries, onToggleEditIndustryValue,
  onSaveEditIndustries, onCancelEditIndustries,
  onRcClick, openCapId,
}) {
  const name = (lang === 'zh' ? rp.name?.zh : rp.name?.en) || rp.name?.en || rp.name?.zh || rp.rp_label;
  const dept = lang === 'zh' ? (rp.department?.zh || rp.department?.en) : (rp.department?.en || rp.department?.zh);
  const tags = (rp.industry || []).map(labelOf).filter(Boolean);
  const caps = rp.capabilities || [];
  const pain = lang === 'zh' ? rp.pain?.zh : rp.pain?.en;
  const value = lang === 'zh' ? rp.value?.zh : rp.value?.en;
  const supplier = rp.supplier_short_name || rp.supplier_name || '';

  return (
    <div className="lr-rp-card lib-card"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{
        opacity: isDragging ? 0.4 : 1,
        outline: isDropTarget ? '2px solid var(--plat-curator)' : 'none',
        outlineOffset: isDropTarget ? '2px' : 0,
        cursor: draggable ? 'grab' : 'default',
      }}
    >
      {/* COMPACT STICKY HEADER — RP id + name + edit/delete/star.
          Always visible; the body below scrolls independently when its
          content exceeds the card height. */}
      <div className="lib-card-head">
        <div className="lib-card-head-left">
          <div className="lr-rp-id-row" style={{ marginBottom: 2 }}>
            <span className="lr-rp-id">{rp.rp_label}</span>
            <span>· {lang === 'zh' ? '已发布' : 'Published'}</span>
            {supplier && <span style={{ fontSize: 10.5, color: 'var(--lr-ink-3)', fontWeight: 500 }}>· {supplier}</span>}
          </div>
          <h3 className="lib-card-title">{name}</h3>
        </div>
        <div className="lib-card-actions">
          <button type="button" disabled={busy}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
            title={lang === 'zh' ? '撤下并跳转到工作台编辑' : 'Pull back & open workbench'}
            className="lib-icon-btn">
            ✎
          </button>
          <button type="button" disabled={busy}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            title={lang === 'zh' ? '永久删除' : 'Permanently delete'}
            className="lib-icon-btn lib-icon-btn--danger">
            ✕
          </button>
          <button type="button" disabled={busy}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStar(); }}
            title={rp.is_featured
              ? (lang === 'zh' ? '已精选 — 显示在首页' : 'Featured on landing')
              : (lang === 'zh' ? '点击精选到首页' : 'Tap to feature on landing')}
            aria-pressed={!!rp.is_featured}
            className={'lib-icon-btn lib-icon-btn--star' + (rp.is_featured ? ' is-on' : '')}>
            {rp.is_featured ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* SCROLLABLE BODY — everything else lives here */}
      <div className="lib-card-body">
        {isEditingIndustries ? (
          <div className="lib-industries-edit" onClick={(e) => e.stopPropagation()}>
            <div className="lib-industries-edit__head">
              {lang === 'zh' ? '编辑行业' : 'Edit industries'}
              <span className="lib-industries-edit__hint">
                {lang === 'zh' ? '从主目录选 — 与 /rolepacks 一致' : 'pick from main taxonomy — matches /rolepacks'}
              </span>
            </div>
            <div className="lib-industries-edit__list">
              {(parentCats || []).map(cat => {
                const checked = editingIndustriesValues.has(cat.id);
                return (
                  <label key={cat.id} className={'lib-industries-edit__item' + (checked ? ' is-checked' : '')}>
                    <input type="checkbox" checked={checked}
                      onChange={() => onToggleEditIndustryValue(cat.id)} />
                    <span>{lang === 'zh' ? (cat.name_zh || cat.name_en) : (cat.name_en || cat.name_zh)}</span>
                  </label>
                );
              })}
            </div>
            <div className="lib-industries-edit__foot">
              <button type="button" className="lib-edit-btn lib-edit-btn--ghost"
                onClick={onCancelEditIndustries} disabled={busy}>
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button type="button" className="lib-edit-btn lib-edit-btn--primary"
                onClick={onSaveEditIndustries} disabled={busy}>
                {lang === 'zh' ? '保存' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
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
            <button type="button" className="lr-rp-tag lib-tag-edit-btn"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartEditIndustries(); }}
              disabled={busy}
              title={lang === 'zh' ? '从主目录编辑行业' : 'Edit industries from main taxonomy'}>
              ✎ {lang === 'zh' ? '编辑' : 'Edit'}
            </button>
          </div>
        )}
        {pain && (
          <div style={{ fontSize: 12.5, color: 'var(--lr-ink-3)', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: 'var(--lr-ink-2)' }}>
              {lang === 'zh' ? '痛点 · ' : 'Pain · '}
            </span>{pain}
          </div>
        )}
        {value && (
          <div style={{ fontSize: 12.5, color: 'var(--lr-ink-3)', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: 'var(--lr-ink-2)' }}>
              {lang === 'zh' ? '解决方式 · ' : 'How · '}
            </span>{value}
          </div>
        )}
        {caps.length > 0 && (
          <div className="lib-card-caps">
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
                  <span className="lr-rp-cap__id">{c.rc_label}</span>
                  {nameZh && <span className="lr-rp-cap__name lr-cap-name-zh">{nameZh}</span>}
                  {nameEn && <span className="lr-rp-cap__name lr-cap-name-en">{nameEn}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER — dept + featured indicator (always visible, below body) */}
      <div className="lib-card-foot">
        <span className="lr-rp-tag">{dept || (lang === 'zh' ? '未指定部门' : 'Cross-functional')}</span>
        {rp.is_featured && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#D9A100', letterSpacing: '0.04em' }}>
            ★ {lang === 'zh' ? '已精选 · 首页' : 'Featured · landing'}
          </span>
        )}
      </div>
    </div>
  );
}
