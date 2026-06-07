import { sql } from './db.js';
import { generateToken, hashToken } from './tokens.js';

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export async function createSession(userId) {
  const raw = generateToken();
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${hashToken(raw)}, now() + interval '30 days')`;
  return raw;
}

export function sessionCookie(raw) {
  return `lx_session=${raw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS}`;
}

export function clearSessionCookie() {
  return `lx_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function getUserFromRequest(req) {
  const m = (req.headers.cookie || '').match(/lx_session=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const rows = await sql`
    select u.id, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashToken(m[1])}
      and s.expires_at > now()
    limit 1`;
  return rows[0] || null;
}
