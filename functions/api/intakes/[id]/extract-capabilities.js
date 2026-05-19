// POST /api/intakes/:id/extract-capabilities — supplier-only.
// AI Surface A. Reads intake materials, produces a list of capabilities (RC-NN),
// wipes any prior unconfirmed capabilities, inserts new ones.

import { json, shortId } from '../../_helpers.js';
import { callClaude } from '../../_lib/ai/client.js';
import { parseStrictJson } from '../../_lib/ai/parse.js';
import { logEvent } from '../../_lib/ai/logging.js';
import { buildIntakeMaterialsBlocks } from '../../_lib/ai/intake-files.js';
import {
  EXTRACT_CAPABILITIES_SYSTEM_PROMPT,
  EXTRACT_CAPABILITIES_OUTPUT_SCHEMA,
} from '../../_lib/ai/prompts/extract-capabilities.js';

export async function onRequestPost(context) {
  const u = context.data.user;
  const id = context.params.id;
  const { env } = context;

  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const intake = await env.DB.prepare('SELECT * FROM intakes WHERE id = ?').bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  if (!env.QWEN_API_KEY && !env.DASHSCOPE_API_KEY) return json({ ok: false, reason: 'no_api_key' });

  const { blocks, hasContent, hasReadableText, fileCount } = await buildIntakeMaterialsBlocks(env, id, intake);
  if (!hasContent) return json({ ok: false, reason: 'no_materials' });
  // Without typed text we can't extract anything useful from PDFs alone yet
  // (binary parsing not implemented for the Qwen backend).
  if (!hasReadableText) {
    await env.DB.prepare(`UPDATE intakes SET status = 'draft' WHERE id = ?`).bind(id).run();
    return json({
      ok: false,
      reason: 'pdf_text_extraction_unavailable',
      message_zh: '上传的 PDF/文档暂时无法自动提取内容。请在「产品介绍」文本框里简要描述这款产品做什么、面向哪些客户、有哪些核心能力,然后再点继续。',
      message_en: 'PDF / document text extraction is not yet available. Please describe what the product does, who it serves, and its core capabilities in the "Product description" text box, then click Continue again.',
    });
  }

  await env.DB.prepare(`UPDATE intakes SET status = 'analyzing_capabilities', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

  // Lazy column add — older deployments only had a single source_quote column.
  // Rename it to source_quote_zh semantically (we keep its DB name for backwards
  // compat; old rows are treated as zh) and add source_quote_en alongside.
  try { await env.DB.prepare(`ALTER TABLE capabilities ADD COLUMN source_quote_en TEXT`).run(); } catch {}

  // Run the AI; if the JSON comes back malformed, retry once with a stronger
  // "STRICT JSON, no prose, no markdown" reminder before surfacing parse_failed.
  async function runAi(extraNudge = '') {
    return await callClaude(env, {
      surface: 'extract-capabilities',
      submissionId: id,
      system: EXTRACT_CAPABILITIES_SYSTEM_PROMPT + (extraNudge ? '\n\n' + extraNudge : ''),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Identify the atomic capabilities present in these materials. Output strict JSON.' },
          ...blocks,
        ],
      }],
      outputSchema: EXTRACT_CAPABILITIES_OUTPUT_SCHEMA,
      // 7000 — extracting 8-12 caps with 1-3 sentence verbatim quotes each
      // can run longer than the previous 5-cap-with-bilingual-fields shape.
      maxTokens: 7000,
      timeoutMs: 110_000,
    });
  }

  let ai = await runAi();
  if (!ai.ok) {
    await env.DB.prepare(`UPDATE intakes SET status = 'draft' WHERE id = ?`).bind(id).run();
    return json({ ok: false, reason: ai.reason || 'error', error: ai.error });
  }

  let parsed = parseStrictJson(ai.text);
  if (!parsed?.capabilities?.length) {
    // One retry with a sharper system-prompt reminder. Qwen sometimes wraps
    // JSON in prose or stops mid-output; a stricter framing usually fixes it.
    await logEvent(env, 'warn', 'extract_caps_parse_retry', { surface: 'extract-capabilities', submissionId: id, sample: (ai.text || '').slice(0, 600) });
    ai = await runAi('CRITICAL: Output ONLY a single JSON object. No prose, no markdown fences, no preamble, no commentary. Start with `{` and end with `}`. Keep `description` to ONE sentence per language to fit within token budget.');
    if (ai.ok) parsed = parseStrictJson(ai.text);
  }
  if (!parsed?.capabilities?.length) {
    await logEvent(env, 'error', 'extract_caps_parse_failed', { surface: 'extract-capabilities', submissionId: id, sample: (ai.text || '').slice(0, 600) });
    await env.DB.prepare(`UPDATE intakes SET status = 'draft' WHERE id = ?`).bind(id).run();
    return json({
      ok: false,
      reason: 'parse_failed',
      message_zh: 'AI 返回的内容无法解析(已自动重试一次)。常见原因:产品材料太长或太复杂导致输出截断。请简化「产品介绍」文本或分次上传材料,然后再次点击「下一步」。',
      message_en: 'The AI response could not be parsed (auto-retried once). Usually this means the materials are too long or complex and the output got truncated. Try shortening the "Product description" or uploading fewer files at once, then click "Next" again.',
    });
  }

  // Wipe ALL AI-sourced capabilities, regardless of confirmed status. The
  // confirm step (clicking "Confirm capabilities → match Roles") flips every
  // row to confirmed=1, so the previous `WHERE confirmed = 0` clause stopped
  // doing anything after the first confirm — re-extract then APPENDED a new
  // batch on top of the existing 10, and the user saw the count jump from
  // 10 → 15. The frontend dialog already promises "your manual additions
  // are kept" (source='supplier'), so wipe only `source = 'ai'`.
  await env.DB.prepare(
    `DELETE FROM capabilities WHERE intake_id = ? AND source = 'ai'`
  ).bind(id).run();

  // Find labels still in use by surviving rows (manual supplier additions)
  // so we don't collide. The AI's own rc_label is unreliable.
  const existing = await env.DB.prepare(
    'SELECT rc_label FROM capabilities WHERE intake_id = ?'
  ).bind(id).all();
  const usedNums = new Set();
  for (const row of (existing.results || [])) {
    const m = String(row.rc_label || '').match(/^RC-(\d+)$/);
    if (m) usedNums.add(parseInt(m[1], 10));
  }
  let nextNum = 1;
  const nextLabel = () => {
    while (usedNums.has(nextNum)) nextNum++;
    const label = `RC-${String(nextNum).padStart(2, '0')}`;
    usedNums.add(nextNum); nextNum++;
    return label;
  };

  // Defensive truncation for the SHORT name field. Trims leading "RC-XX "
  // prefixes and cuts at the first major separator (— : 、 etc.) since
  // those signal the AI tried to stuff a description into the name.
  // Limits aligned with the prompt: zh up to 12 chars, en up to 6 words.
  const trimNameForLang = (s, lang) => {
    const t = String(s || '').trim();
    const stripped = t.replace(/^RC-\d+[\s—:.]*/, '').trim();
    if (lang === 'zh') {
      const cut = stripped.split(/[—:、,,]/, 1)[0].trim();
      return cut.slice(0, 18); // 18 zh chars hard cap (prompt says ≤12)
    }
    const cut = stripped.split(/[—:,;]/, 1)[0].trim();
    return cut.split(/\s+/).slice(0, 8).join(' '); // 8 en words hard cap (prompt says ≤6)
  };

  // Detect the language of an arbitrary string by CJK vs Latin char ratio.
  const detectLang = (s) => {
    const t = String(s || '');
    if (!t) return 'zh';
    const cjk = (t.match(/[一-鿿]/g) || []).length;
    const latin = (t.match(/[A-Za-z]/g) || []).length;
    return cjk >= latin ? 'zh' : 'en';
  };

  // Source language: trust the AI's `language` field; fall back to detecting
  // from the first cap's name. Default to zh if everything's empty.
  const srcLang = parsed.language === 'en' || parsed.language === 'zh'
    ? parsed.language
    : detectLang(parsed.capabilities[0]?.name);
  const tgtLang = srcLang === 'zh' ? 'en' : 'zh';

  // Translate the source-language caps into the target language in ONE batch
  // AI call. Returns parallel array; falls back to empty strings on failure
  // (the gate's auto-fill will pick up the missing side later when the
  // supplier views/edits in that language).
  async function translateBatch(items, from, to) {
    if (!items.length) return items.map(() => ({ name: '', description: '' }));
    const list = items.map((c, i) => `${i + 1}. NAME: ${c.name}\n   DESC: ${c.description || ''}`).join('\n');
    const direction = from === 'zh' ? 'Chinese to English' : 'English to Chinese';
    const sys = `You are a professional bilingual translator for an enterprise software product catalogue. Translate each capability's NAME and DESC from ${direction}, faithful to meaning AND specificity.

Constraints:
- NAME: keep the SAME action verb + object as the source. zh ≤ 12 chars (verb+object). en ≤ 6 words (TitleCase). Do NOT generalise — if the source says "邀请生成" / "Invite Generation", do NOT translate as the broader "Booking" or "Calendar Tool". Mirror the source's specificity.
- DESC: 1–2 sentences, customer-friendly, preserve every concrete detail (named platforms, specific integrations, exact verbs).
- Output strict JSON only, no prose, no markdown fences. Match the input order exactly.

Output schema:
{ "items": [ { "name": "...", "desc": "..." }, { "name": "...", "desc": "..." }, ... ] }`;
    const ai2 = await callClaude(env, {
      surface: 'extract-capabilities-translate',
      submissionId: id,
      system: sys,
      messages: [{
        role: 'user',
        content: `Translate these ${items.length} capability rows from ${direction}:\n\n${list}\n\nReturn JSON with the items array in the same order.`,
      }],
      maxTokens: 3000,
      timeoutMs: 60_000,
    });
    if (!ai2.ok) return items.map(() => ({ name: '', description: '' }));
    const out = parseStrictJson(ai2.text);
    const arr = Array.isArray(out?.items) ? out.items : [];
    return items.map((_, i) => ({
      name: arr[i]?.name || '',
      description: arr[i]?.desc || arr[i]?.description || '',
    }));
  }

  const translated = await translateBatch(parsed.capabilities, srcLang, tgtLang);

  // Position: append after existing rows so re-extract slots new caps below
  // any manual supplier additions.
  const startPos = (existing.results || []).length;
  const writes = [];
  parsed.capabilities.forEach((c, i) => {
    const capId = shortId('CAP-', 8);
    const label = nextLabel();
    const tx = translated[i] || { name: '', description: '' };
    // Source side gets the AI's original output; target side gets the batch
    // translation. Source quote goes into the matching column based on its
    // own language (the AI may have quoted from the opposite-language file).
    const nameSrc = trimNameForLang(c.name, srcLang);
    const nameTgt = trimNameForLang(tx.name, tgtLang);
    const descSrc = c.description || '';
    const descTgt = tx.description || '';
    const sqLang = detectLang(c.source_quote);
    const sqText = c.source_quote || '';
    const nameZh = srcLang === 'zh' ? nameSrc : nameTgt;
    const nameEn = srcLang === 'en' ? nameSrc : nameTgt;
    const descZh = srcLang === 'zh' ? descSrc : descTgt;
    const descEn = srcLang === 'en' ? descSrc : descTgt;
    const sqZh = sqLang === 'zh' ? sqText : '';
    const sqEn = sqLang === 'en' ? sqText : '';
    writes.push(env.DB.prepare(`
      INSERT INTO capabilities (id, intake_id, rc_label, name_zh, name_en, description_zh, description_en, source_quote, source_quote_en, position, source, confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', 0)
    `).bind(
      capId, id, label,
      nameZh, nameEn, descZh, descEn,
      sqZh, sqEn, startPos + i,
    ));
  });
  if (writes.length) await env.DB.batch(writes);

  await env.DB.prepare(
    `UPDATE intakes SET status = 'capabilities_ready', updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();

  return json({ ok: true, count: parsed.capabilities.length, file_count: fileCount });
}
