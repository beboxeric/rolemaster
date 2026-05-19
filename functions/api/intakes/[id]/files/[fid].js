// GET    /api/intakes/:id/files/:fid — download file (supplier on own intake; curator any).
// DELETE /api/intakes/:id/files/:fid — supplier removes one uploaded material.
// PATCH  /api/intakes/:id/files/:fid — supplier renames the file's display_name.

import { json } from '../../../_helpers.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  const { id, fid } = context.params;
  if (u.role !== 'supplier' && u.role !== 'curator') return json({ error: 'forbidden' }, 403);

  const intake = await context.env.DB.prepare(
    'SELECT supplier_id FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (u.role === 'supplier' && intake.supplier_id !== u.supplier_id) {
    return json({ error: 'forbidden' }, 403);
  }

  const file = await context.env.DB.prepare(
    'SELECT storage_key, filename, display_name, size_bytes FROM intake_files WHERE id = ? AND intake_id = ?'
  ).bind(fid, id).first();
  if (!file) return json({ error: 'not_found' }, 404);

  const obj = await context.env.R2.get(file.storage_key);
  if (!obj) return json({ error: 'storage_missing' }, 404);

  const downloadName = file.display_name || file.filename || 'download';
  const safeName = downloadName.replace(/["\\]/g, '_');
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}

export async function onRequestPatch(context) {
  const u = context.data.user;
  const { id, fid } = context.params;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);

  const intake = await context.env.DB.prepare(
    'SELECT supplier_id FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await context.request.json(); } catch { body = {}; }
  const display_name = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 200) : '';

  await context.env.DB.prepare(
    'UPDATE intake_files SET display_name = ? WHERE id = ? AND intake_id = ?'
  ).bind(display_name || null, fid, id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const u = context.data.user;
  const { id, fid } = context.params;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);

  const intake = await context.env.DB.prepare(
    'SELECT supplier_id FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  const file = await context.env.DB.prepare(
    'SELECT storage_key FROM intake_files WHERE id = ? AND intake_id = ?'
  ).bind(fid, id).first();
  if (!file) return json({ error: 'not_found' }, 404);

  // Best-effort R2 delete (don't fail the request if the object is already gone).
  try { await context.env.R2.delete(file.storage_key); } catch {}

  await context.env.DB.prepare(
    'DELETE FROM intake_files WHERE id = ? AND intake_id = ?'
  ).bind(fid, id).run();
  await context.env.DB.prepare(
    `UPDATE intakes SET updated_at = datetime('now') WHERE id = ?`
  ).bind(id).run();
  return json({ ok: true });
}
