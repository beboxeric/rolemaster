// GET  /api/notifications          — current user's notifications
// POST /api/notifications/mark-read — mark one or all as read
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const onlyUnread = req.query.unread === '1';
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id, ...(onlyUnread ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const items = notifications.map(n => ({
      id: n.id,
      type: n.type,
      payload: n.payloadJson,
      read: !!n.readAt,
      createdAt: n.createdAt,
    }));
    res.json({ items, unread: items.filter(i => !i.read).length });
  } catch (err) { next(err); }
});

router.post('/mark-read', async (req, res, next) => {
  try {
    const { id } = req.body; // specific id, or omit to mark all read
    if (id) {
      await prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { readAt: new Date() } });
    } else {
      await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
