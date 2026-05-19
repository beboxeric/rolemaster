// Surface D acceptance test (spec §4.6).
// Atoms produced, generated content, no cost-price leak, materials draft.

const BASE = 'https://rolemaster.pages.dev';
let cookieJar = '';

async function api(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
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

async function main() {
  console.log('▶ Surface D — Decompose + Generate-Materials');
  let pass = true;
  const fail = (m) => { console.error(`   ❌ ${m}`); pass = false; };

  // Login as supplier and find an existing populated submission.
  await api('POST', '/api/auth/login', { email: 'supplier@demo', password: 'demo' });
  const list = await api('GET', '/api/submissions');
  if (!list.items.length) { console.error('No submissions exist; run earlier tests first'); process.exit(1); }
  const target = list.items.find(i => (i.prefill || 0) > 30) || list.items[0];
  const id = target.id;
  console.log(`   target: ${target.product} (sub=${id}, prefill=${target.prefill}%)`);

  // Plant a cost_price value to verify it's filtered out.
  console.log('1. Set price_cost to a unique sentinel value');
  await api('PATCH', `/api/submissions/${id}/fields/price_cost`, {
    value: { zh: 'COST_SENTINEL_001 港币 100K', en: 'COST_SENTINEL_001 HKD 100K' },
  });

  console.log('2. Switch to curator + submit submission');
  await api('POST', '/api/auth/login', { email: 'curator@demo', password: 'demo' });
  // Manually call decompose as curator.
  console.log('3. POST /decompose');
  const t0 = Date.now();
  const dec = await api('POST', `/api/submissions/${id}/decompose`);
  console.log(`   ✓ decompose ok=${dec.ok} atom_count=${dec.atom_count} (${Math.round((Date.now() - t0) / 1000)}s)`);
  if (!dec.ok) fail(`decompose failed: ${dec.reason}`);
  if (!(dec.atom_count >= 5)) fail(`expected ≥5 atoms, got ${dec.atom_count}`);

  console.log('4. GET submission — verify atoms + generated populated');
  const det = await api('GET', `/api/submissions/${id}`);
  const atomTotal = (det.atoms?.capability?.length || 0) + (det.atoms?.knowledge?.length || 0) + (det.atoms?.interface?.length || 0);
  console.log(`   atoms: cap=${det.atoms?.capability?.length} knw=${det.atoms?.knowledge?.length} inf=${det.atoms?.interface?.length} (total=${atomTotal})`);
  if (atomTotal < 5) fail('atoms not in DB after decompose');
  console.log(`   one_liner_en: "${det.generated?.one_liner_en?.slice(0, 80)}…"`);
  if (!det.generated?.one_liner_en || det.generated.one_liner_en.length > 200) fail('one_liner missing or too long');
  if (!det.generated?.customer_voice_pain_zh) fail('customer_voice_pain_zh missing');

  console.log('5. POST /generate-materials');
  const t1 = Date.now();
  const mats = await api('POST', `/api/submissions/${id}/generate-materials`);
  console.log(`   ✓ ok=${mats.ok} (${Math.round((Date.now() - t1) / 1000)}s)`);
  if (!mats.ok) fail(`materials failed: ${mats.reason}`);
  console.log(`   pitch_outline=${mats.pitch_outline?.length} faq=${mats.faq?.length} discovery=${mats.discovery_questions?.length}`);
  if (!(mats.pitch_outline?.length >= 4)) fail('pitch_outline too short');
  if (!(mats.faq?.length >= 6)) fail('faq too short');
  if (!mats.elevator_pitch_en) fail('elevator_pitch_en missing');

  console.log('6. SECURITY: verify cost sentinel does not leak');
  const matsBlob = JSON.stringify(mats);
  const decBlob = JSON.stringify(dec);
  if (matsBlob.includes('COST_SENTINEL_001')) fail('cost sentinel leaked into materials!');
  if (decBlob.includes('COST_SENTINEL_001')) fail('cost sentinel leaked into decompose generated!');
  console.log('   ✓ cost sentinel never appears in materials or decompose output');

  console.log(pass ? '\n✅ SURFACE D PASS' : '\n❌ SURFACE D FAIL');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
