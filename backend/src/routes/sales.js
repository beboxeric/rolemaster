// Sales routes.
// GET /api/sales/rolepacks    — list published rolepacks (with filters)
// GET /api/sales/rolepacks/:id
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireSales } from '../middleware/auth.js';

const router = Router();

router.use(requireSales);

// GET /api/sales/rolepacks
router.get('/rolepacks', async (req, res, next) => {
  try {
    const rolepacks = await prisma.rolepack.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json(rolepacks);
  } catch (err) { next(err); }
});

// GET /api/sales/rolepacks/:id
router.get('/rolepacks/:id', async (req, res, next) => {
  try {
    const rp = await prisma.rolepack.findUnique({ where: { id: req.params.id } });
    if (!rp) return res.status(404).json({ error: 'not_found' });
    res.json(rp);
  } catch (err) { next(err); }
});

export default router;
