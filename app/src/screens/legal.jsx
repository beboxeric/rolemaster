// Stub legal pages (Terms of Service + Privacy Policy). Linked from the
// Capability Partner login. Placeholder text — replace before launch.

import { Link } from 'react-router-dom';

const SHELL = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '40px 24px', background: 'var(--bg)', color: 'var(--ink)',
};
const CARD = {
  maxWidth: 760, width: '100%', background: 'white', borderRadius: 14,
  border: '1px solid var(--line)', padding: '32px 36px',
  boxShadow: '0 4px 16px rgba(15,30,60,0.06)',
};
const H1 = { fontSize: 22, fontWeight: 800, color: 'var(--navy-ink)', margin: '0 0 6px', letterSpacing: '-0.01em' };
const META = { fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 };
const H2 = { fontSize: 14, fontWeight: 700, color: 'var(--navy-ink)', margin: '20px 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const P = { fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 10px' };

function Header({ lang, title, kind }) {
  return (
    <>
      <Link to="/partners" style={{ color: 'var(--plat-curator)', fontSize: 13, marginBottom: 16, alignSelf: 'flex-start' }}>← {lang === 'zh' ? '返回登录' : 'Back to login'}</Link>
      <div style={CARD}>
        <h1 style={H1}>{title}</h1>
        <div style={META}>RoleMaster · {kind}</div>
      </div>
    </>
  );
}

export function ScreenTerms({ lang = 'zh' }) {
  return (
    <div style={SHELL}>
      <div style={{ maxWidth: 760, width: '100%' }}>
        <Header lang={lang} title={lang === 'zh' ? '服务条款' : 'Terms of Service'} kind={lang === 'zh' ? '服务条款 · v0.1 (草稿)' : 'Terms of Service · v0.1 (draft)'} />
        <div style={{ ...CARD, marginTop: 14 }}>
          <p style={P}>{lang === 'zh'
            ? '欢迎使用 RoleMaster。本服务条款适用于通过 airolemaster.com 注册并使用 RoleMaster 平台的所有能力伙伴账号。'
            : 'Welcome to RoleMaster. These Terms of Service apply to every Capability Partner account registered through airolemaster.com.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '1. 账户' : '1. Account'}</h2>
          <p style={P}>{lang === 'zh'
            ? '能力伙伴账号由您本人或获授权的代表创建并维护。账号下提交的内容由您负责。'
            : 'You (or your authorised representative) are responsible for creating and maintaining the Capability Partner account, and for any content submitted under it.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '2. 内容所有权' : '2. Content Ownership'}</h2>
          <p style={P}>{lang === 'zh'
            ? '您提交的产品资料、能力清单、岗位包及上传的材料归您所有。RoleMaster 在您授权范围内使用上述内容,用于策展审阅、目录展示及方案顾问推荐。'
            : 'Product information, capability lists, RolePacks, and uploaded materials remain your property. RoleMaster uses them within the scope you authorise — for curator review, catalog display, and advisor recommendations.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '3. AI 处理' : '3. AI Processing'}</h2>
          <p style={P}>{lang === 'zh'
            ? '为生成 AI 简报、能力提取、岗位匹配等功能,RoleMaster 会将您的提交内容传至大语言模型供应商(如 Alibaba DashScope / Qwen)。我们仅传输完成上述任务所必需的最少内容。'
            : 'To generate AI briefings, capability extraction, and role matching, RoleMaster passes your content to large-language-model providers (e.g. Alibaba DashScope / Qwen). Only the minimum content required for those tasks is transmitted.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '4. 禁止行为' : '4. Prohibited Use'}</h2>
          <p style={P}>{lang === 'zh'
            ? '不得提交侵犯第三方知识产权、违反法律法规或包含恶意代码的内容。一经发现,RoleMaster 有权暂停账号并删除相关内容。'
            : 'Do not submit content that infringes third-party IP, violates applicable law, or contains malicious code. RoleMaster may suspend the account and remove such content on discovery.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '5. 终止' : '5. Termination'}</h2>
          <p style={P}>{lang === 'zh'
            ? '您可随时注销账号。已发布到销售目录的岗位包在注销后保留至当前合作期结束。'
            : 'You may close your account at any time. RolePacks already published to the sales catalog remain visible until the end of the current engagement period.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '6. 联系' : '6. Contact'}</h2>
          <p style={P}>{lang === 'zh'
            ? '如有疑问,请通过 hello@rolemaster.io 联系我们。'
            : 'Questions: hello@rolemaster.io.'}</p>
        </div>
      </div>
    </div>
  );
}

export function ScreenPrivacy({ lang = 'zh' }) {
  return (
    <div style={SHELL}>
      <div style={{ maxWidth: 760, width: '100%' }}>
        <Header lang={lang} title={lang === 'zh' ? '隐私协议' : 'Privacy Policy'} kind={lang === 'zh' ? '隐私协议 · v0.1 (草稿)' : 'Privacy Policy · v0.1 (draft)'} />
        <div style={{ ...CARD, marginTop: 14 }}>
          <p style={P}>{lang === 'zh'
            ? 'RoleMaster 重视您的隐私。本协议说明我们收集哪些数据、用于什么目的,以及您的权利。'
            : 'RoleMaster respects your privacy. This policy explains what data we collect, what we use it for, and what rights you have.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '1. 收集的数据' : '1. Data We Collect'}</h2>
          <p style={P}>{lang === 'zh'
            ? '账户信息(邮箱、姓名、机构)、提交内容(产品资料、能力清单、岗位包、上传材料)、使用日志(登录时间、操作记录)。'
            : 'Account info (email, name, organisation), submitted content (product info, capabilities, RolePacks, uploads), and usage logs (sign-in times, actions taken).'}</p>

          <h2 style={H2}>{lang === 'zh' ? '2. 使用目的' : '2. How We Use It'}</h2>
          <p style={P}>{lang === 'zh'
            ? '提供服务、生成 AI 简报、改进平台功能、与策展人/方案顾问匹配。我们不会向第三方出售您的数据。'
            : 'To deliver the service, generate AI briefings, improve the platform, and match you with curators / advisors. We do not sell your data to third parties.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '3. 第三方服务' : '3. Third-party Services'}</h2>
          <p style={P}>{lang === 'zh'
            ? '基础设施:Cloudflare(托管 + 数据库 + 文件存储)。AI 处理:Alibaba DashScope / Qwen。这些服务商有独立的隐私政策。'
            : 'Infrastructure: Cloudflare (hosting + database + file storage). AI processing: Alibaba DashScope / Qwen. These providers have their own privacy policies.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '4. 数据存储' : '4. Storage'}</h2>
          <p style={P}>{lang === 'zh'
            ? '账户与提交数据存储于 Cloudflare D1(SQLite)与 R2(对象存储)。我们采用业界标准的传输加密(HTTPS)与访问控制。'
            : 'Account and submission data are stored in Cloudflare D1 (SQLite) and R2 (object storage). We use industry-standard transit encryption (HTTPS) and access controls.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '5. 您的权利' : '5. Your Rights'}</h2>
          <p style={P}>{lang === 'zh'
            ? '您可以查看、修改、导出或删除您的账户数据。如需协助,请联系 hello@rolemaster.io。'
            : 'You can view, edit, export, or delete your account data. For assistance contact hello@rolemaster.io.'}</p>

          <h2 style={H2}>{lang === 'zh' ? '6. 更新' : '6. Updates'}</h2>
          <p style={P}>{lang === 'zh'
            ? '本协议如有变更将更新生效日期并在登录页面通知。'
            : 'Material changes are reflected in the effective date and announced on the sign-in page.'}</p>
        </div>
      </div>
    </div>
  );
}
