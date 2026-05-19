// /api/intakes/:id/files — upload and list materials.
// POST: multipart upload (field 'files', optionally 'kind' override +
//       'rolepack_id' scope + 'extracted_text_<filename>' per-file plain
//       text extracted client-side, e.g. via pdfjs-dist for PDFs).
// GET: list this intake's files

import { json, shortId } from '../../../_helpers.js';

function kindFor(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'doc';
  if (['m4a', 'mp3', 'wav', 'ogg'].includes(ext)) return 'voice';
  return 'other';
}

// Lazy column add — schema migration is blocked behind dashboard perms but
// idempotent ALTER inside a request works.
async function ensureExtractedTextColumn(env) {
  try { await env.DB.prepare(`ALTER TABLE intake_files ADD COLUMN extracted_text TEXT`).run(); }
  catch { /* exists */ }
}

export async function onRequestPost(context) {
  const u = context.data.user;
  if (u.role !== 'supplier') return json({ error: 'forbidden' }, 403);
  const id = context.params.id;
  const intake = await context.env.DB.prepare(
    'SELECT supplier_id FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (intake.supplier_id !== u.supplier_id) return json({ error: 'forbidden' }, 403);

  await ensureExtractedTextColumn(context.env);
  const form = await context.request.formData();
  const incoming = [].concat(form.getAll('files'), form.getAll('file'))
    .filter(f => f && typeof f !== 'string');
  if (incoming.length === 0) return json({ error: 'no_files' }, 400);
  const kindOverride = form.get('kind');
  const rolepackId = form.get('rolepack_id');

  const stored = [];
  for (const f of incoming) {
    const fid = 'F-' + shortId('', 8);
    const safeName = (f.name || 'upload').replace(/[\\/]/g, '_');
    const key = `intake/${id}/${fid}_${safeName}`;
    const bytes = await f.arrayBuffer();
    await context.env.R2.put(key, bytes, {
      httpMetadata: { contentType: f.type || 'application/octet-stream' },
    });
    const kind = (typeof kindOverride === 'string' && kindOverride) ? kindOverride : kindFor(safeName);
    // Per-file extracted text from the client (pdfjs-dist for PDFs etc.).
    // Field name is `extracted_text_<filename>` to keep the mapping clear
    // when multiple files are uploaded in one POST.
    let extracted = form.get('extracted_text_' + safeName);
    if (typeof extracted !== 'string') extracted = null;
    if (extracted) extracted = extracted.slice(0, 500_000); // 500KB cap
    await context.env.DB.prepare(`
      INSERT INTO intake_files (id, intake_id, kind, filename, size_bytes, storage_key, rolepack_id, extracted_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(fid, id, kind, safeName, bytes.byteLength, key, rolepackId || null, extracted).run();
    stored.push({ id: fid, kind, filename: safeName, size: bytes.byteLength, has_extracted_text: !!extracted });
  }
  await context.env.DB.prepare(`UPDATE intakes SET updated_at = datetime('now') WHERE id = ?`).bind(id).run();
  return json({ files: stored });
}

export async function onRequestGet(context) {
  const u = context.data.user;
  const id = context.params.id;
  const intake = await context.env.DB.prepare(
    'SELECT supplier_id FROM intakes WHERE id = ?'
  ).bind(id).first();
  if (!intake) return json({ error: 'not_found' }, 404);
  if (u.role !== 'curator' && (u.role !== 'supplier' || intake.supplier_id !== u.supplier_id)) {
    return json({ error: 'forbidden' }, 403);
  }
  const { results } = await context.env.DB.prepare(
    'SELECT id, kind, filename, display_name, size_bytes, rolepack_id, created_at FROM intake_files WHERE intake_id = ? ORDER BY created_at'
  ).bind(id).all();
  return json({
    files: (results || []).map(r => ({
      id: r.id, kind: r.kind, filename: r.filename, display_name: r.display_name,
      size: r.size_bytes,
      rolepack_id: r.rolepack_id, createdAt: r.created_at,
    })),
  });
}
