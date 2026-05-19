// GET /api/taxonomy/regions — hierarchical region list (China > Chengdu, etc.)

import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT id, name_zh, name_en, parent_id, display_order FROM taxonomy_regions ORDER BY display_order, name_en'
  ).all();
  return json({ items: results || [] });
}
