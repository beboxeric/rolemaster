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

// ── Auth helper ──────────────────────────────────────────────────────────────

async function getOwnIntake(intakeId, supplierId) {
  const intake = await prisma.intake.findFirst({
    where: { id: intakeId, supplierId },
  });
  return intake;
}

// ── Intakes CRUD ─────────────────────────────────────────────────────────────

// GET /api/intakes
router.get('/', requireSupplier, async (req, res, next) => {
  try {
    const intakes = await prisma.intake.findMany({
      where: { supplierId: req.user.supplierId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(intakes);
  } catch (err) { next(err); }
});

// POST /api/intakes
router.post('/', requireSupplier, async (req, res, next) => {
  try {
    const { productId, productName } = req.body;
    if (!productId || !productName) return res.status(400).json({ error: 'productId and productName required' });

    const intake = await prisma.intake.create({
      data: {
        id: shortId('INT-', 10),
        supplierId: req.user.supplierId,
        productId,
        productName,
      },
    });
    res.status(201).json(intake);
  } catch (err) { next(err); }
});

// GET /api/intakes/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const where = req.user.role === 'curator'
      ? { id: req.params.id }
      : { id: req.params.id, supplierId: req.user.supplierId };

    const intake = await prisma.intake.findFirst({
      where,
      include: { fields: true, capabilities: { orderBy: { position: 'asc' } }, intakeRolepacks: { orderBy: { position: 'asc' } } },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    res.json(intake);
  } catch (err) { next(err); }
});

// PATCH /api/intakes/:id/fields — bulk upsert form fields
router.patch('/:id/fields', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const { fields } = req.body;
    if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields must be an array' });

    await Promise.all(fields.map(f =>
      prisma.intakeField.upsert({
        where: { intakeId_fieldId: { intakeId: intake.id, fieldId: f.fieldId } },
        update: { valueZh: f.valueZh ?? null, valueEn: f.valueEn ?? null, status: 'filled' },
        create: {
          intakeId: intake.id,
          fieldId: f.fieldId,
          section: f.section ?? 1,
          labelZh: f.labelZh ?? '',
          labelEn: f.labelEn ?? '',
          valueZh: f.valueZh ?? null,
          valueEn: f.valueEn ?? null,
          status: 'filled',
        },
      })
    ));
    await prisma.intake.update({ where: { id: intake.id }, data: { updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/intakes/:id/submit
router.post('/:id/submit', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (intake.status !== 'draft' && intake.status !== 'roles_ready') {
      return res.status(409).json({ error: 'cannot_submit', status: intake.status });
    }
    await prisma.intake.update({
      where: { id: intake.id },
      data: { status: 'new', submittedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Capabilities ─────────────────────────────────────────────────────────────

// GET /api/intakes/:id/capabilities
router.get('/:id/capabilities', requireAuth, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake && req.user.role !== 'curator') return res.status(404).json({ error: 'not_found' });

    const capabilities = await prisma.capability.findMany({
      where: { intakeId: req.params.id },
      orderBy: { position: 'asc' },
    });
    res.json(capabilities);
  } catch (err) { next(err); }
});

// POST /api/intakes/:id/capabilities — add a capability
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
    res.status(201).json({ ok: true, id: cap.id, rcLabel });
  } catch (err) { next(err); }
});

// PATCH /api/intakes/:id/capabilities — bulk update or confirm_all
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
      if (Object.keys(data).length === 0) return Promise.resolve();
      return prisma.capability.updateMany({ where: { id: u.id, intakeId: intake.id }, data });
    }));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/intakes/:id/capabilities/:capId
router.delete('/:id/capabilities/:capId', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    await prisma.capability.deleteMany({ where: { id: req.params.capId, intakeId: intake.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Intake Rolepacks (draft roles) ────────────────────────────────────────────

// GET /api/intakes/:id/rolepacks
router.get('/:id/rolepacks', requireAuth, async (req, res, next) => {
  try {
    const rolepacks = await prisma.intakeRolepack.findMany({
      where: { intakeId: req.params.id },
      include: { capabilities: { include: { capability: true }, orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
    res.json(rolepacks);
  } catch (err) { next(err); }
});

// POST /api/intakes/:id/rolepacks — create a draft rolepack
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

    res.status(201).json({ ok: true, id: rp.id, rpLabel });
  } catch (err) { next(err); }
});

// PATCH /api/intakes/:id/rolepacks/:rpId
router.patch('/:id/rolepacks/:rpId', requireAuth, async (req, res, next) => {
  try {
    // Supplier: own intake only. Curator: any.
    if (req.user.role === 'supplier') {
      const intake = await getOwnIntake(req.params.id, req.user.supplierId);
      if (!intake) return res.status(404).json({ error: 'not_found' });
    }

    const { name, industry, company_size, department, questionnaire, capability_ids, position, rp_label } = req.body;
    const data = {};
    if (name) { data.nameZh = name.zh ?? ''; data.nameEn = name.en ?? ''; }
    if (Array.isArray(industry)) data.industryJson = industry;
    if (Array.isArray(company_size)) data.companySizeJson = company_size;
    if (department != null) data.departmentJson = department;
    if (questionnaire != null) data.questionnaireJson = questionnaire;
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

// DELETE /api/intakes/:id/rolepacks/:rpId
router.delete('/:id/rolepacks/:rpId', requireSupplier, async (req, res, next) => {
  try {
    const intake = await getOwnIntake(req.params.id, req.user.supplierId);
    if (!intake) return res.status(404).json({ error: 'not_found' });
    await prisma.intakeRolepack.deleteMany({ where: { id: req.params.rpId, intakeId: intake.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Files ─────────────────────────────────────────────────────────────────────

function kindFor(filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'doc';
  if (['m4a', 'mp3', 'wav', 'ogg'].includes(ext)) return 'voice';
  return 'other';
}

// GET /api/intakes/:id/files
router.get('/:id/files', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'supplier') {
      const intake = await getOwnIntake(req.params.id, req.user.supplierId);
      if (!intake) return res.status(404).json({ error: 'not_found' });
    }
    const files = await prisma.intakeFile.findMany({
      where: { intakeId: req.params.id },
      select: { id: true, kind: true, filename: true, displayName: true, sizeBytes: true, rolepackId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ files });
  } catch (err) { next(err); }
});

// POST /api/intakes/:id/files — multipart upload
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
        data: {
          id: fid,
          intakeId: intake.id,
          kind,
          filename: safeName,
          sizeBytes: f.size,
          storageKey: key,
          rolepackId,
          extractedText,
        },
      });
      stored.push({ id: fid, kind, filename: safeName, size: f.size });
    }

    await prisma.intake.update({ where: { id: intake.id }, data: { updatedAt: new Date() } });
    res.json({ files: stored });
  } catch (err) { next(err); }
});

// DELETE /api/intakes/:id/files/:fid
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
