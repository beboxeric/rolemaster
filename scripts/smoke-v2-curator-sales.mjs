// v2 curator + sales smoke. Assumes a v2 supplier intake has already been
// submitted + published-eligible (i.e. /api/curator/intakes returns >0).

const BASE = 'https://rolemaster.pages.dev';

let cookieJar = '';
async function api(method, path, body) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (cookieJar) headers['Cookie'] = cookieJar;
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const sc = res.headers.get('set-cookie');
  if (sc) { const m = sc.match(/rm_token=[^;]+/); if (m) cookieJar = m[0]; }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`▶ v2 curator+sales: ${BASE}\n`);

  console.log('1. Login as curator');
  await api('POST', '/api/auth/login', { email: 'grace@rolemaster.io', password: 'demo' });
  console.log('   ✓');

  console.log('2. List submitted intakes');
  const inbox = await api('GET', '/api/curator/intakes?status=submitted');
  console.log(`   ✓ ${inbox.items.length} pending`);
  if (!inbox.items.length) {
    console.log('\n(no pending intakes — run smoke-v2 first)');
    return;
  }
  const intake = inbox.items[0];
  console.log(`     ${intake.id} (${intake.supplier_name}, ${intake.rolepack_ready}/${intake.rolepack_count} ready)`);

  console.log('3. Open intake — list rolepacks');
  const det = await api('GET', `/api/intakes/${intake.id}`);
  const ready = det.rolepacks.filter(r => r.generated_json);
  console.log(`   ✓ ${ready.length}/${det.rolepacks.length} have generated content`);

  if (ready.length === 0) {
    console.log('   (no generated content yet — try again in a minute)');
    return;
  }

  console.log('4. Publish first ready rolepack');
  const rp = ready[0];
  await api('POST', `/api/curator/rolepacks/${rp.id}/publish`);
  console.log(`   ✓ ${rp.rp_label} published`);

  console.log('5. Login as sales');
  cookieJar = '';
  await api('POST', '/api/auth/login', { email: 'sales@rolemaster.io', password: 'demo' });
  console.log('   ✓');

  console.log('6. List published rolepacks (sales view)');
  const lib = await api('GET', '/api/sales/rolepacks');
  console.log(`   ✓ ${lib.items.length} published roles in library`);
  const found = lib.items.find(it => it.id === rp.id);
  if (found) console.log(`     found ${rp.rp_label}: ${found.name?.en || found.name?.zh}`);

  console.log('7. Open published rolepack');
  const detail = await api('GET', `/api/sales/rolepacks/${rp.id}`);
  console.log(`   ✓ ${detail.rp_label}: ${detail.name?.en || detail.name?.zh}`);
  console.log(`     one_liner: "${(detail.generated?.one_liner?.en || '').slice(0, 80)}…"`);
  console.log(`     faq count: ${detail.materials?.faq?.length || 0}`);
  console.log(`     pitch slides: ${detail.materials?.pitch_outline?.length || 0}`);

  console.log('8. Verify cost_price stripped');
  const blob = JSON.stringify(detail).toLowerCase();
  if (/cost[ _]price|成本价/.test(blob)) {
    console.log('   ✗ COST PRICE LEAKED to sales view');
  } else {
    console.log('   ✓ no cost_price in sales response');
  }

  console.log('\n✅ v2 CURATOR+SALES SMOKE COMPLETE');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
