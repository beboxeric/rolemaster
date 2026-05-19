// Trigger decompose directly on a submission as curator and see what happens.

const BASE = 'https://rolemaster.pages.dev';
let cookieJar = '';

async function api(method, path, body) {
  const headers = { 'Accept': 'application/json' };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (cookieJar) headers['Cookie'] = cookieJar;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 240_000);
  try {
    const res = await fetch(BASE + path, { method, headers, body: payload, signal: ctrl.signal });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/rm_token=[^;]+/);
      if (m) cookieJar = m[0];
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } finally {
    clearTimeout(t);
  }
}

const subId = process.argv[2];
if (!subId) { console.error('usage: node scripts/trigger-decompose.mjs <submissionId>'); process.exit(1); }

console.log(`Login as curator…`);
const login = await api('POST', '/api/auth/login', { email: 'curator@demo', password: 'demo' });
console.log(' →', login.status);

console.log(`POST /api/submissions/${subId}/decompose`);
const t0 = Date.now();
const dec = await api('POST', `/api/submissions/${subId}/decompose`);
console.log(` → ${dec.status} after ${Math.round((Date.now() - t0) / 1000)}s`);
console.log(JSON.stringify(dec.body, null, 2));
