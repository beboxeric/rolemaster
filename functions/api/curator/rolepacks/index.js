// GET /api/curator/rolepacks — list every published rolepack with the star
// state. Used by the curator's "Published RolePack Library" page so curators
// can toggle which packs surface on the landing page hero catalogue.
//
// Returns the same buyer-facing shape as /api/public/rolepacks (so the
// curator library uses the same card component) PLUS:
//   - is_featured (the star state)
//   - intake_id + supplier_short_name (handy in-house labels for curators)
//
// Curator-only — non-curators see the public endpoint.

import { json } from '../../_helpers.js';
import { remapIndustries, primaryIndustryRank } from '../../_lib/industry-remap.js';

async function ensureFeaturedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}
async function ensureLibraryOrderColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN library_order INTEGER`).run(); } catch {}
}

export async function onRequestGet(context) {
  const u = context.data.user;
  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  await ensureFeaturedColumn(context.env);
  await ensureLibraryOrderColumn(context.env);

  // Curator-set library order takes precedence; rolepacks without an
  // explicit position fall back to most-recently-updated.
  const { results } = await context.env.DB.prepare(`
    SELECT rp.id, rp.rp_label, rp.name_zh, rp.name_en,
           rp.industry_json, rp.company_size_json, rp.department_json,
           rp.questionnaire_json,
           rp.status, rp.updated_at, rp.intake_id,
           COALESCE(rp.is_featured, 0) AS is_featured,
           rp.library_order,
           i.name AS intake_name,
           s.short_name AS supplier_short_name, s.name AS supplier_name
    FROM rolepacks_v2 rp
    JOIN intakes i ON i.id = rp.intake_id
    LEFT JOIN suppliers s ON s.id = i.supplier_id
    WHERE rp.status = 'published' AND rp.generated_json IS NOT NULL
    ORDER BY (rp.library_order IS NULL) ASC, rp.library_order ASC, rp.updated_at DESC
    LIMIT 500
  `).all();

  const rps = results || [];
  // Group cards by parent industry so the curator library matches the public
  // /rolepacks and landing hero order. Stable sort preserves library_order /
  // updated_at within each industry — drag-drop within an industry still works.
  rps.sort((a, b) => {
    const ra = primaryIndustryRank(safeParse(a.industry_json));
    const rb = primaryIndustryRank(safeParse(b.industry_json));
    return ra - rb;
  });
  let capsByRp = {};
  if (rps.length) {
    const rpIds = rps.map(r => r.id);
    const placeholders = rpIds.map(() => '?').join(',');
    const { results: links } = await context.env.DB.prepare(
      `SELECT rc.rolepack_id, c.id, c.rc_label, c.name_zh, c.name_en,
              c.description_zh, c.description_en, rc.position
       FROM rolepack_capabilities rc
       JOIN capabilities c ON c.id = rc.capability_id
       WHERE rc.rolepack_id IN (${placeholders})
       ORDER BY rc.position`
    ).bind(...rpIds).all();
    capsByRp = {};
    for (const l of (links || [])) {
      (capsByRp[l.rolepack_id] = capsByRp[l.rolepack_id] || []).push({
        id: l.id, rc_label: l.rc_label,
        name: { zh: l.name_zh, en: l.name_en },
        description: { zh: l.description_zh, en: l.description_en },
      });
    }
  }

  return json({
    items: rps.map(r => {
      const q = safeParse(r.questionnaire_json) || {};
      return {
        id: r.id,
        rp_label: r.rp_label,
        name: { zh: r.name_zh, en: r.name_en },
        industry: remapIndustries(safeParse(r.industry_json)),
        company_size: safeParse(r.company_size_json),
        department: safeParse(r.department_json),
        capabilities: capsByRp[r.id] || [],
        pain: oneSentence(field(q, 'pain', 'main_pain')),
        value: oneSentence(field(q, 'how_it_helps', 'workflow_integration')),
        outcomes: oneSentence(field(q, 'how_it_helps', 'outcomes')),
        updated_at: r.updated_at,
        is_featured: !!r.is_featured,
        intake_id: r.intake_id,
        intake_name: r.intake_name,
        supplier_name: r.supplier_name,
        supplier_short_name: r.supplier_short_name,
      };
    }),
  });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

function field(q, sectionKey, fieldId) {
  const f = q?.[sectionKey]?.[fieldId];
  if (!f || typeof f !== 'object') return null;
  return { zh: f.value_zh || '', en: f.value_en || '' };
}

function oneSentence(pair) {
  if (!pair) return null;
  const stripLeadingBullets = (s) => String(s || '')
    .replace(/^([·\-*•]\s*)+/, '')
    .trim();
  const cut = (s) => {
    if (!s) return '';
    let t = String(s).trim();
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const allBullets = lines.every(l => /^[-·*•]\s*/.test(l));
      t = allBullets
        ? stripLeadingBullets(lines[0])
        : lines.map(stripLeadingBullets).join(' ');
    } else {
      t = stripLeadingBullets(t);
    }
    t = t.replace(/\s*[·•]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const m = t.match(/^[\s\S]{1,140}?[。!?.!?]/);
    return (m ? m[0] : t.slice(0, 140)).trim();
  };
  return { zh: cut(pair.zh), en: cut(pair.en) };
}
