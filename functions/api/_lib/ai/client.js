// AI client. Routes through Qwen (Alibaba DashScope) — single backend for all
// AI surfaces (extract-capabilities, match-roles, role-prefill, rewrite,
// summary, copilot). The legacy callClaude name is kept as an alias for
// callQwen so older call sites don't need to change.
//
// Required env (either name works — DASHSCOPE_API_KEY mirrors the Aselo
// project's convention): QWEN_API_KEY or DASHSCOPE_API_KEY.
// Optional: QWEN_MODEL / DASHSCOPE_MODEL (default 'qwen-plus'),
//           QWEN_BASE_URL / DASHSCOPE_BASE_URL.

import { logEvent } from './logging.js';

export const DEFAULT_MODEL = 'qwen-plus';

const RETRIABLE_STATUSES = new Set([429, 529, 500, 502, 503, 504]);

function qwenApiKey(env) {
  // Trim — copy/paste from the dashboard often picks up trailing whitespace
  return ((env.QWEN_API_KEY || env.DASHSCOPE_API_KEY) || '').trim();
}
function qwenModel(env) {
  return ((env.QWEN_MODEL || env.DASHSCOPE_MODEL) || '').trim();
}
// OpenAI-compatible DashScope endpoint. International host by default; can be
// overridden with QWEN_BASE_URL / DASHSCOPE_BASE_URL (use
// https://dashscope.aliyuncs.com/compatible-mode/v1 for China region).
function qwenBaseUrl(env) {
  const raw = env.QWEN_BASE_URL || env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  return raw.trim().replace(/\/$/, '');
}

// Backwards-compatible name. New + old call sites both end up here.
// `system` may be a string or a [{ type:'text', text:'...' }] block array
// (collapsed to a single string before send). `messages` is the OpenAI-style
// chat array (we prepend `system` ourselves).
export async function callClaude(env, opts) {
  return callQwen(env, opts);
}

export async function callQwen(env, {
  surface,
  submissionId = null,
  productId = null,
  system,
  messages,
  maxTokens = 4000,
  model = null,
  timeoutMs = 60_000,
}) {
  const apiKey = qwenApiKey(env);
  if (!apiKey) {
    return { ok: false, reason: 'no_api_key' };
  }
  // Defensive: legacy callers may still pass Claude model names. Ignore those
  // and fall back to Qwen default — Qwen doesn't recognize 'claude-*' strings.
  const safeModel = (model && !/^claude/i.test(model)) ? model : null;
  const useModel = safeModel || qwenModel(env) || DEFAULT_MODEL;
  const t0 = Date.now();
  let attempt = 0;
  let lastError = null;

  // Normalise system → string for OpenAI-style payload
  const systemText = Array.isArray(system)
    ? system.map(s => (typeof s === 'string' ? s : s?.text || '')).filter(Boolean).join('\n\n')
    : (typeof system === 'string' ? system : '');

  // Normalise messages → ensure OpenAI-style { role, content: string }
  const chat = (messages || []).map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
        ? m.content.map(c => (typeof c === 'string' ? c : c?.text || '')).join('\n')
        : String(m.content || ''),
  }));
  const fullMessages = systemText
    ? [{ role: 'system', content: systemText }, ...chat]
    : chat;

  while (attempt < 2) {
    attempt++;
    let abortTimer;
    try {
      const ctrl = new AbortController();
      abortTimer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(qwenBaseUrl(env) + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: useModel,
          messages: fullMessages,
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(abortTimer);
      if (!res.ok) {
        const status = res.status;
        const bodyText = await res.text().catch(() => '');
        const err = new Error('qwen ' + status + ': ' + bodyText.slice(0, 200));
        err.status = status;
        throw err;
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content || '';
      const duration = Date.now() - t0;
      await logEvent(env, 'info', `${surface}_ok`, {
        surface, submissionId, productId,
        attempt, model: useModel, provider: 'qwen',
        prompt_tokens: json?.usage?.prompt_tokens,
        completion_tokens: json?.usage?.completion_tokens,
        duration_ms: duration,
      });
      return { ok: true, text, usage: json?.usage, durationMs: duration };
    } catch (e) {
      if (abortTimer) clearTimeout(abortTimer);
      lastError = e;
      const status = e?.status;
      const retriable = RETRIABLE_STATUSES.has(status) || /timeout|fetch|network|abort|ECONN/i.test(e?.message || '');
      if (attempt < 2 && retriable) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      const duration = Date.now() - t0;
      await logEvent(env, 'error', `${surface}_failed`, {
        surface, submissionId, productId,
        attempt, model: useModel, provider: 'qwen', status,
        message: String(e?.message || e).slice(0, 400),
        duration_ms: duration,
      });
      return { ok: false, reason: 'error', error: e.message, status };
    }
  }
  return { ok: false, reason: 'error', error: lastError?.message };
}

