// POST /api/curator/rolepacks/:rpId/feature — toggle the `is_featured` flag.
// Featured rolepacks render in the landing-page hero catalogue. All published
// rolepacks (featured or not) still render in /rolepacks.
// Body: { featured: true | false }

import { json } from '../../../_helpers.js';

async function ensureFeaturedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const { rpId } = context.params;
  await ensureFeaturedColumn(context.env);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const featured = body.featured ? 1 : 0;

  const exists = await context.env.DB.prepare(
    `SELECT id, status FROM rolepacks_v2 WHERE id = ?`
  ).bind(rpId).first();
  if (!exists) return json({ error: 'not_found' }, 404);
  if (featured && exists.status !== 'published') {
    return json({ error: 'must_be_published_first' }, 400);
  }

  await context.env.DB.prepare(
    `UPDATE rolepacks_v2 SET is_featured = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(featured, rpId).run();

  return json({ ok: true, is_featured: !!featured });
}
