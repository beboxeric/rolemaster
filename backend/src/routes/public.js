// Public routes — no auth required. Used by the marketing landing page.
// GET /api/public/rolepacks
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/rolepacks', async (req, res, next) => {
  try {
    const rolepacks = await prisma.rolepack.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json(rolepacks);
  } catch (err) { next(err); }
});

export default router;
