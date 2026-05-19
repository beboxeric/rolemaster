// platform_logs writer with the redesigned columns. Best-effort; never throws.

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function shortLogId() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = 'LOG-';
  for (const b of bytes) id += ALPHA[b % ALPHA.length];
  return id;
}

export async function logEvent(env, level, message, ctx = {}) {
  const {
    surface = null,
    submissionId = null,
    productId = null,
    duration_ms = null,
    prompt_tokens = null,
    completion_tokens = null,
    ...rest
  } = ctx;
  try {
    await env.DB.prepare(
      `INSERT INTO platform_logs
       (id, level, surface, submission_id, product_id, message, context_json, duration_ms, prompt_tokens, completion_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      shortLogId(),
      level,
      surface,
      submissionId,
      productId,
      String(message).slice(0, 500),
      JSON.stringify(rest).slice(0, 4000),
      duration_ms,
      prompt_tokens,
      completion_tokens,
    ).run();
  } catch { /* swallow */ }
}
