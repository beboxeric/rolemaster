// Curator-only routes.
// GET  /api/curator/intakes         — list all submissions in review queue
// GET  /api/curator/intakes/:id     — get full submission detail
// POST /api/curator/intakes/:id/decision  — approve / revision / hold
// POST /api/curator/rolepacks/:rpId/publish  — publish a rolepack
// TODO: reorder, feature, industry edit, supplier/user management
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireCurator } from '../middleware/auth.js';

const router = Router();

router.use(requireCurator);

// GET /api/curator/intakes
router.get('/intakes', async (req, res, next) => {
  try {
    const intakes = await prisma.submission.findMany({
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
    const intake = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { fields: true, layerAtoms: true, generated: true, comments: true },
    });
    if (!intake) return res.status(404).json({ error: 'not_found' });
    res.json(intake);
  } catch (err) { next(err); }
});

// POST /api/curator/intakes/:id/decision
router.post('/intakes/:id/decision', async (req, res, next) => {
  try {
    const { decision, noteZh, noteEn } = req.body; // decision: approved|revision|held
    const allowed = ['approved', 'revision', 'held'];
    if (!allowed.includes(decision)) return res.status(400).json({ error: 'invalid decision' });

    const intake = await prisma.submission.findUnique({ where: { id: req.params.id } });
    if (!intake) return res.status(404).json({ error: 'not_found' });

    const statusMap = { approved: 'approved', revision: 'revision', held: 'review' };
    await prisma.submission.update({
      where: { id: req.params.id },
      data: { status: statusMap[decision] },
    });

    await prisma.auditLog.create({
      data: {
        submissionId: req.params.id,
        who: req.user.email,
        actionZh: noteZh ?? decision,
        actionEn: noteEn ?? decision,
      },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/curator/rolepacks
router.get('/rolepacks', async (req, res, next) => {
  try {
    const rolepacks = await prisma.rolepack.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json(rolepacks);
  } catch (err) { next(err); }
});

export default router;
