// Create supplier@demo / demo for testing.

const BASE = process.env.BASE || 'https://rolemaster.pages.dev';

const res = await fetch(BASE + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({
    email: 'supplier@demo',
    password: 'demo',
    name: 'Demo Supplier',
    company: 'Vigil Advisory Limited',
    hq: 'Hong Kong',
    contact: 'Wilson Chan',
    phone: '+852 5432 1098',
  }),
});
const text = await res.text();
console.log(res.status, text);
