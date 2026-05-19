// POST /api/curator/rolepacks/:rpId/unpublish — pull a published rolepack
// back into the review pipeline. Curator-only.
//
// Effects:
//   1. status flips from 'published' → 'review' (rolepacks_v2 CHECK allows
//      both). The public /rolepacks catalogue and the landing hero stop
//      rendering it immediately.
//   2. is_featured clears (a re-published pack must be re-starred).
//   3. If the parent intake had is_published=1 and *no* sibling rolepack
//      remains published, intake.is_published flips to 0 so the inbox
//      surfaces the intake again under 审阅中.
//
// The curator then opens the workbench at /curators/intake/:intake_id, edits,
// and re-publishes via /api/curator/rolepacks/:rpId/publish.

import { json } from '../../../_helpers.js';

async function ensureFeaturedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}
async function ensurePublishedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE intakes ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const { rpId } = context.params;
  await ensureFeaturedColumn(context.env);
  await ensurePublishedColumn(context.env);

  const rp = await context.env.DB.prepare(
    `SELECT id, intake_id, status FROM rolepacks_v2 WHERE id = ?`
  ).bind(rpId).first();
  if (!rp) return json({ error: 'not_found' }, 404);

  await context.env.DB.prepare(
    `UPDATE rolepacks_v2 SET status = 'review', is_featured = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(rpId).run();

  // If no sibling rolepack is still published, flip the parent intake back.
  const siblings = await context.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM rolepacks_v2 WHERE intake_id = ? AND status = 'published'`
  ).bind(rp.intake_id).first();
  if ((siblings?.n || 0) === 0) {
    await context.env.DB.prepare(
      `UPDATE intakes SET is_published = 0, updated_at = datetime('now') WHERE id = ?`
    ).bind(rp.intake_id).run();
  }

  return json({ ok: true, intake_id: rp.intake_id });
}
