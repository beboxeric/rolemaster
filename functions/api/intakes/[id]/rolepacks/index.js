// /api/intakes/:id/rolepacks
//   POST  → add a supplier-authored role
//   PATCH → bulk reorder

import { json, shortId } from '../../../_helpers.js';

async function authIntake(context) {
  const u = context.data.user;
  const id = context.params.id;
  if (u.role !== 'supplier') return { error: 'forbidden', status: 403 };
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return { error: 'not_found', status: 404 };
  if (intake.supplier_id !== u.supplier_id) return { error: 'forbidden', status: 403 };
  return { id };
}

export async function onRequestPost(context) {
  const a = await authIntake(context);
  if (a.error) return json({ error: a.error }, a.status);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const { results: existing } = await context.env.DB.prepare(
    'SELECT rp_label, position FROM rolepacks_v2 WHERE intake_id = ?'
  ).bind(a.id).all();
  const used = new Set((existing || []).map(r => r.rp_label));
  let n = 1;
  while (used.has(`RP-${String(n).padStart(2, '0')}`)) n++;
  const rpLabel = `RP-${String(n).padStart(2, '0')}`;
  const nextPos = (existing || []).reduce((m, r) => Math.max(m, r.position ?? 0), -1) + 1;

  const rpId = shortId('RP-', 8);
  await context.env.DB.prepare(`
    INSERT INTO rolepacks_v2 (id, intake_id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json, position, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).bind(
    rpId, a.id, rpLabel,
    body.name?.zh || '', body.name?.en || '',
    JSON.stringify(body.industry || []),
    JSON.stringify(body.company_size || []),
    JSON.stringify(body.department || { zh: '', en: '' }),
    nextPos,
  ).run();

  if (Array.isArray(body.capability_ids)) {
    for (let i = 0; i < body.capability_ids.length; i++) {
      await context.env.DB.prepare(
        'INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)'
      ).bind(rpId, body.capability_ids[i], i).run();
    }
  }

  return json({ ok: true, id: rpId, rp_label: rpLabel });
}
