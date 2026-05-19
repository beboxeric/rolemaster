// GET /api/curator/suppliers — list every supplier with rollup counts.

import { json } from '../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const { results } = await context.env.DB.prepare(`
    SELECT
      s.id, s.name, s.short_name, s.hq, s.created_at,
      (SELECT COUNT(*) FROM intakes      i WHERE i.supplier_id = s.id) AS intake_count,
      (SELECT COUNT(*) FROM rolepacks_v2 rp JOIN intakes i ON i.id = rp.intake_id WHERE i.supplier_id = s.id) AS rolepack_count,
      (SELECT COUNT(*) FROM rolepacks_v2 rp JOIN intakes i ON i.id = rp.intake_id WHERE i.supplier_id = s.id AND rp.status = 'published') AS published_count,
      (SELECT COUNT(*) FROM capabilities  c JOIN intakes i ON i.id = c.intake_id  WHERE i.supplier_id = s.id) AS capability_count,
      (SELECT MAX(COALESCE(i.finalized_at, i.updated_at, i.created_at)) FROM intakes i WHERE i.supplier_id = s.id) AS latest_intake_at
    FROM suppliers s
    ORDER BY latest_intake_at DESC NULLS LAST, s.created_at DESC
  `).all();

  return json({ items: results || [] });
}
