// GET /api/curator/intakes — list intakes by status
// Query params: ?status=submitted|published|all (default: submitted)

import { json } from '../../_helpers.js';

// The intakes.status column has a CHECK constraint that doesn't allow
// 'published' (it tracks wizard state: draft / submitted / etc). The
// publish lifecycle is orthogonal — we track it on a separate
// `is_published` flag added lazily here. This sidesteps the schema
// migration required to alter a SQLite CHECK constraint.
async function ensurePublishedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE intakes ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || 'submitted';

  await ensurePublishedColumn(context.env);

  // Self-heal: any intake whose rolepacks are ALL status='published' but
  // whose `is_published` flag is 0 gets flipped here. Catches Aselo / Vigil
  // — their rolepacks went live, but the intake-side update was failing
  // silently against the status CHECK constraint. Idempotent.
  let healed = 0;
  let healError = null;
  try {
    const { results: stuck } = await context.env.DB.prepare(`
      SELECT i.id
      FROM intakes i
      WHERE COALESCE(i.is_published, 0) = 0
        AND EXISTS (SELECT 1 FROM rolepacks_v2 rp WHERE rp.intake_id = i.id)
        AND NOT EXISTS (
          SELECT 1 FROM rolepacks_v2 rp
          WHERE rp.intake_id = i.id AND rp.status != 'published'
        )
    `).all();
    for (const row of (stuck || [])) {
      const r = await context.env.DB.prepare(
        `UPDATE intakes SET is_published = 1, updated_at = datetime('now') WHERE id = ?`
      ).bind(row.id).run();
      if (r?.success) healed++;
    }
  } catch (e) {
    healError = String(e?.message || e).slice(0, 200);
  }

  let where = '';
  const args = [];
  if (status !== 'all') {
    where = ' WHERE i.status = ?';
    args.push(status);
  }

  // The v2 onboarding flow stores company name in `supplier_company_info`
  // (zh + en columns), not in suppliers.name. Coalesce so the curator inbox
  // shows e.g. "Aselo Company Limited" instead of falling back to the
  // product name — old rows used suppliers.name, new ones use company_info.
  const { results } = await context.env.DB.prepare(`
    SELECT i.id, i.name, i.status, COALESCE(i.is_published, 0) AS is_published,
           i.website, i.industry_hint, i.created_at, i.updated_at, i.finalized_at,
           COALESCE(NULLIF(sci.company_name_zh, ''), NULLIF(sci.company_name_en, ''), NULLIF(s.name, ''), s.short_name) AS supplier_name,
           COALESCE(NULLIF(s.short_name, ''), NULLIF(sci.company_name_en, ''), s.name) AS supplier_short_name,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id) AS rolepack_count,
           (SELECT COUNT(*) FROM rolepacks_v2 rp WHERE rp.intake_id = i.id AND rp.generated_json IS NOT NULL) AS rolepack_ready,
           (SELECT COUNT(*) FROM capabilities c WHERE c.intake_id = i.id) AS capability_count
    FROM intakes i
    JOIN suppliers s ON s.id = i.supplier_id
    LEFT JOIN supplier_company_info sci ON sci.supplier_id = s.id
    ${where}
    ORDER BY i.finalized_at DESC NULLS LAST, i.updated_at DESC
  `).bind(...args).all();

  const items = results || [];
  // Hydrate each intake with its rolepack + capability lists (label + name).
  // Pulled in one query per kind, then joined in JS to avoid the N+1 round-trip.
  if (items.length > 0) {
    const intakeIds = items.map(it => it.id);
    const placeholders = intakeIds.map(() => '?').join(',');
    const { results: rps } = await context.env.DB.prepare(
      `SELECT id, intake_id, rp_label, name_zh, name_en, position, status,
              CASE WHEN generated_json IS NOT NULL THEN 1 ELSE 0 END AS has_generated
       FROM rolepacks_v2
       WHERE intake_id IN (${placeholders})
       ORDER BY position`
    ).bind(...intakeIds).all();
    const { results: caps } = await context.env.DB.prepare(
      `SELECT id, intake_id, rc_label, name_zh, name_en, position
       FROM capabilities
       WHERE intake_id IN (${placeholders})
       ORDER BY position`
    ).bind(...intakeIds).all();
    const rpsByIntake = {};
    for (const r of (rps || [])) (rpsByIntake[r.intake_id] = rpsByIntake[r.intake_id] || []).push(r);
    const capsByIntake = {};
    for (const c of (caps || [])) (capsByIntake[c.intake_id] = capsByIntake[c.intake_id] || []).push(c);
    for (const it of items) {
      it.rolepacks    = rpsByIntake[it.id]  || [];
      it.capabilities = capsByIntake[it.id] || [];
    }
  }

  return json({ items, _heal: { count: healed, error: healError } });
}
