// PATCH/DELETE /api/intakes/:id/rolepacks/:rpId
// PATCH body: { name?, industry?, company_size?, department?, capability_ids?, questionnaire? }

import { json } from '../../../../_helpers.js';
import { remapIndustries } from '../../../../_lib/industry-remap.js';

async function authRp(context) {
  const u = context.data.user;
  const { id, rpId } = context.params;
  if (u.role !== 'supplier' && u.role !== 'curator') return { error: 'forbidden', status: 403 };
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return { error: 'not_found', status: 404 };
  // Suppliers can only touch their own intake; curators can touch any.
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) {
    return { error: 'forbidden', status: 403 };
  }
  return { id, rpId };
}

export async function onRequestPatch(context) {
  const a = await authRp(context);
  if (a.error) return json({ error: a.error }, a.status);
  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sets = [];
  const vals = [];
  if (body.name) {
    sets.push('name_zh = ?', 'name_en = ?');
    vals.push(body.name.zh || '', body.name.en || '');
  }
  // Curator-only: rename the rp_label (e.g. RP-01 → RP-AML).
  if (typeof body.rp_label === 'string' && body.rp_label.trim()) {
    const u = context.data.user;
    if (u.role === 'curator') {
      sets.push('rp_label = ?');
      vals.push(body.rp_label.trim().toUpperCase());
    }
  }
  if (Array.isArray(body.industry)) {
    // Phase 2/3 — bucket whatever the client sends (cat_* parents from the
    // new picker, legacy leaves like "banking", or stray custom:xxx free-
    // text from older drafts) onto the canonical cat_* parents via the
    // shared remap. Preserves data while normalising to the same set the
    // curator library uses. Same logic the read-time remap applies on
    // /api/public/rolepacks, so write/read stay aligned.
    sets.push('industry_json = ?');
    vals.push(JSON.stringify(remapIndustries(body.industry)));
  }
  if (Array.isArray(body.company_size)) {
    sets.push('company_size_json = ?');
    vals.push(JSON.stringify(body.company_size));
  }
  if (body.department) {
    sets.push('department_json = ?');
    vals.push(JSON.stringify(body.department));
  }
  if (body.questionnaire != null) {
    sets.push('questionnaire_json = ?');
    vals.push(JSON.stringify(body.questionnaire));
  }
  if (typeof body.position === 'number') {
    sets.push('position = ?');
    vals.push(body.position);
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    await context.env.DB.prepare(
      `UPDATE rolepacks_v2 SET ${sets.join(', ')} WHERE id = ? AND intake_id = ?`
    ).bind(...vals, a.rpId, a.id).run();
  }

  // capability_ids is m-to-m: replace the link rows.
  if (Array.isArray(body.capability_ids)) {
    await context.env.DB.prepare(
      'DELETE FROM rolepack_capabilities WHERE rolepack_id = ?'
    ).bind(a.rpId).run();
    for (let i = 0; i < body.capability_ids.length; i++) {
      await context.env.DB.prepare(
        'INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)'
      ).bind(a.rpId, body.capability_ids[i], i).run();
    }
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const a = await authRp(context);
  if (a.error) return json({ error: a.error }, a.status);
  await context.env.DB.prepare(
    'DELETE FROM rolepacks_v2 WHERE id = ? AND intake_id = ?'
  ).bind(a.rpId, a.id).run();
  return json({ ok: true });
}
