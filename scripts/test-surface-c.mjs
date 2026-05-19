// Surface C acceptance test (spec §3.6).
// Exercises: multi-field fill, vague follow-up, language mirroring.

const BASE = 'https://rolemaster.pages.dev';
let cookieJar = '';

async function api(method, path, body) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (cookieJar) headers['Cookie'] = cookieJar;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
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
  console.log('▶ Surface C — Copilot');
  await api('POST', '/api/auth/login', { email: 'supplier@demo', password: 'demo' });

  // Create a fresh empty submission to test against.
  console.log('1. Create empty draft');
  const created = await api('POST', '/api/submissions', { productName: 'Surface C Test Product' });
  const id = created.id;

  let pass = true;
  const fail = (m) => { console.error(`   ❌ ${m}`); pass = false; };

  console.log('2. Multi-field zh answer');
  const r1 = await api('POST', `/api/submissions/${id}/copilot`, {
    message: '我们主要客户是零售品牌的销售,每天在 WhatsApp 上回复客户、查产品价格。'
  });
  console.log(`   reply (${r1.reply_lang}): ${r1.reply?.slice(0, 100)}…`);
  console.log(`   fields_updated: ${r1.fields_updated?.length}`);
  for (const u of (r1.fields_updated || [])) {
    console.log(`     - ${u.field_id} = "${(u.value_zh || u.value_en || '').slice(0, 40)}"`);
  }
  if (r1.reply_lang !== 'zh') fail('expected reply_lang=zh');
  if (!(r1.fields_updated?.length >= 2)) fail(`expected ≥2 fields filled, got ${r1.fields_updated?.length}`);

  console.log('3. Bot keeps the conversation going (asks next question)');
  const r2 = await api('POST', `/api/submissions/${id}/copilot`, {
    message: 'various industries'
  });
  console.log(`   reply (${r2.reply_lang}): ${r2.reply?.slice(0, 120)}…`);
  // Functional check: bot must produce a non-empty reply (continues conversation).
  if (!r2.reply || r2.reply.length < 10) fail('expected continuing reply');

  console.log('4. Language mirror — switch back to zh');
  const r3 = await api('POST', `/api/submissions/${id}/copilot`, {
    message: '我们主要服务银行客户,大型机构和虚拟银行都做。'
  });
  if (r3.reply_lang !== 'zh') fail('expected zh reply on zh input');
  console.log(`   ✓ ${r3.reply_lang} reply on zh input`);

  console.log('5. Chat history persisted');
  const hist = await api('GET', `/api/submissions/${id}/copilot`);
  console.log(`   ✓ ${hist.items?.length} messages stored`);
  if (!(hist.items?.length >= 4)) fail(`expected ≥4 messages, got ${hist.items?.length}`);

  console.log(pass ? '\n✅ SURFACE C PASS' : '\n❌ SURFACE C FAIL');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
