// Public landing page — three platform entry points.

import { Link } from 'react-router-dom';
import { LangSwitcher, BrandMark } from '../chrome.jsx';

export function ScreenLanding({ lang, setLang }) {
  const tiles = [
    {
      to: '/supplier',
      color: 'var(--plat-supplier)',
      tint: 'var(--plat-supplier-tint)',
      pillZh: '供应商', pillEn: 'Supplier',
      titleZh: 'AI 供应商', titleEn: 'AI Suppliers',
      bodyZh: '把你的 AI 产品打包成可销售的 RolePack。注册账户、上传材料、Copilot 帮你填表,一次提交后由专人审阅。',
      bodyEn: 'Package your AI product into a sellable RolePack. Register, upload materials, let Copilot draft the spec, and our curators take it from there.',
      ctaZh: '进入供应商门户 →', ctaEn: 'Go to supplier portal →',
    },
    {
      to: '/curator',
      color: 'var(--plat-curator)',
      tint: 'var(--plat-curator-tint)',
      pillZh: '策展人', pillEn: 'Curator',
      titleZh: 'RoleMaster 策展团队', titleEn: 'RoleMaster Curators',
      bodyZh: '审阅供应商提交的产品,在工作台上结构化拆解为能力 / 知识 / 接口,通过后发布到销售目录。',
      bodyEn: 'Review supplier submissions, decompose each product into capabilities / knowledge / interfaces in the workbench, and publish approved RolePacks to the catalog.',
      ctaZh: '进入策展人门户 →', ctaEn: 'Go to curator portal →',
    },
    {
      to: '/sales',
      color: 'var(--plat-sales)',
      tint: 'var(--plat-sales-tint)',
      pillZh: '销售', pillEn: 'Sales',
      titleZh: 'RoleMaster 销售网络', titleEn: 'RoleMaster Sales',
      bodyZh: '浏览所有已发布的 RolePack,为客户挑选合适的方案,下载推介幻灯片与产品说明书。',
      bodyEn: 'Browse the published RolePack catalog, pick the right fit for your customer, and download pitch decks and product manuals.',
      ctaZh: '进入销售门户 →', ctaEn: 'Go to sales portal →',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: '1px solid var(--line)', background: 'var(--surface)'
      }}>
        <BrandMark />
        <span style={{ fontWeight: 700, fontSize: 16 }}>RoleMaster</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>
          {lang === 'zh' ? 'AI 能力交付平台' : 'AI capability delivery platform'}
        </span>
        <div style={{ flex: 1 }} />
        <LangSwitcher lang={lang} setLang={setLang} />
      </header>

      <main style={{
        flex: 1, padding: '64px 32px',
        maxWidth: 1200, margin: '0 auto', width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: 'var(--ink)',
            letterSpacing: '-0.02em', margin: '0 0 14px'
          }}>
            {lang === 'zh' ? '让 AI 第一天就能上岗' : 'Enable AI to work from day one.'}
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.6,
            maxWidth: 640, margin: '0 auto'
          }}>
            {lang === 'zh'
              ? 'RoleMaster 把 AI 产品打包为「能力 + 知识 + 接口」的 RolePack,让企业客户像招聘一样部署 AI。请选择你的角色:'
              : 'RoleMaster packages AI products into RolePacks of skills + knowledge + connections, so enterprises can deploy AI like hiring a role. Pick your portal:'}
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
        }}>
          {tiles.map(t => (
            <Link
              key={t.to}
              to={t.to}
              style={{
                display: 'block',
                background: 'white',
                border: '1px solid var(--line)',
                borderTop: `4px solid ${t.color}`,
                borderRadius: 16,
                padding: 28,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(15,30,60,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', borderRadius: 999,
                background: t.color, color: 'white',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: 16,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.85)' }} />
                {lang === 'zh' ? t.pillZh : t.pillEn}
              </span>
              <h2 style={{
                fontSize: 20, fontWeight: 700, margin: '0 0 10px',
                color: 'var(--ink)', letterSpacing: '-0.01em',
              }}>
                {lang === 'zh' ? t.titleZh : t.titleEn}
              </h2>
              <p style={{
                fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55,
                margin: '0 0 18px', minHeight: 84,
              }}>
                {lang === 'zh' ? t.bodyZh : t.bodyEn}
              </p>
              <span style={{ color: t.color, fontSize: 14, fontWeight: 600 }}>
                {lang === 'zh' ? t.ctaZh : t.ctaEn}
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer style={{
        padding: '20px 32px', textAlign: 'center',
        fontSize: 12, color: 'var(--ink-3)',
        borderTop: '1px solid var(--line)',
      }}>
        © RoleMaster · {lang === 'zh' ? 'AI 能力交付平台' : 'AI Capability Delivery Platform'}
      </footer>
    </div>
  );
}
