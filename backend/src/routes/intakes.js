// Supplier-side intake routes.
// All routes require supplier role.
import { Router } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import { requireSupplier, requireAuth } from '../middleware/auth.js';
import { shortId } from '../lib/id.js';
import { uploadFile, deleteFile } from '../lib/storage.js';

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

export default router;
