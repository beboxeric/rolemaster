// POST /api/intakes/:id/rolepacks/:rpId/generate
// Surface D — generate customer-voice + sales materials for a single rolepack.
// Designed for client-driven parallel calls (one fetch per role) so each call
// stays within Cloudflare Pages' single-request timeout.

import { json } from '../../../../_helpers.js';
import { callClaude } from '../../../../_lib/ai/client.js';
import { parseStrictJson } from '../../../../_lib/ai/parse.js';
import { logEvent } from '../../../../_lib/ai/logging.js';
import {
  ROLE_FINALIZE_SYSTEM_PROMPT,
  ROLE_FINALIZE_OUTPUT_SCHEMA,
} from '../../../../_lib/ai/prompts/role-finalize.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const { id, rpId } = context.params;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake || intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  const rp = await env.DB.prepare('SELECT * FROM rolepacks_v2 WHERE id = ? AND intake_id = ?').bind(rpId, id).first();
  if (!rp) return json({ error: 'not_found' }, 404);

  // Idempotent: skip if already generated, unless ?force=1.
  const url = new URL(context.request.url);
  if (rp.generated_json && url.searchParams.get('force') !== '1') {
    return json({ ok: true, skipped: 'already_generated' });
  }

  const { results: caps } = await env.DB.prepare(`
    SELECT c.rc_label, c.name_zh, c.name_en, c.description_zh, c.description_en
    FROM rolepack_capabilities rc JOIN capabilities c ON c.id = rc.capability_id
    WHERE rc.rolepack_id = ? ORDER BY rc.position
  `).bind(rpId).all();

  const brief = {
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
    questionnaire: safeParse(rp.questionnaire_json) || {},
    service_pricing: safeParse(intake.service_pricing_json) || {},
  };
  if (brief.service_pricing?.pricing) delete brief.service_pricing.pricing.cost_price;

  const ai = await callClaude(env, {
    surface: 'role-finalize',
    submissionId: id,
    productId: rpId,
    system: ROLE_FINALIZE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: 'Role brief:\n' + JSON.stringify(brief, null, 2) }],
    outputSchema: ROLE_FINALIZE_OUTPUT_SCHEMA,
    maxTokens: 8000,

    timeoutMs: 80_000,
  });
  if (!ai.ok) return json({ ok: false, reason: ai.reason || 'error', error: ai.error }, 500);
  const parsed = parseStrictJson(ai.text);
  if (!parsed?.generated || !parsed?.materials) {
    await logEvent(env, 'error', 'finalize_role_parse_failed', {
      surface: 'role-finalize', submissionId: id, productId: rpId,
      keys: parsed ? Object.keys(parsed).join(',') : 'null',
      sample: (ai.text || '').slice(0, 200),
    });
    return json({ ok: false, reason: 'parse_failed' }, 500);
  }

  const blob = JSON.stringify(parsed).toLowerCase();
  if (/cost[ _]price|成本价/.test(blob)) {
    await logEvent(env, 'error', 'finalize_role_cost_leak', { submissionId: id, productId: rpId });
    return json({ ok: false, reason: 'cost_price_leak' }, 500);
  }

  await env.DB.prepare(
    `UPDATE rolepacks_v2 SET generated_json = ?, materials_draft_json = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(parsed.generated), JSON.stringify(parsed.materials), rpId).run();
  await logEvent(env, 'info', 'finalize_role_saved', {
    surface: 'role-finalize', submissionId: id, productId: rpId,
  });

  return json({ ok: true });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
