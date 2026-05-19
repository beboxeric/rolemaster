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
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  });

  // If company info already exists, skip straight to the dashboard.
  // Otherwise prefill contact_email with the supplier's registered email.
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const co = await companyApi.get();
        if (abort) return;
        const c = co?.company || {};
        const filled = (c.company_name?.zh || c.company_name?.en);
        if (filled) {
          navigate('/partners', { replace: true });
          return;
        }
        if (supplier?.email) {
          setVals(v => ({ ...v, contact_email: v.contact_email || supplier.email }));
        }
      } catch {}
    })();
    return () => { abort = true; };
  }, [supplier?.email]);

  const set = (key, value) => setVals(v => ({ ...v, [key]: value }));

  const submit = async () => {
    if (!vals.company_name.trim() || !vals.company_hq.trim()) {
      setErr(lang === 'zh' ? '公司名称和总部为必填' : 'Company name and HQ required');
      return;
    }
    if (!vals.contact_name.trim() || !vals.contact_phone.trim() || !vals.contact_email.trim()) {
      setErr(lang === 'zh' ? '联系人姓名、手机、邮箱为必填' : 'Contact name, phone, and email are required');
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
        contact_name: vals.contact_name,
        contact_phone: vals.contact_phone,
        contact_email: vals.contact_email,
      });
      await refresh?.();
      navigate('/partners');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen-anim platform-supplier v2" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} supplierName={supplier?.short_name ?? supplier?.name} onLogout={onLogout} />
      <div className="v2-page v2-page--narrow">
        <h1 className="v2-display">{lang === 'zh' ? '公司资料' : 'Company info'}</h1>
        <p className="v2-lede">
          {lang === 'zh'
            ? '只需填一次。每个产品入驻时,这些信息会自动跟随。日后可在主页随时修改。'
            : 'One-time setup. Auto-applied to every product you submit. Editable any time from your dashboard.'}
        </p>

        <div className="v2-input-card">
          <div className="v2-h3">{lang === 'zh' ? '公司' : 'Company'}</div>
          <Field lang={lang} label={{ zh: '公司名称', en: 'Company name' }} value={vals.company_name}
            onChange={(v) => set('company_name', v)} required placeholder={{ zh: '某某科技有限公司', en: 'Acme Technology Ltd.' }} />
          <Field lang={lang} label={{ zh: '总部', en: 'Headquarters' }} value={vals.company_hq}
            onChange={(v) => set('company_hq', v)} required placeholder={{ zh: '香港', en: 'Hong Kong' }} />
          <Field lang={lang} label={{ zh: '公司官网', en: 'Company website' }} value={vals.website}
            onChange={(v) => set('website', v)} placeholder={{ zh: 'https://example.com', en: 'https://example.com' }} />
        </div>

        <div className="v2-input-card">
          <div className="v2-h3">{lang === 'zh' ? '联系人(用于审核进度联系)' : 'Contact person (used for review status)'}</div>
          <Field lang={lang} label={{ zh: '姓名', en: 'Name' }} value={vals.contact_name}
            onChange={(v) => set('contact_name', v)} required placeholder={{ zh: '张三', en: 'Jane Doe' }} />
          <Field lang={lang} label={{ zh: '手机', en: 'Mobile phone' }} value={vals.contact_phone}
            onChange={(v) => set('contact_phone', v)} required placeholder={{ zh: '+852 9123 4567', en: '+852 9123 4567' }} />
          <Field lang={lang} label={{ zh: '工作邮箱', en: 'Work email' }} value={vals.contact_email}
            onChange={(v) => set('contact_email', v)} required placeholder={{ zh: 'you@yourcompany.com', en: 'you@yourcompany.com' }} />
        </div>

        <div className="v2-input-card">
          <div className="v2-h3">{lang === 'zh' ? '可选 — 让你的介绍更有说服力' : 'Optional — sharpens your pitch'}</div>
          <Field lang={lang} label={{ zh: '团队规模', en: 'Team size' }} value={vals.company_team}
            onChange={(v) => set('company_team', v)} placeholder={{ zh: '6-10 人', en: '6-10 people' }} optional />
          <Field lang={lang} label={{ zh: '成立年份', en: 'Year founded' }} value={vals.company_founded}
            onChange={(v) => set('company_founded', v)} placeholder={{ zh: '2018', en: '2018' }} optional />
          <Field lang={lang} label={{ zh: '现有企业客户', en: 'Enterprise clients' }} value={vals.company_clients}
            onChange={(v) => set('company_clients', v)} placeholder={{ zh: '10-20 家', en: '10-20' }} optional />
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginTop: 10 }}>⚠ {err}</div>}

        <div className="v2-cluster" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← {lang === 'zh' ? '返回' : 'Back'}</button>
          <div className="v2-grow"></div>
          <button className="btn btn-primary" onClick={submit} disabled={busy}
            style={{ padding: '12px 18px', fontSize: 14, fontWeight: 600 }}>
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
