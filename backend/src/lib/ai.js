// Qwen/DashScope AI client — OpenAI-compatible endpoint.
// Mirrors the Cloudflare Functions _lib/ai/client.js but reads from process.env.

const DEFAULT_MODEL = 'qwen-plus';
const RETRIABLE_STATUSES = new Set([429, 529, 500, 502, 503, 504]);

function apiKey() { return (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '').trim(); }
function model() { return (process.env.QWEN_MODEL || process.env.DASHSCOPE_MODEL || '').trim() || DEFAULT_MODEL; }
function baseUrl() {
  const raw = process.env.QWEN_BASE_URL || process.env.DASHSCOPE_BASE_URL
    || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
  return raw.trim().replace(/\/$/, '');
}

export async function callQwen({ surface, submissionId = null, system, messages, maxTokens = 4000, timeoutMs = 60_000 }) {
  const key = apiKey();
  if (!key) return { ok: false, reason: 'no_api_key' };

  const systemText = Array.isArray(system)
    ? system.map(s => typeof s === 'string' ? s : s?.text || '').filter(Boolean).join('\n\n')
    : (typeof system === 'string' ? system : '');

  const chat = (messages || []).map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
        ? m.content.map(c => typeof c === 'string' ? c : c?.text || '').join('\n')
        : String(m.content || ''),
  }));

  const fullMessages = systemText ? [{ role: 'system', content: systemText }, ...chat] : chat;

  let attempt = 0, lastError = null;
  const t0 = Date.now();

  while (attempt < 2) {
    attempt++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(baseUrl() + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: model(), messages: fullMessages, max_tokens: maxTokens, temperature: 0.6 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`qwen ${res.status}: ${body.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content || '';
      console.log(`[ai] ${surface} ok attempt=${attempt} model=${model()} ms=${Date.now() - t0}`);
      return { ok: true, text, usage: json?.usage };
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      const retriable = RETRIABLE_STATUSES.has(e?.status) || /timeout|fetch|network|abort|ECONN/i.test(e?.message || '');
      console.error(`[ai] ${surface} err attempt=${attempt}:`, e.message);
      if (attempt < 2 && retriable) { await new Promise(r => setTimeout(r, 1500)); continue; }
      return { ok: false, reason: 'error', error: e.message, status: e?.status };
    }
  }
  return { ok: false, reason: 'error', error: lastError?.message };
}

export function parseStrictJson(text) {
  if (!text) return null;
  // Strip markdown fences if present.
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  // Find first { or [
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  s = s.slice(start);
  // Find matching end
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (last < 0) return null;
  try { return JSON.parse(s.slice(0, last + 1)); } catch { return null; }
}
