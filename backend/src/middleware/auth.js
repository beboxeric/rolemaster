import { verifyToken, COOKIE_NAME } from '../lib/jwt.js';

const SUPERADMIN_EMAILS = new Set([
  'hello@rolemaster.io',
  'demo-admin@airolemaster.com',
  'demo-curator@airolemaster.com',
]);

function isSuperadminEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  return SUPERADMIN_EMAILS.has(e) || e.startsWith('admin@');
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return req.cookies?.[COOKIE_NAME] || null;
}

// Requires a valid JWT. Attaches req.user.
export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      supplierId: payload.sup ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Requires curator role.
export function requireCurator(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'curator') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}

// Requires sales role.
export function requireSales(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'sales') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}

// Requires supplier role (with optional superadmin impersonation).
export function requireSupplier(req, res, next) {
  requireAuth(req, res, () => {
    const impersonate = req.headers['x-impersonate-supplier'];
    if (impersonate && isSuperadminEmail(req.user.email)) {
      req.user = { ...req.user, role: 'supplier', supplierId: impersonate };
      return next();
    }
    if (req.user.role !== 'supplier') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}
