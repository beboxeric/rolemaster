// Hierarchical multi-select picker with search + custom entry.
// Items: { id, parent_id, name_zh, name_en }. Items with parent_id are leaves.
// Custom entries: items the supplier types themselves; saved by id 'custom:<value>'.

import { useState, useMemo, useRef, useEffect } from 'react';

export function HierarchicalPicker({
  items,
  selected,           // string[] — IDs
  onChange,
  lang,
  placeholder,
  multi = true,
  customLabel,        // string for "+ self type"
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);
  const [customText, setCustomText] = useState('');
  const ref = useRef(null);

  const cats = useMemo(() => items.filter(i => !i.parent_id), [items]);
  const subsByParent = useMemo(() => {
    const map = {};
    for (const i of items) {
      if (i.parent_id) (map[i.parent_id] = map[i.parent_id] || []).push(i);
    }
    return map;
  }, [items]);

  // Flat mode: there are no sub-items (every item is top-level). Render directly,
  // no category expansion. Used for company sizes, etc.
  const isFlat = useMemo(() => items.length > 0 && items.every(i => !i.parent_id), [items]);

  const allLeaves = useMemo(
    () => isFlat ? items : items.filter(i => i.parent_id),
    [isFlat, items],
  );
  const itemById = useMemo(() => {
    const m = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return allLeaves.filter(l =>
      (l.name_zh || '').toLowerCase().includes(q)
      || (l.name_en || '').toLowerCase().includes(q)
    );
  }, [search, allLeaves]);

  const toggle = (id) => {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    } else {
      onChange([id]);
      setOpen(false);
    }
  };

  const addCustom = () => {
    const v = customText.trim();
    if (!v) return;
    const id = 'custom:' + v;
    if (!selected.includes(id)) onChange(multi ? [...selected, id] : [id]);
    setCustomText('');
    if (!multi) setOpen(false);
  };

  // Strict-language label. If the active language is missing on this taxonomy
  // item, we still need to show something (the chip is a SELECTED value), but
  // we mark it as untranslated so the chip can be styled differently — never
  // silently mix English text into a Chinese UI.
  const labelFor = (id) => {
    if (id.startsWith('custom:')) return { text: id.slice(7), untranslated: false };
    const it = itemById[id];
    if (!it) return { text: id, untranslated: true };
    const want = lang === 'zh' ? it.name_zh : it.name_en;
    if (want && String(want).trim()) return { text: want, untranslated: false };
    const fallback = lang === 'zh' ? it.name_en : it.name_zh;
    return { text: fallback || id, untranslated: true };
  };

  const totalAvailable = allLeaves.length;
  const selectedCount = selected.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {selected.map(id => {
          const { text, untranslated } = labelFor(id);
          return (
            <span key={id} className="v2-chip v2-chip--active"
              title={untranslated
                ? (lang === 'zh' ? '此标签缺少中文翻译' : 'This tag has no English translation yet')
                : undefined}
              style={{
                cursor: 'default',
                opacity: disabled ? 0.85 : 1,
                fontStyle: untranslated ? 'italic' : 'normal',
                background: untranslated ? 'color-mix(in srgb, #f5b800 14%, transparent)' : undefined,
                color: untranslated ? '#7a4f00' : undefined,
                border: untranslated ? '1px solid color-mix(in srgb, #f5b800 35%, transparent)' : undefined,
              }}>
              {untranslated && (
                <span style={{ fontSize: 9, fontWeight: 700, marginRight: 2, opacity: 0.7 }}>
                  {lang === 'zh' ? '⚠ 待译' : '⚠ EN'}
                </span>
              )}
              {text}
              {!disabled && (
                <button onClick={() => onChange(selected.filter(x => x !== id))}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 2px', fontSize: 13, lineHeight: 1, opacity: 0.85 }}>×</button>
              )}
            </span>
          );
        })}
        {!disabled && (
          <button onClick={() => setOpen(!open)}
            style={{
              fontSize: 12, padding: '3px 9px', borderRadius: 999,
              background: 'white', color: 'var(--ink-2)',
              border: '1px dashed var(--line)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span>{placeholder}</span>
            {totalAvailable > 0 && multi && (
              <span style={{
                fontSize: 10, color: selectedCount > 0 ? 'var(--plat-supplier)' : 'var(--ink-3)',
                fontWeight: 600, fontFamily: 'var(--font-mono)',
              }}>{selectedCount}/{totalAvailable}</span>
            )}
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 30,
          background: 'white', border: '1px solid var(--line)', borderRadius: 10,
          minWidth: 320, maxWidth: 420, maxHeight: 360, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--line-2)' }}>
            <input autoFocus value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'zh' ? '搜索…' : 'Search…'}
              style={{
                width: '100%', padding: '6px 10px', fontSize: 12.5,
                border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
              }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
            {filtered ? (
              filtered.length === 0
                ? <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                    {lang === 'zh' ? '没有匹配项,可以在下方自定义。' : 'No matches — add custom below.'}
                  </div>
                : filtered.map(l => {
                    const parent = itemById[l.parent_id];
                    const checked = selected.includes(l.id);
                    const primary = lang === 'zh' ? l.name_zh : l.name_en;
                    const secondary = lang === 'zh' ? l.name_en : l.name_zh;
                    return (
                      <div key={l.id}
                        onClick={() => toggle(l.id)}
                        style={{
                          padding: '7px 10px', cursor: 'pointer', borderRadius: 6,
                          fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10,
                          background: checked ? 'var(--plat-supplier-tint)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                        <CheckboxBox checked={checked} />
                        <span>{primary}</span>
                        {secondary && secondary !== primary && (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>· {secondary}</span>
                        )}
                        {parent && <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>
                          {lang === 'zh' ? parent.name_zh : parent.name_en}
                        </span>}
                      </div>
                    );
                  })
            ) : isFlat ? (
              items.map(l => {
                const checked = selected.includes(l.id);
                return (
                  <div key={l.id}
                    onClick={() => toggle(l.id)}
                    style={{
                      padding: '7px 10px', cursor: 'pointer', borderRadius: 6,
                      fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10,
                      background: checked ? 'var(--plat-supplier-tint)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg)'; }}
                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                    <CheckboxBox checked={checked} />
                    <span>{lang === 'zh' ? l.name_zh : l.name_en}</span>
                  </div>
                );
              })
            ) : (
              cats.map(c => {
                const subs = subsByParent[c.id] || [];
                const isExpanded = expandedCat === c.id;
                const selectedInCat = subs.filter(s => selected.includes(s.id)).length;
                return (
                  <div key={c.id}>
                    <div
                      onClick={() => setExpandedCat(isExpanded ? null : c.id)}
                      style={{
                        padding: '7px 10px', cursor: 'pointer', borderRadius: 6,
                        fontSize: 12.5, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: isExpanded ? 'var(--bg)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg)'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--ink-3)', width: 10 }}>{isExpanded ? '▾' : '▸'}</span>
                        {lang === 'zh' ? c.name_zh : c.name_en}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                        {selectedInCat > 0 && <span style={{ color: 'var(--plat-supplier)', fontWeight: 700, marginRight: 6 }}>{selectedInCat}</span>}
                        {subs.length}
                      </span>
                    </div>
                    {isExpanded && subs.map(s => {
                      const checked = selected.includes(s.id);
                      return (
                        <div key={s.id}
                          onClick={() => toggle(s.id)}
                          style={{
                            padding: '6px 10px 6px 28px', cursor: 'pointer', borderRadius: 6,
                            fontSize: 12, display: 'flex', alignItems: 'center', gap: 10,
                            background: checked ? 'var(--plat-supplier-tint)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg)'; }}
                          onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}>
                          <CheckboxBox checked={checked} />
                          <span>{lang === 'zh' ? s.name_zh : s.name_en}</span>
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
              placeholder={customLabel || (lang === 'zh' ? '+ 自定义' : '+ Custom')}
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

// Visible checkbox-style indicator (16x16 box) used inside dropdown items so
// the user can see they are picking from a list of toggleable options.
function CheckboxBox({ checked }) {
  return (
    <span style={{
      width: 16, height: 16, flexShrink: 0,
      borderRadius: 4,
      border: checked ? '1.5px solid var(--plat-supplier)' : '1.5px solid var(--line)',
      background: checked ? 'var(--plat-supplier)' : 'white',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 0.12s, background 0.12s',
    }}>
      {checked && (
        <span style={{ color: 'white', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>
      )}
    </span>
  );
}

// Searchable + custom-input flat picker — used for sales-assist, sizes, etc.
export function SearchablePicker({
  items,            // [{ id, label_zh, label_en }] — single-level
  selected,         // single id, OR id starting with 'custom:'
  onChange,
  lang,
  placeholder,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customText, setCustomText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.label_zh || '').toLowerCase().includes(q)
      || (i.label_en || '').toLowerCase().includes(q));
  }, [search, items]);

  // Strict-language label. Returns { text, untranslated } so the button can
  // visually flag values that lack a translation in the active language
  // instead of silently showing the other language.
  const labelOf = (val) => {
    if (!val) return { text: '', untranslated: false };
    if (val.startsWith('custom:')) return { text: val.slice(7), untranslated: false };
    const it = items.find(i => i.id === val);
    if (!it) return { text: val, untranslated: true };
    const want = lang === 'zh' ? it.label_zh : it.label_en;
    if (want && String(want).trim()) return { text: want, untranslated: false };
    const fallback = lang === 'zh' ? it.label_en : it.label_zh;
    return { text: fallback || val, untranslated: true };
  };

  const pick = (id) => { onChange(id); setOpen(false); };
  const addCustom = () => {
    const v = customText.trim();
    if (!v) return;
    onChange('custom:' + v);
    setCustomText('');
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '8px 12px', fontSize: 13, textAlign: 'left',
          background: 'white', color: selected ? 'var(--ink)' : 'var(--ink-3)',
          border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>
          {selected ? (() => {
            const { text, untranslated } = labelOf(selected);
            return untranslated
              ? <span style={{ fontStyle: 'italic', color: '#7a4f00' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, marginRight: 4, opacity: 0.7 }}>
                    {lang === 'zh' ? '⚠ 待译' : '⚠ EN'}
                  </span>{text}
                </span>
              : text;
          })() : placeholder}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30,
          background: 'white', border: '1px solid var(--line)', borderRadius: 8,
          maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          <input autoFocus value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'zh' ? '搜索…' : 'Search…'}
            style={{
              padding: '8px 12px', fontSize: 12.5, border: 'none',
              borderBottom: '1px solid var(--line-2)', outline: 'none',
            }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                {lang === 'zh' ? '没有匹配项,可以在下方自定义。' : 'No matches — add custom below.'}
              </div>
            )}
            {filtered.map(i => (
              <div key={i.id}
                onClick={() => pick(i.id)}
                style={{
                  padding: '7px 12px', cursor: 'pointer', borderRadius: 6,
                  fontSize: 12.5, background: selected === i.id ? 'var(--plat-supplier-tint)' : 'transparent',
                }}
                onMouseEnter={e => { if (selected !== i.id) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (selected !== i.id) e.currentTarget.style.background = 'transparent'; }}>
                {lang === 'zh' ? (i.label_zh || i.label_en) : (i.label_en || i.label_zh)}
                {(i.label_zh && i.label_en) && (
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 6 }}>
                    {lang === 'zh' ? i.label_en : i.label_zh}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 6 }}>
            <input value={customText}
              onChange={e => setCustomText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder={lang === 'zh' ? '+ 自定义' : '+ Custom'}
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
