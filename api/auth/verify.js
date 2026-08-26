import { sql } from '../../lib/db.js';
import { hashToken } from '../../lib/tokens.js';
import { createSession, sessionCookie } from '../../lib/session.js';

export default async function handler(req, res) {
  const origin = process.env.APP_ORIGIN || 'https://thelexicon.xyz';
  const { token, next } = req.query;

  if (!token) {
    return res.redirect(302, `${origin}/?auth=missing`);
  }

  let rows;
  try {
    rows = await sql`
      select id, user_id from auth_tokens
      where token_hash = ${hashToken(token)}
        and expires_at > now()
        and used_at is null
      limit 1`;
  } catch (e) {
    console.error('[auth/verify] db error', e);
    return res.redirect(302, `${origin}/?auth=error`);
  }

  if (!rows[0]) {
    return res.redirect(302, `${origin}/?auth=expired`);
  }

  // Mark token as used (one-time guarantee)
  await sql`update auth_tokens set used_at = now() where id = ${rows[0].id}`;
  await sql`update users set last_login = now() where id = ${rows[0].user_id}`;

  const rawSession = await createSession(rows[0].user_id);
  res.setHeader('Set-Cookie', sessionCookie(rawSession));

  const dest = (typeof next === 'string' && next.startsWith('/')) ? next : '/';
  return res.redirect(302, `${origin}${dest}${dest.includes('?') ? '&' : '?'}auth=ok`);
}
