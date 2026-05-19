// Per-platform login. Same form, themed in the platform's color, and rejects
// users whose role doesn't match the requested platform.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LangSwitcher, BrandMark } from '../chrome.jsx';
import { t } from '../i18n.js';
import { useAuth } from '../auth.jsx';

const META = {
  supplier: {
    pillZh: '供应商', pillEn: 'Supplier',
    titleZh: '供应商门户', titleEn: 'Supplier Portal',
    subZh: '使用你的供应商账号登录,继续录入和提交产品。',
    subEn: 'Sign in with your supplier account to continue working on submissions.',
    classBody: 'platform-supplier',
  },
  curator: {
    pillZh: '策展人', pillEn: 'Curator',
    titleZh: '策展人门户', titleEn: 'Curator Portal',
    subZh: '审阅团队登录入口。',
    subEn: 'Sign in for the curator review team.',
    classBody: 'platform-curator',
  },
  sales: {
    pillZh: '销售', pillEn: 'Sales',
    titleZh: '销售门户', titleEn: 'Sales Portal',
    subZh: '使用销售网络账号浏览所有已发布的 RolePack。',
    subEn: 'Browse the published RolePack catalog with your sales account.',
    classBody: 'platform-sales',
  },
};

export function ScreenPortalLogin({ platform, lang, setLang, onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo');
  const [password, setPassword] = useState('demo');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = META[platform];

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    // If user types "demo" (the universal demo username) on any portal, route
    // them to the platform-specific demo account: supplier@demo / curator@demo /
    // sales@demo. Otherwise treat the input as a normal email.
    let resolvedEmail = email.trim();
    if (resolvedEmail === 'demo') resolvedEmail = `${platform}@demo`;
    if (!resolvedEmail.includes('@')) {
      setErr(lang === 'zh' ? '请输入有效邮箱' : 'Enter a valid email');
      return;
    }
    try {
      setBusy(true);
      const res = await login(resolvedEmail, password);
      if (res.user.role !== platform) {
        // Server-allowed login but the account belongs to a different portal.
        setErr(lang === 'zh'
          ? `该账号不是${meta.pillZh}账号,请使用对应门户登录`
          : `This account is not a ${meta.pillEn} account — please use the matching portal`);
        return;
      }
      onSuccess();
    } catch (e2) {
      setErr(e2.data?.error === 'invalid_credentials'
        ? (lang === 'zh' ? '邮箱或密码错误' : 'Invalid email or password')
        : (e2.message || 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`sales-login ${meta.classBody} hero-bg`}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: `var(--plat-${platform})`,
      }} />
      <div className="sales-login-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link to="/" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <BrandMark size={48} />
          </Link>
          <div style={{
            fontSize: 13, color: 'var(--ink-3)', letterSpacing: '0.06em',
            textTransform: 'uppercase', fontWeight: 600, marginTop: 12,
          }}>RoleMaster</div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: `var(--plat-${platform})`, color: 'white',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', margin: '6px 0',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
            {lang === 'zh' ? meta.pillZh : meta.pillEn}
          </span>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--ink)',
            margin: '6px 0 6px', letterSpacing: '-0.01em',
          }}>
            {lang === 'zh' ? meta.titleZh : meta.titleEn}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0, lineHeight: 1.5 }}>
            {lang === 'zh' ? meta.subZh : meta.subEn}
          </p>
        </div>

        {platform === 'supplier' && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--plat-supplier)',
            borderRadius: 8, padding: '14px 18px', marginBottom: 18,
            fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)',
          }}>
            {lang === 'zh'
              ? <>RoleMaster 是<span style={{ color: 'var(--ink)', fontWeight: 600 }}>企业 AI 智能体的岗位能力市场</span>。在此发布的产品,其核心能力将被封装为<span style={{ color: 'var(--ink)', fontWeight: 600 }}>标准化、可调用的 Skill</span>,直接成为企业数字员工的工作模块。</>
              : <>RoleMaster is the <span style={{ color: 'var(--ink)', fontWeight: 600 }}>job-skill marketplace for enterprise AI agents</span>. Products published here are packaged as <span style={{ color: 'var(--ink)', fontWeight: 600 }}>standardised, agent-callable Skills</span> — the work modules of an enterprise's digital workforce.</>}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="field-label">{t('s9_email', lang)}</label>
            <input className="text-input" type="text" value={email}
              onChange={e => { setEmail(e.target.value); setErr(''); }}
              autoFocus placeholder="demo" />
          </div>
          <div>
            <label className="field-label">{t('s9_password', lang)}</label>
            <input className="text-input" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }} />
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              {lang === 'zh' ? '演示账号:' : 'Demo:'} <code style={{ background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 4 }}>demo</code> / <code style={{ background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 4 }}>demo</code>
            </div>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)' }}>{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary"
            style={{ marginTop: 4, padding: '12px 18px' }}>
            {busy ? '…' : t('s9_signin', lang)} →
          </button>
        </form>

        {platform === 'supplier' && (
          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)',
            textAlign: 'center', fontSize: 13, color: 'var(--ink-2)',
          }}>
            {lang === 'zh' ? '没有账号?' : 'No account yet?'}{' '}
            <Link to="/supplier/register" style={{ color: 'var(--plat-supplier)', fontWeight: 600 }}>
              {lang === 'zh' ? '注册供应商账号 →' : 'Register as a supplier →'}
            </Link>
          </div>
        )}

        <div style={{
          marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
        }}>
          <Link to="/" style={{ color: 'var(--ink-3)' }}>← {lang === 'zh' ? '返回首页' : 'Home'}</Link>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
      </div>
    </div>
  );
}
