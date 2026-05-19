// PUT /api/curator/rolepacks/:rpId/industries — replace a rolepack's
// industry array with the canonical cat_* parent categories the curator
// has selected. Validates every value is one of the 13 known parents
// (cat_finance, cat_tech, … cat_other) so partner-prefilled custom:xxx
// strings get cleaned up at the curator review step.
//
// Body: { industries: ['cat_finance', 'cat_logistics'] }
// Returns: { ok: true, industries: [...] }
//
// This is the curator's manual cleanup tool — the partner-side AI
// generation will eventually emit cat_* values directly (Phase 2), but
// for now this endpoint lets curators normalise existing data.

import { json } from '../../../_helpers.js';

const CANONICAL_PARENTS = new Set([
  'cat_finance', 'cat_tech', 'cat_manufacturing', 'cat_retail',
  'cat_healthcare', 'cat_government', 'cat_professional', 'cat_logistics',
  'cat_realestate', 'cat_energy', 'cat_education', 'cat_telecom',
  'cat_other',
]);

export async function onRequestPut(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const { rpId } = context.params;

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const incoming = Array.isArray(body.industries) ? body.industries : null;
  if (!incoming) return json({ error: 'industries_array_required' }, 400);

  // Filter to canonical parents, dedupe, preserve order.
  const seen = new Set();
  const industries = [];
  for (const v of incoming) {
    if (typeof v !== 'string') continue;
    if (!CANONICAL_PARENTS.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    industries.push(v);
  }

  const exists = await context.env.DB.prepare(
    `SELECT id FROM rolepacks_v2 WHERE id = ?`
  ).bind(rpId).first();
  if (!exists) return json({ error: 'not_found' }, 404);

  await context.env.DB.prepare(
    `UPDATE rolepacks_v2 SET industry_json = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(industries), rpId).run();

  return json({ ok: true, industries });
}
