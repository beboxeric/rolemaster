// PATCH /api/auth/me/language — update the current user's preferred language.
// T4.3.

import { json } from '../../_helpers.js';

export async function onRequestPatch(context) {
  const u = context.data.user;
  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const next = body.language;
  if (next !== 'zh' && next !== 'en') return json({ error: 'invalid_language' }, 400);

  await context.env.DB.prepare(
    'UPDATE users SET language = ? WHERE id = ?'
  ).bind(next, u.id).run();
  return json({ ok: true });
}
