// v2 Curator Inbox — list of submitted intakes with rolepacks awaiting review.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { CuratorHeader } from '../../chrome.jsx';
import { curator } from '../../api.js';

export function ScreenV2CuratorInbox({ lang, setLang, onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('submitted');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    curator.listIntakes(tab)
      .then(r => { if (!abort) setItems(r.items || []); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [tab]);

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CuratorHeader lang={lang} setLang={setLang} curatorName={user?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {lang === 'zh' ? '审阅队列' : 'Review Queue'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 24px' }}>
          {lang === 'zh'
            ? '查看供应商提交的岗位、销售素材,审阅后发布到销售库。'
            : 'Review supplier-submitted roles + sales materials, then publish to the sales library.'}
        </p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--line)' }}>
          {['submitted', 'published', 'all'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: 'transparent',
                color: tab === t ? 'var(--plat-curator)' : 'var(--ink-2)',
                border: 0,
                borderBottom: tab === t ? '2px solid var(--plat-curator)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab === t && '• '}
              {t === 'submitted' ? (lang === 'zh' ? '待审阅' : 'Pending') :
                t === 'published' ? (lang === 'zh' ? '已发布' : 'Published') :
                  (lang === 'zh' ? '全部' : 'All')}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'zh' ? '加载中…' : 'Loading…'}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-3)', background: 'white', border: '1px solid var(--line)', borderRadius: 12 }}>
            {lang === 'zh' ? '没有待审阅的提交。' : 'No submissions to review.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(it => (
              <button
                key={it.id}
                onClick={() => navigate(`/curator/intake/${it.id}`)}
                style={{
                  textAlign: 'left', padding: 18, background: 'white',
                  border: '1px solid var(--line)', borderRadius: 12,
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--plat-curator)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 4 }}>
                    {it.supplier_short_name || it.supplier_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {it.id} · {it.industry_hint || (lang === 'zh' ? '未指定行业' : 'No industry')} · {it.rolepack_ready}/{it.rolepack_count} {lang === 'zh' ? '岗位已生成' : 'roles ready'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                    background: it.status === 'submitted' ? 'var(--st-aireview-bg)' : it.status === 'published' ? 'var(--st-fill-bg)' : 'var(--bg)',
                    color: it.status === 'submitted' ? 'var(--st-aireview-ink)' : it.status === 'published' ? 'var(--st-fill-ink)' : 'var(--ink-3)',
                  }}>
                    {it.status === 'submitted' ? (lang === 'zh' ? '待审阅' : 'Pending') :
                      it.status === 'published' ? (lang === 'zh' ? '已发布' : 'Published') : it.status}
                  </span>
                  <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
