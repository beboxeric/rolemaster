// /api/intakes — supplier-only.
//   GET  → list this supplier's intakes
//   POST → create a new intake (returns id)

import { json, shortId } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const { results } = await context.env.DB.prepare(`
    SELECT i.id, i.name, i.status, i.free_text, i.created_at, i.updated_at, i.finalized_at,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id) AS rolepack_count,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id AND rp.status = 'published') AS rolepack_published
    FROM intakes i WHERE i.supplier_id = ?
    ORDER BY i.created_at DESC
  `).bind(u.supplier_id).all();
  return json({ items: results || [] });
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const id = shortId('INT-', 8);
  const name = typeof body.name === 'string' ? body.name : null;
  const free_text = typeof body.free_text === 'string' ? body.free_text : null;
  await context.env.DB.prepare(
    `INSERT INTO intakes (id, supplier_id, status, name, free_text) VALUES (?, ?, 'draft', ?, ?)`
  ).bind(id, u.supplier_id, name, free_text).run();
  return json({ id });
}
