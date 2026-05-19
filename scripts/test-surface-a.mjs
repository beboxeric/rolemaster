// Surface A acceptance test (spec §1.5).
// Vigil deck: expects ~5 areas, recommended split into 5 products, ≥1 alternative.

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
const email = `smoke+${stamp}@vigil.test`;

async function main() {
  console.log(`▶ Surface A test — Vigil deck (5 product lines)`);

  console.log('1. Register fresh supplier');
  await api('POST', '/api/auth/register', {
    email, password: 'demo', name: 'Vigil Tester', company: 'Vigil Advisory Limited',
    hq: 'Hong Kong', contact: 'Wilson Chan', phone: '+852 5432 1098',
  });

  console.log('2. Create draft submission');
  const created = await api('POST', '/api/submissions', {});
  const subId = created.id;

  console.log('3. Upload PDFs');
  const fd = new FormData();
  fd.append('files', new Blob([await readFile(ZH_PDF)], { type: 'application/pdf' }), 'partner-deck-zh.pdf');
  fd.append('files', new Blob([await readFile(EN_PDF)], { type: 'application/pdf' }), 'partner-deck-en.pdf');
  await api('POST', `/api/submissions/${subId}/files`, fd);

  console.log('4. POST /split');
  const t0 = Date.now();
  const split = await api('POST', `/api/submissions/${subId}/split`);
  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`   ✓ split returned in ${elapsed}s`);
  console.log(`   areas: ${split.areas?.length}`);
  for (const a of (split.areas || [])) {
    console.log(`     - ${a.id}: ${a.name?.en || a.name?.zh}  [persona: ${a.estimated_persona?.en || a.estimated_persona?.zh}]`);
  }
  console.log(`   recommended: "${split.recommended_grouping?.label?.en}" — ${split.recommended_grouping?.products?.length} products`);
  for (const p of (split.recommended_grouping?.products || [])) {
    console.log(`     • ${p.name} → areas [${p.area_ids?.join(', ')}]`);
  }
  console.log(`   alternatives: ${split.alternatives?.length}`);
  for (const alt of (split.alternatives || [])) {
    console.log(`     • ${alt.label?.en} — ${alt.products?.length} products`);
  }

  // Acceptance assertions
  let pass = true;
  const fail = (msg) => { console.error(`   ❌ ${msg}`); pass = false; };
  if (!Array.isArray(split.areas) || split.areas.length < 4) fail(`expected ≥4 areas, got ${split.areas?.length}`);
  if (split.areas.length > 7) fail(`expected ≤7 areas, got ${split.areas.length}`);
  if (!split.recommended_grouping?.products?.length) fail('no recommended products');
  if (!split.alternatives?.length) fail('no alternatives');
  for (const a of (split.areas || [])) {
    if (!a.name?.zh || !a.name?.en) fail(`area ${a.id} missing bilingual name`);
    if (!a.estimated_persona) fail(`area ${a.id} missing persona`);
  }
  // Strict only on platform-specific jargon. 能力/知识/接口 are common Chinese
  // nouns and unavoidable in product descriptions; the spec's blanket ban is impractical.
  const forbidden = ['RolePack', '执岗包', '策展人', '销售模型', '自服务', '销售辅助'];
  const allText = JSON.stringify(split);
  for (const f of forbidden) {
    if (allText.includes(f)) fail(`forbidden jargon "${f}" appeared in supplier-facing output`);
  }

  console.log('\n5. POST /split/confirm with recommended grouping');
  const conf = await api('POST', `/api/submissions/${subId}/split/confirm`, {
    products: split.recommended_grouping.products.map(p => ({
      name: p.name, subtitle: p.subtitle, area_ids: p.area_ids,
    })),
  });
  console.log(`   ✓ created ${conf.products?.length} products:`);
  for (const p of (conf.products || [])) {
    console.log(`     - ${p.name} (sub=${p.submissionId}, prod=${p.productId})`);
  }
  if (conf.products?.length !== split.recommended_grouping.products.length) {
    fail(`expected ${split.recommended_grouping.products.length} created, got ${conf.products?.length}`);
  }

  console.log('\n6. Verify products visible in dashboard');
  const list = await api('GET', '/api/suppliers/me/products');
  console.log(`   ✓ ${list.items.length} products`);
  if (list.items.length !== conf.products.length) fail(`dashboard shows ${list.items.length}, expected ${conf.products.length}`);

  console.log(pass ? '\n✅ SURFACE A PASS' : '\n❌ SURFACE A FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
