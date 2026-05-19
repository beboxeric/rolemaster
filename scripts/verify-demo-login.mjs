// Verify supplier@demo, curator@demo, sales@demo all accept "demo" as password
// (that's what the frontend resolves to when you type "demo" / "demo" on each portal).

const BASE = 'https://rolemaster.pages.dev';

for (const role of ['supplier', 'curator', 'sales']) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${role}@demo`, password: 'demo' }),
  });
  const text = await res.text();
  const ok = res.status === 200 && text.includes(`"role":"${role}"`);
  console.log(`${role}@demo / demo  →  ${res.status}  ${ok ? '✓' : '✗ ' + text.slice(0, 100)}`);
}
