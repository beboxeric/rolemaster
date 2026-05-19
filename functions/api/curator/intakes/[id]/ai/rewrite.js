// POST /api/curator/intakes/:id/ai/rewrite — curator-only.
// General AI helper. Used to: organize meeting notes, rewrite capability
// descriptions, auto-translate between zh/en, and suggest semantic
// RP/RC labels. Stateless — no DB writes.
//
// Body: {
//   kind: 'meeting_notes' | 'capability_desc' | 'rewrite' | 'translate' | 'suggest_labels',
//   input: string,
//   input_zh?: string, input_en?: string,
//   target_lang?: 'zh' | 'en' | 'both',
//   context?: { rc_label?, name?, items?: [{rp_label, name_zh, name_en}], ... }
// }
//
// Returns:
//   - For text kinds: { ok, output_zh, output_en, rationale }
//   - For suggest_labels: { ok, suggestions: [{ id, current_label, suggested_label, rationale }] }

import { json } from '../../../../_helpers.js';
import { callClaude } from '../../../../_lib/ai/client.js';

const SYSTEM = `You are RoleMaster's curator-side rewrite assistant.

Curators ask you to:
- "organize" raw meeting notes into clean bullet points
- rewrite a capability description so it's clearer, more specific, and customer-relevant
- translate between Chinese and English
- suggest semantic codes for RP-XXX and RC-XXX labels

Constraints:
- Output STRICT JSON
- For text rewrites/translations: { "output_zh": "...", "output_en": "...", "rationale": "<one short sentence>" }
- Always return BOTH languages when translating or when only one side is given
- Keep the original meaning; do NOT invent facts
- Be concise; don't pad
- Avoid forbidden internal vocabulary (RolePack/RoleCapability/curator/sales-assist) in customer-facing rewrites — use plain product/role/capability language instead

CRITICAL — RP/RC label naming rule:
When suggesting an RP-XXX or RC-XXX label, the suffix MUST describe the role or capability function — NEVER the supplier brand or product name.
- Good: RP-AML, RP-RM, RP-EDD, RP-QA, RP-MERCH, RC-DD, RC-COACH, RC-TRX, RC-ALERT, RC-RENDR.
- Forbidden: RP-AURORA, RP-VIGIL, RC-WIZBANK, RP-SENTINEL — anything derived from a brand, supplier, or product name.
- The suffix is a noun for the work being done.
- HARD LIMIT: the suffix after RP- or RC- is MAXIMUM 5 uppercase letters/digits. Truncate or abbreviate if needed.

For suggest_labels output: { "suggestions": [{ "id": "<id from input>", "current_label": "RC-01", "suggested_label": "RC-DD", "rationale": "due diligence" }] }`;

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'curator' && u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const { id } = context.params;
  const { env } = context;

  const intake = await env.DB.prepare('SELECT id, name, supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) {
    return json({ error: 'forbidden' }, 403);
  }

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const kind = body.kind || 'rewrite';
  const inputZh = body.input_zh || body.input || '';
  const inputEn = body.input_en || '';
  const target = body.target_lang || 'both';
  const ctx = body.context || {};

  if (!inputZh && !inputEn) return json({ error: 'empty_input' }, 400);
  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) {
    return json({ ok: false, reason: 'no_api_key' });
  }

  const userPrompt = buildUserPrompt({ kind, inputZh, inputEn, target, ctx, productName: intake.name });

  const ai = await callClaude(env, {
    surface: 'curator_rewrite',
    submissionId: id,
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 2000,

    timeoutMs: 30_000,
  });

  if (!ai.ok) return json({ ok: false, reason: ai.reason });
  const parsed = safeParse(ai.text) || tryExtract(ai.text);

  if (kind === 'suggest_labels') {
    if (!parsed?.suggestions) return json({ ok: false, reason: 'parse_failed', raw: ai.text.slice(0, 500) });
    // Enforce the 5-char-suffix hard limit defensively.
    const trimmed = (parsed.suggestions || []).map(s => {
      const lbl = String(s?.suggested_label || '').toUpperCase();
      const m = lbl.match(/^(RP|RC)-([A-Z0-9]+)$/);
      if (!m) return s;
      return { ...s, suggested_label: m[1] + '-' + m[2].slice(0, 5) };
    });
    return json({ ok: true, suggestions: trimmed });
  }

  if (!parsed?.output_zh && !parsed?.output_en) {
    return json({ ok: false, reason: 'parse_failed', raw: ai.text.slice(0, 500) });
  }
  return json({
    ok: true,
    output_zh: parsed.output_zh || '',
    output_en: parsed.output_en || '',
    rationale: parsed.rationale || '',
  });
}

function buildUserPrompt({ kind, inputZh, inputEn, target, ctx, productName }) {
  const parts = [];
  parts.push(`Product / context: ${productName || '(unknown)'}`);
  if (ctx.rc_label) parts.push(`Capability label: ${ctx.rc_label}`);
  if (ctx.name) parts.push(`Capability name: ${ctx.name}`);
  parts.push('');

  if (kind === 'suggest_labels') {
    parts.push('Task: Suggest a semantic RP-XXX or RC-XXX label for each item below. The suffix MUST describe the role/capability function, NEVER the supplier brand or product name. The supplier name is "' + (productName || '(unknown)') + '" — do not derive labels from it.');
    parts.push('');
    const items = ctx.items || [];
    parts.push('Items to label:');
    for (const it of items) {
      parts.push(`- id: ${it.id} | current: ${it.current_label} | name_zh: ${it.name_zh || ''} | name_en: ${it.name_en || ''} | desc: ${(it.description_zh || it.description_en || '').slice(0, 200)}`);
    }
    parts.push('');
    parts.push('Return strict JSON: {"suggestions":[{"id":"<id>","current_label":"<current>","suggested_label":"<RP-XXX or RC-XXX>","rationale":"<why this code>"}, ...]}');
    return parts.join('\n');
  }

  if (kind === 'meeting_notes') {
    parts.push('Task: tidy these raw meeting notes into clear bullet points (Chinese AND English). Preserve all decisions and action items. Drop filler.');
  } else if (kind === 'capability_desc') {
    parts.push('Task: rewrite this capability description so it\'s clear and specific (1–3 sentences). Lead with what it does, then how/where it fits a workflow. Customer-friendly language. Output BOTH zh and en.');
  } else if (kind === 'translate') {
    parts.push(`Task: translate. Output both zh and en versions, faithful to the original meaning.`);
  } else {
    parts.push('Task: rewrite for clarity and concision. Output BOTH zh and en.');
  }
  parts.push('');
  if (inputZh) parts.push('Chinese input:\n' + inputZh);
  if (inputEn) parts.push('English input:\n' + inputEn);
  parts.push('');
  parts.push('Return strict JSON: {"output_zh":"...","output_en":"...","rationale":"..."}');
  return parts.join('\n');
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function tryExtract(text) { const m = text.match(/\{[\s\S]*\}/); return m ? safeParse(m[0]) : null; }
