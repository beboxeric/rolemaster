// v2 Product entry — name, description, materials. One per product.

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { intakes } from '../../api.js';

// Lazy-loaded PDF text extractor (pdfjs-dist bundled by Vite). Returns
// { text, error } so the UI can surface real failures instead of falling
// back silently to "PDF extraction unavailable".
let pdfjsLib = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  // Lazy chunk so pdfjs (~400KB) only loads when the supplier actually uploads
  // a PDF. The legacy build is more browser-compatible than the modern build.
  const lib = await import('pdfjs-dist/build/pdf.mjs');
  // Vite's `?url` import returns a same-origin asset URL — no CORS issues.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  pdfjsLib = lib;
  return lib;
}

async function extractTextFromFile(file) {
  if (!file) return { text: '', error: null };
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    try { return { text: await file.text(), error: null }; }
    catch (e) { return { text: '', error: 'text read failed: ' + (e?.message || e) }; }
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const lib = await loadPdfjs();
      const buf = await file.arrayBuffer();
      const doc = await lib.getDocument({ data: buf }).promise;
      const pages = [];
      const maxPages = Math.min(doc.numPages, 50);
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        const lines = tc.items.map(it => (it.str || '')).join(' ');
        if (lines.trim()) pages.push(`--- page ${i} ---\n` + lines);
      }
      const text = pages.join('\n\n').slice(0, 480_000);
      if (!text.trim()) return { text: '', error: 'PDF has no extractable text (likely scanned images)' };
      return { text, error: null };
    } catch (e) {
      const msg = e?.message || String(e);
      console.error('PDF extraction failed:', e);
      return { text: '', error: 'PDF extraction failed: ' + msg };
    }
  }
  // doc/docx/ppt/pptx — would need separate libs.
  return { text: '', error: 'extraction not supported for this file type — only PDF / TXT / MD' };
}

export function ScreenV2Onboard({ lang, setLang, onLogout }) {
  const { supplier } = useAuth();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const fromReview = searchParams.get('from') === 'review';
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
      const extractIssues = [];
      for (const f of incoming) {
        fd.append('files', f);
        // Extract text in-browser via pdfjs-dist so the AI has real content
        // to read. Errors are surfaced so the supplier knows whether their
        // PDF will be useful to the AI or not.
        const { text, error } = await extractTextFromFile(f);
        if (text && text.trim()) {
          fd.append('extracted_text_' + (f.name || 'upload').replace(/[\\/]/g, '_'), text);
        } else if (error) {
          extractIssues.push({ name: f.name, error });
        }
      }
      const res = await intakes.uploadFile(id, fd);
      setFiles(prev => [...prev, ...(res.files || [])]);
      if (extractIssues.length > 0) {
        const lines = extractIssues.map(i => `• ${i.name}: ${i.error}`).join('\n');
        setErr((lang === 'zh' ? '部分文件文本提取失败:\n' : 'Some files could not be extracted:\n') + lines);
      }
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
      // If the supplier came from the final-review screen to fix one thing,
      // jump straight back there instead of re-walking every stage. Otherwise
      // proceed to capabilities with ?regen=1 so AI re-extracts after upload.
      if (fromReview) {
        navigate(`/partners/intake/${id}/review`);
      } else {
        navigate(`/partners/intake/${id}/capabilities?regen=1`);
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const fmt = (n) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`;

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div className="v2-page">
        <div className="v2-eyebrow">{lang === 'zh' ? '步骤 2 · 产品资料' : 'Step 2 · Product'}</div>
        <h1 className="v2-display">{lang === 'zh' ? '入驻新产品' : 'Submit a new product'}</h1>
        <p className="v2-lede">
          {lang === 'zh'
            ? '为这款产品命名,介绍它做什么,上传相关材料。AI 会读完后,把这款产品的能力梳理出来,匹配最适合的岗位。'
            : 'Name this product, describe what it does, upload materials. AI reads them and identifies the capabilities + matching Roles.'}
        </p>

        <div className="v2-input-card" style={{ marginBottom: 14 }}>
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

        <div className="v2-input-card" style={{ marginBottom: 14 }}>
          <div className="v2-h3">{lang === 'zh' ? '材料上传' : 'Materials'}</div>
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

        <div className="v2-cluster">
          <button className="btn btn-ghost" onClick={() => navigate('/partners')}>
            ← {lang === 'zh' ? '返回主页' : 'Back to home'}
          </button>
          <div className="v2-grow"></div>
          <button className="btn btn-primary" onClick={submit} disabled={busy}
            style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
            {busy ? '…' : (lang === 'zh' ? '提交并开始 AI 分析 →' : 'Save & start AI analysis →')}
          </button>
        </div>
      </div>
    </div>
  );
}
