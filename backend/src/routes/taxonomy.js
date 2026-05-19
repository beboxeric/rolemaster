// Taxonomy routes — industry hierarchy.
// GET /api/taxonomy/industries
// GET /api/taxonomy/industries/:id
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/industries', async (req, res, next) => {
  try {
    const industries = await prisma.taxonomyIndustry.findMany({
      orderBy: [{ displayOrder: 'asc' }, { nameEn: 'asc' }],
    });
    res.json(industries);
  } catch (err) { next(err); }
});

router.get('/industries/:id', async (req, res, next) => {
  try {
    const industry = await prisma.taxonomyIndustry.findUnique({ where: { id: req.params.id } });
    if (!industry) return res.status(404).json({ error: 'not_found' });
    res.json(industry);
  } catch (err) { next(err); }
});

export default router;
