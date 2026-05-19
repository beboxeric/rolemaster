// GET /api/admin/sales-sessions — recent sales-role logins for telemetry. T5.4.
// Curator role doubles as admin in this codebase (no admin role exists yet).

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const url = new URL(context.request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);

  const { results } = await context.env.DB.prepare(`
    SELECT id, user_id, email, ip_address, user_agent, signed_in_at, expires_at
    FROM sales_sessions
    ORDER BY signed_in_at DESC
    LIMIT ?
  `).bind(limit).all();

  return json({ items: results || [] });
}
