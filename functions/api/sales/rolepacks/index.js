// GET /api/sales/rolepacks — list published rolepacks for sales reps.
// Returns sanitized data — no cost_price, no curator-private fields.

import { json } from '../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'sales' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const { results } = await context.env.DB.prepare(`
    SELECT rp.id, rp.rp_label, rp.name_zh, rp.name_en, rp.industry_json, rp.company_size_json,
           rp.department_json, rp.updated_at, rp.intake_id,
           s.name AS supplier_name, s.short_name AS supplier_short_name
    FROM rolepacks_v2 rp
    JOIN intakes i ON i.id = rp.intake_id
    JOIN suppliers s ON s.id = i.supplier_id
    WHERE rp.status = 'published' AND rp.generated_json IS NOT NULL
    ORDER BY rp.updated_at DESC
  `).all();

  return json({
    items: (results || []).map(r => ({
      id: r.id,
      rp_label: r.rp_label,
      name: { zh: r.name_zh, en: r.name_en },
      industry: safeParse(r.industry_json),
      company_size: safeParse(r.company_size_json),
      department: safeParse(r.department_json),
      supplier: { name: r.supplier_name, short_name: r.supplier_short_name },
      updated_at: r.updated_at,
    })),
  });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
