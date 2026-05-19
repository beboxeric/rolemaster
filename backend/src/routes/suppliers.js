// Supplier self-service routes.
// GET  /api/suppliers/me/company-info
// PATCH /api/suppliers/me/company-info
// GET  /api/suppliers/me/products
// POST /api/suppliers/me/products
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireSupplier } from '../middleware/auth.js';
import { shortId } from '../lib/id.js';

const router = Router();
router.use(requireSupplier);

// GET /api/suppliers/me/company-info
router.get('/me/company-info', async (req, res, next) => {
  try {
    const info = await prisma.supplierCompanyInfo.findUnique({
      where: { supplierId: req.user.supplierId },
    });
    res.json(info ?? {});
  } catch (err) { next(err); }
});

// PATCH /api/suppliers/me/company-info
router.patch('/me/company-info', async (req, res, next) => {
  try {
    const fields = [
      'companyNameZh', 'companyNameEn',
      'companyHqZh', 'companyHqEn',
      'companyFoundedZh', 'companyFoundedEn',
      'companyTeamZh', 'companyTeamEn',
      'companyClientsZh', 'companyClientsEn',
    ];
    const data = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }

    await prisma.supplierCompanyInfo.upsert({
      where: { supplierId: req.user.supplierId },
      update: data,
      create: { supplierId: req.user.supplierId, ...data },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/suppliers/me/products
router.get('/me/products', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { supplierId: req.user.supplierId, archived: false },
      orderBy: { position: 'asc' },
    });
    res.json(products);
  } catch (err) { next(err); }
});

// POST /api/suppliers/me/products
router.post('/me/products', async (req, res, next) => {
  try {
    const { name, subtitleZh, subtitleEn } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const existing = await prisma.product.findMany({
      where: { supplierId: req.user.supplierId },
      select: { position: true },
    });
    const nextPos = existing.reduce((m, p) => Math.max(m, p.position), -1) + 1;

    const product = await prisma.product.create({
      data: {
        id: shortId('PRD-', 8),
        supplierId: req.user.supplierId,
        name,
        subtitleZh: subtitleZh ?? null,
        subtitleEn: subtitleEn ?? null,
        position: nextPos,
      },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

// PATCH /api/suppliers/me/products/:id
router.patch('/me/products/:id', async (req, res, next) => {
  try {
    const { name, subtitleZh, subtitleEn, archived } = req.body;
    const data = {};
    if (name) data.name = name;
    if (subtitleZh !== undefined) data.subtitleZh = subtitleZh;
    if (subtitleEn !== undefined) data.subtitleEn = subtitleEn;
    if (typeof archived === 'boolean') data.archived = archived;
    await prisma.product.updateMany({
      where: { id: req.params.id, supplierId: req.user.supplierId },
      data,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
