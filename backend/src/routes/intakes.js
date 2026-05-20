// Supplier-side intake routes.
// All routes require supplier role.
import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import { requireSupplier, requireAuth } from '../middleware/auth.js';
import { shortId } from '../lib/id.js';
import { uploadFile, deleteFile } from '../lib/storage.js';
import { callQwen, parseStrictJson } from '../lib/ai.js';
import { buildMaterialsBlocks } from '../lib/ai-intake.js';
import { EXTRACT_CAPABILITIES_SYSTEM_PROMPT } from '../lib/prompts/extract-capabilities.js';
import { MATCH_ROLES_SYSTEM_PROMPT } from '../lib/prompts/match-roles.js';
import { ROLE_PREFILL_SYSTEM_PROMPT } from '../lib/prompts/role-prefill.js';
import { ROLE_FINALIZE_SYSTEM_PROMPT } from '../lib/prompts/role-finalize.js';
import { COPILOT_SYSTEM_PROMPT } from '../lib/prompts/copilot.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOwnIntake(intakeId, supplierId) {
  return prisma.intake.findFirst({ where: { id: intakeId, supplierId } });
}

function kindFor(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'doc';
  if (['m4a', 'mp3', 'wav', 'ogg'].includes(ext)) return 'voice';
  return 'other';
}

function serializeIntakeListItem(row, counts) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    free_text: row.freeText,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    finalized_at: row.finalizedAt,
    rolepack_count: counts?.[row.id]?.total ?? 0,
    rolepack_published: counts?.[row.id]?.published ?? 0,
  };
}

// ── GET /api/intakes ──────────────────────────────────────────────────────────

router.get('/', requireSupplier, async (req, res, next) => {
  try {
    const rows = await prisma.intake.findMany({
      where: { supplierId: req.user.supplierId },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch rolepack counts in one query.
    const ids = rows.map(r => r.id);
    const rpRows = ids.length
      ? await prisma.intakeRolepack.groupBy({
          by: ['intakeId'],
          where: { intakeId: { in: ids } },
          _count: { id: true },
        })
      : [];
    const publishedRpRows = ids.length
      ? await prisma.intakeRolepack.groupBy({
          by: ['intakeId'],
          where: { intakeId: { in: ids }, status: 'published' },
          _count: { id: true },
        })
      : [];
    const counts = {};
    for (const r of rpRows) counts[r.intakeId] = { total: r._count.id, published: 0 };
    for (const r of publishedRpRows) {
      if (counts[r.intakeId]) counts[r.intakeId].published = r._count.id;
      else counts[r.intakeId] = { total: 0, published: r._count.id };
    }

    res.json({ items: rows.map(r => serializeIntakeListItem(r, counts)) });
  } catch (err) { next(err); }
});

// ── POST /api/intakes ─────────────────────────────────────────────────────────

router.post('/', requireSupplier, async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name : null;
    const freeText = typeof req.body.free_text === 'string' ? req.body.free_text : null;
    const intake = await prisma.intake.create({
      data: {
        id: shortId('INT-', 8),
        supplierId: req.user.supplierId,
        name,
        freeText,
        status: 'draft',
      },
    });
    res.status(201).json({ id: intake.id });
  } catch (err) { next(err); }
});

// ── GET /api/intakes/:id ──────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const where = req.user.role === 'curator'
      ? { id: req.params.id }
      : { id: req.params.id, supplierId: req.user.supplierId };
    const row = await prisma.intake.findFirst({ where });
    if (!row) return res.status(404).json({ error: 'not_found' });

    const [caps, rps, links, files] = await Promise.all([
      prisma.capability.findMany({
        where: { intakeId: row.id },
        orderBy: { position: 'asc' },
      }),
      prisma.intakeRolepack.findMany({
        where: { intakeId: row.id },
        orderBy: { position: 'asc' },
      }),
      prisma.rolepackCapability.findMany({
        where: { rolepack: { intakeId: row.id } },
        orderBy: { position: 'asc' },
      }),
      prisma.intakeFile.findMany({
        where: { intakeId: row.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    for (const rp of rps) {
      rp.capability_ids = links.filter(l => l.rolepackId === rp.id).map(l => l.capabilityId);
    }

    // Fetch supplier + company for the curator workbench.
    let supplier = null;
    let company = null;
    try {
      const sup = await prisma.supplier.findUnique({ where: { id: row.supplierId } });
      if (sup) supplier = { id: sup.id, name: sup.name, short_name: sup.shortName, hq: sup.hq };
      const ci = await prisma.supplierCompanyInfo.findUnique({ where: { supplierId: row.supplierId } });
      if (ci) {
        company = {
          company_name: ci.companyNameZh || ci.companyNameEn || '',
          company_hq: ci.companyHqZh || ci.companyHqEn || '',
          company_founded: ci.companyFoundedZh || ci.companyFoundedEn || '',
          company_team: ci.companyTeamZh || ci.companyTeamEn || '',
          company_clients: ci.companyClientsZh || ci.companyClientsEn || '',
          website: ci.website || '',
          contact_name: ci.contactName || '',
          contact_phone: ci.contactPhone || '',
          contact_email: ci.contactEmail || '',
        };
      }
    } catch {}

    res.json({
      intake: {
        id: row.id,
        name: row.name,
        status: row.status,
        website: row.website,
        industry_hint: row.industryHint,
        free_text: row.freeText,
        service_pricing: row.servicePricingJson,
        supplier_id: row.supplierId,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        finalized_at: row.finalizedAt,
      },
      supplier,
      company,
      capabilities: caps.map(c => ({
        id: c.id,
        rc_label: c.rcLabel,
        name_zh: c.nameZh,
        name_en: c.nameEn,
        description_zh: c.descriptionZh,
        description_en: c.descriptionEn,
        source_quote: c.sourceQuote,
        position: c.position,
        source: c.source,
        confirmed: c.confirmed,
      })),
      rolepacks: rps.map(r => ({
        id: r.id,
        rp_label: r.rpLabel,
        name_zh: r.nameZh,
        name_en: r.nameEn,
        industry: r.industryJson,
        company_size: r.companySizeJson,
        department: r.departmentJson,
        questionnaire: r.questionnaireJson,
        generated: r.generatedJson,
        materials_draft: r.materialsDraftJson,
        status: r.status,
        position: r.position,
        capability_ids: r.capability_ids,
      })),
      files: files.map(f => ({
        id: f.id,
        kind: f.kind,
        filename: f.filename,
        display_name: f.displayName,
        size_bytes: f.sizeBytes,
        rolepack_id: f.rolepackId,
        created_at: f.createdAt,
      })),
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/intakes/:id ────────────────────────────────────────────────────

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'supplier') {
      const intake = await getOwnIntake(req.params.id, req.user.supplierId);
      if (!intake) return res.status(404).json({ error: 'not_found' });
    } else {
      const exists = await prisma.intake.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: 'not_found' });
    }

    const data = {};
    const b = req.body;
    if (typeof b.name === 'string') data.name = b.name;
    if (typeof b.free_text === 'string') data.freeText = b.free_text;
    if (typeof b.industry_hint === 'string') data.industryHint = b.industry_hint;
    if (typeof b.website === 'string') data.website = b.website;
    if (b.service_pricing != null) data.servicePricingJson = b.service_pricing;
    if (typeof b.status === 'string' && b.status !== 'published') data.status = b.status;

    if (Object.keys(data).length === 0) return res.json({ ok: true, noop: true });
    await prisma.intake.update({ where: { id: req.params.id }, data });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/intakes/:id ───────────────────────────────────────────────────

router.delete('/:id', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const published = await prisma.intakeRolepack.findFirst({
      where: { intakeId: req.params.id, status: 'published' },
    });
    if (published) return res.status(400).json({ ok: false, reason: 'published' });

    const files = await prisma.intakeFile.findMany({ where: { intakeId: req.params.id } });
    for (const f of files) await deleteFile(f.storageKey).catch(() => {});

    await prisma.intake.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Capabilities ─────────────────────────────────────────────────────────────

router.get('/:id/capabilities', requireAuth, async (req, res, next) => {
  try {
    const where = req.user.role === 'curator'
      ? { id: req.params.id }
      : { id: req.params.id, supplierId: req.user.supplierId };
    const intake = await prisma.intake.findFirst({ where });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const caps = await prisma.capability.findMany({
      where: { intakeId: req.params.id },
      orderBy: { position: 'asc' },
    });
    res.json({ capabilities: caps.map(c => ({
      id: c.id, rc_label: c.rcLabel, name_zh: c.nameZh, name_en: c.nameEn,
      description_zh: c.descriptionZh, description_en: c.descriptionEn,
      source_quote: c.sourceQuote, position: c.position, source: c.source, confirmed: c.confirmed,
    })) });
  } catch (err) { next(err); }
});

router.post('/:id/capabilities', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const existing = await prisma.capability.findMany({ where: { intakeId: intake.id }, select: { rcLabel: true, position: true } });
    const usedLabels = new Set(existing.map(r => r.rcLabel));
    let n = 1;
    while (usedLabels.has(`RC-${String(n).padStart(2, '0')}`)) n++;
    const rcLabel = `RC-${String(n).padStart(2, '0')}`;
    const nextPos = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;

    const { name, description } = req.body;
    const cap = await prisma.capability.create({
      data: {
        id: shortId('CAP-', 8),
        intakeId: intake.id,
        rcLabel,
        nameZh: name?.zh ?? '',
        nameEn: name?.en ?? '',
        descriptionZh: description?.zh ?? '',
        descriptionEn: description?.en ?? '',
        position: nextPos,
        source: 'supplier',
        confirmed: true,
      },
    });
    res.status(201).json({ ok: true, id: cap.id, rc_label: rcLabel });
  } catch (err) { next(err); }
});

router.patch('/:id/capabilities/:capId', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const { name, description, confirmed, position } = req.body;
    const data = {};
    if (name) { data.nameZh = name.zh ?? ''; data.nameEn = name.en ?? ''; }
    if (description) { data.descriptionZh = description.zh ?? ''; data.descriptionEn = description.en ?? ''; }
    if (typeof confirmed === 'boolean') data.confirmed = confirmed;
    if (typeof position === 'number') data.position = position;
    if (Object.keys(data).length) {
      await prisma.capability.updateMany({ where: { id: req.params.capId, intakeId: intake.id }, data });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/capabilities', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });

    if (req.body.confirm_all) {
      await prisma.capability.updateMany({ where: { intakeId: intake.id }, data: { confirmed: true } });
      await prisma.intake.update({ where: { id: intake.id }, data: { status: 'matching_roles' } });
      return res.json({ ok: true });
    }

    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    await Promise.all(updates.map(u => {
      const data = {};
      if (u.name) { data.nameZh = u.name.zh ?? ''; data.nameEn = u.name.en ?? ''; }
      if (u.description) { data.descriptionZh = u.description.zh ?? ''; data.descriptionEn = u.description.en ?? ''; }
      if (typeof u.position === 'number') data.position = u.position;
      if (typeof u.confirmed === 'boolean') data.confirmed = u.confirmed;
      if (!Object.keys(data).length) return Promise.resolve();
      return prisma.capability.updateMany({ where: { id: u.id, intakeId: intake.id }, data });
    }));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/capabilities/:capId', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    await prisma.capability.deleteMany({ where: { id: req.params.capId, intakeId: intake.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Rolepacks (draft roles) ───────────────────────────────────────────────────

router.get('/:id/rolepacks', requireAuth, async (req, res, next) => {
  try {
    const rps = await prisma.intakeRolepack.findMany({
      where: { intakeId: req.params.id },
      orderBy: { position: 'asc' },
    });
    const links = await prisma.rolepackCapability.findMany({
      where: { rolepackId: { in: rps.map(r => r.id) } },
    });
    for (const rp of rps) rp.capability_ids = links.filter(l => l.rolepackId === rp.id).map(l => l.capabilityId);
    res.json({ rolepacks: rps });
  } catch (err) { next(err); }
});

router.post('/:id/rolepacks', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const existing = await prisma.intakeRolepack.findMany({ where: { intakeId: intake.id }, select: { rpLabel: true, position: true } });
    const usedLabels = new Set(existing.map(r => r.rpLabel));
    let n = 1;
    while (usedLabels.has(`RP-${String(n).padStart(2, '0')}`)) n++;
    const rpLabel = `RP-${String(n).padStart(2, '0')}`;
    const nextPos = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;

    const { name, industry, company_size, department, capability_ids } = req.body;
    const rp = await prisma.intakeRolepack.create({
      data: {
        id: shortId('RP-', 8),
        intakeId: intake.id,
        rpLabel,
        nameZh: name?.zh ?? '',
        nameEn: name?.en ?? '',
        industryJson: industry ?? [],
        companySizeJson: company_size ?? [],
        departmentJson: department ?? {},
        position: nextPos,
      },
    });

    if (Array.isArray(capability_ids) && capability_ids.length) {
      await prisma.rolepackCapability.createMany({
        data: capability_ids.map((capId, i) => ({ rolepackId: rp.id, capabilityId: capId, position: i })),
        skipDuplicates: true,
      });
    }
    res.status(201).json({ ok: true, id: rp.id, rp_label: rpLabel });
  } catch (err) { next(err); }
});

router.patch('/:id/rolepacks/:rpId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'supplier') {
      const intake = await getOwnIntake(req.params.id, req.user.supplierId);
      if (!intake) return res.status(404).json({ error: 'not_found' });
    }
    const { name, industry, company_size, department, questionnaire, generated, capability_ids, position, rp_label } = req.body;
    const data = {};
    if (name) { data.nameZh = name.zh ?? ''; data.nameEn = name.en ?? ''; }
    if (Array.isArray(industry)) data.industryJson = industry;
    if (Array.isArray(company_size)) data.companySizeJson = company_size;
    if (department != null) data.departmentJson = department;
    if (questionnaire != null) data.questionnaireJson = questionnaire;
    if (generated != null) data.generatedJson = generated;
    if (typeof position === 'number') data.position = position;
    if (typeof rp_label === 'string' && req.user.role === 'curator') data.rpLabel = rp_label.trim().toUpperCase();

    if (Object.keys(data).length) {
      await prisma.intakeRolepack.updateMany({ where: { id: req.params.rpId, intakeId: req.params.id }, data });
    }
    if (Array.isArray(capability_ids)) {
      await prisma.rolepackCapability.deleteMany({ where: { rolepackId: req.params.rpId } });
      if (capability_ids.length) {
        await prisma.rolepackCapability.createMany({
          data: capability_ids.map((capId, i) => ({ rolepackId: req.params.rpId, capabilityId: capId, position: i })),
          skipDuplicates: true,
        });
      }
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/rolepacks/:rpId', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    await prisma.intakeRolepack.deleteMany({ where: { id: req.params.rpId, intakeId: intake.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Files ─────────────────────────────────────────────────────────────────────

router.get('/:id/files', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'supplier') {
      const intake = await getOwnIntake(req.params.id, req.user.supplierId);
      if (!intake) return res.status(404).json({ error: 'not_found' });
    }
    const files = await prisma.intakeFile.findMany({
      where: { intakeId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ files: files.map(f => ({
      id: f.id, kind: f.kind, filename: f.filename, display_name: f.displayName,
      size_bytes: f.sizeBytes, rolepack_id: f.rolepackId, created_at: f.createdAt,
    })) });
  } catch (err) { next(err); }
});

router.post('/:id/files', requireSupplier, upload.array('files'), async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (!req.files?.length) return res.status(400).json({ error: 'no_files' });

    const rolepackId = req.body.rolepack_id || null;
    const kindOverride = req.body.kind || null;
    const stored = [];

    for (const f of req.files) {
      const fid = 'F-' + shortId('', 8);
      const safeName = f.originalname.replace(/[\\/]/g, '_');
      const key = `intake/${intake.id}/${fid}_${safeName}`;
      const kind = kindOverride || kindFor(safeName);
      let extractedText = req.body[`extracted_text_${safeName}`] ?? null;
      if (extractedText) extractedText = String(extractedText).slice(0, 500_000);

      await uploadFile(key, f.buffer, f.mimetype);
      await prisma.intakeFile.create({
        data: { id: fid, intakeId: intake.id, kind, filename: safeName, sizeBytes: f.size, storageKey: key, rolepackId, extractedText },
      });
      stored.push({ id: fid, kind, filename: safeName, size: f.size, size_bytes: f.size });
    }
    await prisma.intake.update({ where: { id: intake.id }, data: { updatedAt: new Date() } });
    res.json({ files: stored });
  } catch (err) { next(err); }
});

router.patch('/:id/files/:fid', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const { display_name } = req.body;
    if (typeof display_name === 'string') {
      await prisma.intakeFile.updateMany({ where: { id: req.params.fid, intakeId: intake.id }, data: { displayName: display_name } });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id/files/:fid', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const file = await prisma.intakeFile.findFirst({ where: { id: req.params.fid, intakeId: intake.id } });
    if (!file) return res.status(404).json({ error: 'not_found' });
    await deleteFile(file.storageKey).catch(() => {});
    await prisma.intakeFile.delete({ where: { id: file.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── AI: extract capabilities ──────────────────────────────────────────────────

router.post('/:id/extract-capabilities', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (!process.env.QWEN_API_KEY && !process.env.DASHSCOPE_API_KEY) return res.json({ ok: false, reason: 'no_api_key' });

    const { blocks, hasContent, hasReadableText, fileCount } = await buildMaterialsBlocks(intake.id, intake);
    if (!hasContent) return res.json({ ok: false, reason: 'no_materials' });
    if (!hasReadableText) {
      await prisma.intake.update({ where: { id: intake.id }, data: { status: 'draft' } });
      return res.json({
        ok: false, reason: 'pdf_text_extraction_unavailable',
        message_zh: '上传的 PDF/文档暂时无法自动提取内容。请在「产品介绍」文本框里简要描述这款产品做什么，然后再点继续。',
        message_en: 'PDF text extraction unavailable. Please describe the product in the "Product description" box, then click Continue again.',
      });
    }

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'analyzing_capabilities' } });

    async function runAi(extraNudge = '') {
      return callQwen({
        surface: 'extract-capabilities', submissionId: intake.id,
        system: EXTRACT_CAPABILITIES_SYSTEM_PROMPT + (extraNudge ? '\n\n' + extraNudge : ''),
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Identify the atomic capabilities. Output strict JSON.' },
          ...blocks,
        ]}],
        maxTokens: 7000, timeoutMs: 110_000,
      });
    }

    let ai = await runAi();
    if (!ai.ok) {
      await prisma.intake.update({ where: { id: intake.id }, data: { status: 'draft' } });
      return res.json({ ok: false, reason: ai.reason || 'error', error: ai.error });
    }

    let parsed = parseStrictJson(ai.text);
    if (!parsed?.capabilities?.length) {
      ai = await runAi('CRITICAL: Output ONLY a single JSON object. No prose, no markdown fences. Start with `{` and end with `}`. Keep `description` to ONE sentence per language.');
      if (ai.ok) parsed = parseStrictJson(ai.text);
    }
    if (!parsed?.capabilities?.length) {
      await prisma.intake.update({ where: { id: intake.id }, data: { status: 'draft' } });
      return res.json({ ok: false, reason: 'parse_failed', message_zh: 'AI 返回内容无法解析，请简化产品介绍后重试。', message_en: 'Could not parse AI response. Try shortening the product description.' });
    }

    // Wipe previous AI caps, keep supplier-added ones.
    await prisma.capability.deleteMany({ where: { intakeId: intake.id, source: 'ai' } });

    const existing = await prisma.capability.findMany({ where: { intakeId: intake.id }, select: { rcLabel: true, position: true } });
    const usedNums = new Set(existing.map(r => { const m = r.rcLabel?.match(/^RC-(\d+)$/); return m ? parseInt(m[1]) : null; }).filter(Boolean));
    let nextNum = 1;
    const nextLabel = () => { while (usedNums.has(nextNum)) nextNum++; const l = `RC-${String(nextNum).padStart(2, '0')}`; usedNums.add(nextNum++); return l; };

    const trimName = (s, lang) => {
      const t = String(s || '').trim().replace(/^RC-\d+[\s—:.]*/, '').trim();
      return lang === 'zh' ? t.split(/[—:、,,]/, 1)[0].trim().slice(0, 18) : t.split(/[—:,;]/, 1)[0].trim().split(/\s+/).slice(0, 8).join(' ');
    };
    const detectLang = (s) => { const t = String(s || ''); return (t.match(/[一-鿿]/g)||[]).length >= (t.match(/[A-Za-z]/g)||[]).length ? 'zh' : 'en'; };

    const srcLang = parsed.language === 'en' || parsed.language === 'zh' ? parsed.language : detectLang(parsed.capabilities[0]?.name);
    const tgtLang = srcLang === 'zh' ? 'en' : 'zh';

    // Batch translate.
    async function translateBatch(items, from, to) {
      if (!items.length) return items.map(() => ({ name: '', description: '' }));
      const list = items.map((c, i) => `${i + 1}. NAME: ${c.name}\n   DESC: ${c.description || ''}`).join('\n');
      const direction = from === 'zh' ? 'Chinese to English' : 'English to Chinese';
      const ai2 = await callQwen({
        surface: 'extract-capabilities-translate', submissionId: intake.id,
        system: `You are a professional bilingual translator. Translate NAME and DESC from ${direction}. Output strict JSON: { "items": [ { "name": "...", "desc": "..." } ] }. Constraints: NAME zh ≤12 chars, en ≤6 words. DESC 1-2 sentences. No prose, no fences.`,
        messages: [{ role: 'user', content: `Translate ${items.length} capability rows from ${direction}:\n\n${list}` }],
        maxTokens: 3000, timeoutMs: 60_000,
      });
      if (!ai2.ok) return items.map(() => ({ name: '', description: '' }));
      const out = parseStrictJson(ai2.text);
      const arr = Array.isArray(out?.items) ? out.items : [];
      return items.map((_, i) => ({ name: arr[i]?.name || '', description: arr[i]?.desc || arr[i]?.description || '' }));
    }

    const translated = await translateBatch(parsed.capabilities, srcLang, tgtLang);
    const startPos = existing.length;

    await Promise.all(parsed.capabilities.map((c, i) => {
      const tx = translated[i] || { name: '', description: '' };
      const nameSrc = trimName(c.name, srcLang), nameTgt = trimName(tx.name, tgtLang);
      const sqLang = detectLang(c.source_quote); const sqText = c.source_quote || '';
      return prisma.capability.create({ data: {
        id: shortId('CAP-', 8), intakeId: intake.id, rcLabel: nextLabel(),
        nameZh: srcLang === 'zh' ? nameSrc : nameTgt,
        nameEn: srcLang === 'en' ? nameSrc : nameTgt,
        descriptionZh: srcLang === 'zh' ? (c.description || '') : (tx.description || ''),
        descriptionEn: srcLang === 'en' ? (c.description || '') : (tx.description || ''),
        sourceQuote: sqLang === 'zh' ? sqText : '',
        position: startPos + i, source: 'ai', confirmed: false,
      }});
    }));

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'capabilities_ready' } });
    res.json({ ok: true, count: parsed.capabilities.length, file_count: fileCount });
  } catch (err) { next(err); }
});

// ── AI: match roles ───────────────────────────────────────────────────────────

router.post('/:id/match-roles', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (!process.env.QWEN_API_KEY && !process.env.DASHSCOPE_API_KEY) return res.json({ ok: false, reason: 'no_api_key' });

    const caps = await prisma.capability.findMany({ where: { intakeId: intake.id }, orderBy: { position: 'asc' } });
    if (!caps.length) return res.json({ ok: false, reason: 'no_capabilities' });

    const [industries, sizes, depts] = await Promise.all([
      prisma.taxonomyIndustry.findMany({ where: { parentId: null }, orderBy: { displayOrder: 'asc' } }),
      Promise.resolve([]),
      Promise.resolve([]),
    ]);

    const validIndustryIds = new Set(industries.map(r => r.id));
    const taxonomyForPrompt = {
      industries: industries.map(r => ({ id: r.id, zh: r.nameZh, en: r.nameEn })),
      company_sizes: sizes.map(r => ({ id: r.id, zh: r.nameZh, en: r.nameEn })),
      departments: depts.map(r => ({ id: r.id, zh: r.nameZh, en: r.nameEn })),
    };

    const capList = caps.map(c => ({ rc_label: c.rcLabel, name: { zh: c.nameZh, en: c.nameEn }, description: { zh: c.descriptionZh, en: c.descriptionEn } }));
    const { blocks } = await buildMaterialsBlocks(intake.id, intake);

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'matching_roles' } });

    const ai = await callQwen({
      surface: 'match-roles', submissionId: intake.id,
      system: MATCH_ROLES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Valid taxonomy (use ONLY these IDs):\n' + JSON.stringify(taxonomyForPrompt, null, 2) + '\n\nCapabilities:\n' + JSON.stringify(capList, null, 2) + '\n\nMaterials follow:' },
        ...blocks,
      ]}],
      maxTokens: 3000, timeoutMs: 70_000,
    });
    if (!ai.ok) return res.json({ ok: false, reason: ai.reason || 'error', error: ai.error });

    const parsed = parseStrictJson(ai.text);
    if (!parsed?.roles?.length) return res.json({ ok: false, reason: 'parse_failed' });

    for (const r of parsed.roles) {
      r.industry = (r.industry || []).filter(x => validIndustryIds.has(x));
    }

    // Replace all rolepacks for this intake.
    await prisma.intakeRolepack.deleteMany({ where: { intakeId: intake.id } });
    const capByLabel = Object.fromEntries(caps.map(c => [c.rcLabel, c.id]));

    for (let i = 0; i < parsed.roles.length; i++) {
      const r = parsed.roles[i];
      const rpId = shortId('RP-', 8);
      const rpLabel = `RP-${String(i + 1).padStart(2, '0')}`;
      await prisma.intakeRolepack.create({ data: {
        id: rpId, intakeId: intake.id, rpLabel,
        nameZh: r.name?.zh || '', nameEn: r.name?.en || '',
        industryJson: r.industry || [], companySizeJson: r.company_size || [],
        departmentJson: r.department || { zh: '', en: '' }, position: i,
      }});
      const capIds = (r.capability_ids || []).map(lbl => capByLabel[lbl]).filter(Boolean);
      if (capIds.length) {
        await prisma.rolepackCapability.createMany({
          data: capIds.map((capId, j) => ({ rolepackId: rpId, capabilityId: capId, position: j })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'roles_ready' } });
    res.json({ ok: true, count: parsed.roles.length });
  } catch (err) { next(err); }
});

// ── Finalize (submit to curator queue) ───────────────────────────────────────

router.post('/:id/finalize', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const rolepacks = await prisma.intakeRolepack.findMany({ where: { intakeId: intake.id }, orderBy: { position: 'asc' } });
    if (!rolepacks.length) return res.json({ ok: false, reason: 'no_rolepacks' });

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'submitted', finalizedAt: new Date() } });
    await prisma.intakeRolepack.updateMany({ where: { intakeId: intake.id }, data: { status: 'submitted' } });

    res.json({ ok: true, count: rolepacks.length, rolepacks: rolepacks.map(r => ({ id: r.id, rp_label: r.rpLabel })) });
  } catch (err) { next(err); }
});

// ── AI: prefill rolepack questionnaire ───────────────────────────────────────

router.post('/:id/rolepacks/:rpId/prefill', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const rp = await prisma.intakeRolepack.findFirst({ where: { id: req.params.rpId, intakeId: intake.id } });
    if (!rp) return res.status(404).json({ error: 'not_found' });

    const force = req.query.force === '1';
    if (rp.questionnaireJson && !force) return res.json({ ok: true, skipped: true, questionnaire: rp.questionnaireJson });

    const caps = await prisma.rolepackCapability.findMany({
      where: { rolepackId: rp.id },
      include: { capability: true },
      orderBy: { position: 'asc' },
    });
    const { blocks } = await buildMaterialsBlocks(intake.id, intake);

    const roleBrief = {
      rp_label: rp.rpLabel, name: { zh: rp.nameZh, en: rp.nameEn },
      industry: rp.industryJson, company_size: rp.companySizeJson, department: rp.departmentJson,
      capabilities: caps.map(rc => ({ rc_label: rc.capability.rcLabel, name: { zh: rc.capability.nameZh, en: rc.capability.nameEn }, description: { zh: rc.capability.descriptionZh, en: rc.capability.descriptionEn } })),
    };

    const ai = await callQwen({
      surface: 'role-prefill', submissionId: intake.id, productId: rp.id,
      system: ROLE_PREFILL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Role brief:\n' + JSON.stringify(roleBrief, null, 2) + '\n\n---\n\nMaterials follow:' },
        ...blocks,
      ]}],
      maxTokens: 4000, timeoutMs: 70_000,
    });
    if (!ai.ok) return res.json({ ok: false, reason: ai.reason || 'error' });

    const parsed = parseStrictJson(ai.text);
    if (!parsed) return res.json({ ok: false, reason: 'parse_failed' });

    await prisma.intakeRolepack.update({ where: { id: rp.id }, data: { questionnaireJson: parsed } });
    res.json({ ok: true, questionnaire: parsed });
  } catch (err) { next(err); }
});

// ── AI: generate rolepack sales materials ────────────────────────────────────

router.post('/:id/rolepacks/:rpId/generate', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    const rp = await prisma.intakeRolepack.findFirst({ where: { id: req.params.rpId, intakeId: intake.id } });
    if (!rp) return res.status(404).json({ error: 'not_found' });

    const force = req.query.force === '1';
    if (rp.generatedJson && !force) return res.json({ ok: true, skipped: 'already_generated' });

    const caps = await prisma.rolepackCapability.findMany({
      where: { rolepackId: rp.id }, include: { capability: true }, orderBy: { position: 'asc' },
    });

    const brief = {
      rp_label: rp.rpLabel, name: { zh: rp.nameZh, en: rp.nameEn },
      industry: rp.industryJson, company_size: rp.companySizeJson, department: rp.departmentJson,
      capabilities: caps.map(rc => ({ rc_label: rc.capability.rcLabel, name: { zh: rc.capability.nameZh, en: rc.capability.nameEn }, description: { zh: rc.capability.descriptionZh, en: rc.capability.descriptionEn } })),
      questionnaire: rp.questionnaireJson || {},
      service_pricing: intake.servicePricingJson || {},
    };

    const ai = await callQwen({
      surface: 'role-finalize', submissionId: intake.id, productId: rp.id,
      system: ROLE_FINALIZE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: 'Role brief:\n' + JSON.stringify(brief, null, 2) }],
      maxTokens: 8000, timeoutMs: 80_000,
    });
    if (!ai.ok) return res.status(500).json({ ok: false, reason: ai.reason || 'error', error: ai.error });

    const parsed = parseStrictJson(ai.text);
    if (!parsed?.generated || !parsed?.materials) return res.status(500).json({ ok: false, reason: 'parse_failed' });

    await prisma.intakeRolepack.update({ where: { id: rp.id }, data: { generatedJson: parsed.generated, materialsDraftJson: parsed.materials } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── AI: copilot ───────────────────────────────────────────────────────────────

const COPILOT_FIELD_LABELS = {
  'profile.daily_activities':    { zh: '日常工作内容', en: 'Daily activities' },
  'profile.decision_maker':      { zh: '决策者', en: 'Decision maker' },
  'profile.decision_priorities': { zh: '决策者关注点', en: 'Decision priorities' },
  'pain.main_pain':              { zh: '主要痛点', en: 'Main pain' },
  'pain.current_workflow':       { zh: '现有处理方式', en: 'Current workflow' },
  'pain.quantified_value':       { zh: '量化效果', en: 'Quantified value' },
  'how_it_helps.workflow_integration': { zh: '能力如何嵌入', en: 'Workflow integration' },
  'how_it_helps.outcomes':       { zh: '上线后改变', en: 'Outcomes' },
  'how_it_helps.case_study':     { zh: '客户案例', en: 'Case study' },
  'deployment.deployment_mode':  { zh: '部署方式', en: 'Deployment mode' },
  'deployment.api_endpoint':     { zh: 'API 接入', en: 'API endpoint' },
};

router.post('/:id/rolepacks/:rpId/copilot', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'supplier' && req.user.role !== 'curator') return res.status(403).json({ error: 'forbidden' });
    const intake = await prisma.intake.findUnique({ where: { id: req.params.id } });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (req.user.role === 'supplier' && intake.supplierId !== req.user.supplierId) return res.status(403).json({ error: 'forbidden' });

    const rp = await prisma.intakeRolepack.findFirst({ where: { id: req.params.rpId, intakeId: req.params.id } });
    if (!rp) return res.status(404).json({ error: 'not_found' });

    const message = (req.body.message || '').trim();
    const dryrun = req.body.dryrun === true;
    if (!message) return res.status(400).json({ error: 'empty_message' });

    const questionnaire = rp.questionnaireJson || {};
    const stateLines = Object.entries(COPILOT_FIELD_LABELS).map(([dotKey, label]) => {
      const [section, field] = dotKey.split('.');
      const v = questionnaire[section]?.[field];
      const display = v ? (Array.isArray(v.value_zh) ? v.value_zh.join(' · ') : (v.value_zh || v.value_en || '')) : '';
      return `  ${dotKey} [${label.zh} / ${label.en}]: ${display ? `filled = "${String(display).slice(0, 60)}"` : 'empty'}`;
    });

    const userPrompt = `Role: ${rp.rpLabel} ${rp.nameZh}/${rp.nameEn}\n\nCurrent questionnaire state:\n\n${stateLines.join('\n')}\n\nLatest from supplier:\n\n${message}`;

    const ai = await callQwen({
      surface: 'copilot', submissionId: req.params.id, productId: rp.id,
      system: COPILOT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500, timeoutMs: 30_000,
    });
    if (!ai.ok) return res.json({ ok: false, reason: ai.reason, reply: 'AI temporarily unavailable.', updates: [] });

    const parsed = parseStrictJson(ai.text);
    if (!parsed) return res.json({ ok: false, reason: 'parse_failed', reply: '我理解你的输入了。', updates: [] });

    const applied = [];
    for (const upd of (parsed.fields_updated || [])) {
      const [section, field] = (upd.field_id || '').split('.');
      if (!section || !field || !COPILOT_FIELD_LABELS[upd.field_id]) continue;
      const display = Array.isArray(upd.value_zh) ? upd.value_zh.join(' · ') : (upd.value_zh || upd.value_en || '');
      if (!display) continue;
      if (!questionnaire[section]) questionnaire[section] = {};
      questionnaire[section][field] = { value_zh: upd.value_zh, value_en: upd.value_en, confidence: upd.confidence ?? null, source_quote: '', _state: upd.vague_followup_needed ? 'copilot_weak' : 'copilot_filled' };
      applied.push({ id: upd.field_id, label: COPILOT_FIELD_LABELS[upd.field_id], value: { zh: upd.value_zh, en: upd.value_en }, status: upd.vague_followup_needed ? 'weak' : 'filled', vague: upd.vague_followup_needed });
    }

    if (applied.length && !dryrun) {
      await prisma.intakeRolepack.update({ where: { id: rp.id }, data: { questionnaireJson: questionnaire } });
    }
    if (!dryrun) {
      await prisma.chatMessage.createMany({ data: [
        { rolepackId: rp.id, role: 'user', content: message },
        { rolepackId: rp.id, role: 'bot', content: parsed.reply || '', meta: { updates: applied.map(a => ({ id: a.id })) } },
      ]}).catch(() => {});
    }

    res.json({ ok: true, reply: parsed.reply, reply_lang: parsed.reply_lang, updates: applied, dryrun });
  } catch (err) { next(err); }
});

router.get('/:id/rolepacks/:rpId/copilot', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'supplier' && req.user.role !== 'curator') return res.status(403).json({ error: 'forbidden' });
    const intake = await prisma.intake.findUnique({ where: { id: req.params.id } });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (req.user.role === 'supplier' && intake.supplierId !== req.user.supplierId) return res.status(403).json({ error: 'forbidden' });

    const messages = await prisma.chatMessage.findMany({
      where: { rolepackId: req.params.rpId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({ items: messages.map(m => ({ role: m.role, content: m.content, created_at: m.createdAt })) });
  } catch (err) { next(err); }
});

export default router;
