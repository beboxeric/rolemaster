// GET /api/curator/curators — list all curator users for the assign-curator
// menu in the kanban. Any logged-in curator can read this; no superadmin gate.
// Returns minimal fields: id, name, email, is_superadmin. The frontend derives
// the avatar short label and color from id deterministically.

import { json, ensureSuperadminColumn } from '../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  await ensureSuperadminColumn(context.env);

  const { results } = await context.env.DB.prepare(
    `SELECT id, email, name, COALESCE(is_superadmin, 0) AS is_superadmin
     FROM users
     WHERE role = 'curator'
     ORDER BY is_superadmin DESC, name COLLATE NOCASE ASC`
  ).all();
  return json({ items: results || [] });
}
