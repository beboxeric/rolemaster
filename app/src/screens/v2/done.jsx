// v2 Done — submitted intake. Shows per-role status + finalize progress.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes } from '../../api.js';

export function ScreenV2Done({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [det, setDet] = useState(null);

  useEffect(() => {
    let abort = false;
    let timer = null;
    const triggered = new Set();
    const tick = async () => {
      try {
        const d = await intakes.get(id);
        if (abort) return;
        setDet(d);
        for (const rp of d.rolepacks || []) {
          if (!rp.generated_json && !triggered.has(rp.id)) {
            triggered.add(rp.id);
            intakes.generateRolepack(id, rp.id).catch(() => {});
          }
        }
        const generating = (d.rolepacks || []).some(r => !r.generated_json);
        const allPublished = (d.rolepacks || []).length > 0 && (d.rolepacks || []).every(r => r.status === 'published');
        if (generating) timer = setTimeout(tick, 5000);
        else if (!allPublished) timer = setTimeout(tick, 30000);
      } catch {}
    };
    tick();
    return () => { abort = true; if (timer) clearTimeout(timer); };
  }, [id]);

  const rolepacks = det?.rolepacks || [];
  const publishedCount = rolepacks.filter(r => r.status === 'published').length;
  const reviewCount = rolepacks.length - publishedCount;
  const allPublished = rolepacks.length > 0 && publishedCount === rolepacks.length;

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div className="v2-page">
        <div className="v2-eyebrow">✓ {lang === 'zh' ? '已提交' : 'Submitted'}</div>
        <div className="v2-title-row">
          <h1 className="v2-display">
            {lang === 'zh' ? `已收到 — ${rolepacks.length} 个岗位` : `Received — ${rolepacks.length} Roles`}
          </h1>
          {allPublished
            ? <span className="v2-status-pill v2-status-pill--ok">✓ {lang === 'zh' ? '全部已发布' : 'All published'}</span>
            : <span className="v2-status-pill v2-status-pill--review">✦ {lang === 'zh' ? '审阅中' : 'In review'}</span>}
        </div>
        <p className="v2-lede" style={{ maxWidth: 'none' }}>
          {lang === 'zh'
            ? '已提交进入审阅,审阅团队会在 1-3 个工作日内联系你。如需修改请联系 hello@rolemaster.io。'
            : 'Submitted for review. The review team will contact you within 1-3 business days. To make edits, email hello@rolemaster.io.'}
        </p>

        <div style={{ marginTop: 8 }}>
          <div className="v2-section__head--actions" style={{ marginBottom: 14, padding: '0 4px' }}>
            <div className="v2-section__head-left">
              <h2 className="v2-h2--sm">{lang === 'zh' ? '岗位状态' : 'Role status'}</h2>
              <span className="v2-meta">
                {reviewCount > 0 && (lang === 'zh' ? `${reviewCount} 审阅中` : `${reviewCount} in review`)}
                {reviewCount > 0 && publishedCount > 0 && ' · '}
                {publishedCount > 0 && (lang === 'zh' ? `${publishedCount} 已发布` : `${publishedCount} published`)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {rolepacks.map((rp, idx) => {
              const isPublished = rp.status === 'published';
              return (
                <div key={rp.id} className="v2-input-card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Code stack */}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 56, gap: 1, flexShrink: 0 }}>
                      <span className="v2-code-label">{rp.rp_label}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
                        {lang === 'zh' ? `岗位 ${idx + 1}` : `Role ${idx + 1}`}
                      </span>
                    </div>
                    {/* Name + inline small status pill + meta below */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy-ink)' }}>
                          {(lang === 'zh' ? rp.name_zh : rp.name_en) || '—'}
                        </span>
                        {isPublished
                          ? <span className="v2-status-pill v2-status-pill--ok" style={{ fontSize: 10, padding: '2px 7px' }}>✓ {lang === 'zh' ? '已发布' : 'Published'}</span>
                          : <span className="v2-status-pill v2-status-pill--review" style={{ fontSize: 10, padding: '2px 7px' }}>✦ {lang === 'zh' ? '审阅中' : 'In review'}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {isPublished
                          ? (lang === 'zh' ? '已上架销售库' : 'Live in catalog')
                          : (lang === 'zh' ? '已提交,等待审阅' : 'Submitted, awaiting review')}
                      </div>
                    </div>
                    {/* View-full link on the right */}
                    <button onClick={() => navigate(`/partners/intake/${id}/role/${rp.id}/details`)}
                      style={{
                        fontSize: 12.5, color: 'var(--plat-supplier)', fontWeight: 600,
                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                      {lang === 'zh' ? '查看完整 →' : 'View full →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="v2-cluster" style={{ marginTop: 28 }}>
          <div className="v2-grow"></div>
          <button className="btn btn-primary" onClick={() => navigate('/partners')} style={{ padding: '10px 18px', fontWeight: 600 }}>
            {lang === 'zh' ? '返回主页' : 'Back to home'}
          </button>
        </div>
      </div>
    </div>
  );
}
