// First-time company info collection. Shown once after register; later edits
// happen inline on the supplier dashboard.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';
import { companyInfo as companyApi } from '../../api.js';

export function ScreenV2CompanySetup({ lang, setLang, onLogout }) {
  const { supplier, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [vals, setVals] = useState({
    company_name: '',
    company_hq: '',
    website: '',
    company_team: '',
    company_founded: '',
    company_clients: '',
  });

  // If company info already exists, skip straight to the dashboard.
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const co = await companyApi.get();
        if (abort) return;
        const c = co?.company || {};
        const filled = (c.company_name?.zh || c.company_name?.en);
        if (filled) {
          navigate('/supplier', { replace: true });
          return;
        }
      } catch {}
    })();
    return () => { abort = true; };
  }, []);

  const set = (key, value) => setVals(v => ({ ...v, [key]: value }));

  const submit = async () => {
    if (!vals.company_name.trim() || !vals.company_hq.trim()) {
      setErr(lang === 'zh' ? '公司名称和总部为必填' : 'Company name and HQ required');
      return;
    }
    try {
      setBusy(true); setErr('');
      await companyApi.patch({
        company_name: vals.company_name,
        company_hq: vals.company_hq,
        company_founded: vals.company_founded,
        company_team: vals.company_team,
        company_clients: vals.company_clients,
        website: vals.website,
      });
      await refresh?.();
      navigate('/supplier');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen-anim platform-supplier" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div style={{ flex: 1, padding: '32px 24px 80px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          {lang === 'zh' ? '公司资料' : 'Company info'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.6 }}>
          {lang === 'zh'
            ? '只需填一次。每个产品入驻时,这些信息会自动跟随。日后可在主页随时修改。'
            : 'One-time setup. Auto-applied to every product you submit. Editable any time from your dashboard.'}
        </p>

        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Field lang={lang} label={{ zh: '公司名称', en: 'Company name' }} value={vals.company_name}
            onChange={(v) => set('company_name', v)} required placeholder={{ zh: '某某科技有限公司', en: 'Acme Technology Ltd.' }} />
          <Field lang={lang} label={{ zh: '总部', en: 'Headquarters' }} value={vals.company_hq}
            onChange={(v) => set('company_hq', v)} required placeholder={{ zh: '香港', en: 'Hong Kong' }} />
          <Field lang={lang} label={{ zh: '公司官网', en: 'Company website' }} value={vals.website}
            onChange={(v) => set('website', v)} placeholder={{ zh: 'https://example.com', en: 'https://example.com' }} />
          <Field lang={lang} label={{ zh: '团队规模', en: 'Team size' }} value={vals.company_team}
            onChange={(v) => set('company_team', v)} placeholder={{ zh: '6-10 人', en: '6-10 people' }} optional />
          <Field lang={lang} label={{ zh: '成立年份', en: 'Year founded' }} value={vals.company_founded}
            onChange={(v) => set('company_founded', v)} placeholder={{ zh: '2018', en: '2018' }} optional />
          <Field lang={lang} label={{ zh: '现有企业客户', en: 'Enterprise clients' }} value={vals.company_clients}
            onChange={(v) => set('company_clients', v)} placeholder={{ zh: '10-20 家', en: '10-20' }} optional />
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← {lang === 'zh' ? '返回' : 'Back'}</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}
            style={{ flex: 1, padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>
            {busy ? '…' : (lang === 'zh' ? '保存,进入主页 →' : 'Save & continue →')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ lang, label, value, onChange, placeholder, required, optional }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field-label">
        {label[lang]}
        {required && <span style={{ color: 'var(--st-empty-ink)', marginLeft: 4 }}>*</span>}
        {optional && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ink-3)', fontWeight: 400 }}>{lang === 'zh' ? '(可选)' : '(optional)'}</span>}
      </label>
      <input className="text-input" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder?.[lang] || ''} style={{ fontSize: 13.5 }} />
    </div>
  );
}
