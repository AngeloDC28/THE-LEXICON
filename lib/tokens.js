import crypto from 'node:crypto';

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
export function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
