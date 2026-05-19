// KnowledgeCardCarousel — friendly loading state with rotating teaching cards.
// Used while AI is extracting capabilities, matching roles, or finalizing.

import { useEffect, useState } from 'react';

export function KnowledgeCardCarousel({ stage, lang, etaSeconds }) {
  const cards = CARDS[stage]?.[lang] || CARDS.generic[lang];
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const eta = etaSeconds || 45;

  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      // Asymptotic curve so we never hit 100 — we leave that to the real callback.
      const p = Math.min(95, (elapsed / eta) * 92);
      setProgress(p);
    }, 250);
    return () => clearInterval(tick);
  }, [eta]);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % cards.length), 6000);
    return () => clearInterval(t);
  }, [cards.length]);

  return (
    <div style={{ width: '100%', maxWidth: 580 }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--cop-border), var(--plat-supplier))',
          transition: 'width 0.3s ease-out',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: -16, marginBottom: 24 }}>
        <span>{cards[idx]?.label || ''}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress)}%</span>
      </div>

      {/* Knowledge card — taller, vertical-centered, with lightbulb icon */}
      <div key={idx} style={{
        background: 'white', border: '1px solid var(--line)',
        borderLeft: '3px solid var(--plat-supplier)',
        borderRadius: 14,
        padding: '36px 32px',
        minHeight: 240,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14,
        animation: 'fadeIn 0.4s ease-out',
        boxShadow: '0 6px 24px rgba(20,24,42,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{
            width: 32, height: 32, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--plat-supplier) 14%, white)',
            color: 'var(--plat-supplier)', fontSize: 18, lineHeight: 1,
          }}>💡</span>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cop-border)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
            {cards[idx]?.kicker}
          </div>
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy-ink)', margin: 0, letterSpacing: '-0.014em', lineHeight: 1.3 }}>
          {cards[idx]?.title}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
          {cards[idx]?.body}
        </p>
      </div>

      {/* Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {cards.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{
              width: i === idx ? 18 : 8, height: 8, padding: 0, borderRadius: 4,
              background: i === idx ? 'var(--plat-supplier)' : 'var(--line)',
              border: 'none', cursor: 'pointer',
              transition: 'width 0.2s ease, background 0.2s ease',
            }} />
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

const CARDS = {
  capabilities: {
    zh: [
      { label: '01', kicker: '什么是「能力」?', title: '能力是产品中可独立完成某类工作的最小单元', body: '比如"比对监管名单"、"生成审查报告"。一个能力是个独立可调用的动作,后面可以被组合到不同岗位里。' },
      { label: '02', kicker: 'AI 在做什么', title: '正在把你的资料拆成具体能力', body: 'AI 在阅读你上传的文件,识别出每一项能独立完成的工作。这一步只看"能做什么",不看是给谁用的。' },
      { label: '03', kicker: '接下来你可以', title: '编辑、增删能力', body: 'AI 给的是初稿。你可以改名字、改描述、加我们漏掉的能力,或者删掉不准的。一切以你说的为准。' },
    ],
    en: [
      { label: '01', kicker: 'What is a capability?', title: 'A Capability is one atomic thing your product can do', body: 'Things like "screen sanctions list" or "generate audit reports". Each Capability stands alone — later we group them into Roles.' },
      { label: '02', kicker: 'What AI is doing', title: 'Breaking your materials into concrete capabilities', body: "We're reading the files you uploaded and identifying every action your product can do independently. We don't look at who uses it yet — just what it does." },
      { label: '03', kicker: 'Next', title: 'Edit, add, or remove capabilities', body: "AI gives you a starting point. Rename, refine descriptions, add ones we missed, or delete the ones we got wrong. You're the final word." },
    ],
  },
  roles: {
    zh: [
      { label: '01', kicker: '什么是「岗位」?', title: '岗位是企业里某个具体职能', body: '比如"反洗钱专员"、"客户服务代表"。你的产品可以同时担任多个岗位 — 同一项能力也可以被多个岗位用到。' },
      { label: '02', kicker: 'AI 在做什么', title: '基于能力 + 资料,匹配最适合的岗位', body: 'AI 在判断哪些能力组合起来能担起一个具体岗位的日常工作,并预填岗位面向的行业、规模、部门。' },
      { label: '03', kicker: '接下来你可以', title: '调整岗位组合', body: '改岗位名、调整能力勾选(同一能力可在多个岗位)、加 AI 没想到的岗位。后面每个岗位会有一份独立问卷。' },
    ],
    en: [
      { label: '01', kicker: 'What is a Role?', title: 'A Role is a specific job inside an enterprise', body: 'Like "AML Officer" or "Customer Service Rep". Your product can serve multiple Roles, and the same Capability can power more than one.' },
      { label: '02', kicker: 'What AI is doing', title: 'Matching capabilities to the best-fit Roles', body: "We're figuring out which combinations of capabilities can do the daily work of one specific job, and prefilling industry, size, and department." },
      { label: '03', kicker: 'Next', title: 'Tune the lineup', body: 'Rename, toggle capabilities (one capability can live in multiple Roles), add Roles we missed. Each Role gets its own short questionnaire next.' },
    ],
  },
  finalize: {
    zh: [
      { label: '01', kicker: '我们准备好了', title: '正在为每个岗位生成销售素材', body: '审阅团队会拿到完整的能力、问卷答案,以及为每个岗位起草的 elevator pitch、FAQ 和销售幻灯片大纲。' },
      { label: '02', kicker: '后续', title: '审阅团队会很快联系你', body: '通常 1–3 个工作日内完成审阅。我们会通知你审阅结果、是否需要补充资料,以及上线时间。' },
    ],
    en: [
      { label: '01', kicker: 'Almost there', title: 'Preparing sales materials for each Role', body: 'Our review team will receive your full capabilities, questionnaire answers, plus drafted elevator pitches, FAQ and pitch decks per Role.' },
      { label: '02', kicker: 'Next', title: 'Review team will reach out', body: 'Most reviews finish within 1–3 business days. We\'ll let you know the outcome and any follow-ups.' },
    ],
  },
  generic: {
    zh: [
      { label: '01', kicker: '稍等片刻', title: 'AI 正在处理', body: '通常 30-60 秒内完成。' },
    ],
    en: [
      { label: '01', kicker: 'One moment', title: 'AI is working', body: 'Usually 30–60 seconds.' },
    ],
  },
};
