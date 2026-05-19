import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken, setTokenCookie, clearTokenCookie } from '../lib/jwt.js';
import { shortId } from '../lib/id.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role = 'supplier' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    if (!['supplier', 'curator', 'sales'].includes(role)) {
      return res.status(400).json({ error: 'invalid role' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'email_taken' });

    const { hash, salt } = hashPassword(password);
    const userId = shortId('USR-', 10);

    let supplierId = null;
    if (role === 'supplier') {
      supplierId = shortId('SUP-', 10);
      await prisma.supplier.create({
        data: {
          id: supplierId,
          name,
          shortName: name.slice(0, 20),
          hq: '',
        },
      });
    }

    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        password: hash,
        salt,
        name,
        role,
        supplierId,
      },
    });

    const token = signToken(user);
    setTokenCookie(res, token);
    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplierId } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = verifyPassword(password, user.password, user.salt);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const token = signToken(user);
    setTokenCookie(res, token);
    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplierId } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearTokenCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, supplierId: user.supplierId, language: user.language });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me/language
router.patch('/me/language', requireAuth, async (req, res, next) => {
  try {
    const { language } = req.body;
    if (!['zh', 'en'].includes(language)) return res.status(400).json({ error: 'invalid language' });
    await prisma.user.update({ where: { id: req.user.id }, data: { language } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
