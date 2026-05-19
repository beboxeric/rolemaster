// POST /api/curator/rolepacks/reorder
// Body: { ids: ['rp-id-1', 'rp-id-2', ...] }
//
// Persists the drag-drop order from the curator library by writing each
// rolepack's index in the array to a new `library_order` column. Lazy ALTER
// adds the column on first use. The curator-side library + the public
// catalogue both ORDER BY library_order ASC NULLS LAST, updated_at DESC.

import { json } from '../../_helpers.js';

async function ensureLibraryOrderColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN library_order INTEGER`).run(); } catch {}
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  await ensureLibraryOrderColumn(context.env);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string') : [];
  if (!ids.length) return json({ error: 'no_ids' }, 400);

  // Bulk-update with one prepared statement per row. SQLite doesn't have
  // a portable VALUES-batch here, but the list is small (< 100 rolepacks
  // in practice) so a single round of prepared statements is fine.
  for (let i = 0; i < ids.length; i++) {
    await context.env.DB.prepare(
      `UPDATE rolepacks_v2 SET library_order = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(i, ids[i]).run();
  }

  return json({ ok: true, n: ids.length });
}
