// v2 Product entry — name, description, materials. One per product.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes } from '../../api.js';

export function ScreenV2Onboard({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [intakeId, setIntakeId] = useState(routeId || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [name, setName] = useState('');
  const [freeText, setFreeText] = useState('');
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);

  // If editing an existing draft, hydrate.
  useEffect(() => {
    if (!routeId) return;
    let abort = false;
    (async () => {
      try {
        const det = await intakes.get(routeId);
        if (abort) return;
        setName(det.intake?.name || '');
        setFreeText(det.intake?.free_text || '');
        setFiles((det.files || []).map(f => ({ id: f.id, filename: f.filename, kind: f.kind, size: f.size_bytes })));
      } catch (e) { setErr(e.message); }
    })();
    return () => { abort = true; };
  }, [routeId]);

  const ensureIntake = async () => {
    if (intakeId) return intakeId;
    const res = await intakes.create({ name: name || null, free_text: freeText || null });
    setIntakeId(res.id);
    return res.id;
  };

  const upload = async (incoming) => {
    if (!incoming?.length) return;
    try {
      setBusy(true); setErr('');
      const id = await ensureIntake();
      const fd = new FormData();
      for (const f of incoming) fd.append('files', f);
      const res = await intakes.uploadFile(id, fd);
      setFiles(prev => [...prev, ...(res.files || [])]);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const removeFile = async (fid) => {
    if (!intakeId) return;
    try {
      setBusy(true); setErr('');
      await intakes.deleteFile(intakeId, fid);
      setFiles(prev => prev.filter(f => f.id !== fid));
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setHover(false);
    upload(Array.from(e.dataTransfer?.files || []));
  };

  const submit = async () => {
    if (!name.trim()) {
      setErr(lang === 'zh' ? '请填写产品名称' : 'Product name required');
      return;
    }
    if (files.length === 0) {
      setErr(lang === 'zh' ? '请至少上传一份材料,AI 才能识别能力' : 'Upload at least one file so AI can identify capabilities');
      return;
    }
    try {
      setBusy(true); setErr('');
      const id = await ensureIntake();
      await intakes.patch(id, { name, free_text: freeText });
      navigate(`/supplier/intake/${id}/capabilities`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const fmt = (n) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`;

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? '入驻新产品' : 'Submit a new product'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
          {lang === 'zh'
            ? '为这款产品命名,介绍它做什么,上传相关材料。AI 会读完后,把这款产品的能力梳理出来,匹配最适合的岗位。'
            : 'Name this product, describe what it does, upload materials. AI reads them and identifies the capabilities + matching Roles.'}
        </p>

        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">
              {lang === 'zh' ? '产品名称' : 'Product name'}
              <span style={{ color: 'var(--st-empty-ink)', marginLeft: 4 }}>*</span>
            </label>
            <input className="text-input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder={lang === 'zh' ? '例如:智能合规平台 / RPA 客服助手' : 'e.g. Smart Compliance Platform / RPA Customer Assistant'}
              style={{ fontSize: 14 }} />
          </div>

          <div>
            <label className="field-label">
              {lang === 'zh' ? '产品介绍(可粘贴文本)' : 'Product description (paste text)'}
            </label>
            <textarea className="text-input" value={freeText}
              onChange={e => setFreeText(e.target.value)}
              rows={5}
              placeholder={lang === 'zh'
                ? '简单描述这款产品做什么、面向哪些客户、有哪些核心能力。可以直接粘贴官网或介绍文案。'
                : 'What does it do, who is it for, what are the core capabilities. Paste from your website or pitch deck.'}
              style={{ resize: 'vertical', minHeight: 100, fontSize: 13 }} />
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            {lang === 'zh' ? '材料上传' : 'Materials'}
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={onDrop}
            style={{
              display: 'block', cursor: 'pointer',
              border: `2px dashed ${hover ? 'var(--plat-supplier)' : 'var(--line)'}`,
              borderRadius: 12, background: hover ? 'var(--plat-supplier-tint)' : 'var(--bg)',
              padding: files.length > 0 ? '20px' : '36px 24px',
              textAlign: 'center', transition: 'all 0.18s',
            }}>
            <input type="file" multiple style={{ display: 'none' }}
              onChange={(e) => { upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-ink)', marginBottom: 4 }}>
              {files.length === 0
                ? (lang === 'zh' ? '点击或拖拽文件至此' : 'Click or drag files here')
                : (lang === 'zh' ? '继续添加更多材料 →' : 'Add more materials →')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {lang === 'zh' ? 'PDF · DOC · PPT · 录音 · 多文件支持' : 'PDF · DOC · PPT · Audio · Multiple files OK'}
            </div>
            {busy && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)' }}>{lang === 'zh' ? '上传中…' : 'Uploading…'}</div>}
          </label>

          {files.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              {files.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: 'var(--bg)',
                  border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 12.5,
                }}>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    background: 'white', border: '1px solid var(--line)',
                    color: 'var(--ink-2)',
                  }}>{(f.kind || 'doc').toUpperCase()}</span>
                  <span style={{ flex: 1, color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{f.filename}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmt(f.size)}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(f.id); }}
                    disabled={busy}
                    title={lang === 'zh' ? '删除' : 'Remove'}
                    style={{
                      background: 'transparent', border: 0, cursor: 'pointer',
                      padding: '2px 6px', fontSize: 16, lineHeight: 1, color: 'var(--ink-3)',
                      borderRadius: 4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--st-empty-ink)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/supplier')}>
            ← {lang === 'zh' ? '返回主页' : 'Back to home'}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}
            style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
            {busy ? '…' : (lang === 'zh' ? '提交并开始 AI 分析 →' : 'Save & start AI analysis →')}
          </button>
        </div>
      </div>
    </div>
  );
}
