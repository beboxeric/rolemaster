// v2 Register — only email + password. Soft warning for free webmail.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { AppHeader } from '../../chrome.jsx';

const FREE_WEBMAIL = /@(gmail|qq|163|126|yahoo|outlook|hotmail|icloud|foxmail|sina)\./i;

export function ScreenV2Register({ lang, setLang, onLogout }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!email.includes('@')) { setErr(lang === 'zh' ? '请输入有效邮箱' : 'Enter a valid email'); return; }
    if (password.length < 4) { setErr(lang === 'zh' ? '密码至少 4 位' : 'Password ≥ 4 chars'); return; }
    if (!agree) { setErr(lang === 'zh' ? '请同意服务条款' : 'Please agree to the terms'); return; }
    try {
      setBusy(true);
      await register({ email, password });
      navigate('/supplier/onboard');
    } catch (e2) {
      setErr(e2.data?.error === 'email_taken'
        ? (lang === 'zh' ? '该邮箱已注册' : 'Email already registered')
        : (e2.message || 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  const isWebmail = email && FREE_WEBMAIL.test(email);

  return (
    <div className="screen-anim platform-supplier hero-bg" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader lang={lang} setLang={setLang} onLogout={onLogout} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <form onSubmit={submit} style={{
          maxWidth: 460, width: '100%',
          background: 'white', border: '1px solid var(--line)',
          borderRadius: 16, padding: 32,
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            {lang === 'zh' ? '加入 RoleMaster' : 'Join RoleMaster'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 18px', lineHeight: 1.55 }}>
            {lang === 'zh'
              ? '只需邮箱和密码即可开始。下一步再填公司信息。'
              : 'Just email + password to start. We collect company info on the next step.'}
          </p>

          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--plat-supplier)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 22,
            fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-2)',
          }}>
            {lang === 'zh'
              ? <>RoleMaster 是<strong style={{ color: 'var(--ink)' }}>企业 AI 智能体的岗位能力市场</strong>。在此发布的产品,其核心能力被封装为<strong style={{ color: 'var(--ink)' }}>标准化、可调用的 Skill</strong>,直接成为企业数字员工的工作模块。</>
              : <>RoleMaster is the <strong style={{ color: 'var(--ink)' }}>job-skill marketplace for enterprise AI agents</strong>. Products published here are packaged as <strong style={{ color: 'var(--ink)' }}>standardised, agent-callable Skills</strong>.</>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="field-label">{lang === 'zh' ? '公司邮箱(优先公司域名)' : 'Work email (company domain preferred)'}</label>
            <input className="text-input" type="text" value={email} autoFocus
              onChange={e => { setEmail(e.target.value); setErr(''); }}
              placeholder={lang === 'zh' ? 'you@yourcompany.com' : 'you@yourcompany.com'} />
            {isWebmail && (
              <div style={{ fontSize: 11, color: 'var(--st-weak-ink)', marginTop: 4, fontStyle: 'italic' }}>
                💡 {lang === 'zh' ? '建议使用公司邮箱以便我们识别贵司身份。' : 'A company email helps us recognize your organization.'}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="field-label">{lang === 'zh' ? '密码' : 'Password'}</label>
            <input className="text-input" type="password" value={password}
              onChange={e => { setPassword(e.target.value); setErr(''); }}
              placeholder={lang === 'zh' ? '至少 4 位' : '≥ 4 characters'} />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 18 }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
            <span>{lang === 'zh' ? '我已阅读并同意 ' : 'I agree to the '}<a href="#">{lang === 'zh' ? '服务条款与隐私协议' : 'Terms & Privacy'}</a></span>
          </label>

          {err && <div style={{ fontSize: 12, color: 'var(--st-empty-ink)', marginBottom: 10 }}>⚠ {err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
              ← {lang === 'zh' ? '返回' : 'Back'}
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary"
              style={{ flex: 1, padding: '12px 18px' }}>
              {busy ? '…' : (lang === 'zh' ? '继续 →' : 'Continue →')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
