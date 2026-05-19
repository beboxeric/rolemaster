// PATCH  /api/admin/users/:userId — update name / role / password (superadmin only)
// DELETE /api/admin/users/:userId — remove user (superadmin only; cannot remove self)

import { json, hashPassword, isSuperadmin, ensureSuperadminColumn } from '../../_helpers.js';

const VALID_ROLES = new Set(['supplier', 'curator', 'sales']);

export async function onRequestPatch(context) {
  const u = context.data.user;
  if (!(await isSuperadmin(context.env, u))) return json({ error: 'forbidden' }, 403);
  const { userId } = context.params;
  await ensureSuperadminColumn(context.env);

  const target = await context.env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(userId).first();
  if (!target) return json({ error: 'not_found' }, 404);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }

  const sets = [];
  const vals = [];
  if (typeof body.name === 'string' && body.name.trim()) {
    sets.push('name = ?');
    vals.push(body.name.trim());
  }
  if (typeof body.role === 'string') {
    if (!VALID_ROLES.has(body.role)) return json({ error: 'invalid_role' }, 400);
    sets.push('role = ?');
    vals.push(body.role);
  }
  if (body.supplier_id !== undefined) {
    sets.push('supplier_id = ?');
    vals.push(body.supplier_id || null);
  }
  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 6) return json({ error: 'password_too_short' }, 400);
    const { hash, salt } = await hashPassword(body.password);
    sets.push('password = ?', 'salt = ?');
    vals.push(hash, salt);
  }
  if (body.is_superadmin !== undefined) {
    sets.push('is_superadmin = ?');
    vals.push(body.is_superadmin ? 1 : 0);
  }
  if (sets.length === 0) return json({ ok: true, noop: true });

  await context.env.DB.prepare(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals, userId).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  if (!(await isSuperadmin(context.env, u))) return json({ error: 'forbidden' }, 403);
  const { userId } = context.params;

  // Prevent removing yourself.
  if (userId === u.id) return json({ error: 'cannot_remove_self' }, 400);

  const target = await context.env.DB.prepare('SELECT id, role, supplier_id FROM users WHERE id = ?').bind(userId).first();
  if (!target) return json({ error: 'not_found' }, 404);

  await context.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return json({ ok: true });
}
