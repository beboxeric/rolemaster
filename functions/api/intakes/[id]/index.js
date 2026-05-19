// GET    /api/intakes/:id  — full state (intake + capabilities + rolepacks + files)
// PATCH  /api/intakes/:id  — update name, industry_hint, free_text, service_pricing_json, status
// DELETE /api/intakes/:id  — supplier removes a product. Only allowed before publication.

import { json } from '../../_helpers.js';

async function loadIntake(env, id, supplierId) {
  const row = await env.DB.prepare(
    'SELECT * FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!row) return { error: 'not_found', status: 404 };
  if (row.supplier_id !== supplierId) return { error: 'forbidden', status: 403 };
  return { intake: row };
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const r = await loadIntake(context.env, context.params.id, u.supplier_id);
  if (r.error && u.role !== 'curator') return json({ error: r.error }, r.status);

  const intake = r.intake || (await context.env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(context.params.id).first());
  if (!intake) return json({ error: 'not_found' }, 404);

  // source_quote_en may not exist on older deployments — try with it, fall back without.
  let caps;
  try {
    const r = await context.env.DB.prepare(
      'SELECT id, rc_label, name_zh, name_en, description_zh, description_en, source_quote, source_quote_en, position, source, confirmed FROM capabilities WHERE intake_id = ? ORDER BY position'
    ).bind(intake.id).all();
    caps = r.results;
  } catch {
    const r = await context.env.DB.prepare(
      'SELECT id, rc_label, name_zh, name_en, description_zh, description_en, source_quote, position, source, confirmed FROM capabilities WHERE intake_id = ? ORDER BY position'
    ).bind(intake.id).all();
    caps = r.results;
  }

  const { results: rps } = await context.env.DB.prepare(
    `SELECT id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json,
            position, questionnaire_json, generated_json, materials_draft_json, status
     FROM rolepacks_v2 WHERE intake_id = ? ORDER BY position`
  ).bind(intake.id).all();
  const rolepacks = (rps || []).map(r => ({
    ...r,
    industry: safeParse(r.industry_json),
    company_size: safeParse(r.company_size_json),
    department: safeParse(r.department_json),
    questionnaire: normaliseBullets(safeParse(r.questionnaire_json)),
    generated: safeParse(r.generated_json),
    materials_draft: safeParse(r.materials_draft_json),
  }));

  const { results: links } = await context.env.DB.prepare(
    'SELECT rolepack_id, capability_id, position FROM rolepack_capabilities WHERE rolepack_id IN (SELECT id FROM rolepacks_v2 WHERE intake_id = ?)'
  ).bind(intake.id).all();
  for (const rp of rolepacks) {
    rp.capability_ids = (links || []).filter(l => l.rolepack_id === rp.id).map(l => l.capability_id);
  }

  const { results: files } = await context.env.DB.prepare(
    'SELECT id, kind, filename, display_name, size_bytes, rolepack_id, created_at FROM intake_files WHERE intake_id = ? ORDER BY created_at'
  ).bind(intake.id).all();

  // Pull supplier name + company_info so the curator workbench can show the
  // partner's company profile alongside the per-intake product info.
  let supplier = null;
  let company = null;
  try {
    supplier = await context.env.DB.prepare(
      'SELECT id, name, short_name, hq FROM suppliers WHERE id = ?'
    ).bind(intake.supplier_id).first();
    const ci = await context.env.DB.prepare(
      'SELECT * FROM supplier_company_info WHERE supplier_id = ?'
    ).bind(intake.supplier_id).first();
    if (ci) {
      const out = {};
      for (const fid of ['company_name', 'company_hq', 'company_founded', 'company_team', 'company_clients']) {
        out[fid] = ci[fid + '_zh'] || ci[fid + '_en'] || '';
      }
      for (const c of ['website', 'contact_name', 'contact_phone', 'contact_email']) {
        if (c in ci) out[c] = ci[c] || '';
      }
      company = out;
    }
  } catch {}

  return json({
    intake: {
      id: intake.id,
      name: intake.name,
      status: intake.status,
      website: intake.website,
      industry_hint: intake.industry_hint,
      free_text: intake.free_text,
      service_pricing: safeParse(intake.service_pricing_json),
      supplier_id: intake.supplier_id,
      created_at: intake.created_at,
      updated_at: intake.updated_at,
      finalized_at: intake.finalized_at,
    },
    supplier,
    company,
    capabilities: caps || [],
    rolepacks,
    files: files || [],
  });
}

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  // Curators can patch any intake; suppliers only their own.
  if (u.role === 'supplier') {
    const r = await loadIntake(context.env, context.params.id, u.supplier_id);
    if (r.error) return json({ error: r.error }, r.status);
  } else {
    const exists = await context.env.DB.prepare('SELECT 1 FROM intakes WHERE id = ?').bind(context.params.id).first();
    if (!exists) return json({ error: 'not_found' }, 404);
  }

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  // Idempotent migration so legacy DBs accept is_published patches.
  try { await context.env.DB.prepare(`ALTER TABLE intakes ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`).run(); } catch {}

  const sets = [];
  const vals = [];
  if (typeof body.name === 'string') { sets.push('name = ?'); vals.push(body.name); }
  if (typeof body.industry_hint === 'string') { sets.push('industry_hint = ?'); vals.push(body.industry_hint); }
  if (typeof body.free_text === 'string') { sets.push('free_text = ?'); vals.push(body.free_text); }
  if (body.service_pricing != null) { sets.push('service_pricing_json = ?'); vals.push(JSON.stringify(body.service_pricing)); }
  if (typeof body.website === 'string') { sets.push('website = ?'); vals.push(body.website); }
  if (typeof body.status === 'string') {
    // intakes.status has a CHECK constraint that doesn't include 'published'
    // (it tracks wizard state). Reject 'published' here — callers should set
    // is_published instead.
    if (body.status === 'published') {
      // No-op silently; caller likely passed status='published' from the
      // kanban flow. They should pass is_published: true alongside.
    } else {
      sets.push('status = ?'); vals.push(body.status);
    }
  }
  let publishStateChanged = null;
  if (typeof body.is_published === 'boolean' || body.is_published === 0 || body.is_published === 1) {
    const flagVal = body.is_published ? 1 : 0;
    sets.push('is_published = ?'); vals.push(flagVal);
    publishStateChanged = !!flagVal;
  }
  if (sets.length === 0) return json({ ok: true, noop: true });
  sets.push("updated_at = datetime('now')");

  await context.env.DB.prepare(
    `UPDATE intakes SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals, context.params.id).run();

  // Cascade: when the curator flips is_published, mirror it on every
  // rolepack so the public catalogue + curator-inbox self-heal stay
  // consistent. Otherwise unpublishing an intake leaves all its rolepacks
  // status='published' on the server, which the next /api/curator/intakes
  // call would re-heal back to is_published=1 — making the unpublish
  // appear to silently fail.
  if (publishStateChanged === true) {
    await context.env.DB.prepare(
      `UPDATE rolepacks_v2 SET status = 'published', updated_at = datetime('now')
       WHERE intake_id = ? AND status != 'published'`
    ).bind(context.params.id).run();
  } else if (publishStateChanged === false) {
    await context.env.DB.prepare(
      `UPDATE rolepacks_v2 SET status = 'submitted', updated_at = datetime('now')
       WHERE intake_id = ? AND status = 'published'`
    ).bind(context.params.id).run();
  }
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  const intake = await context.env.DB.prepare(
    'SELECT supplier_id, status FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  // Block deletion once a curator has published any rolepack from this intake.
  const published = await context.env.DB.prepare(
    `SELECT 1 FROM rolepacks_v2 WHERE intake_id = ? AND status = 'published' LIMIT 1`
  ).bind(id).first();
  if (published) return json({ ok: false, reason: 'published' }, 400);

  // Best-effort R2 cleanup for materials.
  const { results: files } = await context.env.DB.prepare(
    'SELECT storage_key FROM intake_files WHERE intake_id = ?'
  ).bind(id).all();
  for (const f of files || []) {
    try { await context.env.R2.delete(f.storage_key); } catch {}
  }

  // Cascading deletes via FKs handle capabilities, rolepacks_v2, intake_files,
  // rolepack_chat_messages, rolepack_capabilities. Just drop the intake row.
  await context.env.DB.prepare('DELETE FROM intakes WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

// AI prefill historically chained list items with " · " on a single line, which
// renders as one ugly long string in the textarea. Convert to real newline
// bullets ("- item" per line) on read so existing rolepacks display correctly
// without a data migration. Only runs on questionnaire fields that are bullet
// lists; prose fields are left untouched.
const BULLET_LIST_FIELDS = new Set(['daily_activities', 'decision_priorities']);
function reformatBullets(text) {
  if (typeof text !== 'string' || !text) return text;
  // If it already has line breaks, assume it's been formatted properly.
  if (text.includes('\n')) return text;
  // Detect inline-bullet patterns (leading "·" or " · " separators).
  const looksLikeInlineBullets = /(^|;|;|,|,)\s*·/.test(text) || /\s·\s/.test(text);
  if (!looksLikeInlineBullets) return text;
  return text
    .split(/\s*[;;]\s*|\s*·\s*/)
    .map(s => s.replace(/^·\s*/, '').trim())
    .filter(Boolean)
    .map(s => '- ' + s)
    .join('\n');
}
function normaliseBullets(questionnaire) {
  if (!questionnaire || typeof questionnaire !== 'object') return questionnaire;
  for (const sectionKey of Object.keys(questionnaire)) {
    const section = questionnaire[sectionKey];
    if (!section || typeof section !== 'object') continue;
    for (const fieldId of Object.keys(section)) {
      const f = section[fieldId];
      if (!f || typeof f !== 'object') continue;
      // Bullet reformatting on list fields.
      if (BULLET_LIST_FIELDS.has(fieldId)) {
        if (typeof f.value_zh === 'string') f.value_zh = reformatBullets(f.value_zh);
        if (typeof f.value_en === 'string') f.value_en = reformatBullets(f.value_en);
      }
      // Strip leading RC-XX label references on every prose field — the AI
      // sometimes writes "·RC-08（快速回复发送）：…" or "RC-08: ..." which
      // breaks if the curator renames RC-08 later.
      if (typeof f.value_zh === 'string') f.value_zh = stripRcLabels(f.value_zh);
      if (typeof f.value_en === 'string') f.value_en = stripRcLabels(f.value_en);
    }
  }
  return questionnaire;
}

// Remove RC-XX (and bare/parenthesised variants) from prose values. The label
// is a moving target; leaving it baked into the supplier's questionnaire
// turns it into stale debris when curators renumber.
function stripRcLabels(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  // "RC-08（快速回复发送）：" → "快速回复发送:" (keep the parenthesised name)
  out = out.replace(/RC-\d+\s*[（(]([^）)]+)[）)]\s*[:：]?\s*/g, '$1: ');
  // Bullet "·RC-08：…" or "- RC-08: …" or just "RC-08:" / "(RC-08)"
  out = out.replace(/^([·\-•]\s*)?RC-\d+\s*[:：]\s*/gm, '$1');
  out = out.replace(/\s*[（(]\s*RC-\d+\s*[）)]/g, '');
  out = out.replace(/(^|[\s,;,;。.])RC-\d+(?=[\s,;,;。.])/g, '$1');
  // Trim doubled spaces / leading bullets/whitespace introduced by removals.
  out = out.replace(/[ \t]+/g, ' ').replace(/^([·\-•])\s+/gm, '$1 ');
  return out;
}
