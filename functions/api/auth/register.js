// POST /api/auth/register — supplier sign-up.
// v2: only email + password collected here. Company info goes in the next step.

import { json, jsonWithCookie, signJWT, hashPassword, shortId } from '../_helpers.js';

const FREE_WEBMAIL_DOMAINS = new Set([
  'gmail.com', 'qq.com', '163.com', '126.com', 'yahoo.com', 'yahoo.com.hk',
  'outlook.com', 'hotmail.com', 'icloud.com', 'foxmail.com', 'sina.com',
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { email, password } = body;

  if (!email || !email.includes('@')) return json({ error: 'invalid_email' }, 400);
  if (!password || password.length < 4) return json({ error: 'weak_password' }, 400);

  const lcEmail = email.toLowerCase().trim();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(lcEmail).first();
  if (existing) return json({ error: 'email_taken' }, 409);

  const domain = lcEmail.split('@')[1] || '';
  const isWebmail = FREE_WEBMAIL_DOMAINS.has(domain);

  // Create a placeholder supplier record. Company name etc. fill in on the next step.
  const supplierId = shortId('SUP-', 8);
  const userId = shortId('U-', 10);
  const { hash, salt } = await hashPassword(password);
  const placeholderName = lcEmail.split('@')[0];

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO suppliers (id, name, short_name, hq, contact) VALUES (?, ?, ?, ?, ?)'
    ).bind(supplierId, '', '', '', placeholderName),
    env.DB.prepare(
      `INSERT INTO users (id, email, password, salt, name, role, supplier_id)
       VALUES (?, ?, ?, ?, ?, 'supplier', ?)`
    ).bind(userId, lcEmail, hash, salt, placeholderName, supplierId),
  ]);

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const token = await signJWT(
    { sub: userId, email: lcEmail, name: placeholderName, role: 'supplier', sup: supplierId, exp },
    env.JWT_SECRET,
  );

  return jsonWithCookie({
    ok: true,
    token,
    user: { id: userId, email: lcEmail, name: placeholderName, role: 'supplier', supplier_id: supplierId },
    is_webmail: isWebmail,
  }, token);
}
