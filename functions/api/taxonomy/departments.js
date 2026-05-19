import { json } from '../_helpers.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT id, parent_id, name_zh, name_en, display_order FROM taxonomy_departments ORDER BY display_order'
  ).all();
  return json({ items: results || [] });
}
