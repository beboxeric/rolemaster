// GET   /api/curator/suppliers/:supplierId — full supplier dossier (curator).
// PATCH /api/curator/suppliers/:supplierId — update company_info.

import { json, writeSupplierCompanyField, SUPPLIER_SCOPED_FIELDS } from '../../../_helpers.js';

const SINGLE_COLUMNS = ['website', 'contact_name', 'contact_phone', 'contact_email'];

async function ensureContactColumns(env) {
  for (const col of SINGLE_COLUMNS) {
    try { await env.DB.prepare(`ALTER TABLE supplier_company_info ADD COLUMN ${col} TEXT`).run(); }
    catch { /* exists */ }
  }
}

async function loadCompany(env, supplierId) {
  await ensureContactColumns(env);
  const row = await env.DB.prepare(
    'SELECT * FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(supplierId).first();
  const out = {};
  for (const fid of SUPPLIER_SCOPED_FIELDS) {
    out[fid] = { zh: row?.[`${fid}_zh`] || '', en: row?.[`${fid}_en`] || '' };
  }
  for (const c of SINGLE_COLUMNS) out[c] = row?.[c] || '';
  return out;
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const { supplierId } = context.params;

  const supplier = await context.env.DB.prepare(
    'SELECT id, name, short_name, hq, contact, phone, founded, team, clients, created_at FROM suppliers WHERE id = ?'
  ).bind(supplierId).first();
  if (!supplier) return json({ error: 'not_found' }, 404);

  const company = await loadCompany(context.env, supplierId);

  const { results: intakeRows } = await context.env.DB.prepare(
    `SELECT id, name, status, industry_hint, created_at, updated_at, finalized_at
     FROM intakes WHERE supplier_id = ?
     ORDER BY COALESCE(finalized_at, updated_at, created_at) DESC`
  ).bind(supplierId).all();
  const intakes = intakeRows || [];

  let rolepacks = [], capabilities = [];
  if (intakes.length > 0) {
    const ids = intakes.map(i => i.id);
    const placeholders = ids.map(() => '?').join(',');
    const { results: rps } = await context.env.DB.prepare(
      `SELECT id, intake_id, rp_label, name_zh, name_en, status, position
       FROM rolepacks_v2 WHERE intake_id IN (${placeholders}) ORDER BY position`
    ).bind(...ids).all();
    rolepacks = rps || [];
    const { results: caps } = await context.env.DB.prepare(
      `SELECT id, intake_id, rc_label, name_zh, name_en, position
       FROM capabilities WHERE intake_id IN (${placeholders}) ORDER BY position`
    ).bind(...ids).all();
    capabilities = caps || [];
  }

  return json({
    supplier,
    company,
    intakes,
    rolepacks,
    capabilities,
  });
}

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const { supplierId } = context.params;

  await ensureContactColumns(context.env);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const updates = body.updates || {};

  // Ensure row exists
  const exist = await context.env.DB.prepare(
    'SELECT supplier_id FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(supplierId).first();
  if (!exist) {
    await context.env.DB.prepare('INSERT INTO supplier_company_info (supplier_id) VALUES (?)').bind(supplierId).run();
  }

  let written = 0;
  for (const fid of SUPPLIER_SCOPED_FIELDS) {
    if (!(fid in updates)) continue;
    const v = updates[fid];
    const vz = (typeof v === 'object' ? v.zh : v) || '';
    const ve = (typeof v === 'object' ? v.en : v) || '';
    await writeSupplierCompanyField(context.env, supplierId, fid, vz, ve);
    written++;
  }
  for (const col of SINGLE_COLUMNS) {
    if (!(col in updates)) continue;
    const w = typeof updates[col] === 'string' ? updates[col] : '';
    await context.env.DB.prepare(
      `UPDATE supplier_company_info SET ${col} = ?, updated_at = datetime('now') WHERE supplier_id = ?`
    ).bind(w, supplierId).run();
    written++;
  }

  // Optional top-level supplier table fields (HQ, contact, phone — legacy)
  const sets = [];
  const vals = [];
  if (typeof body.name === 'string') { sets.push('name = ?'); vals.push(body.name); }
  if (typeof body.short_name === 'string') { sets.push('short_name = ?'); vals.push(body.short_name); }
  if (typeof body.hq === 'string') { sets.push('hq = ?'); vals.push(body.hq); }
  if (sets.length > 0) {
    await context.env.DB.prepare(
      `UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...vals, supplierId).run();
    written += sets.length;
  }

  return json({ ok: true, updated: written });
}
