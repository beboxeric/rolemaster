// GET /api/sales/rolepacks/:rpId — full rolepack content for sales reps.
// Sanitized: no cost_price.

import { json } from '../../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'sales' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const rpId = context.params.rpId;

  const rp = await context.env.DB.prepare(`
    SELECT rp.*, s.name AS supplier_name, s.short_name AS supplier_short_name
    FROM rolepacks_v2 rp
    JOIN intakes i ON i.id = rp.intake_id
    JOIN suppliers s ON s.id = i.supplier_id
    WHERE rp.id = ? AND rp.status = 'published'
  `).bind(rpId).first();
  if (!rp) return json({ error: 'not_found' }, 404);

  // Capabilities
  const { results: caps } = await context.env.DB.prepare(`
    SELECT c.rc_label, c.name_zh, c.name_en, c.description_zh, c.description_en
    FROM rolepack_capabilities rc JOIN capabilities c ON c.id = rc.capability_id
    WHERE rc.rolepack_id = ? ORDER BY rc.position
  `).bind(rpId).all();

  // Pricing — strip cost_price from intake-level service_pricing for sales.
  const intake = await context.env.DB.prepare(
    'SELECT service_pricing_json FROM intakes WHERE id = ?'
  ).bind(rp.intake_id).first();
  const pricing = safeParse(intake?.service_pricing_json) || {};
  if (pricing.pricing) {
    delete pricing.pricing.cost_price;
    delete pricing.pricing.cost_price_zh;
    delete pricing.pricing.cost_price_en;
  }

  return json({
    id: rp.id,
    rp_label: rp.rp_label,
    name: { zh: rp.name_zh, en: rp.name_en },
    industry: safeParse(rp.industry_json),
    company_size: safeParse(rp.company_size_json),
    department: safeParse(rp.department_json),
    capabilities: caps || [],
    questionnaire: safeParse(rp.questionnaire_json),
    generated: safeParse(rp.generated_json),
    materials: safeParse(rp.materials_draft_json),
    service_pricing: pricing,
    supplier: { name: rp.supplier_name, short_name: rp.supplier_short_name },
    updated_at: rp.updated_at,
  });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
