// GET  /api/admin/users        — list all users (superadmin only)
// POST /api/admin/users        — create user { email, password, name, role, supplier_id? }

import { json, hashPassword, shortId, isSuperadmin, ensureSuperadminColumn } from '../../_helpers.js';

const VALID_ROLES = new Set(['supplier', 'curator', 'sales']);

export async function onRequestGet(context) {
  const u = context.data.user;
  if (!(await isSuperadmin(context.env, u))) return json({ error: 'forbidden' }, 403);
  await ensureSuperadminColumn(context.env);

  const { results } = await context.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.supplier_id, u.language, u.created_at,
            COALESCE(u.is_superadmin, 0) AS is_superadmin,
            s.name AS supplier_name, s.short_name AS supplier_short_name
     FROM users u
     LEFT JOIN suppliers s ON s.id = u.supplier_id
     ORDER BY u.created_at DESC`
  ).all();
  return json({ items: results || [] });
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (!(await isSuperadmin(context.env, u))) return json({ error: 'forbidden' }, 403);
  await ensureSuperadminColumn(context.env);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  const role = String(body.role || '').trim();
  const supplierId = body.supplier_id || null;
  const isSuper = body.is_superadmin ? 1 : 0;

  if (!email || !password || !name) return json({ error: 'missing_fields' }, 400);
  if (!VALID_ROLES.has(role)) return json({ error: 'invalid_role' }, 400);
  if (password.length < 6) return json({ error: 'password_too_short' }, 400);
  if (role === 'supplier' && !supplierId) {
    return json({ error: 'supplier_id_required_for_supplier_role' }, 400);
  }

  const exists = await context.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) return json({ error: 'email_taken' }, 400);

  const { hash, salt } = await hashPassword(password);
  const id = shortId('USR-', 8);
  await context.env.DB.prepare(
    `INSERT INTO users (id, email, password, salt, name, role, supplier_id, language, is_superadmin)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'zh', ?)`
  ).bind(id, email, hash, salt, name, role, supplierId, isSuper).run();

  return json({ ok: true, id });
}
