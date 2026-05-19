// GET  /api/taxonomy/industries — list (any authenticated user)
// POST /api/taxonomy/industries — create (curator/admin)
//
// T5.5

import { json, shortId } from '../../_helpers.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(`
    SELECT id, name_zh, name_en, parent_id, display_order, created_at
    FROM taxonomy_industries
    ORDER BY display_order, name_en
  `).all();
  return json({ items: results || [] });
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const nameZh = (body.name_zh || '').trim();
  const nameEn = (body.name_en || '').trim();
  if (!nameZh || !nameEn) return json({ error: 'name_required' }, 400);

  const id = (body.id || shortId('IND-', 6)).toLowerCase();
  const parentId = body.parent_id || null;
  const displayOrder = Number.isInteger(body.display_order) ? body.display_order : 0;

  await context.env.DB.prepare(`
    INSERT INTO taxonomy_industries (id, name_zh, name_en, parent_id, display_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, nameZh, nameEn, parentId, displayOrder, u.id).run();

  return json({ ok: true, id });
}
