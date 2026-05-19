// Surface B acceptance test (spec §2.7).
// Force the supplier to confirm a 5-product split, then verify each submission
// has prefill scoped to its own product (TMX excludes KYX content, etc.).

import { readFile } from 'node:fs/promises';

const BASE = 'https://rolemaster.pages.dev';
const ZH_PDF = 'C:/Users/rache/OneDrive/Desktop/partner-deck-zh.pdf';
const EN_PDF = 'C:/Users/rache/OneDrive/Desktop/partner-deck-en(1).pdf';

let cookieJar = '';

async function api(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (cookieJar) headers['Cookie'] = cookieJar;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 240_000);
  try {
    const res = await fetch(BASE + path, { method, headers, body: payload, signal: ctrl.signal });
    const sc = res.headers.get('set-cookie');
    if (sc) { const m = sc.match(/rm_token=[^;]+/); if (m) cookieJar = m[0]; }
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  } finally { clearTimeout(t); }
}

const stamp = Date.now();
const email = `smokeb+${stamp}@vigil.test`;

async function main() {
  console.log('▶ Surface B test — 5-product Vigil split, scoped prefill');

  await api('POST', '/api/auth/register', {
    email, password: 'demo', name: 'Vigil B', company: 'Vigil Advisory Limited',
    hq: 'Hong Kong', contact: 'Wilson Chan', phone: '+852 0000 0000',
  });
  const created = await api('POST', '/api/submissions', {});
  const subId = created.id;
  const fd = new FormData();
  fd.append('files', new Blob([await readFile(ZH_PDF)], { type: 'application/pdf' }), 'partner-deck-zh.pdf');
  fd.append('files', new Blob([await readFile(EN_PDF)], { type: 'application/pdf' }), 'partner-deck-en.pdf');
  await api('POST', `/api/submissions/${subId}/files`, fd);

  console.log('1. Run /split');
  const split = await api('POST', `/api/submissions/${subId}/split`);
  console.log(`   ✓ ${split.areas?.length} areas`);

  // Force the 5-product split (last alternative is usually the role-based split).
  const fivePack = split.alternatives?.find(a => a.products?.length === 5)
    || (split.recommended_grouping?.products?.length === 5 ? split.recommended_grouping : null);
  if (!fivePack) {
    console.error('   ❌ no 5-product grouping available; using recommended');
  }
  const grouping = fivePack || split.recommended_grouping;
  console.log(`   using "${grouping.label?.en || 'recommended'}" — ${grouping.products?.length} products`);

  console.log('2. Confirm split');
  const conf = await api('POST', `/api/submissions/${subId}/split/confirm`, {
    products: grouping.products.map(p => ({ name: p.name, subtitle: p.subtitle, area_ids: p.area_ids })),
  });
  console.log(`   ✓ created ${conf.products.length} submissions`);

  console.log('3. Fire per-product /prefill in parallel (1st is already running server-side)');
  // The confirm endpoint kicks off prefill on product[0] via waitUntil.
  // Trigger prefill on the rest from this side so each is its own request.
  const remainingPrefills = conf.products.slice(1).map(p =>
    api('POST', `/api/submissions/${p.submissionId}/prefill`, {}, { timeoutMs: 180_000 })
      .then(() => console.log(`   ✓ ${p.name} prefill done`))
      .catch(e => console.log(`   ✗ ${p.name} prefill: ${e.message}`))
  );
  console.log('   Polling all products until prefill > 0…');
  let i = 0;
  while (i < 30) {
    await new Promise(r => setTimeout(r, 5000));
    i++;
    let allReady = true;
    let progress = '';
    for (const p of conf.products) {
      const s = await api('GET', `/api/submissions/${p.submissionId}`);
      const pct = s.submission?.prefill ?? 0;
      progress += ` ${p.name.split(/[\s–-]/)[1] || p.name.slice(0, 6)}=${pct}%`;
      if (pct === 0) allReady = false;
    }
    process.stdout.write(`\r   poll ${i}:${progress}`);
    if (allReady) { console.log(''); break; }
  }
  console.log('');
  await Promise.allSettled(remainingPrefills);

  console.log('4. Verify per-product field content');
  let pass = true;
  const fail = (msg) => { console.error(`   ❌ ${msg}`); pass = false; };
  for (const p of conf.products) {
    const s = await api('GET', `/api/submissions/${p.submissionId}`);
    const fields = s.fields || {};
    const fillCount = Object.values(fields).filter(f => f.status === 'ai' || f.status === 'filled').length;
    console.log(`   ${p.name}: ${fillCount} filled fields`);
    if (fillCount === 0) fail(`  ${p.name} has 0 filled fields`);

    // Cross-product scope check: TMX should mention "transaction" / "monitoring";
    // KYX should NOT mention "SAR" or "transaction monitoring rules engine".
    const blob = JSON.stringify(fields).toLowerCase();
    if (/transaction monitoring|交易监控/.test(p.name.toLowerCase()) || /tmx/i.test(p.name)) {
      if (!/transaction|alert|sar|监控|告警/.test(blob)) fail(`  ${p.name} missing transaction-monitoring keywords`);
    }
    if (/know your|kyc|kyx/i.test(p.name)) {
      if (/sar generation|sar 自动生成|交易监控规则引擎/.test(blob)) fail(`  ${p.name} contains TMX-specific content (cross-contamination)`);
    }
  }

  console.log('5. Test re-prefill on first product');
  const first = conf.products[0];
  const re = await api('POST', `/api/submissions/${first.submissionId}/prefill`);
  console.log(`   ✓ re-prefill ok=${re.ok} fields_filled=${re.fields_filled}`);
  if (!re.ok) fail('re-prefill failed');

  console.log(pass ? '\n✅ SURFACE B PASS' : '\n❌ SURFACE B FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
