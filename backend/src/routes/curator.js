// Curator-only routes.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireCurator } from '../middleware/auth.js';
import { shortId } from '../lib/id.js';

const router = Router();
router.use(requireCurator);

// ── Intake Queue ──────────────────────────────────────────────────────────────

// GET /api/curator/intakes
router.get('/intakes', async (req, res, next) => {
  try {
    const intakes = await prisma.intake.findMany({
      where: { status: { in: ['new', 'review', 'revision', 'approved'] } },
      include: { supplier: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(intakes);
  } catch (err) { next(err); }
});

// GET /api/curator/intakes/:id
router.get('/intakes/:id', async (req, res, next) => {
  try {
    const intake = await prisma.intake.findUnique({
      where: { id: req.params.id },
      include: {
        fields: true,
        capabilities: { orderBy: { position: 'asc' } },
        intakeRolepacks: {
          include: { capabilities: { include: { capability: true }, orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        },
        generated: true,
        comments: { orderBy: { createdAt: 'asc' } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        supplier: true,
      },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    res.json(intake);
  } catch (err) { next(err); }
});

// POST /api/curator/intakes/:id/decision
router.post('/intakes/:id/decision', async (req, res, next) => {
  try {
    const { decision, noteZh, noteEn } = req.body;
    const statusMap = { approved: 'approved', revision: 'revision', held: 'review' };
    if (!statusMap[decision]) return res.status(400).json({ error: 'invalid decision' });

    const intake = await prisma.intake.findUnique({ where: { id: req.params.id } });
    if (!intake) return res.status(404).json({ error: 'not_found' });

    await prisma.intake.update({ where: { id: req.params.id }, data: { status: statusMap[decision] } });
    await prisma.auditLog.create({
      data: {
        intakeId: req.params.id,
        who: req.user.email,
        actionZh: noteZh ?? decision,
        actionEn: noteEn ?? decision,
      },
    });

    // Notify supplier of revision/approval
    if (decision === 'revision' || decision === 'approved') {
      const supplier = await prisma.user.findFirst({ where: { supplierId: intake.supplierId } });
      if (supplier) {
        await prisma.notification.create({
          data: {
            id: shortId('NTF-', 10),
            userId: supplier.id,
            type: decision === 'approved' ? 'submission_approved' : 'submission_revision',
            payloadJson: { intakeId: intake.id, productName: intake.productName },
          },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Rolepack Publishing ───────────────────────────────────────────────────────

// GET /api/curator/rolepacks
router.get('/rolepacks', async (req, res, next) => {
  try {
    const rolepacks = await prisma.rolepack.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json(rolepacks);
  } catch (err) { next(err); }
});

// POST /api/curator/intakes/:id/publish-all
// Takes all approved IntakeRolepacks and publishes them to the catalog.
router.post('/intakes/:id/publish-all', async (req, res, next) => {
  try {
    const intake = await prisma.intake.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        intakeRolepacks: {
          where: { status: { not: 'published' } },
          include: { capabilities: { include: { capability: true } } },
        },
      },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (intake.status !== 'approved') return res.status(409).json({ error: 'intake_not_approved' });

    const published = [];
    for (const rp of intake.intakeRolepacks) {
      const rpId = shortId('PUB-', 10);
      await prisma.rolepack.create({
        data: {
          id: rpId,
          supplierId: intake.supplierId,
          supplierName: intake.supplier.name,
          data: {
            rpLabel: rp.rpLabel,
            nameZh: rp.nameZh,
            nameEn: rp.nameEn,
            industry: rp.industryJson,
            companySize: rp.companySizeJson,
            department: rp.departmentJson,
            capabilities: rp.capabilities.map(rc => ({
              rcLabel: rc.capability.rcLabel,
              nameZh: rc.capability.nameZh,
              nameEn: rc.capability.nameEn,
              descriptionZh: rc.capability.descriptionZh,
              descriptionEn: rc.capability.descriptionEn,
            })),
            ...(rp.generatedJson ?? {}),
          },
        },
      });
      await prisma.intakeRolepack.update({ where: { id: rp.id }, data: { status: 'published' } });
      published.push(rpId);
    }

    await prisma.intake.update({ where: { id: intake.id }, data: { status: 'published' } });

    // Notify supplier
    const supplierUser = await prisma.user.findFirst({ where: { supplierId: intake.supplierId } });
    if (supplierUser) {
      await prisma.notification.create({
        data: {
          id: shortId('NTF-', 10),
          userId: supplierUser.id,
          type: 'submission_published',
          payloadJson: { intakeId: intake.id, productName: intake.productName, rolepackCount: published.length },
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        intakeId: intake.id,
        who: req.user.email,
        actionZh: `发布了 ${published.length} 个岗位包`,
        actionEn: `Published ${published.length} rolepack(s)`,
      },
    });

    res.json({ ok: true, published });
  } catch (err) { next(err); }
});

// ── Supplier & User Management ────────────────────────────────────────────────

// GET /api/curator/suppliers
router.get('/suppliers', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: { _count: { select: { intakes: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(suppliers);
  } catch (err) { next(err); }
});

// GET /api/curator/suppliers/:id
router.get('/suppliers/:id', async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: { intakes: { orderBy: { updatedAt: 'desc' } }, users: { select: { id: true, name: true, email: true } } },
    });
    if (!supplier) return res.status(404).json({ error: 'not_found' });
    res.json(supplier);
  } catch (err) { next(err); }
});

// GET /api/curator/users
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, supplierId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// PATCH /api/curator/users/:id
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { role, isSuper } = req.body;
    const data = {};
    if (role && ['supplier', 'curator', 'sales'].includes(role)) data.role = role;
    if (typeof isSuper === 'boolean') data.isSuper = isSuper;
    if (!Object.keys(data).length) return res.status(400).json({ error: 'nothing to update' });
    await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Intake Comments ───────────────────────────────────────────────────────────

// POST /api/curator/intakes/:id/comments
router.post('/intakes/:id/comments', async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });

    const intake = await prisma.intake.findUnique({ where: { id: req.params.id } });
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const comment = await prisma.intakeComment.create({
      data: {
        id: shortId('CMT-', 10),
        intakeId: intake.id,
        authorId: req.user.id,
        authorRole: 'curator',
        authorName: req.user.name,
        body: body.trim(),
      },
    });
    res.status(201).json(comment);
  } catch (err) { next(err); }
});

export default router;
