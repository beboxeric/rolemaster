// GET /api/notifications — current user's notifications, newest first. T5.3.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  const url = new URL(context.request.url);
  const onlyUnread = url.searchParams.get('unread') === '1';

  const sql = `SELECT id, type, payload_json, read_at, created_at
    FROM notifications
    WHERE user_id = ?${onlyUnread ? ' AND read_at IS NULL' : ''}
    ORDER BY created_at DESC
    LIMIT 50`;
  const { results } = await context.env.DB.prepare(sql).bind(u.id).all();

  const items = (results || []).map(r => ({
    id: r.id,
    type: r.type,
    payload: r.payload_json ? safeParse(r.payload_json) : null,
    read: !!r.read_at,
    createdAt: r.created_at,
  }));
  const unread = items.filter(i => !i.read).length;
  return json({ items, unread });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
