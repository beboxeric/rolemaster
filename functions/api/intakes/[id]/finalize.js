// POST /api/intakes/:id/finalize — supplier-only.
// Marks intake as 'submitted' and each rolepack as 'submitted' (curator queue
// picks them up). Returns the rolepack IDs so the client can fan out one
// generate request per rolepack — that pattern is more reliable than
// waitUntil for multi-call AI flows.

import { json } from '../../_helpers.js';
import { logEvent } from '../../_lib/ai/logging.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  const { results: rolepacks } = await env.DB.prepare(
    'SELECT id, rp_label FROM rolepacks_v2 WHERE intake_id = ? ORDER BY position'
  ).bind(id).all();
  if (!rolepacks?.length) return json({ ok: false, reason: 'no_rolepacks' });

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE intakes SET status = 'submitted', finalized_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).bind(id),
    env.DB.prepare(
      `UPDATE rolepacks_v2 SET status = 'submitted', updated_at = datetime('now') WHERE intake_id = ?`
    ).bind(id),
  ]);
  await logEvent(env, 'info', 'finalize_submitted', { submissionId: id, count: rolepacks.length });

  return json({ ok: true, count: rolepacks.length, rolepacks: rolepacks.map(r => ({ id: r.id, rp_label: r.rp_label })) });
}
