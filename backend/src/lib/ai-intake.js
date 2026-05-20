// Build text content blocks from an intake's files for Qwen prompts.
import prisma from './prisma.js';

const MAX_FILES = 8;

export async function buildMaterialsBlocks(intakeId, intake) {
  const blocks = [];
  let hasReadableText = false;

  if (intake?.freeText?.trim()) {
    blocks.push({ type: 'text', text: 'Supplier-provided description:\n\n' + intake.freeText.trim() });
    hasReadableText = true;
  }
  if (intake?.industryHint?.trim()) {
    blocks.push({ type: 'text', text: 'Supplier-stated industry: ' + intake.industryHint.trim() });
    hasReadableText = true;
  }
  if (intake?.website?.trim()) {
    blocks.push({ type: 'text', text: 'Company website: ' + intake.website.trim() });
    hasReadableText = true;
  }

  const files = await prisma.intakeFile.findMany({
    where: { intakeId, rolepackId: null },
    orderBy: { createdAt: 'asc' },
    take: MAX_FILES,
  });

  for (const f of files) {
    const sizeKb = f.sizeBytes ? Math.round(f.sizeBytes / 1024) : 0;
    if (f.extractedText?.trim()) {
      blocks.push({
        type: 'text',
        text: `[Attached ${(f.kind || 'file').toUpperCase()}: ${f.filename} (${sizeKb}KB) — extracted text below]\n\n` + f.extractedText.trim(),
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
