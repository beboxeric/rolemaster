// GET /api/auth/me — current user + supplier record (if applicable).
// Auth is enforced by _middleware.js; we just read context.data.user here.

import { json, ensureSuperadminColumn, isSuperadmin } from '../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  let supplier = null;
  if (u.supplier_id) {
    supplier = await context.env.DB.prepare(
      'SELECT id, name, short_name, hq, contact, phone, founded, team, clients FROM suppliers WHERE id = ?'
    ).bind(u.supplier_id).first();
    // v2 stores company info separately; prefer that as the display name.
    if (supplier) {
      const co = await context.env.DB.prepare(
        'SELECT company_name_zh, company_name_en, company_hq_zh, company_hq_en FROM supplier_company_info WHERE supplier_id = ?'
      ).bind(u.supplier_id).first();
      if (co) {
        const coName = co.company_name_zh || co.company_name_en || '';
        if (coName) {
          supplier.name = supplier.name || coName;
          supplier.short_name = supplier.short_name || coName;
          supplier.company_name_zh = co.company_name_zh || '';
          supplier.company_name_en = co.company_name_en || '';
          supplier.hq = supplier.hq || (co.company_hq_zh || co.company_hq_en || '');
        }
      }
    }
  }
  // T4.3 — server-side language preference
  await ensureSuperadminColumn(context.env);
  const pref = await context.env.DB.prepare(
    'SELECT language, is_superadmin FROM users WHERE id = ?'
  ).bind(u.id).first();
  const superFlag = await isSuperadmin(context.env, u);
  return json({
    user: {
      id: u.id, email: u.email, name: u.name, role: u.role, supplier_id: u.supplier_id,
      language: pref?.language || null,
      is_superadmin: superFlag ? 1 : 0,
    },
    supplier,
  });
}
