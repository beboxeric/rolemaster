// Shared helpers for RoleMaster Pages Functions.
// Web Crypto-based PBKDF2 + JWT (no Node deps).

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  });
}

// ── Session cookie (JWT) ──────────────────────────────────────────
export const TOKEN_COOKIE = 'rm_token';
export const TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function jsonWithCookie(obj, token, status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...CORS });
  headers.append('Set-Cookie', [
    `${TOKEN_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${TOKEN_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; '));
  return new Response(JSON.stringify(obj), { status, headers });
}

export function jsonClearCookie(obj, status = 200) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...CORS });
  headers.append('Set-Cookie', `${TOKEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  return new Response(JSON.stringify(obj), { status, headers });
}

export function readTokenCookie(request) {
  const c = request.headers.get('Cookie') || '';
  for (const part of c.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === TOKEN_COOKIE) return rest.join('=');
  }
  return null;
}

// ── JWT (HS256) ───────────────────────────────────────────────────
function base64UrlEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Bad token');
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const sig = base64UrlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(signingInput));
  if (!valid) throw new Error('Bad signature');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Expired');
  return payload;
}

// ── PBKDF2 password hashing ───────────────────────────────────────
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.substr(i, 2), 16);
  return out;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
  return { hash: bufToHex(buf), salt: bufToHex(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(salt), iterations: 100000, hash: 'SHA-256' }, km, 256);
  return bufToHex(buf) === hash;
}

// ── Superadmin: email allowlist + DB-backed is_superadmin flag ────
// Email allowlist is bootstrap (so the first superadmin can sign in even
// before the column has been written). Subsequent superadmin grants/revokes
// happen via the users.is_superadmin column managed in user-management UI.
const SUPERADMIN_EMAILS = new Set([
  'hello@rolemaster.io',
  'tildajed130@outlook.com',
  'demo-admin@airolemaster.com',
  'demo-curator@airolemaster.com',
]);
export function isSuperadminEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  if (SUPERADMIN_EMAILS.has(e)) return true;
  if (e.startsWith('admin@')) return true;
  return false;
}
// Idempotent column-add. Schema migrations require API token perms we don't
// have, so the column is created on demand inside any handler that touches it.
export async function ensureSuperadminColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0`).run(); }
  catch { /* column already exists */ }
}
// Async because we may need a DB lookup for users that were granted
// superadmin via the user-management UI (not in the email allowlist).
export async function isSuperadmin(env, user) {
  if (!user) return false;
  if (isSuperadminEmail(user.email)) return true;
  if (!user.id) return false;
  try {
    await ensureSuperadminColumn(env);
    const row = await env.DB.prepare('SELECT is_superadmin FROM users WHERE id = ?').bind(user.id).first();
    return !!(row && row.is_superadmin);
  } catch { return false; }
}
// Sync version that only checks the email allowlist. Use only in places where
// you already know the user's elevated status doesn't depend on the DB.
export function requireSuperadmin(user) {
  return user && isSuperadminEmail(user.email);
}

// ── Tiny ID helpers ───────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function shortId(prefix = '', n = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let id = prefix;
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

// ── T5.6 — lightweight platform logging ───────────────────────────
// Best-effort. Never throws — logging failure must not cascade.
export async function logEvent(env, level, message, context = {}) {
  try {
    await env.DB.prepare(
      `INSERT INTO platform_logs (id, level, message, context_json) VALUES (?, ?, ?, ?)`
    ).bind(shortId('LOG-', 10), level, String(message).slice(0, 500), JSON.stringify(context).slice(0, 4000)).run();
  } catch { /* swallow */ }
}

// ── T5.3 — in-app notifications ───────────────────────────────────
// type examples: 'submission_approved', 'submission_revision', 'submission_published', 'comment'
export async function notify(env, userId, type, payload = {}) {
  if (!userId) return;
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, payload_json) VALUES (?, ?, ?, ?)`
    ).bind(shortId('NTF-', 10), userId, type, JSON.stringify(payload)).run();
  } catch { /* swallow */ }
}

// ── Bilingual field row ↔ object mapping ─────────────────────────
export function rowToField(row) {
  const value = (row.value_zh || row.value_en)
    ? { zh: row.value_zh ?? '', en: row.value_en ?? '' }
    : '';
  const out = {
    section: row.section,
    label: { zh: row.label_zh, en: row.label_en },
    status: row.status,
    value,
  };
  if (row.hint_zh || row.hint_en) out.hint = { zh: row.hint_zh, en: row.hint_en };
  if (row.optional) out.optional = true;
  return out;
}

// ── Sensitive-field sanitizer (T5.8) ───────────────────────────────
// Strips cost_price (and the curator's private notes / source quotes)
// before sending data to the wrong audience.
//
// Matrix:
//   - sales:    no cost_price, no curator-private fields
//   - supplier: no curator-private fields (own cost is fine — they entered it)
//   - curator:  see everything
//
// `fields` is the {fieldId -> field} object returned by loadFields().
// `atoms` is the array of layer_atom rows.
const COST_FIELD_IDS = new Set(['price_cost']);
const CURATOR_PRIVATE_FIELD_IDS = new Set([]); // reserved for future
const ATOM_PRIVATE_KEYS = ['source_quote']; // curator-internal; never sent to supplier or sales

// Object keys that should NEVER appear in a sales-bound payload, regardless of where they sit.
const SALES_FORBIDDEN_KEYS = new Set([
  'price_cost', 'cost_price', 'cost_price_zh', 'cost_price_en',
  'curator_notes', 'review_notes', 'source_quote',
]);

export function sanitizeFieldsForRole(fields, role) {
  if (role === 'curator' || !fields) return fields;
  const out = {};
  for (const [id, f] of Object.entries(fields)) {
    if (role === 'sales' && COST_FIELD_IDS.has(id)) continue;
    if (CURATOR_PRIVATE_FIELD_IDS.has(id)) continue;
    out[id] = f;
  }
  return out;
}

export function sanitizeAtomsForRole(atoms, role) {
  if (role === 'curator' || !Array.isArray(atoms)) return atoms;
  return atoms.map(a => {
    const copy = { ...a };
    for (const k of ATOM_PRIVATE_KEYS) delete copy[k];
    return copy;
  });
}

export function sanitizeRolepackForRole(data, role) {
  if (role === 'curator' || !data) return data;
  // RolePack data already excludes cost — publish.js never copies it. Defensive copy:
  const copy = { ...data };
  delete copy.cost_price;
  delete copy.cost_price_zh;
  delete copy.cost_price_en;
  return copy;
}

// T5.8 — defense-in-depth recursive scrubber. Wrap any GET response that goes
// to a sales user. Curator/supplier responses pass through untouched (other
// scrubbers handle their narrower carve-outs).
export function sanitizeForRole(data, role) {
  if (role !== 'sales' || data == null) return data;
  return scrub(data);
}

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SALES_FORBIDDEN_KEYS.has(k)) continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}

// ── T3.1 — supplier-scoped (shared) Section 1 fields ─────────────────
// These five fields live in supplier_company_info, not submission_fields.
// Edits made on any product page propagate across all of that supplier's products.
export const SUPPLIER_SCOPED_FIELDS = ['company_name', 'company_hq', 'company_founded', 'company_team', 'company_clients'];
const SUPPLIER_SCOPED_LABELS = {
  company_name:    { zh: '公司名称',     en: 'Company name' },
  company_hq:      { zh: '总部',         en: 'Headquarters' },
  company_founded: { zh: '成立年份',     en: 'Founded' },
  company_team:    { zh: '团队规模',     en: 'Team size' },
  company_clients: { zh: '现有企业客户', en: 'Enterprise clients' },
};
const SUPPLIER_SCOPED_OPTIONAL = new Set(['company_founded', 'company_team', 'company_clients']);

export function isSupplierScoped(fieldId) {
  return SUPPLIER_SCOPED_FIELDS.includes(fieldId);
}

export async function loadSupplierCompanyFields(env, supplierId) {
  const row = await env.DB.prepare(
    'SELECT * FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(supplierId).first();
  const out = {};
  for (const fid of SUPPLIER_SCOPED_FIELDS) {
    const vz = row?.[`${fid}_zh`] || '';
    const ve = row?.[`${fid}_en`] || '';
    out[fid] = {
      section: 1,
      scope: 'supplier',
      label: SUPPLIER_SCOPED_LABELS[fid],
      value: (vz || ve) ? { zh: vz, en: ve } : '',
      status: (vz || ve) ? 'filled' : 'empty',
      optional: SUPPLIER_SCOPED_OPTIONAL.has(fid),
    };
  }
  return out;
}

export async function writeSupplierCompanyField(env, supplierId, fieldId, valueZh, valueEn) {
  if (!isSupplierScoped(fieldId)) throw new Error('not_supplier_scoped');
  const exist = await env.DB.prepare(
    'SELECT supplier_id FROM supplier_company_info WHERE supplier_id = ?'
  ).bind(supplierId).first();
  if (!exist) {
    await env.DB.prepare(
      'INSERT INTO supplier_company_info (supplier_id) VALUES (?)'
    ).bind(supplierId).run();
  }
  // fieldId is whitelisted via isSupplierScoped — safe to interpolate.
  await env.DB.prepare(
    `UPDATE supplier_company_info SET ${fieldId}_zh = ?, ${fieldId}_en = ?, updated_at = datetime('now') WHERE supplier_id = ?`
  ).bind(valueZh, valueEn, supplierId).run();
}
