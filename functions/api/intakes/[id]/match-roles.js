// POST /api/intakes/:id/match-roles — supplier-only.
// AI Surface B. Reads confirmed capabilities + materials, derives Roles.

import { json, shortId } from '../../_helpers.js';
import { callClaude } from '../../_lib/ai/client.js';
import { parseStrictJson } from '../../_lib/ai/parse.js';
import { logEvent } from '../../_lib/ai/logging.js';
import { buildIntakeMaterialsBlocks } from '../../_lib/ai/intake-files.js';
import {
  MATCH_ROLES_SYSTEM_PROMPT,
  MATCH_ROLES_OUTPUT_SCHEMA,
} from '../../_lib/ai/prompts/match-roles.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);
  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) return json({ ok: false, reason: 'no_api_key' });

  const { results: capRows } = await env.DB.prepare(
    'SELECT id, rc_label, name_zh, name_en, description_zh, description_en FROM capabilities WHERE intake_id = ? ORDER BY position'
  ).bind(id).all();
  if (!capRows?.length) return json({ ok: false, reason: 'no_capabilities' });

  const capListForPrompt = capRows.map(c => ({
    rc_label: c.rc_label,
    name: { zh: c.name_zh, en: c.name_en },
    description: { zh: c.description_zh, en: c.description_en },
  }));

  // Pull the LIVE taxonomy so the AI is constrained to IDs that actually
  // exist in the picker. Industries: only the 13 PARENT cat_* categories
  // (cat_finance / cat_tech / … / cat_other) so partner-suggested values
  // match exactly what /rolepacks displays and what curators edit. Leaves
  // (banking, svf, fnb, etc.) are NOT shown to the AI — the read-time
  // remap was dropping them onto parents anyway, so picking parents
  // directly keeps the stored data canonical.
  const [{ results: indRows }, { results: sizeRows }, { results: deptRows }] = await Promise.all([
    env.DB.prepare('SELECT id, parent_id, name_zh, name_en FROM taxonomy_industries WHERE parent_id IS NULL ORDER BY display_order').all(),
    env.DB.prepare('SELECT id, name_zh, name_en FROM taxonomy_company_sizes ORDER BY display_order').all(),
    env.DB.prepare('SELECT id, parent_id, name_zh, name_en FROM taxonomy_departments WHERE parent_id IS NOT NULL ORDER BY display_order').all(),
  ]);
  const validIndustryIds = new Set((indRows || []).map(r => r.id));
  const validSizeIds = new Set((sizeRows || []).map(r => r.id));
  const validDeptIds = new Set((deptRows || []).map(r => r.id));
  const taxonomyForPrompt = {
    industries: (indRows || []).map(r => ({ id: r.id, zh: r.name_zh, en: r.name_en })),
    company_sizes: (sizeRows || []).map(r => ({ id: r.id, zh: r.name_zh, en: r.name_en })),
    departments: (deptRows || []).map(r => ({ id: r.id, zh: r.name_zh, en: r.name_en })),
  };

  const { blocks } = await buildIntakeMaterialsBlocks(env, id, intake);

  await env.DB.prepare(`UPDATE intakes SET status = 'matching_roles', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

  const ai = await callClaude(env, {
    surface: 'match-roles',
    submissionId: id,
    system: MATCH_ROLES_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text:
          'Valid taxonomy (use ONLY these IDs — never invent new ones):\n'
          + JSON.stringify(taxonomyForPrompt, null, 2)
          + '\n\nCapabilities:\n' + JSON.stringify(capListForPrompt, null, 2)
          + '\n\nMaterials follow:' },
        ...blocks,
      ],
    }],
    outputSchema: MATCH_ROLES_OUTPUT_SCHEMA,
    maxTokens: 3000,

    timeoutMs: 70_000,
  });
  if (!ai.ok) return json({ ok: false, reason: ai.reason || 'error', error: ai.error });

  const parsed = parseStrictJson(ai.text);
  if (!parsed?.roles?.length) {
    await logEvent(env, 'error', 'match_roles_parse_failed', { surface: 'match-roles', submissionId: id, sample: (ai.text || '').slice(0, 300) });
    return json({ ok: false, reason: 'parse_failed' });
  }
  // Drop any IDs that aren't actually in the taxonomy. Belt-and-suspenders
  // alongside the prompt; AI sometimes invents IDs even when constrained.
  for (const r of parsed.roles) {
    r.industry = (r.industry || []).filter(x => validIndustryIds.has(x));
    r.company_size = (r.company_size || []).filter(x => validSizeIds.has(x));
    // department is an object {zh,en}; if AI also returned a department_id,
    // validate it. The prompt still uses {zh,en} so most outputs are fine.
    if (r.department_id && !validDeptIds.has(r.department_id)) delete r.department_id;
  }

  // Replace existing rolepacks for this intake (re-match wipes).
  await env.DB.prepare('DELETE FROM rolepacks_v2 WHERE intake_id = ?').bind(id).run();

  // Build a map: RC-label → capability.id (for the m-to-m link table)
  const capByLabel = Object.fromEntries(capRows.map(c => [c.rc_label, c.id]));

  // Assign rp_label server-side. AI's own rp_label is unreliable (often
  // duplicates RP-01 across items). Always start from 1 since the DELETE
  // above wiped everything.
  let nextRpNum = 1;
  for (let i = 0; i < parsed.roles.length; i++) {
    const r = parsed.roles[i];
    const rpId = shortId('RP-', 8);
    const label = `RP-${String(nextRpNum).padStart(2, '0')}`;
    nextRpNum++;
    await env.DB.prepare(`
      INSERT INTO rolepacks_v2 (id, intake_id, rp_label, name_zh, name_en, industry_json, company_size_json, department_json, position, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).bind(
      rpId, id, label,
      r.name?.zh || '', r.name?.en || '',
      JSON.stringify(r.industry || []),
      JSON.stringify(r.company_size || []),
      JSON.stringify(r.department || { zh: '', en: '' }),
      i,
    ).run();
    // Link capabilities (skip unknown labels)
    const caps = (r.capability_ids || [])
      .map(rcLabel => capByLabel[rcLabel])
      .filter(Boolean);
    for (let j = 0; j < caps.length; j++) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO rolepack_capabilities (rolepack_id, capability_id, position) VALUES (?, ?, ?)'
      ).bind(rpId, caps[j], j).run();
    }
  }

  await env.DB.prepare(
    `UPDATE intakes SET status = 'roles_ready', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true, count: parsed.roles.length });
}
