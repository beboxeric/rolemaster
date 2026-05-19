// Supplier-side intake (submission) routes.
// GET  /api/intakes               — list own intakes
// POST /api/intakes               — create new intake
// GET  /api/intakes/:id           — get single intake
// PATCH /api/intakes/:id/fields   — bulk update fields
// POST /api/intakes/:id/submit    — submit for review
// TODO: capabilities, rolepacks, files, copilot sub-routes
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireSupplier } from '../middleware/auth.js';
import { shortId } from '../lib/id.js';

const router = Router();

router.use(requireSupplier);

// GET /api/intakes
router.get('/', async (req, res, next) => {
  try {
    const intakes = await prisma.submission.findMany({
      where: { supplierId: req.user.supplierId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(intakes);
  } catch (err) { next(err); }
});

// POST /api/intakes
router.post('/', async (req, res, next) => {
  try {
    const { productId, productName } = req.body;
    if (!productId || !productName) return res.status(400).json({ error: 'productId and productName required' });

    const intake = await prisma.submission.create({
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
router.get('/:id', async (req, res, next) => {
  try {
    const intake = await prisma.submission.findFirst({
      where: { id: req.params.id, supplierId: req.user.supplierId },
      include: { fields: true },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    res.json(intake);
  } catch (err) { next(err); }
});

// PATCH /api/intakes/:id/fields — bulk upsert fields
router.patch('/:id/fields', async (req, res, next) => {
  try {
    const { fields } = req.body; // [{ fieldId, valueZh, valueEn }]
    if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields must be an array' });

    const intake = await prisma.submission.findFirst({
      where: { id: req.params.id, supplierId: req.user.supplierId },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });

    await Promise.all(fields.map(f =>
      prisma.submissionField.upsert({
        where: { submissionId_fieldId: { submissionId: intake.id, fieldId: f.fieldId } },
        update: { valueZh: f.valueZh, valueEn: f.valueEn, status: 'filled' },
        create: {
          submissionId: intake.id,
          fieldId: f.fieldId,
          section: f.section ?? 1,
          labelZh: f.labelZh ?? '',
          labelEn: f.labelEn ?? '',
          valueZh: f.valueZh,
          valueEn: f.valueEn,
          status: 'filled',
        },
      })
    ));

    await prisma.submission.update({ where: { id: intake.id }, data: { updatedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/intakes/:id/submit
router.post('/:id/submit', async (req, res, next) => {
  try {
    const intake = await prisma.submission.findFirst({
      where: { id: req.params.id, supplierId: req.user.supplierId },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    if (intake.status !== 'draft') return res.status(409).json({ error: 'already_submitted' });

    await prisma.submission.update({
      where: { id: intake.id },
      data: { status: 'new', submittedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
