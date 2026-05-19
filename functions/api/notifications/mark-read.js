// POST /api/notifications/mark-read — body { ids: [] } or empty for all. T5.3.

import { json } from '../_helpers.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string') : [];

  if (ids.length === 0) {
    await context.env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`
    ).bind(u.id).run();
  } else {
    const placeholders = ids.map(() => '?').join(',');
    await context.env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND id IN (${placeholders})`
    ).bind(u.id, ...ids).run();
  }
  return json({ ok: true });
}
