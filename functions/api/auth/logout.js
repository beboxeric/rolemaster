// POST /api/auth/logout — clears the cookie. Stateless JWTs so nothing else to do.

import { jsonClearCookie } from '../_helpers.js';

export async function onRequestPost() {
  return jsonClearCookie({ ok: true });
}
