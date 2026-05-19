// Build text-only content blocks from an INTAKE's files. The Qwen backend
// (via the DashScope OpenAI-compatible endpoint) silently drops non-text
// content blocks, so binary attachments are listed as placeholders only.
// PDFs are extracted client-side via pdfjs-dist before upload — the
// extracted text comes through this same path under `extracted_text`.
//
// `hasContent`     — true if SOMETHING was added (text or placeholder)
// `hasReadableText` — true if the AI has actual content to analyse (typed
//                     description / industry / website). False when the
//                     supplier only uploaded files we can't parse.

const MAX_FILES_PER_INTAKE = 8;

export async function buildIntakeMaterialsBlocks(env, intakeId, intake) {
  const blocks = [];
  let hasReadableText = false;
  if (intake?.free_text && intake.free_text.trim()) {
    blocks.push({
      type: 'text',
      text: 'Supplier-provided description:\n\n' + intake.free_text.trim(),
    });
    hasReadableText = true;
  }
  if (intake?.industry_hint && intake.industry_hint.trim()) {
    blocks.push({
      type: 'text',
      text: 'Supplier-stated industry: ' + intake.industry_hint.trim(),
    });
    hasReadableText = true;
  }
  if (intake?.website && intake.website.trim()) {
    blocks.push({
      type: 'text',
      text: 'Company website: ' + intake.website.trim(),
    });
    hasReadableText = true;
  }

  // Defensive: extracted_text column may not exist yet on older deployments.
  let rows = [];
  try {
    const r = await env.DB.prepare(
      `SELECT id, kind, filename, size_bytes, storage_key, rolepack_id, extracted_text
       FROM intake_files WHERE intake_id = ? AND rolepack_id IS NULL ORDER BY created_at`
    ).bind(intakeId).all();
    rows = r.results || [];
  } catch {
    const r = await env.DB.prepare(
      `SELECT id, kind, filename, size_bytes, storage_key, rolepack_id
       FROM intake_files WHERE intake_id = ? AND rolepack_id IS NULL ORDER BY created_at`
    ).bind(intakeId).all();
    rows = r.results || [];
  }
  const files = rows.slice(0, MAX_FILES_PER_INTAKE);

  for (const f of files) {
    const sizeKb = f.size_bytes ? Math.round(f.size_bytes / 1024) : 0;
    if (f.extracted_text && f.extracted_text.trim()) {
      blocks.push({
        type: 'text',
        text: `[Attached ${(f.kind || 'file').toUpperCase()}: ${f.filename} (${sizeKb}KB) — extracted text below]\n\n` +
              f.extracted_text.trim(),
      });
      hasReadableText = true;
    } else {
      blocks.push({
        type: 'text',
        text: `[Attached ${(f.kind || 'file').toUpperCase()}: ${f.filename} (${sizeKb}KB) — content not extractable; rely on the supplier-provided description above]`,
      });
    }
  }

  return { blocks, hasContent: blocks.length > 0, hasReadableText, fileCount: files.length };
}
