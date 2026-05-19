// PATCH  /api/taxonomy/industries/:id — rename / reorder (curator)
// DELETE /api/taxonomy/industries/:id — remove (curator)
//
// T5.5

import { json } from '../../_helpers.js';

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sets = [];
  const vals = [];
  if (typeof body.name_zh === 'string') { sets.push('name_zh = ?'); vals.push(body.name_zh); }
  if (typeof body.name_en === 'string') { sets.push('name_en = ?'); vals.push(body.name_en); }
  if (Number.isInteger(body.display_order)) { sets.push('display_order = ?'); vals.push(body.display_order); }
  if ('parent_id' in body) { sets.push('parent_id = ?'); vals.push(body.parent_id || null); }
  if (sets.length === 0) return json({ ok: true, noop: true });

  await context.env.DB.prepare(
    `UPDATE taxonomy_industries SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals, id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  await context.env.DB.prepare('DELETE FROM taxonomy_industries WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
