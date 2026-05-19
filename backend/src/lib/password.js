// PBKDF2 — compatible with the original Cloudflare Workers implementation.
// Same algorithm (SHA-256, 100k iterations, 32-byte output, hex encoding),
// so passwords from the old D1 database verify correctly here.
import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256')
    .toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const derived = crypto
    .pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256')
    .toString('hex');
  return derived === hash;
}
