// v2 supplier-flow smoke test against prod.

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
const email = `v2+${stamp}@vigil.test`;

async function main() {
  console.log(`▶ v2 smoke: ${BASE}\n`);

  console.log('1. Register (email + password only)');
  const reg = await api('POST', '/api/auth/register', { email, password: 'test1234' });
  console.log(`   ✓ ${email} (webmail=${reg.is_webmail})`);

  console.log('2. Patch supplier company info');
  await api('PATCH', '/api/suppliers/me/company-info', {
    updates: {
      company_name: { zh: 'Vigil Advisory Limited', en: 'Vigil Advisory Limited' },
      company_hq: { zh: '香港', en: 'Hong Kong' },
      company_founded: { zh: '2018', en: '2018' },
    },
  });
  console.log('   ✓ company info saved');

  console.log('3. Create intake');
  const { id: intakeId } = await api('POST', '/api/intakes');
  console.log(`   ✓ ${intakeId}`);

  console.log('4. Patch intake with website + free_text');
  await api('PATCH', `/api/intakes/${intakeId}`, {
    website: 'https://vigil.example',
    industry_hint: 'RegTech',
    free_text: 'Full-stack AML/KYC compliance platform.',
  });

  console.log('5. Upload 2 PDFs');
  const fd = new FormData();
  fd.append('files', new Blob([await readFile(ZH_PDF)], { type: 'application/pdf' }), 'partner-deck-zh.pdf');
  fd.append('files', new Blob([await readFile(EN_PDF)], { type: 'application/pdf' }), 'partner-deck-en.pdf');
  await api('POST', `/api/intakes/${intakeId}/files`, fd);

  console.log('6. AI Surface A — extract capabilities');
  const t0 = Date.now();
  const exA = await api('POST', `/api/intakes/${intakeId}/extract-capabilities`);
  console.log(`   ✓ ${exA.count} capabilities (${Math.round((Date.now() - t0) / 1000)}s)`);

  console.log('7. GET intake — verify capabilities');
  const det1 = await api('GET', `/api/intakes/${intakeId}`);
  console.log(`   ✓ ${det1.capabilities.length} caps, status=${det1.intake.status}`);
  for (const c of det1.capabilities) console.log(`     ${c.rc_label}: ${c.name_en || c.name_zh}`);

  console.log('8. Confirm capabilities');
  await api('PATCH', `/api/intakes/${intakeId}/capabilities`, { confirm_all: true });

  console.log('9. AI Surface B — match roles');
  const t1 = Date.now();
  const exB = await api('POST', `/api/intakes/${intakeId}/match-roles`);
  console.log(`   ✓ ${exB.count} roles (${Math.round((Date.now() - t1) / 1000)}s)`);

  console.log('10. GET intake — verify rolepacks');
  const det2 = await api('GET', `/api/intakes/${intakeId}`);
  for (const r of det2.rolepacks) {
    console.log(`     ${r.rp_label}: ${r.name_en || r.name_zh} [${r.industry?.join(',')}, ${r.department?.en}, ${r.capability_ids.length} caps]`);
  }

  console.log('11. AI Surface C — prefill questionnaire for first role');
  const firstRp = det2.rolepacks[0];
  const t2 = Date.now();
  const prefill = await api('POST', `/api/intakes/${intakeId}/rolepacks/${firstRp.id}/prefill`);
  console.log(`   ✓ ok=${prefill.ok} (${Math.round((Date.now() - t2) / 1000)}s)`);
  if (prefill.questionnaire) {
    const q = prefill.questionnaire;
    console.log(`     pain.main_pain: "${(q.pain?.main_pain?.value_en || q.pain?.main_pain?.value_zh || '').slice(0, 60)}…"`);
    console.log(`     deployment.api_endpoint: ${q.deployment?.api_endpoint ? '✓' : '—'}`);
  }

  console.log('12. Save shared service+pricing + finalize');
  await api('PATCH', `/api/intakes/${intakeId}`, {
    service_pricing: {
      service: { demo_mode: 'Online demo + sandbox', sales_assist_level: 'Available any stage', sales_coverage_regions: ['hk', 'sg'], delivery_scope: 'Full delivery', support_languages: 'Chinese / English' },
      pricing: { pricing_model: 'Annual license', cost_price: 'HKD 300K/yr', suggested_retail: 'HKD 600K-800K/yr' },
    },
  });
  const fin = await api('POST', `/api/intakes/${intakeId}/finalize`);
  console.log(`   ✓ finalize: ${fin.count} roles queued`);

  console.log('13. Sequentially generate per-role (Surface D, with retry)');
  const t3 = Date.now();
  let okN = 0;
  for (const rp of fin.rolepacks) {
    let saved = false;
    for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
      try {
        const r = await api('POST', `/api/intakes/${intakeId}/rolepacks/${rp.id}/generate`);
        if (r?.ok) { saved = true; okN++; process.stdout.write('.'); }
        else process.stdout.write('x');
      } catch {
        process.stdout.write(attempt === 1 ? '!' : '?');
        // After a fetch failure, the worker may have actually finished — check.
        await new Promise(r => setTimeout(r, 3000));
        try {
          const det = await api('GET', `/api/intakes/${intakeId}`);
          const found = det.rolepacks.find(r => r.id === rp.id);
          if (found?.generated_json) { saved = true; okN++; process.stdout.write('.'); }
        } catch {}
      }
    }
  }
  console.log(`\n   ✓ ${okN}/${fin.rolepacks.length} roles generated (${Math.round((Date.now() - t3) / 1000)}s)`);

  console.log('14. Verify generated content');
  const det = await api('GET', `/api/intakes/${intakeId}`);
  const done = det.rolepacks.filter(r => r.generated_json);
  console.log(`   ${done.length}/${det.rolepacks.length} have generated_json`);

  console.log('\n✅ v2 SMOKE COMPLETE');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
