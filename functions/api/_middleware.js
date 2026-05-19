// Auth middleware — runs before every /api/* request.
// - Lets public routes through (login, register, health).
// - For everything else, requires a valid JWT. Token source order:
//     1. `Authorization: Bearer <jwt>` header  ← per-tab session
//     2. `rm_token` cookie                     ← default browser session
//   Per-tab tokens (sessionStorage on the client) let the same browser run
//   two different accounts in two tabs (e.g. curator + supplier) without
//   the cookie clobbering one when the other logs in. Decoded payload is
//   exposed at context.data.user.
// - Superadmin impersonation: when an X-Impersonate-Supplier header is
//   present AND the JWT user is a superadmin, the user object is presented
//   downstream as { role: 'supplier', supplier_id: <header value> } so the
//   supplier-side endpoints transparently act on behalf of that partner.

import { CORS, json, readTokenCookie, verifyJWT, isSuperadmin } from './_helpers.js';

function readBearerToken(request) {
  const h = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  if (!h.toLowerCase().startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

const PUBLIC = [
  { method: 'GET',  path: '/api/health' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/logout' }, // clears cookie regardless of auth
];

// Anything under /api/public/* is browsable without auth — used by the
// marketing landing page at airolemaster.com to render the live catalogue.
function isPublic(method, path) {
  if (PUBLIC.some(r => r.method === method && r.path === path)) return true;
  if (method === 'GET' && path.startsWith('/api/public/')) return true;
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const path = new URL(request.url).pathname;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (isPublic(method, path)) {
    return await context.next();
  }

  const token = readBearerToken(request) || readTokenCookie(request);
  if (!token) return json({ error: 'unauthorized' }, 401);

  let payload;
  try {
    payload = await verifyJWT(token, env.JWT_SECRET);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }
  context.data = context.data || {};
  const realUser = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    supplier_id: payload.sup ?? null,
  };
  context.data.realUser = realUser;

  // Impersonation: superadmin viewing as a Capability Partner.
  // X-Impersonate-Supplier header is honoured only when the request is from
  // a superadmin (verified against the email allowlist OR users.is_superadmin).
  const impersonate = request.headers.get('X-Impersonate-Supplier') || request.headers.get('x-impersonate-supplier');
  if (impersonate && await isSuperadmin(env, realUser)) {
    context.data.user = {
      ...realUser,
      role: 'supplier',
      supplier_id: impersonate,
      impersonated_from: realUser.id,
    };
  } else {
    context.data.user = realUser;
  }
  return await context.next();
}
