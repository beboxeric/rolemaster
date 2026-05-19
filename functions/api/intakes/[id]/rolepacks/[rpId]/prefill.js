// POST /api/intakes/:id/rolepacks/:rpId/prefill — supplier-only.
// AI Surface C. Prefills one role's questionnaire from materials + its capabilities.

import { json } from '../../../../_helpers.js';
import { callClaude } from '../../../../_lib/ai/client.js';
import { parseStrictJson } from '../../../../_lib/ai/parse.js';
import { logEvent } from '../../../../_lib/ai/logging.js';
import { buildIntakeMaterialsBlocks } from '../../../../_lib/ai/intake-files.js';
import { ROLE_PREFILL_SYSTEM_PROMPT } from '../../../../_lib/ai/prompts/role-prefill.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const { id, rpId } = context.params;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);
  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) return json({ ok: false, reason: 'no_api_key' });

  const rp = await env.DB.prepare(
    'SELECT * FROM rolepacks_v2 WHERE id = ? AND intake_id = ?'
  ).bind(rpId, id).first();
  if (!rp) return json({ error: 'not_found' }, 404);

  // Skip if already prefilled (supplier has reopened the page) unless ?force=1
  const url = new URL(context.request.url);
  if (rp.questionnaire_json && url.searchParams.get('force') !== '1') {
    return json({ ok: true, skipped: true, questionnaire: JSON.parse(rp.questionnaire_json) });
  }

  // Load this role's capabilities for the prompt context.
  const { results: caps } = await env.DB.prepare(`
    SELECT c.rc_label, c.name_zh, c.name_en, c.description_zh, c.description_en
    FROM rolepack_capabilities rc
    JOIN capabilities c ON c.id = rc.capability_id
    WHERE rc.rolepack_id = ?
    ORDER BY rc.position
  `).bind(rpId).all();

  const { blocks } = await buildIntakeMaterialsBlocks(env, id, intake);

  const roleBrief = {
    rp_label: rp.rp_label,
    name: { zh: rp.name_zh, en: rp.name_en },
    industry: safeParse(rp.industry_json) || [],
    company_size: safeParse(rp.company_size_json) || [],
    department: safeParse(rp.department_json) || {},
    capabilities: (caps || []).map(c => ({
      rc_label: c.rc_label,
      name: { zh: c.name_zh, en: c.name_en },
      description: { zh: c.description_zh, en: c.description_en },
    })),
  };

  const ai = await callClaude(env, {
    surface: 'role-prefill',
    submissionId: id,
    productId: rpId,
    system: ROLE_PREFILL_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Role brief:\n' + JSON.stringify(roleBrief, null, 2) + '\n\n---\n\nMaterials follow:' },
        ...blocks,
      ],
    }],
    maxTokens: 4000,

    timeoutMs: 70_000,
  });
  if (!ai.ok) return json({ ok: false, reason: ai.reason || 'error' });

  const parsed = parseStrictJson(ai.text);
  if (!parsed) {
    await logEvent(env, 'error', 'role_prefill_parse_failed', { surface: 'role-prefill', submissionId: id, productId: rpId });
    return json({ ok: false, reason: 'parse_failed' });
  }

  await env.DB.prepare(
    `UPDATE rolepacks_v2 SET questionnaire_json = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(parsed), rpId).run();

  return json({ ok: true, questionnaire: parsed });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
