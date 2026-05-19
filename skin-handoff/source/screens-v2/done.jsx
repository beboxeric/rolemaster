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
        // Continue polling at a slower rate after all rolepacks are generated, so the
        // dashboard reflects when the curator publishes them. Stop polling once the
        // intake itself is fully published or after ~10 minutes of being on this page.
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

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '40px 24px 80px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16,
        }}>✓</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {lang === 'zh' ? `已收到 — ${rolepacks.length} 个岗位` : `Received — ${rolepacks.length} Roles`}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 28px', lineHeight: 1.6 }}>
          {lang === 'zh'
            ? '已提交进入审阅,审阅团队会在 1-3 个工作日内联系你。如需修改请联系 hello@rolemaster.io。'
            : 'Submitted for review. The review team will contact you within 1-3 business days. To make edits, email hello@rolemaster.io.'}
        </p>

        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 12 }}>
            {lang === 'zh' ? '岗位状态' : 'Role status'}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rolepacks.map(rp => {
              const isPublished = rp.status === 'published';
              // Supplier doesn't need to see AI internals — once submitted, just say "in review"
              // until the curator publishes.
              const stateColor = isPublished ? 'var(--st-fill-ink)' : 'var(--cop-border)';
              const stateBg = isPublished ? 'var(--st-fill-bg)' : 'var(--cop-bg)';
              const stateBorder = isPublished ? 'var(--st-fill-border)' : '#D8C9EC';
              const stateText = isPublished
                ? (lang === 'zh' ? '✓ 已发布' : '✓ Published')
                : (lang === 'zh' ? '✦ 已提交,审阅中' : '✦ Submitted, in review');
              return (
                <div key={rp.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  background: stateBg,
                  border: `1px solid ${stateBorder}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: stateColor, fontWeight: 700, minWidth: 50 }}>
                    {rp.rp_label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-ink)' }}>
                      {(lang === 'zh' ? rp.name_zh : rp.name_en) || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: stateColor, marginTop: 2 }}>
                      {stateText}
                    </div>
                  </div>
                  <button onClick={() => navigate(`/supplier/intake/${id}/role/${rp.id}/details`)}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      background: 'white', color: stateColor, border: `1px solid ${stateBorder}`,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {lang === 'zh' ? '查看 →' : 'View →'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>


        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => navigate('/supplier')} style={{ flex: 1, padding: '12px 18px', fontWeight: 600 }}>
            {lang === 'zh' ? '返回首页' : 'Back to home'}
          </button>
        </div>
      </div>
    </div>
  );
}
