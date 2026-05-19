// End-to-end smoke test: supplier → curator → sales.
// Pretends to be Vigil. Uploads the 2 partner-deck PDFs, runs prefill+split,
// fills + submits one product, logs in as curator to publish, then as sales.
//
// Run: node scripts/smoke-test.mjs

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.BASE || 'https://rolemaster.pages.dev';
const ZH_PDF = process.env.ZH_PDF || 'C:/Users/rache/OneDrive/Desktop/partner-deck-zh.pdf';
const EN_PDF = process.env.EN_PDF || 'C:/Users/rache/OneDrive/Desktop/partner-deck-en(1).pdf';
const CURATOR_EMAIL = 'curator@demo';
const CURATOR_PASS = 'demo';
const SALES_EMAIL = 'sales@demo';
const SALES_PASS = 'demo';

let cookieJar = '';

async function api(method, path, body, opts = {}) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (cookieJar) headers['Cookie'] = cookieJar;
  const ctrl = new AbortController();
  const timeoutMs = opts.timeoutMs || 180_000; // generous default for Claude calls
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual', signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const m = setCookie.match(/rm_token=[^;]+/);
    if (m) cookieJar = m[0];
  }
  if (opts.raw) return res;
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
  }
  return data;
}

const stamp = Date.now();
const supplierEmail = `smoke+${stamp}@vigil.test`;
const log = (...a) => console.log(...a);
const banner = (s) => console.log(`\n━━━━━━━━━━ ${s} ━━━━━━━━━━`);

async function loginAs(role, email, password) {
  cookieJar = '';
  await api('POST', '/api/auth/login', { email, password });
  const me = await api('GET', '/api/auth/me');
  if (me.user.role !== role) throw new Error(`logged in as ${me.user.role}, expected ${role}`);
  log(`  ✓ logged in as ${role} (${email})`);
}

let firstSubId, firstProductId, allCreated;
let submittedSubId, submittedProductId;
let publishedRolepackId;

async function supplierFlow() {
  banner('SUPPLIER FLOW (as Vigil)');

  log('1.1 Register fresh supplier');
  await api('POST', '/api/auth/register', {
    email: supplierEmail, password: 'test1234',
    name: 'Wilson Chan', company: 'Vigil Advisory Limited',
    hq: 'Hong Kong', contact: 'Wilson Chan', phone: '+852 5432 1098',
  });
  log(`  ✓ ${supplierEmail}`);

  log('1.2 Create draft submission');
  const created = await api('POST', '/api/submissions', {});
  firstSubId = created.id; firstProductId = created.productId;
  log(`  ✓ submission=${firstSubId}, product=${firstProductId}`);

  log('1.3 Upload 2 PDFs (zh + en)');
  const zhBuf = await readFile(resolve(ZH_PDF));
  const enBuf = await readFile(resolve(EN_PDF));
  const fd = new FormData();
  fd.append('files', new Blob([zhBuf], { type: 'application/pdf' }), 'partner-deck-zh.pdf');
  fd.append('files', new Blob([enBuf], { type: 'application/pdf' }), 'partner-deck-en.pdf');
  const upRes = await api('POST', `/api/submissions/${firstSubId}/files`, fd);
  log(`  ✓ uploaded ${upRes.files?.length} files`);

  log('1.4a Run prefill (Claude — ~30s)');
  const t0 = Date.now();
  const prefillRes = await api('POST', `/api/submissions/${firstSubId}/prefill`);
  log(`  ✓ prefill ok=${prefillRes.ok} updated=${prefillRes.updated} prefill=${prefillRes.prefill}% (${Math.round((Date.now()-t0)/1000)}s)`);
  log(`    summary: ${prefillRes.summary}`);

  log('1.4b Detect multi-product (Claude — ~15s)');
  const t0b = Date.now();
  const multiRes = await api('POST', `/api/submissions/${firstSubId}/detect-multi`);
  log(`  ✓ detect-multi ok=${multiRes.ok} is_multi=${multiRes.is_multi} (${Math.round((Date.now()-t0b)/1000)}s)`);
  if (multiRes.is_multi) {
    log(`    ✓ ${multiRes.products?.length} products:`);
    for (const p of (multiRes.products || [])) log(`    - ${p.name}: ${p.subtitle}`);
  } else {
    log(`  ⚠ multi-product NOT detected — Vigil deck should yield multiple products`);
  }

  if (multiRes.is_multi && multiRes.products?.length > 1) {
    log('1.5 Call split — fan out per-product prefill');
    const t1 = Date.now();
    const splitRes = await api('POST', `/api/submissions/${firstSubId}/split`, {
      products: multiRes.products,
    });
    log(`  ✓ split done in ${Math.round((Date.now()-t1)/1000)}s — ${splitRes.products.length} products:`);
    allCreated = splitRes.products;
    for (const p of allCreated) {
      const status = p.ok ? `✓ prefill=${p.prefill}% (${p.updated} fields)` : `✗ ${p.reason || p.error}`;
      log(`    - ${p.name} (${p.submissionId}): ${status}`);
    }
    const failed = allCreated.filter(p => !p.ok || p.prefill === 0);
    if (failed.length === 0) log('  ✅ all products got prefill > 0');
    else log(`  ❌ ${failed.length}/${allCreated.length} products did NOT get prefill`);
  } else {
    allCreated = [{ submissionId: firstSubId, productId: firstProductId, name: 'TMX', ok: true, prefill: prefillRes.prefill }];
  }

  log('1.6 Verify products list endpoint');
  const listed = await api('GET', '/api/suppliers/me/products');
  log(`  ✓ ${listed.items.length} products in dashboard`);

  log('1.7 Verify supplier_company_info shared (read submission GET on first sub)');
  const subDetail = await api('GET', `/api/submissions/${firstSubId}`);
  const companyName = subDetail.fields?.company_name?.value;
  log(`  ✓ company_name from supplier_company_info = "${typeof companyName === 'object' ? companyName.zh : companyName}"`);
  if (subDetail.fields?.deploy_api?.label?.zh?.includes('API')) log('  ✓ new deploy_api field present in form template');
  else log('  ⚠ deploy_api field missing — check field template propagation');

  log('1.8 Patch some fields on first product (simulate supplier filling out form)');
  const target = allCreated[0];
  await api('PATCH', `/api/submissions/${target.submissionId}/fields/svc_demo`, {
    value: { zh: '现场或线上演示均可', en: 'On-site or video demo' },
  });
  await api('PATCH', `/api/submissions/${target.submissionId}/fields/svc_response`, {
    value: { zh: '工作日 24 小时内', en: 'Within 24 business hours' },
  });
  log(`  ✓ patched 2 service fields on ${target.submissionId}`);

  log('1.9 Test Copilot endpoint with a sentence');
  const copilotRes = await api('POST', `/api/submissions/${target.submissionId}/copilot`, {
    text: '我们的预算大约在每年 60 万到 80 万港币。', lang: 'zh',
  });
  log(`  ✓ copilot reply: "${(copilotRes.reply || '').slice(0, 80)}..." (updates: ${copilotRes.updates?.length || 0})`);

  log('1.10 Preview generated (confirm screen content)');
  const preview = await api('POST', `/api/submissions/${target.submissionId}/preview-generated`);
  if (preview.customer_voice_pain_zh) log(`  ✓ preview customer pain (zh): "${preview.customer_voice_pain_zh.slice(0, 80)}..."`);
  if (preview.one_liner_en) log(`  ✓ preview one-liner (en): "${preview.one_liner_en.slice(0, 80)}..."`);

  log('1.11 Submit the first product (sync decompose, async materials)');
  submittedSubId = target.submissionId;
  submittedProductId = target.productId;
  const t2 = Date.now();
  try {
    await api('POST', `/api/submissions/${submittedSubId}/submit`, undefined, { timeoutMs: 240_000 });
  } catch (e) {
    log(`  ⚠ submit fetch failed (${e.message}); operation may still have completed — polling…`);
  }
  log(`  ✓ submit returned/dropped after ${Math.round((Date.now()-t2)/1000)}s`);

  log('1.12 Poll until atoms appear (post-submit)');
  let polls = 0;
  while (polls < 40) {
    await new Promise(r => setTimeout(r, 4000));
    polls++;
    let s;
    try { s = await api('GET', `/api/submissions/${submittedSubId}`); }
    catch (e) { process.stdout.write(`\r    poll ${polls}: api error`); continue; }
    const atomCount = (s.atoms?.capability?.length || 0) + (s.atoms?.knowledge?.length || 0) + (s.atoms?.interface?.length || 0);
    const matsReady = !!s.salesMaterials?.pitch_outline?.length;
    process.stdout.write(`\r    poll ${polls}: status=${s.submission.status} atoms=${atomCount} mats=${matsReady}`);
    if (atomCount > 0) {
      console.log('');
      log(`  ✓ atoms ready: cap=${s.atoms.capability?.length} knw=${s.atoms.knowledge?.length} inf=${s.atoms.interface?.length}`);
      log(`    generated.one_liner_en: "${(s.generated?.one_liner_en || '').slice(0, 80)}..."`);
      break;
    }
  }
  console.log('');
}

async function curatorFlow() {
  banner('CURATOR FLOW');

  await loginAs('curator', CURATOR_EMAIL, CURATOR_PASS);

  log('2.1 List submissions queue');
  const queue = await api('GET', '/api/submissions');
  log(`  ✓ ${queue.items.length} items in queue`);
  const target = queue.items.find(i => i.id === submittedSubId);
  if (!target) throw new Error(`submitted ${submittedSubId} not in queue!`);
  log(`  ✓ found our submission: ${target.product} (status=${target.status})`);

  log('2.2 Open workbench (full GET)');
  const wb = await api('GET', `/api/submissions/${submittedSubId}`);
  log(`    atoms total: ${(wb.atoms?.capability?.length || 0) + (wb.atoms?.knowledge?.length || 0) + (wb.atoms?.interface?.length || 0)}`);
  log(`    sales materials present: pitch=${!!wb.salesMaterials?.pitch_outline?.length} faq=${!!wb.salesMaterials?.faq?.length}`);

  log('2.3 Curator: edit one atom inline');
  const firstAtom = wb.atoms?.capability?.[0];
  if (firstAtom) {
    await api('PATCH', `/api/submissions/${submittedSubId}/atoms/${firstAtom.row_id}`, {
      name_zh: firstAtom.name_zh + ' (edited)', name_en: (firstAtom.name_en || '') + ' (edited)',
    });
    log(`  ✓ edited atom ${firstAtom.atom_id}`);
  }

  log('2.4 Curator: post a comment to the supplier');
  await api('POST', `/api/submissions/${submittedSubId}/comments`, {
    body: 'Looks good — please confirm pricing range and we will publish.',
  });
  log('  ✓ comment posted');

  log('2.5 Curator: publish the submission (background asset generators)');
  const pubRes = await api('POST', `/api/curator/submissions/${submittedSubId}/publish`, {});
  publishedRolepackId = pubRes.rolepackId;
  log(`  ✓ publish initiated. rolepack=${publishedRolepackId} asset_status=${pubRes.asset_status}`);

  log('2.6 Poll for asset generation completion');
  const t0 = Date.now();
  let polls = 0;
  while (polls < 30) {
    await new Promise(r => setTimeout(r, 5000));
    polls++;
    const detail = await api('GET', `/api/catalog/${publishedRolepackId}`);
    const status = detail.rolepack?.asset_status || (detail.rolepack?.pitch_deck_en_url ? 'ready' : '?');
    process.stdout.write(`\r    poll ${polls}: status=${status}`);
    if (detail.rolepack?.pitch_deck_en_url || detail.rolepack?.product_manual_en_url) {
      console.log('');
      log(`  ✓ assets ready in ${Math.round((Date.now()-t0)/1000)}s`);
      break;
    }
  }
}

async function salesFlow() {
  banner('SALES FLOW');

  await loginAs('sales', SALES_EMAIL, SALES_PASS);

  log('3.1 Browse catalog');
  const cat = await api('GET', '/api/catalog');
  log(`  ✓ ${cat.items.length} rolepacks in catalog`);
  const target = cat.items.find(i => i.id === publishedRolepackId);
  if (!target) throw new Error(`${publishedRolepackId} not in catalog`);
  log(`  ✓ found: ${target.name?.zh || target.name?.en || target.id} (supplier: ${target.supplier})`);

  log('3.2 Open rolepack detail');
  const detail = await api('GET', `/api/catalog/${publishedRolepackId}`);
  const rp = detail.rolepack;
  log(`    elevator (en): "${(rp.elevator?.en || '').slice(0, 100)}..."`);
  log(`    pitch (zh): "${(rp.pitch?.zh || '').slice(0, 80)}..."`);
  log(`    capabilities: ${rp.capabilities?.en?.length || 0}, knowledge: ${rp.knowledge?.en?.length || 0}, interfaces: ${rp.interfaces?.en?.length || 0}`);
  log(`    pitchOutline slides: ${rp.pitchOutline?.length || 0}, FAQs: ${rp.faq?.length || 0}, discoveryQuestions: ${rp.discoveryQuestions?.length || 0}`);
  log(`    fromPrice: ${rp.fromPrice}`);
  if (JSON.stringify(rp).match(/(price_cost|cost_price|curator_notes|source_quote)/i)) {
    log('  ❌ SECURITY: sensitive field leaked into sales-bound payload!');
  } else {
    log('  ✓ no sensitive fields (cost_price/curator_notes/source_quote) in payload');
  }

  log('3.3 Test asset URL existence');
  const assets = ['pitch_deck_zh_url', 'pitch_deck_en_url', 'product_manual_zh_url', 'product_manual_en_url']
    .map(k => ({ k, present: !!rp[k] }));
  for (const a of assets) log(`    ${a.present ? '✓' : '✗'} ${a.k}`);

  log('3.4 Try downloading the en pitch deck');
  const dl = await api('GET', `/api/rolepacks/${publishedRolepackId}/download/pitch-en`, undefined, { raw: true });
  if (dl.ok) {
    const len = dl.headers.get('content-length');
    const ct = dl.headers.get('content-type');
    log(`  ✓ download responded ${dl.status}, ${ct}, ${len} bytes`);
  } else {
    log(`  ✗ download failed: ${dl.status}`);
  }

  log('3.5 AI Q&A grounded query');
  const askRes = await api('POST', `/api/catalog/${publishedRolepackId}/ask`, {
    question: 'Does this product fit a 200-person retail bank in Hong Kong?',
    lang: 'en',
  });
  log(`  ✓ AI answered (grounded=${askRes.grounded}): "${(askRes.answer || '').slice(0, 150)}..."`);
}

async function main() {
  log(`▶ ${BASE}`);
  await supplierFlow();
  await curatorFlow();
  await salesFlow();
  log('\n✅ END-TO-END SMOKE COMPLETE');
}

main().catch(e => { console.error('\n❌ FAIL:', e.message); console.error(e.stack); process.exit(1); });
