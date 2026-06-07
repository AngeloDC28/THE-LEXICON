import { sql } from '../../lib/db.js';
import { generateToken, hashToken, isValidEmail } from '../../lib/tokens.js';
import { sendMagicLink } from '../../lib/email.js';

// In-memory rate limit: one link per email per 30s. Resets on cold start.
const recent = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { email, next } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const key = email.toLowerCase().trim();
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < 30_000) {
    return res.status(429).json({ error: 'too_soon', retryAfter: Math.ceil((30_000 - (now - last)) / 1000) });
  }
  recent.set(key, now);

  // Prune old entries occasionally
  if (recent.size > 10_000) {
    const cutoff = now - 60_000;
    for (const [k, t] of recent) if (t < cutoff) recent.delete(k);
  }

  const safeNext = (typeof next === 'string' && next.startsWith('/')) ? next : '/';

  try {
    const users = await sql`
      insert into users (email) values (${key})
      on conflict (email) do update set email = excluded.email
      returning id`;

    const raw = generateToken();
    await sql`
      insert into auth_tokens (user_id, token_hash, expires_at)
      values (${users[0].id}, ${hashToken(raw)}, now() + interval '15 minutes')`;

    await sendMagicLink(key, raw, safeNext);

    // Always 200 — never reveal whether an email exists (prevents enumeration)
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[auth/request]', e);
    return res.status(500).json({ error: 'send_failed' });
  }
}
