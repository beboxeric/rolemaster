// v2 Sales Library — list of published rolepacks, with detail view.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { PlatformHeader } from '../../chrome.jsx';
import { sales } from '../../api.js';

function SalesHeader({ lang, setLang, onLogout }) {
  const right = onLogout && (
    <button onClick={onLogout} style={{
      padding: '6px 12px', fontSize: 12, fontWeight: 600,
      background: 'transparent', color: 'var(--ink-2)',
      border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer',
    }}>{lang === 'zh' ? '退出' : 'Sign out'}</button>
  );
  return <PlatformHeader platform="sales" lang={lang} setLang={setLang} right={right} />;
}

export function ScreenV2SalesLibrary({ lang, setLang, onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let abort = false;
    sales.listRolepacks()
      .then(r => { if (!abort) setItems(r.items || []); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, []);

  const filtered = filter
    ? items.filter(it => {
        const q = filter.toLowerCase();
        return (it.name?.zh || '').toLowerCase().includes(q)
          || (it.name?.en || '').toLowerCase().includes(q)
          || (it.supplier?.name || '').toLowerCase().includes(q)
          || (it.industry || []).join(',').toLowerCase().includes(q);
      })
    : items;

  return (
    <div className="screen-anim platform-sales" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SalesHeader lang={lang} setLang={setLang} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {lang === 'zh' ? '销售素材库' : 'Sales Library'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 24px' }}>
          {lang === 'zh'
            ? '已发布的岗位包,包含一句话介绍、电梯演讲、FAQ 与演示大纲。'
            : 'Published role packs with elevator pitches, FAQs, pitch outlines.'}
        </p>

        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={lang === 'zh' ? '按岗位、行业、供应商搜索…' : 'Search by role, industry, supplier…'}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 14,
            border: '1px solid var(--line)', borderRadius: 10, background: 'white',
            marginBottom: 20,
          }}
        />

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)', background: 'white', border: '1px solid var(--line)', borderRadius: 12 }}>
            {lang === 'zh' ? '暂无已发布的岗位。' : 'No published roles yet.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(it => (
              <button
                key={it.id}
                onClick={() => navigate(`/sales/rolepack/${it.id}`)}
                style={{
                  textAlign: 'left', padding: 18, background: 'white',
                  border: '1px solid var(--line)', borderRadius: 12, cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--plat-sales)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--plat-sales)', fontWeight: 700 }}>{it.rp_label}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-ink)' }}>
                    {(lang === 'zh' ? it.name?.zh : it.name?.en) || '—'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {it.supplier?.short_name || it.supplier?.name} · {(it.industry || []).join(', ')} · {it.department?.[lang === 'zh' ? 'zh' : 'en'] || it.department?.en}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScreenV2SalesRolepack({ lang, setLang, onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { rpId } = useParams();
  const [rp, setRp] = useState(null);

  useEffect(() => {
    sales.getRolepack(rpId).then(setRp).catch(() => setRp({ error: true }));
  }, [rpId]);

  if (!rp) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (rp.error) return <div style={{ padding: 40, textAlign: 'center' }}>Not found.</div>;
  const gen = rp.generated;
  const mat = rp.materials;

  return (
    <div className="screen-anim platform-sales" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SalesHeader lang={lang} setLang={setLang} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '24px 24px 80px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <button onClick={() => navigate('/sales')} style={{ background: 'transparent', border: 0, color: 'var(--ink-2)', fontSize: 12, marginBottom: 16, cursor: 'pointer' }}>
          ← {lang === 'zh' ? '返回素材库' : 'Back to library'}
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--plat-sales)', fontWeight: 700 }}>{rp.rp_label}</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>
            {(lang === 'zh' ? rp.name?.zh : rp.name?.en) || '—'}
          </h1>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20 }}>
          {rp.supplier?.short_name || rp.supplier?.name} · {(rp.industry || []).join(', ')}
        </div>

        {gen?.one_liner && (
          <div style={{ background: 'var(--plat-sales-tint)', border: '1px solid var(--plat-sales)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--plat-sales)', textTransform: 'uppercase', marginBottom: 8 }}>{lang === 'zh' ? '一句话' : 'One-liner'}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--navy-ink)' }}>{lang === 'zh' ? gen.one_liner.zh : gen.one_liner.en}</div>
          </div>
        )}

        {gen && [
          ['customer_voice_pain', lang === 'zh' ? '客户痛点' : 'Customer pain'],
          ['value_positioning', lang === 'zh' ? '价值定位' : 'Value positioning'],
          ['capability_summary', lang === 'zh' ? '能力概述' : 'Capability summary'],
        ].map(([key, title]) => gen[key] && (
          <SectionCard key={key} title={title}>
            <pre style={{ margin: 0, fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>
              {lang === 'zh' ? gen[key].zh : gen[key].en}
            </pre>
          </SectionCard>
        ))}

        {mat?.elevator_pitch_zh && (
          <SectionCard title={lang === 'zh' ? '电梯演讲' : 'Elevator pitch'}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{lang === 'zh' ? mat.elevator_pitch_zh : mat.elevator_pitch_en}</p>
          </SectionCard>
        )}
        {mat?.faq && (
          <SectionCard title={lang === 'zh' ? '常见问题' : 'FAQ'}>
            <div style={{ display: 'grid', gap: 14 }}>
              {mat.faq.map((qa, i) => (
                <div key={i}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Q: {lang === 'zh' ? qa.q?.zh : qa.q?.en}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>A: {lang === 'zh' ? qa.a?.zh : qa.a?.en}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {mat?.pitch_outline && (
          <SectionCard title={lang === 'zh' ? '演示大纲' : 'Pitch outline'}>
            <div style={{ display: 'grid', gap: 14 }}>
              {mat.pitch_outline.map((slide, i) => (
                <div key={i}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{i + 1}. {lang === 'zh' ? slide.title?.zh : slide.title?.en}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-2)' }}>
                    {(lang === 'zh' ? slide.bullets?.zh : slide.bullets?.en)?.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {mat?.discovery_questions && (
          <SectionCard title={lang === 'zh' ? '探索性问题' : 'Discovery questions'}>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
              {mat.discovery_questions.map((q, i) => <li key={i}>{lang === 'zh' ? q.zh : q.en}</li>)}
            </ol>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
