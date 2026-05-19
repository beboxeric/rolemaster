// POST /api/intakes/:id/rolepacks/:rpId/copilot — supplier-only.
// Conversational helper scoped to ONE role's questionnaire.

import { json } from '../../../../_helpers.js';
import { callClaude } from '../../../../_lib/ai/client.js';
import { parseStrictJson } from '../../../../_lib/ai/parse.js';
import { logEvent } from '../../../../_lib/ai/logging.js';
import { COPILOT_SYSTEM_PROMPT } from '../../../../_lib/ai/prompts/copilot.js';

const FIELD_LABELS = {
  'profile.daily_activities':   { zh: '日常工作内容',     en: 'Daily activities' },
  'profile.decision_maker':     { zh: '决策者',           en: 'Decision maker' },
  'profile.decision_priorities':{ zh: '决策者关注点',     en: 'Decision priorities' },
  'pain.main_pain':             { zh: '主要痛点',         en: 'Main pain' },
  'pain.current_workflow':      { zh: '现有处理方式',     en: 'Current workflow' },
  'pain.quantified_value':      { zh: '量化效果',         en: 'Quantified value' },
  'how_it_helps.workflow_integration': { zh: '能力如何嵌入', en: 'Workflow integration' },
  'how_it_helps.outcomes':      { zh: '上线后改变',       en: 'Outcomes' },
  'how_it_helps.case_study':    { zh: '客户案例',         en: 'Case study' },
  'deployment.deployment_mode': { zh: '部署方式',         en: 'Deployment mode' },
  'deployment.api_endpoint':    { zh: 'API 接入',         en: 'API endpoint' },
};

export async function onRequestPost(context) {
  const u = context.data.user;
  const { id, rpId } = context.params;
  const { env } = context;

  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  // Suppliers can only chat with their own intake's copilot; curators can chat with any.
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) {
    return json({ error: 'forbidden' }, 403);
  }

  const rp = await env.DB.prepare(
    'SELECT id, rp_label, name_zh, name_en, questionnaire_json FROM rolepacks_v2 WHERE id = ? AND intake_id = ?'
  ).bind(rpId, id).first();
  if (!rp) return json({ error: 'not_found' }, 404);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const message = (body.message || body.text || '').trim();
  // dryrun=true returns suggested updates without writing to the questionnaire.
  // Curator approval flow: client previews, then calls again with dryrun=false
  // (or a future apply-updates endpoint) to commit the chosen subset.
  const dryrun = body.dryrun === true;
  if (!message) return json({ error: 'empty_message' }, 400);
  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) {
    return json({ ok: false, reason: 'no_api_key', reply: 'AI is not configured.', updates: [] });
  }

  const questionnaire = safeParse(rp.questionnaire_json) || {};
  const stateLines = [];
  for (const [dotKey, label] of Object.entries(FIELD_LABELS)) {
    const [section, field] = dotKey.split('.');
    const v = questionnaire[section]?.[field];
    let st;
    if (v == null) st = 'empty';
    else {
      const display = Array.isArray(v.value_zh) ? v.value_zh.join(' · ') : (v.value_zh || v.value_en || '');
      st = display ? `filled = "${String(display).slice(0, 60)}"` : 'empty';
    }
    stateLines.push(`  ${dotKey} [${label.zh} / ${label.en}]: ${st}`);
  }

  const userPrompt =
    `Role: ${rp.rp_label} ${rp.name_zh}/${rp.name_en}\n\n` +
    `Current questionnaire state:\n\n${stateLines.join('\n')}\n\n` +
    `Latest from supplier:\n\n${message}`;

  const ai = await callClaude(env, {
    surface: 'copilot',
    submissionId: id,
    productId: rpId,
    system: COPILOT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1500,

    timeoutMs: 30_000,
  });
  if (!ai.ok) return json({ ok: false, reason: ai.reason, reply: 'AI temporarily unavailable.', updates: [] });

  const parsed = parseStrictJson(ai.text);
  if (!parsed) {
    await logEvent(env, 'error', 'role_copilot_parse_failed', { surface: 'copilot', submissionId: id, productId: rpId });
    return json({ ok: false, reason: 'parse_failed', reply: '我理解你的输入了。', updates: [] });
  }

  // Apply updates to the questionnaire.
  const applied = [];
  for (const upd of (parsed.fields_updated || [])) {
    const dotKey = upd.field_id;
    const [section, field] = (dotKey || '').split('.');
    if (!section || !field || !FIELD_LABELS[dotKey]) continue;
    if (!questionnaire[section]) questionnaire[section] = {};
    const display = Array.isArray(upd.value_zh) ? upd.value_zh.join(' · ') : (upd.value_zh || upd.value_en || '');
    if (!display) continue;
    questionnaire[section][field] = {
      value_zh: upd.value_zh,
      value_en: upd.value_en,
      confidence: upd.confidence ?? null,
      source_quote: '',
      _state: upd.vague_followup_needed ? 'copilot_weak' : 'copilot_filled',
    };
    applied.push({
      id: dotKey,
      label: FIELD_LABELS[dotKey],
      value: { zh: upd.value_zh, en: upd.value_en },
      status: upd.vague_followup_needed ? 'weak' : 'filled',
      vague: upd.vague_followup_needed,
    });
  }

  if (applied.length && !dryrun) {
    await env.DB.prepare(
      `UPDATE rolepacks_v2 SET questionnaire_json = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(JSON.stringify(questionnaire), rpId).run();
  }

  // Persist chat history (rolepack-scoped). Skip on dryrun so we don't pollute
  // the transcript with rejected suggestions.
  if (!dryrun) {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO rolepack_chat_messages (rolepack_id, role, content) VALUES (?, 'user', ?)`).bind(rpId, message),
      env.DB.prepare(`INSERT INTO rolepack_chat_messages (rolepack_id, role, content, meta) VALUES (?, 'bot', ?, ?)`)
        .bind(rpId, parsed.reply || '', JSON.stringify({ updates: applied.map(a => ({ id: a.id })) })),
    ]);
  }

  return json({
    ok: true,
    reply: parsed.reply,
    reply_lang: parsed.reply_lang,
    updates: applied,
    dryrun,
  });
}

export async function onRequestGet(context) {
  const u = context.data.user;
  const { id, rpId } = context.params;
  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);
  const intake = await context.env.DB.prepare('SELECT supplier_id FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);
  const { results } = await context.env.DB.prepare(
    `SELECT role, content, created_at FROM rolepack_chat_messages WHERE rolepack_id = ? ORDER BY created_at LIMIT 50`
  ).bind(rpId).all();
  return json({ items: results || [] });
}

function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
