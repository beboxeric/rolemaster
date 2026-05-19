// PATCH/DELETE /api/intakes/:id/capabilities/:capId
// Suppliers can only edit caps on their own intake; curators can edit any.

import { json } from '../../../_helpers.js';

async function authCap(context) {
  const u = context.data.user;
  const { id, capId } = context.params;
  if (u.role !== 'supplier' && u.role !== 'curator') return { error: 'forbidden', status: 403 };
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return { error: 'not_found', status: 404 };
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) {
    return { error: 'forbidden', status: 403 };
  }
  return { id, capId };
}

export async function onRequestPatch(context) {
  const a = await authCap(context);
  if (a.error) return json({ error: a.error }, a.status);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const sets = [];
  const vals = [];
  if (body.name) {
    sets.push('name_zh = ?', 'name_en = ?');
    vals.push(body.name.zh || '', body.name.en || '');
  }
  if (body.description) {
    sets.push('description_zh = ?', 'description_en = ?');
    vals.push(body.description.zh || '', body.description.en || '');
  }
  // Curator-only: rename the rc_label (e.g. RC-01 → RC-DD).
  if (typeof body.rc_label === 'string' && body.rc_label.trim()) {
    const u = context.data.user;
    if (u.role === 'curator') {
      sets.push('rc_label = ?');
      vals.push(body.rc_label.trim().toUpperCase());
    }
  }
  if (typeof body.confirmed === 'number' || typeof body.confirmed === 'boolean') {
    sets.push('confirmed = ?');
    vals.push(body.confirmed ? 1 : 0);
  }
  if (typeof body.position === 'number') {
    sets.push('position = ?');
    vals.push(body.position);
  }
  if (sets.length === 0) return json({ ok: true, noop: true });

  await context.env.DB.prepare(
    `UPDATE capabilities SET ${sets.join(', ')} WHERE id = ? AND intake_id = ?`
  ).bind(...vals, a.capId, a.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const a = await authCap(context);
  if (a.error) return json({ error: a.error }, a.status);
  await context.env.DB.prepare(
    'DELETE FROM capabilities WHERE id = ? AND intake_id = ?'
  ).bind(a.capId, a.id).run();
  return json({ ok: true });
}
