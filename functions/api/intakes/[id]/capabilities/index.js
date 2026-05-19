// /api/intakes/:id/capabilities
//   POST  → add a supplier-authored capability
//   PATCH → bulk update (e.g. confirm all, reorder)

import { json, shortId } from '../../../_helpers.js';

async function authIntake(context) {
  const u = context.data.user;
  const id = context.params.id;
  if (u.role !== 'supplier') return { error: 'forbidden', status: 403 };
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return { error: 'not_found', status: 404 };
  if (intake.supplier_id !== u.supplier_id) return { error: 'forbidden', status: 403 };
  return { id, intake };
}

export async function onRequestPost(context) {
  const a = await authIntake(context);
  if (a.error) return json({ error: a.error }, a.status);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const capId = shortId('CAP-', 8);

  // Compute next RC label.
  const { results: existing } = await context.env.DB.prepare(
    'SELECT rc_label FROM capabilities WHERE intake_id = ?'
  ).bind(a.id).all();
  const used = new Set((existing || []).map(r => r.rc_label));
  let n = 1;
  while (used.has(`RC-${String(n).padStart(2, '0')}`)) n++;
  const rcLabel = `RC-${String(n).padStart(2, '0')}`;

  const { results: posRows } = await context.env.DB.prepare(
    'SELECT MAX(position) AS m FROM capabilities WHERE intake_id = ?'
  ).bind(a.id).all();
  const nextPos = (posRows?.[0]?.m ?? -1) + 1;

  await context.env.DB.prepare(`
    INSERT INTO capabilities (id, intake_id, rc_label, name_zh, name_en, description_zh, description_en, position, source, confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'supplier', 1)
  `).bind(
    capId, a.id, rcLabel,
    body.name?.zh || '', body.name?.en || '',
    body.description?.zh || '', body.description?.en || '',
    nextPos,
  ).run();

  return json({ ok: true, id: capId, rc_label: rcLabel });
}

export async function onRequestPatch(context) {
  const a = await authIntake(context);
  if (a.error) return json({ error: a.error }, a.status);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  // Bulk: { confirm_all: true } or { updates: [{ id, name?, description?, position? }] }
  if (body.confirm_all) {
    await context.env.DB.prepare(
      'UPDATE capabilities SET confirmed = 1 WHERE intake_id = ?'
    ).bind(a.id).run();
    await context.env.DB.prepare(
      `UPDATE intakes SET status = 'matching_roles', updated_at = datetime('now') WHERE id = ?`
    ).bind(a.id).run();
    return json({ ok: true });
  }

  const updates = Array.isArray(body.updates) ? body.updates : [];
  for (const u of updates) {
    const sets = [];
    const vals = [];
    if (u.name) {
      sets.push('name_zh = ?', 'name_en = ?');
      vals.push(u.name.zh || '', u.name.en || '');
    }
    if (u.description) {
      sets.push('description_zh = ?', 'description_en = ?');
      vals.push(u.description.zh || '', u.description.en || '');
    }
    if (typeof u.position === 'number') {
      sets.push('position = ?');
      vals.push(u.position);
    }
    if (sets.length === 0) continue;
    await context.env.DB.prepare(
      `UPDATE capabilities SET ${sets.join(', ')} WHERE id = ? AND intake_id = ?`
    ).bind(...vals, u.id, a.id).run();
  }
  return json({ ok: true });
}
