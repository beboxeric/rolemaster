// v2 Curator Review — open one intake, browse its rolepacks, publish each.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { CuratorHeader } from '../../chrome.jsx';
import { intakes, curator } from '../../api.js';

export function ScreenV2CuratorReview({ lang, setLang, onLogout }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [det, setDet] = useState(null);
  const [activeRp, setActiveRp] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    let abort = false;
    intakes.get(id).then(d => {
      if (abort) return;
      setDet(d);
      if (d.rolepacks?.length) setActiveRp(d.rolepacks[0].id);
    });
    return () => { abort = true; };
  }, [id]);

  async function publish(rpId) {
    setPublishing(rpId);
    try {
      await curator.publishRolepack(rpId);
      const d = await intakes.get(id);
      setDet(d);
    } finally { setPublishing(null); }
  }

  async function publishAll() {
    if (!det) return;
    const readyCount = (det.rolepacks || []).filter(r => r.generated_json && r.status !== 'published').length;
    if (readyCount === 0) return;
    if (!confirm(lang === 'zh'
      ? `一次发布全部 ${readyCount} 个就绪岗位到销售库?`
      : `Publish all ${readyCount} ready role${readyCount === 1 ? '' : 's'} to the sales library?`)) return;
    setPublishingAll(true);
    setBulkResult(null);
    try {
      const r = await curator.publishAll(id);
      setBulkResult(r);
      const d = await intakes.get(id);
      setDet(d);
    } catch (e) {
      alert(e.message);
    } finally { setPublishingAll(false); }
  }

  if (!det) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  const rp = det.rolepacks.find(r => r.id === activeRp);
  const gen = rp?.generated_json ? JSON.parse(rp.generated_json) : null;
  const mat = rp?.materials_draft_json ? JSON.parse(rp.materials_draft_json) : null;

  return (
    <div className="screen-anim platform-curator" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CuratorHeader lang={lang} setLang={setLang} curatorName={user?.name} onLogout={onLogout} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 280, borderRight: '1px solid var(--line)', background: 'white', overflowY: 'auto', padding: 18 }}>
          <button onClick={() => navigate('/curator')} style={{ background: 'transparent', border: 0, color: 'var(--ink-2)', fontSize: 12, marginBottom: 16, cursor: 'pointer' }}>
            ← {lang === 'zh' ? '返回队列' : 'Back to queue'}
          </button>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>{det.intake.id}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
            {det.intake.industry_hint} · {(det.rolepacks || []).length} {lang === 'zh' ? '个岗位' : 'roles'}
          </div>

          {(() => {
            const ready = (det.rolepacks || []).filter(r => r.generated_json && r.status !== 'published');
            const total = (det.rolepacks || []).length;
            const publishedCount = (det.rolepacks || []).filter(r => r.status === 'published').length;
            if (total === 0) return null;
            if (ready.length === 0 && publishedCount === total) {
              return (
                <div style={{
                  padding: '8px 10px', marginBottom: 14, borderRadius: 8, fontSize: 11.5,
                  background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
                  border: '1px solid var(--st-fill-border)',
                }}>
                  ✓ {lang === 'zh' ? '全部岗位已发布' : 'All roles published'}
                </div>
              );
            }
            if (ready.length === 0) return null;
            return (
              <button onClick={publishAll} disabled={publishingAll}
                style={{
                  width: '100%', marginBottom: 14, padding: '10px 12px',
                  background: 'var(--plat-curator)', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>
                {publishingAll
                  ? (lang === 'zh' ? '发布中…' : 'Publishing…')
                  : (lang === 'zh' ? `一键发布 ${ready.length} 个就绪岗位` : `Publish all ${ready.length} ready role${ready.length === 1 ? '' : 's'}`)}
              </button>
            );
          })()}
          {bulkResult?.published?.length > 0 && (
            <div style={{
              padding: '8px 10px', marginBottom: 14, borderRadius: 8, fontSize: 11.5,
              background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
              border: '1px solid var(--st-fill-border)',
            }}>
              ✓ {lang === 'zh' ? `已发布 ${bulkResult.published.length} 个岗位,供应商已收到通知。` : `Published ${bulkResult.published.length} role${bulkResult.published.length === 1 ? '' : 's'}; supplier has been notified.`}
            </div>
          )}

          <div style={{ display: 'grid', gap: 6 }}>
            {(det.rolepacks || []).map(r => (
              <button
                key={r.id}
                onClick={() => setActiveRp(r.id)}
                style={{
                  textAlign: 'left', padding: 10, borderRadius: 8, fontSize: 12,
                  background: r.id === activeRp ? 'var(--plat-curator-tint)' : 'transparent',
                  color: r.id === activeRp ? 'var(--plat-curator)' : 'var(--ink-2)',
                  border: r.id === activeRp ? '1px solid var(--plat-curator)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>{r.rp_label}</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{(lang === 'zh' ? r.name_zh : r.name_en) || '—'}</div>
                <div style={{ fontSize: 10, marginTop: 2,
                  color: r.status === 'published' ? 'var(--st-fill-ink)'
                       : r.generated_json ? 'var(--cop-border)'
                       : 'var(--ink-3)' }}>
                  {r.status === 'published'
                    ? (lang === 'zh' ? '✓ 已发布' : '✓ Published')
                    : r.generated_json
                      ? (lang === 'zh' ? '✓ 待发布' : '✓ Ready to publish')
                      : (lang === 'zh' ? '⏳ AI 生成中' : '⏳ AI generating')}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 80px' }}>
          {!rp ? null : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{rp.rp_label}</div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)', margin: 0 }}>
                    {(lang === 'zh' ? rp.name_zh : rp.name_en) || '—'}
                  </h1>
                </div>
                {rp.generated_json && rp.status !== 'published' && (
                  <button
                    onClick={() => publish(rp.id)}
                    disabled={publishing === rp.id}
                    className="btn btn-primary"
                    style={{ padding: '10px 18px', fontWeight: 600 }}
                  >
                    {publishing === rp.id ? (lang === 'zh' ? '发布中…' : 'Publishing…') : (lang === 'zh' ? '发布到销售库' : 'Publish to sales')}
                  </button>
                )}
                {rp.status === 'published' && (
                  <span style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)' }}>
                    ✓ {lang === 'zh' ? '已发布' : 'Published'}
                  </span>
                )}
              </div>

              {!rp.generated_json && (
                <div style={{ padding: 30, background: 'white', border: '1px dashed var(--line)', borderRadius: 12, textAlign: 'center', color: 'var(--ink-3)' }}>
                  {lang === 'zh' ? 'AI 还在生成销售素材,请稍等。' : 'AI is still generating sales materials. Please wait.'}
                </div>
              )}

              {gen && (
                <Section title={lang === 'zh' ? '客户痛点' : 'Customer pain'}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{lang === 'zh' ? gen.customer_voice_pain?.zh : gen.customer_voice_pain?.en}</p>
                </Section>
              )}
              {gen && (
                <Section title={lang === 'zh' ? '价值定位' : 'Value positioning'}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{lang === 'zh' ? gen.value_positioning?.zh : gen.value_positioning?.en}</p>
                </Section>
              )}
              {gen && (
                <Section title={lang === 'zh' ? '能力概述' : 'Capability summary'}>
                  <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{lang === 'zh' ? gen.capability_summary?.zh : gen.capability_summary?.en}</pre>
                </Section>
              )}
              {gen && (
                <Section title={lang === 'zh' ? '一句话介绍' : 'One-liner'}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{lang === 'zh' ? gen.one_liner?.zh : gen.one_liner?.en}</p>
                </Section>
              )}
              {mat?.elevator_pitch_zh && (
                <Section title={lang === 'zh' ? '电梯演讲' : 'Elevator pitch'}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{lang === 'zh' ? mat.elevator_pitch_zh : mat.elevator_pitch_en}</p>
                </Section>
              )}
              {mat?.faq && (
                <Section title={lang === 'zh' ? '常见问题' : 'FAQ'}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {mat.faq.map((qa, i) => (
                      <div key={i}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Q: {lang === 'zh' ? qa.q?.zh : qa.q?.en}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>A: {lang === 'zh' ? qa.a?.zh : qa.a?.en}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {mat?.pitch_outline && (
                <Section title={lang === 'zh' ? '演示大纲' : 'Pitch outline'}>
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
                </Section>
              )}
              {mat?.discovery_questions && (
                <Section title={lang === 'zh' ? '探索性问题' : 'Discovery questions'}>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                    {mat.discovery_questions.map((q, i) => <li key={i}>{lang === 'zh' ? q.zh : q.en}</li>)}
                  </ol>
                </Section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
