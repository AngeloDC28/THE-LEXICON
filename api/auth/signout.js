import { sql } from '../../lib/db.js';
import { hashToken } from '../../lib/tokens.js';
import { clearSessionCookie } from '../../lib/session.js';

export default async function handler(req, res) {
  const m = (req.headers.cookie || '').match(/lx_session=([A-Za-z0-9_-]+)/);
  if (m) {
    try {
      await sql`delete from sessions where token_hash = ${hashToken(m[1])}`;
    } catch (e) {
      console.error('[auth/signout]', e);
    }
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}
