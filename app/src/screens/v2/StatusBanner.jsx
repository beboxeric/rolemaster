// Status banners for submitted / published intakes.

export function UnderReviewBanner({ lang, intake }) {
  return (
    <div style={{
      background: 'var(--st-aireview-bg)', color: 'var(--st-aireview-ink)',
      border: '1px solid var(--st-aireview-border, var(--line))',
      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
      fontSize: 12.5, lineHeight: 1.6,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>🔒</span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {lang === 'zh' ? '审阅中,内容已锁定' : 'Under review — content locked'}
        </div>
        <div>
          {lang === 'zh'
            ? '审阅团队会在 1-3 个工作日内联系你。如需修改,请联系 hello@rolemaster.io。'
            : 'The review team will contact you within 1–3 business days. To make edits, email hello@rolemaster.io.'}
        </div>
      </div>
    </div>
  );
}

export function PublishedBanner({ lang }) {
  return (
    <div style={{
      background: 'var(--st-fill-bg)', color: 'var(--st-fill-ink)',
      border: '1px solid var(--st-fill-border)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
      fontSize: 12.5, lineHeight: 1.6,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>✓</span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {lang === 'zh' ? '已发布到销售库' : 'Published to sales library'}
        </div>
        <div>
          {lang === 'zh'
            ? '内容已上线,无法修改。如需调整请联系 hello@rolemaster.io。'
            : 'Live in the sales library. To request changes, email hello@rolemaster.io.'}
        </div>
      </div>
    </div>
  );
}

export function isLocked(status) {
  return ['submitted', 'published'].includes(status);
}
