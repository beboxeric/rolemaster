// GET / PATCH /api/suppliers/me/company-info — supplier-shared Section 1 fields.

import { json, writeSupplierCompanyField, SUPPLIER_SCOPED_FIELDS } from '../../_helpers.js';

const SINGLE_COLUMNS = ['website', 'contact_name', 'contact_phone', 'contact_email'];

// Idempotent column ensure — ALTER TABLE ... ADD COLUMN throws if the column
// already exists, so we swallow that. Lets us ship contact fields before
// applying migrations through the dashboard. Real cost is one cheap query
// per request after first run.
async function ensureContactColumns(env) {
  for (const col of SINGLE_COLUMNS) {
    try { await env.DB.prepare(`ALTER TABLE supplier_company_info ADD COLUMN ${col} TEXT`).run(); }
    catch { /* column exists — ignore */ }
  }
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  await ensureContactColumns(context.env);
  const row = await context.env.DB.prepare(
    'SELECT * FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(u.supplier_id).first();
  const out = {};
  for (const fid of SUPPLIER_SCOPED_FIELDS) {
    out[fid] = {
      zh: row?.[`${fid}_zh`] || '',
      en: row?.[`${fid}_en`] || '',
    };
  }
  for (const c of SINGLE_COLUMNS) out[c] = row?.[c] || '';
  return json({ company: out });
}

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  await ensureContactColumns(context.env);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const updates = body.updates || {};

  // Ensure row exists.
  const exist = await context.env.DB.prepare(
    'SELECT supplier_id FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(u.supplier_id).first();
  if (!exist) {
    await context.env.DB.prepare('INSERT INTO supplier_company_info (supplier_id) VALUES (?)').bind(u.supplier_id).run();
  }

  let written = 0;
  for (const fid of SUPPLIER_SCOPED_FIELDS) {
    if (!(fid in updates)) continue;
    const v = updates[fid];
    const vz = (typeof v === 'object' ? v.zh : v) || '';
    const ve = (typeof v === 'object' ? v.en : v) || '';
    await writeSupplierCompanyField(context.env, u.supplier_id, fid, vz, ve);
    written++;
  }
  for (const col of SINGLE_COLUMNS) {
    if (!(col in updates)) continue;
    const w = typeof updates[col] === 'string' ? updates[col] : '';
    await context.env.DB.prepare(
      `UPDATE supplier_company_info SET ${col} = ?, updated_at = datetime('now') WHERE supplier_id = ?`
    ).bind(w, u.supplier_id).run();
    written++;
  }
  return json({ ok: true, updated: written });
}
