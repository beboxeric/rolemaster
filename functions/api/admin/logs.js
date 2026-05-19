// GET /api/admin/logs?level=error&since=ISO — recent platform logs (curator/admin only). T5.6.

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const url = new URL(context.request.url);
  const level = url.searchParams.get('level');
  const since = url.searchParams.get('since');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);

  const where = [];
  const vals = [];
  if (level) { where.push('level = ?'); vals.push(level); }
  if (since) { where.push("created_at >= ?"); vals.push(since); }

  const sql = `SELECT id, level, message, context_json, created_at
    FROM platform_logs
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ?`;
  const { results } = await context.env.DB.prepare(sql).bind(...vals, limit).all();
  return json({
    items: (results || []).map(r => ({
      ...r,
      context: r.context_json ? safeParse(r.context_json) : null,
    })),
  });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
