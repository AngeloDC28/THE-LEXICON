import { sql } from '../../lib/db.js';
import { getUserFromRequest, clearSessionCookie } from '../../lib/session.js';
import { isValidEmail } from '../../lib/tokens.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let user;
  try {
    user = await getUserFromRequest(req);
  } catch (e) {
    console.error('[auth/delete] session lookup', e);
    return res.status(500).json({ error: 'server_error' });
  }

  if (!user) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const { email } = req.body || {};
  if (!isValidEmail(email) || email.toLowerCase().trim() !== user.email) {
    return res.status(400).json({ error: 'email_mismatch' });
  }

  try {
    // Cascades to auth_tokens, sessions, folders, folder_entries
    await sql`delete from users where id = ${user.id}`;
  } catch (e) {
    console.error('[auth/delete] delete user', e);
    return res.status(500).json({ error: 'delete_failed' });
  }

  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}
