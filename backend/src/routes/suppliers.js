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

const SCOPED_FIELDS = ['company_name', 'company_hq', 'company_team', 'company_founded', 'company_clients'];
const SINGLE_FIELDS = ['website', 'contact_name', 'contact_phone', 'contact_email'];

function serializeCompanyInfo(row) {
  const out = {};
  for (const fid of SCOPED_FIELDS) {
    const zhKey = fid.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'Zh';
    const enKey = fid.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) + 'En';
    out[fid] = { zh: row?.[zhKey] || '', en: row?.[enKey] || '' };
  }
  out.website = row?.website || '';
  out.contact_name = row?.contactName || '';
  out.contact_phone = row?.contactPhone || '';
  out.contact_email = row?.contactEmail || '';
  return out;
}

// GET /api/suppliers/me/company-info
router.get('/me/company-info', async (req, res, next) => {
  try {
    const info = await prisma.supplierCompanyInfo.findUnique({
      where: { supplierId: req.user.supplierId },
    });
    res.json({ company: serializeCompanyInfo(info) });
  } catch (err) { next(err); }
});

// PATCH /api/suppliers/me/company-info
router.patch('/me/company-info', async (req, res, next) => {
  try {
    const updates = req.body.updates || {};
    const data = {};

    for (const fid of SCOPED_FIELDS) {
      if (!(fid in updates)) continue;
      const v = updates[fid];
      const zh = (typeof v === 'object' ? v.zh : v) || '';
      const en = (typeof v === 'object' ? v.en : v) || '';
      const base = fid.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      data[base + 'Zh'] = zh;
      data[base + 'En'] = en;
    }
    if ('website' in updates) data.website = updates.website || '';
    if ('contact_name' in updates) data.contactName = updates.contact_name || '';
    if ('contact_phone' in updates) data.contactPhone = updates.contact_phone || '';
    if ('contact_email' in updates) data.contactEmail = updates.contact_email || '';

    await prisma.supplierCompanyInfo.upsert({
      where: { supplierId: req.user.supplierId },
      update: data,
      create: { supplierId: req.user.supplierId, ...data },
    });
    res.json({ ok: true, updated: Object.keys(data).length });
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
