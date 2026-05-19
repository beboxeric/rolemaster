// POST /api/curator/intakes/:id/summary — curator-only.
// Generates a short briefing summary for the curator workbench.
// Stateless: client caches the result (the prototype DB has no column for it).

import { json } from '../../../_helpers.js';
import { callClaude } from '../../../_lib/ai/client.js';

const SYSTEM = `You are RoleMaster's curator briefing assistant.

A Capability Partner (supplier) has submitted an intake describing one or more AI products plus the operational roles those products help. A human curator is about to review it. Write a SHORT, narrative briefing in BOTH Chinese and English so the curator can scan it in 30 seconds before opening the full submission.

CRITICAL: Do NOT re-list the RolePacks or RoleCapabilities — those appear in their own sections directly below the summary. Re-listing them wastes vertical space.

Required structure (keep it compact — total height should fit on one screen):
1. **Opening paragraph (2-3 sentences):** what this product is, who it serves, the core mechanism. Lead with the product not the supplier.
2. **🌟 关键亮点 / Key highlights:** 2 bullets — the most concrete benefits or numbers
3. **💡 解决的痛点 / Pain point addressed:** 1-2 sentences — the operational problem this solves
4. **❓ 建议追问 / Questions to probe:** 2-3 bullets — sharp follow-up questions for the curator's first call with the partner

Formatting:
- Markdown bold ** ** for inline emphasis
- Use bullets (-) only inside the highlight + questions sections
- Keep emoji to the section icons shown above; don't sprinkle elsewhere
- Be specific with numbers + named tools when present in the source data
- No supplier brand worship; focus on the product mechanism

Output STRICT JSON:
{
  "summary_zh": "...",
  "summary_en": "..."
}`;

export async function onRequestPost(context) {
  const u = context.data.user;
  const { id } = context.params;
  const { env } = context;

  if (u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const intake = await env.DB.prepare(
    'SELECT id, name, status, website, industry_hint, free_text, service_pricing_json FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);

  const { results: rps } = await env.DB.prepare(
    `SELECT id, rp_label, name_zh, name_en, questionnaire_json, generated_json, status
     FROM rolepacks_v2 WHERE intake_id = ? ORDER BY position`
  ).bind(id).all();

  const { results: caps } = await env.DB.prepare(
    `SELECT rc_label, name_zh, name_en, description_zh, description_en, confirmed
     FROM capabilities WHERE intake_id = ? ORDER BY position`
  ).bind(id).all();

  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) {
    return json({ ok: false, reason: 'no_api_key' });
  }

  // Compact, model-friendly view of the data.
  const compact = {
    product_name: intake.name || '',
    industry_hint: intake.industry_hint || '',
    website: intake.website || '',
    free_text: (intake.free_text || '').slice(0, 800),
    service_pricing: safeParse(intake.service_pricing_json),
    rolepacks: (rps || []).map(r => {
      const q = safeParse(r.questionnaire_json) || {};
      const filled = countFilled(q);
      return {
        rp_label: r.rp_label,
        name: r.name_zh || r.name_en || '',
        status: r.status,
        ready: !!r.generated_json,
        questionnaire_filled: filled.filled,
        questionnaire_total: filled.total,
        snippets: extractSnippets(q),
      };
    }),
    capabilities: (caps || []).map(c => ({
      rc_label: c.rc_label,
      name: c.name_zh || c.name_en || '',
      desc: (c.description_zh || c.description_en || '').slice(0, 120),
      confirmed: !!c.confirmed,
    })),
  };

  const ai = await callClaude(env, {
    surface: 'curator_summary',
    submissionId: id,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(compact) }],
    maxTokens: 1500,
    timeoutMs: 30_000,
  });

  if (!ai.ok) return json({ ok: false, reason: ai.reason });

  const parsed = safeParse(ai.text) || tryExtract(ai.text);
  if (!parsed?.summary_zh && !parsed?.summary_en) {
    return json({ ok: false, reason: 'parse_failed', raw: ai.text.slice(0, 600) });
  }

  return json({
    ok: true,
    summary_zh: parsed.summary_zh || '',
    summary_en: parsed.summary_en || '',
    generated_at: new Date().toISOString(),
  });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function tryExtract(text) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? safeParse(m[0]) : null;
}

function countFilled(q) {
  let total = 0, filled = 0;
  for (const section of Object.values(q || {})) {
    if (!section || typeof section !== 'object') continue;
    for (const v of Object.values(section)) {
      total++;
      if (v && (v.value_zh || v.value_en)) filled++;
    }
  }
  return { total, filled };
}

function extractSnippets(q) {
  const out = {};
  for (const [sec, fields] of Object.entries(q || {})) {
    if (!fields || typeof fields !== 'object') continue;
    for (const [k, v] of Object.entries(fields)) {
      if (!v) continue;
      const display = Array.isArray(v.value_zh) ? v.value_zh.join(' · ') : (v.value_zh || v.value_en || '');
      if (display) out[`${sec}.${k}`] = String(display).slice(0, 80);
    }
  }
  return out;
}
