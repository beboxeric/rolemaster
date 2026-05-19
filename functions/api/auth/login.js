// POST /api/auth/login

import { json, jsonWithCookie, signJWT, verifyPassword, shortId } from '../_helpers.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { email, password } = body;
  if (!email || !password) return json({ error: 'missing_credentials' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, email, password, salt, name, role, supplier_id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  if (!user) return json({ error: 'invalid_credentials' }, 401);

  const ok = await verifyPassword(password, user.password, user.salt);
  if (!ok) return json({ error: 'invalid_credentials' }, 401);

  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const token = await signJWT(
    { sub: user.id, email: user.email, name: user.name, role: user.role, sup: user.supplier_id, exp },
    env.JWT_SECRET,
  );

  // T5.4 — track sales sessions for telemetry. Best-effort; don't block login.
  if (user.role === 'sales') {
    try {
      const sessionId = shortId('SLS-', 10);
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
      const ua = request.headers.get('User-Agent') || '';
      await env.DB.prepare(
        `INSERT INTO sales_sessions (id, user_id, email, ip_address, user_agent, signed_in_at, expires_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime(?, 'unixepoch'))`
      ).bind(sessionId, user.id, user.email, ip, ua, exp).run();
    } catch {}
  }

  // `token` is also returned in the body so the client can stash it in
  // sessionStorage for per-tab auth. The cookie still rides along as a
  // fallback for fresh tabs and refreshes.
  return jsonWithCookie({
    ok: true,
    token,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, supplier_id: user.supplier_id,
    },
  }, token);
}
