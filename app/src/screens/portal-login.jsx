// Per-platform login. Same form, themed in the platform's color, and rejects
// users whose role doesn't match the requested platform.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LangSwitcher } from '../chrome.jsx';
import { t } from '../i18n.js';
import { useAuth } from '../auth.jsx';

const META = {
  supplier: {
    pillZh: '能力伙伴', pillEn: 'Capability Partner',
    titleZh: '能力伙伴登录', titleEn: 'Capability Partner Sign-in',
    subZh: '使用你的能力伙伴账号登录,继续录入和提交产品。',
    subEn: 'Sign in with your Capability Partner account to continue working on submissions.',
    classBody: 'platform-supplier',
  },
  curator: {
    pillZh: '策展人', pillEn: 'Curator',
    titleZh: '策展人登录', titleEn: 'Curator Sign-in',
    subZh: '审阅团队登录入口。',
    subEn: 'Sign in for the curator review team.',
    classBody: 'platform-curator',
  },
  sales: {
    pillZh: '方案顾问', pillEn: 'Solution Advisor',
    titleZh: '方案顾问登录', titleEn: 'Solution Advisor Sign-in',
    subZh: '浏览所有已发布的 RolePack,为客户挑选合适的方案。',
    subEn: 'Browse the published RolePack catalog and pick the right fit for your client.',
    classBody: 'platform-sales',
  },
};

export function ScreenPortalLogin({ platform, lang, setLang, onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Capability Partner login requires accepting the T&C; everyone else doesn't.
  const requireTos = platform === 'supplier';
  const [tosAgreed, setTosAgreed] = useState(!requireTos);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = META[platform];

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (requireTos && !tosAgreed) {
      setErr(lang === 'zh' ? '请勾选同意服务条款与隐私协议' : 'Please accept the Terms of Service & Privacy Policy');
      return;
    }
    const resolvedEmail = email.trim();
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
          <Link to="/" style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }} aria-label="RoleMaster">
            <img src="/logos/rm-light-v.png" alt="RoleMaster"
              style={{ display: 'block', height: 72, width: 'auto', objectFit: 'contain', margin: '0 auto' }} />
          </Link>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--ink)',
            margin: '14px 0 6px', letterSpacing: '-0.01em',
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
            <input className="text-input" type="email" value={email}
              onChange={e => { setEmail(e.target.value); setErr(''); }}
              autoFocus placeholder="you@example.com" />
          </div>
          <div>
            <label className="field-label">{t('s9_password', lang)}</label>
            <input className="text-input" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }} />
          </div>
          {requireTos && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={tosAgreed}
                onChange={e => { setTosAgreed(e.target.checked); setErr(''); }}
                style={{ marginTop: 3, accentColor: 'var(--plat-supplier)', flexShrink: 0 }} />
              <span>
                {lang === 'zh' ? '我已阅读并同意 ' : 'I have read and agree to the '}
                <a href="/legal/terms" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--plat-supplier)', fontWeight: 600 }}>
                  {lang === 'zh' ? '服务条款' : 'Terms of Service'}
                </a>
                {lang === 'zh' ? ' 与 ' : ' and '}
                <a href="/legal/privacy" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--plat-supplier)', fontWeight: 600 }}>
                  {lang === 'zh' ? '隐私协议' : 'Privacy Policy'}
                </a>
              </span>
            </label>
          )}
          {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)' }}>{err}</div>}
          <button type="submit" disabled={busy || (requireTos && !tosAgreed)} className="btn btn-primary"
            style={{ marginTop: 4, padding: '12px 18px', opacity: (busy || (requireTos && !tosAgreed)) ? 0.55 : 1 }}>
            {busy ? '…' : t('s9_signin', lang)} →
          </button>
        </form>

        {platform === 'supplier' && (
          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)',
            textAlign: 'center', fontSize: 13, color: 'var(--ink-2)',
          }}>
            {lang === 'zh' ? '没有账号?' : 'No account yet?'}{' '}
            <Link to="/partners/register" style={{ color: 'var(--plat-supplier)', fontWeight: 600 }}>
              {lang === 'zh' ? '注册能力伙伴账号 →' : 'Register as a Capability Partner →'}
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
