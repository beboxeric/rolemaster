// GET /api/public/rolepacks — public catalog of published rolepacks.
// No auth required. Used by the marketing landing at airolemaster.com to
// show the live RolePack catalogue.
//
// Privacy contract: the public listing exposes the FUNCTION (role name,
// industries, capabilities, pain it solves, value delivered) but NEVER the
// supplier company name or the product name those came from. Buyers browse
// roles; they don't browse suppliers. The curator team controls who gets
// introduced once a buyer expresses interest.

import { json } from '../_helpers.js';
import { remapIndustries, primaryIndustryRank } from '../_lib/industry-remap.js';

// Lazy ALTER so the is_featured flag is always available without a separate
// migration (same pattern we use for is_published on intakes).
async function ensureFeaturedColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
}
async function ensureLibraryOrderColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE rolepacks_v2 ADD COLUMN library_order INTEGER`).run(); } catch {}
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // ?featured=1 → only rolepacks the curator team has starred for the
  // landing page. Default (no flag) returns the full public catalogue.
  const featuredOnly = url.searchParams.get('featured') === '1';
  await ensureFeaturedColumn(context.env);
  await ensureLibraryOrderColumn(context.env);

  const featuredFilter = featuredOnly ? `AND COALESCE(rp.is_featured, 0) = 1` : '';
  // Same ordering as the curator library so "first card" stays the same in
  // both surfaces.
  const { results } = await context.env.DB.prepare(`
    SELECT rp.id, rp.rp_label, rp.name_zh, rp.name_en,
           rp.industry_json, rp.company_size_json, rp.department_json,
           rp.questionnaire_json,
           rp.updated_at, rp.intake_id,
           COALESCE(rp.is_featured, 0) AS is_featured
    FROM rolepacks_v2 rp
    JOIN intakes i ON i.id = rp.intake_id
    WHERE rp.status = 'published' AND rp.generated_json IS NOT NULL
    ${featuredFilter}
    ORDER BY (rp.library_order IS NULL) ASC, rp.library_order ASC, rp.updated_at DESC
    LIMIT 200
  `).all();

  const rps = results || [];
  // Group cards by parent industry so the landing hero, /rolepacks, and the
  // curator library all show the same order. Stable sort keeps the existing
  // library_order/updated_at order intact within each industry.
  rps.sort((a, b) => {
    const ra = primaryIndustryRank(safeParse(a.industry_json));
    const rb = primaryIndustryRank(safeParse(b.industry_json));
    return ra - rb;
  });
  // Pull every cap linked to these rolepacks in one query, then fan out.
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
        // Description = the partner-submitted explanation of what this
        // capability does. Surfaced on click of the RC pill (modal popup
        // on /rolepacks + /curators/library).
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
        // Buyer-facing excerpts. The full questionnaire stays curator/supplier-
        // only — only the pitch-relevant first sentence of each goes public.
        pain: oneSentence(field(q, 'pain', 'main_pain')),
        value: oneSentence(field(q, 'how_it_helps', 'workflow_integration')),
        outcomes: oneSentence(field(q, 'how_it_helps', 'outcomes')),
        updated_at: r.updated_at,
        is_featured: !!r.is_featured,
      };
    }),
  });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }

// Extract a {zh, en} pair for one questionnaire field; tolerates missing data.
function field(q, sectionKey, fieldId) {
  const f = q?.[sectionKey]?.[fieldId];
  if (!f || typeof f !== 'object') return null;
  return { zh: f.value_zh || '', en: f.value_en || '' };
}

// Reduce a multi-sentence / multi-bullet value to ONE clean prose line per
// language. Public cards put this after a "解决方式 · " label, so the excerpt
// must NOT start with a bullet marker (· - * •) — otherwise readers see
// "解决方式 · · …". Behaviour:
//   - Real bullet list (every line starts with bullet) → take the first item.
//   - Wrapped prose (line breaks inside one sentence) → join with spaces.
//   - Inline " · " / " • " separators → replaced with single space.
//   - First-sentence cap then trims to ≤140 chars.
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
    // Collapse inline " · " / " • " bullets the AI sometimes chains.
    t = t.replace(/\s*[·•]\s*/g, ' ').replace(/\s+/g, ' ').trim();
    // First sentence break (CN or Latin punctuation), else first ~140 chars.
    const m = t.match(/^[\s\S]{1,140}?[。!?.!?]/);
    return (m ? m[0] : t.slice(0, 140)).trim();
  };
  return { zh: cut(pair.zh), en: cut(pair.en) };
}
